import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, JiraContext } from "../types";

const GetIssueDetailsSchema = z.object({
  issueKey: z.string().describe("The JIRA issue key (e.g., 'RHCLOUD-12345')")
});

export function getIssueDetailsTool(context: JiraContext): McpTool {
  return [
    "get_jira_issue_details",
    {
      description: "Get comprehensive details for a specific JIRA issue. Returns all fields including description, attachments, subtasks, links, and available transitions. Use this when working on a specific issue and need full information. Note: For comments use get_jira_issue_comments tool instead.",
      inputSchema: GetIssueDetailsSchema
    },
    async (args) => {
      try {
        const { issueKey } = args as z.infer<typeof GetIssueDetailsSchema>;

        // Fetch full issue details from JIRA API with expanded fields
        // Note: Excludes comments and changelog - use dedicated tools for those
        const url = `${context.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}?expand=renderedFields,names,schema,transitions,operations,editmeta`;
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
            `Failed to get JIRA issue details: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        const issue = await response.json() as any;

        // Return the full issue data with all expanded fields
        // Excludes comments and changelog - use dedicated tools for those
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                key: issue.key,
                id: issue.id,
                self: issue.self,
                fields: issue.fields,
                renderedFields: issue.renderedFields,
                transitions: issue.transitions,
                operations: issue.operations
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
          `Error getting JIRA issue details: ${(error as Error).message}`
        );
      }
    }
  ];
}
