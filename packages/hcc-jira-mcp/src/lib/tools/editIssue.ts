import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, JiraContext } from "../types";

const EditIssueSchema = z.object({
  issueKey: z.string().describe("The JIRA issue key to edit (e.g., 'RHCLOUD-12345')"),
  fields: z.record(z.any()).describe("Fields to update. Common fields: summary (string), description (string), assignee (object with name/accountId), priority (object with name/id), labels (array of strings), customfield_* (varies by type)")
});

export function editIssueTool(context: JiraContext): McpTool {
  return [
    "edit_jira_issue",
    {
      description: "Edit/update fields on a JIRA issue. Can update summary, description, assignee, priority, labels, custom fields, and more. Note: To change issue status, use transitions instead. Returns the updated field values.",
      inputSchema: EditIssueSchema
    },
    async (args) => {
      try {
        const { issueKey, fields } = args as z.infer<typeof EditIssueSchema>;

        // Update issue via JIRA API
        const url = `${context.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}`;
        const response = await fetch(url, {
          method: 'PUT',
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
            `Failed to edit JIRA issue: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        // PUT to /issue/{issueKey} returns 204 No Content on success
        // Fetch the updated issue to return current values
        const getUrl = `${context.baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}`;
        const getResponse = await fetch(getUrl, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${context.apiToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }
        });

        if (!getResponse.ok) {
          // Edit succeeded but couldn't fetch updated issue
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  issueKey,
                  success: true,
                  message: "Issue updated successfully",
                  updatedFields: Object.keys(fields)
                }, null, 2)
              }
            ]
          };
        }

        const updatedIssue = await getResponse.json() as any;

        // Return success with updated field values
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                issueKey,
                success: true,
                message: "Issue updated successfully",
                updatedFields: Object.keys(fields),
                currentValues: updatedIssue.fields
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
          `Error editing JIRA issue: ${(error as Error).message}`
        );
      }
    }
  ];
}
