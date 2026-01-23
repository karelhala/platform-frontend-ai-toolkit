import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, JiraContext } from "../types";

const GetCommentsSchema = z.object({
  issueKey: z.string().describe("The JIRA issue key (e.g., 'RHCLOUD-12345')"),
  maxResults: z.number().optional().describe("Maximum number of comments to return (default: 50, max: 100)")
});

const AddCommentSchema = z.object({
  issueKey: z.string().describe("The JIRA issue key to add the comment to (e.g., 'RHCLOUD-12345')"),
  comment: z.string().describe("The comment text to add to the issue")
});

export function getIssueCommentsTool(context: JiraContext): McpTool {
  return [
    "get_jira_issue_comments",
    {
      description: "Get comments from a JIRA issue. Returns all comments with author, creation time, and comment body.",
      inputSchema: GetCommentsSchema
    },
    async (args) => {
      try {
        const { issueKey, maxResults = 50 } = args as z.infer<typeof GetCommentsSchema>;

        // Limit maxResults to 100
        const limit = Math.min(maxResults, 100);

        // Fetch comments from JIRA API
        const url = `${context.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment?maxResults=${limit}`;
        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${context.apiToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get JIRA issue comments: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        const commentResult = await response.json() as any;

        // Comments endpoint returns { comments: [...], total: number }
        if (!commentResult.comments || commentResult.comments.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  issueKey,
                  total: 0,
                  comments: []
                }, null, 2)
              }
            ]
          };
        }

        // Return the raw response data as JSON
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                issueKey,
                total: commentResult.total || commentResult.comments.length,
                maxResults: limit,
                comments: commentResult.comments
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error getting JIRA issue comments: ${(error as Error).message}`
        );
      }
    }
  ];
}

export function addIssueCommentTool(context: JiraContext): McpTool {
  return [
    "add_jira_issue_comment",
    {
      description: "Add a comment to a JIRA issue. Posts a new comment with the provided text.",
      inputSchema: AddCommentSchema
    },
    async (args) => {
      try {
        const { issueKey, comment } = args as z.infer<typeof AddCommentSchema>;

        // Post comment to JIRA API
        const url = `${context.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/comment`;
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${context.apiToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: comment
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to add comment to JIRA issue: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        const addedComment = await response.json() as any;

        // Return the created comment data
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                issueKey,
                success: true,
                comment: addedComment
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error adding comment to JIRA issue: ${(error as Error).message}`
        );
      }
    }
  ];
}
