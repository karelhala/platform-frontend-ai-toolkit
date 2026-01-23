import { z } from "zod";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, JiraContext } from "../types";

const GetCreateMetaSchema = z.object({
  projectKey: z.string().optional().describe("Filter by project key (e.g., 'RHCLOUD')"),
  projectId: z.string().optional().describe("Filter by project ID"),
  issuetypeName: z.string().optional().describe("Filter by issue type name (e.g., 'Bug', 'Story')"),
  issuetypeId: z.string().optional().describe("Filter by issue type ID")
});

export function getCreateMetaTool(context: JiraContext): McpTool {
  return [
    "get_jira_create_metadata",
    {
      description: "Get metadata about creating issues in JIRA. Returns information about available projects, issue types, and required/optional fields for issue creation. Use this to understand what fields are needed before creating an issue.",
      inputSchema: GetCreateMetaSchema
    },
    async (args) => {
      try {
        const { projectKey, projectId, issuetypeName, issuetypeId } = args as z.infer<typeof GetCreateMetaSchema>;

        // Build query parameters
        const params = new URLSearchParams();

        if (projectKey) {
          params.append('projectKeys', projectKey);
        }
        if (projectId) {
          params.append('projectIds', projectId);
        }
        if (issuetypeName) {
          params.append('issuetypeNames', issuetypeName);
        }
        if (issuetypeId) {
          params.append('issuetypeIds', issuetypeId);
        }

        // Always expand fields to get detailed field information
        params.append('expand', 'projects.issuetypes.fields');

        // Fetch create metadata from JIRA API
        const url = `${context.baseUrl}/rest/api/2/issue/createmeta?${params.toString()}`;
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
            `Failed to get JIRA create metadata: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        const metadata = await response.json() as any;

        // Return the metadata with helpful structure
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                projects: metadata.projects.map((project: any) => ({
                  key: project.key,
                  id: project.id,
                  name: project.name,
                  issuetypes: project.issuetypes?.map((issuetype: any) => ({
                    id: issuetype.id,
                    name: issuetype.name,
                    description: issuetype.description,
                    subtask: issuetype.subtask,
                    fields: issuetype.fields ? Object.entries(issuetype.fields).reduce((acc: any, [key, field]: [string, any]) => {
                      acc[key] = {
                        name: field.name,
                        required: field.required,
                        hasDefaultValue: field.hasDefaultValue,
                        schema: field.schema,
                        operations: field.operations,
                        allowedValues: field.allowedValues,
                        autoCompleteUrl: field.autoCompleteUrl
                      };
                      return acc;
                    }, {}) : {}
                  }))
                }))
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
          `Error getting JIRA create metadata: ${(error as Error).message}`
        );
      }
    }
  ];
}
