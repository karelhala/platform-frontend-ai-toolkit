import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, JiraContext } from "../types";

const CreateIssueSchema = z.object({
  fields: z.record(z.any()).describe("Issue fields. Required: project (object with key or id), summary (string), issuetype (object with name or id). Optional: description, assignee, priority, labels, customfield_*, etc.")
});

export function createIssueTool(context: JiraContext): McpTool {
  return [
    "create_jira_issue",
    {
      description: "Create a new JIRA issue. Requires project, summary, and issue type. Can include description, assignee, priority, labels, custom fields, and more. Returns the created issue key and details.",
      inputSchema: CreateIssueSchema
    },
    async (args) => {
      try {
        const { fields } = args as z.infer<typeof CreateIssueSchema>;

        // Validate required fields
        if (!fields.project) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required field: project (must be object with 'key' or 'id')"
          );
        }
        if (!fields.summary) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required field: summary (must be a string)"
          );
        }
        if (!fields.issuetype) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required field: issuetype (must be object with 'name' or 'id')"
          );
        }

        // Create issue via JIRA API
        const url = `${context.baseUrl}/rest/api/2/issue`;
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${context.apiToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to create JIRA issue: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        const createdIssue = await response.json() as any;

        // Return the created issue details
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Issue created successfully",
                issueKey: createdIssue.key,
                issueId: createdIssue.id,
                issueUrl: `${context.baseUrl}/browse/${createdIssue.key}`,
                self: createdIssue.self
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
          `Error creating JIRA issue: ${(error as Error).message}`
        );
      }
    }
  ];
}
