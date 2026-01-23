# HCC JIRA MCP Server

A Model Context Protocol (MCP) server for JIRA integration, providing AI assistants with comprehensive assistance for JIRA operations, including getting detailed issue information, searching for issues, creating new issues, editing issue fields, retrieving comments, and posting comments.

## Features

- 🔐 **Secure Credential Storage**: API tokens are stored in your system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- 🎫 Get comprehensive details for specific issues (all fields, transitions, rendered content)
- 🔍 Search for issues using JQL (JIRA Query Language)
- 📋 Get issue creation metadata (required fields, allowed values, field types)
- ➕ Create new issues with all required and optional fields
- ✏️ Edit and update issue fields (summary, description, assignee, priority, labels, custom fields)
- 💬 Get and post comments on issues

## Installation

```bash
npm install @redhat-cloud-services/hcc-jira-mcp
```

## Quick Start

### Option 1: Using Environment Variables (Easiest! ⚡)

The fastest way to get started with Claude Code CLI:

1. **Get your JIRA API token**:
   - Visit: https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Give it a label (e.g., "HCC JIRA MCP")
   - Copy the token

2. **Add the MCP server with credentials**:
   ```bash
   claude mcp add --transport stdio \
     --env JIRA_BASE_URL=https://your-domain.atlassian.net \
     --env JIRA_API_TOKEN=your-api-token \
     jira -- hcc-jira-mcp
   ```

3. **Reload VSCode/Claude Code** and start using JIRA immediately!
   - "Get me the details for issue RHCLOUD-12345"
   - "Show me everything about RHCLOUD-12345 - I need full context to work on it"
   - "Show me all open issues assigned to me"
   - "Find all high priority bugs closed last week"
   - "Create a new Bug in project RHCLOUD with summary 'Login page crashes on mobile'"
   - "Change the summary of RHCLOUD-12345 to 'Fix authentication bug'"
   - "Update RHCLOUD-12345: set priority to High and assign to jdoe"
   - "Show me the comments on RHCLOUD-12345"
   - "Add a comment to RHCLOUD-12345 saying 'Fix verified in production'"

**Note**: This method stores credentials in your VSCode settings. For more security, use Option 2 below.

### Option 2: Using Keychain (Most Secure 🔐)

For secure credential storage in your system keychain:

1. **Get your JIRA API token** (see step 1 above)

2. **Run the setup command**:
   ```bash
   hcc-jira-mcp-setup
   ```

   You'll be prompted for:
   - **JIRA Base URL**: Your JIRA instance URL (e.g., `https://your-domain.atlassian.net`)
   - **JIRA API Token**: The token you created in step 1

3. **Add the MCP server** (no credentials needed!):
   ```bash
   claude mcp add --transport stdio jira -- hcc-jira-mcp
   ```

4. **Reload VSCode/Claude Code** and start using JIRA!

### Option 3: Using Traditional MCP Configuration

For Claude Desktop or other MCP clients:

Add this to your MCP settings file (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@redhat-cloud-services/hcc-jira-mcp"],
      "env": {
        "JIRA_BASE_URL": "https://your-domain.atlassian.net",
        "JIRA_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

Or use keychain (run `hcc-jira-mcp-setup` first) and omit the `env` section.

### How Credentials Are Stored

Your API token is **securely stored** in your system keychain:
- **macOS**: Keychain Access
- **Windows**: Credential Manager
- **Linux**: Secret Service API / libsecret

**Note**: You never need to put credentials in your MCP configuration!

## Available Tools

### search_jira_issues

Search for JIRA issues using JQL (JIRA Query Language). Can retrieve a single issue by key or search with complex criteria.

**Parameters:**
- `jql` (string): JQL query string
- `maxResults` (number, optional): Maximum number of results to return (default: 50, max: 100)

**Examples:**

**Get a single issue:**
```
User: "Get details for RHCLOUD-12345"
Assistant: *Searches with JQL: issuekey=RHCLOUD-12345*
```

**Search by assignee and status:**
```
User: "Show me all open issues assigned to jdoe"
Assistant: *Searches with JQL: assignee=jdoe AND status=Open*
```

**Search by date range:**
```
User: "Give me all issues assigned to user FooBar which he closed in last week"
Assistant: *Searches with JQL: assignee=FooBar AND status=Closed AND updated >= -7d*
```

**JQL Query Examples:**
- `issuekey=PROJ-123` - Get a specific issue
- `assignee=currentUser() AND status=Open` - My open issues
- `project=MYPROJ AND created >= -30d` - Issues created in last 30 days
- `assignee=jdoe AND status=Closed AND resolved >= -7d` - Closed by user in last week
- `status in (Open, "In Progress") AND priority=High` - High priority active issues

### get_jira_issue_details

Get comprehensive details for a specific JIRA issue. Returns all available fields including description, attachments, subtasks, links, transitions, and rendered content. Use this when you need full information about a specific issue you're working on.

**Parameters:**
- `issueKey` (string): The JIRA issue key (e.g., 'RHCLOUD-12345')

**Examples:**

**Get full details for an issue:**
```
User: "Show me everything about RHCLOUD-12345"
Assistant: *Fetches comprehensive details for issue RHCLOUD-12345*
```

**Working on a specific issue:**
```
User: "I'm working on RHCLOUD-12345, what are all the details?"
Assistant: *Fetches full issue information including all fields*
```

**Response includes:**
- All standard fields (summary, description, status, assignee, reporter, priority, labels, etc.)
- Custom fields configured in your JIRA instance
- Rendered description (HTML format)
- Available transitions (workflow actions you can take)
- Operations available on the issue
- Subtasks, links, and attachments
- All metadata and configuration

**Use Cases:**
- When you need to work on a specific issue and need complete context
- Understanding the current state of an issue
- Seeing all available workflow transitions
- Accessing custom fields and metadata
- Getting rendered HTML content for formatted descriptions

**Note:** This tool is optimized for getting detailed information about a single issue. For searching or listing multiple issues, use `search_jira_issues` instead. For comments, use `get_jira_issue_comments`.

### get_jira_create_metadata

Get metadata about creating issues in JIRA. Returns information about available projects, issue types, and required/optional fields for issue creation. Use this before creating an issue to understand what fields are needed and what values are allowed.

**Parameters:**
- `projectKey` (string, optional): Filter by project key (e.g., 'RHCLOUD')
- `projectId` (string, optional): Filter by project ID
- `issuetypeName` (string, optional): Filter by issue type name (e.g., 'Bug', 'Story')
- `issuetypeId` (string, optional): Filter by issue type ID

**Examples:**

**Get metadata for all projects:**
```
User: "What fields do I need to create an issue?"
Assistant: *Fetches create metadata for all accessible projects*
```

**Get metadata for a specific project:**
```
User: "What fields are required to create a Bug in RHCLOUD?"
Assistant: *Fetches metadata with projectKey='RHCLOUD' and issuetypeName='Bug'*
```

**Response includes:**
- Available projects (key, id, name)
- Available issue types per project (Bug, Story, Task, etc.)
- Fields for each issue type:
  - Field name and schema type
  - Whether field is required or optional
  - Whether field has a default value
  - Allowed values (for select fields, priorities, etc.)
  - Auto-complete URLs (for fields with auto-complete)
  - Available operations (set, add, remove)

**Use Cases:**
- Discovering what fields are required before creating an issue
- Understanding what values are allowed for a field (priorities, issue types, etc.)
- Building dynamic forms or wizards for issue creation
- Validating user input before attempting to create an issue
- Finding custom fields and their configurations

**Workflow:**
1. Use `get_jira_create_metadata` to discover required fields and allowed values
2. Collect necessary information from the user
3. Use `create_jira_issue` with the collected fields

**Example response structure:**
```json
{
  "projects": [
    {
      "key": "RHCLOUD",
      "id": "10001",
      "name": "Red Hat Cloud",
      "issuetypes": [
        {
          "id": "1",
          "name": "Bug",
          "description": "A problem which impairs functionality",
          "subtask": false,
          "fields": {
            "summary": {
              "name": "Summary",
              "required": true,
              "schema": { "type": "string", "system": "summary" }
            },
            "priority": {
              "name": "Priority",
              "required": false,
              "hasDefaultValue": true,
              "allowedValues": [
                { "id": "1", "name": "High" },
                { "id": "2", "name": "Medium" },
                { "id": "3", "name": "Low" }
              ]
            }
          }
        }
      ]
    }
  ]
}
```

### create_jira_issue

Create a new JIRA issue in a project. Requires project, summary, and issue type. Can include description, assignee, priority, labels, custom fields, and more. Returns the created issue key.

**Parameters:**
- `fields` (object): Issue fields to set

**Required Fields:**
- `project` (object): Project - use `{ key: "PROJKEY" }` or `{ id: "10001" }`
- `summary` (string): Issue title/summary
- `issuetype` (object): Issue type - use `{ name: "Bug" }` or `{ id: "1" }`

**Optional Fields:**
- `description` (string): Issue description
- `assignee` (object): Assignee - use `{ name: "username" }` or `{ accountId: "id" }`
- `priority` (object): Priority - use `{ name: "High" }` or `{ id: "1" }`
- `labels` (array): Array of label strings
- `customfield_*` (varies): Custom fields - type depends on field configuration
- Any other editable field

**Examples:**

**Create a basic bug:**
```
User: "Create a new Bug in project RHCLOUD with summary 'Login page crashes on mobile'"
Assistant: *Creates issue with required fields*
```

**Create issue with all details:**
```
User: "Create a Story in RHCLOUD: summary 'Implement dark mode', description 'Add dark mode toggle to settings', assign to jdoe, priority High, label 'ui-enhancement'"
Assistant: *Creates issue with all specified fields*
```

**Create with custom fields:**
```
User: "Create a Bug in project RHCLOUD with summary 'API timeout' and set sprint to Sprint 5 (customfield_10001)"
Assistant: *Creates issue with custom field*
```

**Response includes:**
- Success confirmation
- Created issue key (e.g., 'RHCLOUD-12345')
- Created issue ID
- Issue URL (web interface browse URL, e.g., 'https://issues.com/browse/RHCLOUD-12345')
- API URL (REST API endpoint)

**Important Notes:**
- Project must exist and you must have create permissions
- Issue type must be valid for the project
- Some fields may be required based on project configuration
- Field names and types vary by JIRA configuration

### edit_jira_issue

Edit and update fields on a JIRA issue. Can modify summary, description, assignee, priority, labels, custom fields, and other editable fields. Returns the updated field values after the change.

**Parameters:**
- `issueKey` (string): The JIRA issue key to edit (e.g., 'RHCLOUD-12345')
- `fields` (object): Fields to update with their new values

**Common Fields:**
- `summary` (string): Issue title/summary
- `description` (string): Issue description
- `assignee` (object): Assignee - use `{ name: "username" }` or `{ accountId: "id" }`
- `priority` (object): Priority - use `{ id: "1" }` or `{ name: "High" }`
- `labels` (array): Array of label strings
- `customfield_*` (varies): Custom fields - type depends on field configuration

**Examples:**

**Update issue summary:**
```
User: "Change the summary of RHCLOUD-12345 to 'Fix authentication bug in login flow'"
Assistant: *Updates summary field*
```

**Update multiple fields:**
```
User: "Update RHCLOUD-12345: set priority to High, add label 'urgent', and assign to jdoe"
Assistant: *Updates priority, labels, and assignee fields*
```

**Update custom field:**
```
User: "Set the sprint field (customfield_10001) to 'Sprint 5' for RHCLOUD-12345"
Assistant: *Updates custom field value*
```

**Response includes:**
- Success confirmation
- List of updated field names
- Current values of all fields after the update

**Important Notes:**
- To change issue status, use workflow transitions (not this tool)
- Field names and types vary by JIRA configuration
- Some fields may be required or have validation rules
- You need edit permissions on the issue

### get_jira_issue_comments

Get all comments from a JIRA issue. Returns comment details including author, timestamps, and comment body.

**Parameters:**
- `issueKey` (string): The JIRA issue key (e.g., 'RHCLOUD-12345')
- `maxResults` (number, optional): Maximum number of comments to return (default: 50, max: 100)

**Examples:**

**Get comments from an issue:**
```
User: "Show me the comments on RHCLOUD-12345"
Assistant: *Fetches comments for issue RHCLOUD-12345*
```

**Response includes:**
- Comment ID
- Author name and email
- Comment body text
- Creation and update timestamps
- Total comment count

### add_jira_issue_comment

Add a new comment to a JIRA issue. Posts a comment with the provided text.

**Parameters:**
- `issueKey` (string): The JIRA issue key to add the comment to (e.g., 'RHCLOUD-12345')
- `comment` (string): The comment text to add to the issue

**Examples:**

**Add a comment to an issue:**
```
User: "Add a comment to RHCLOUD-12345 saying 'Investigation complete, fix deployed to staging'"
Assistant: *Posts comment to issue RHCLOUD-12345*
```

**Response includes:**
- Success confirmation
- Created comment details (ID, author, timestamp, body)

## Use Case: Generating Weekly Team Reports

The JIRA MCP server works seamlessly with the **hcc-frontend-weekly-report** agent to generate comprehensive team reports automatically.

### Prerequisites

1. **Install the HCC Frontend AI Toolkit plugin** (see [main README](../../README.md))
2. **Configure the JIRA MCP server** (see Quick Start section above)
3. **Reload Claude Code/VSCode** to activate the agent and MCP server

### How to Generate a Weekly Report

Once configured, simply ask Claude Code to generate a report:

```
User: "Show me what Platform Framework accomplished this week"
```

Claude Code will:
1. Use the **weekly report agent** to determine the current date and calculate the lookback period to the most recent Wednesday
2. Query JIRA using the **search_jira_issues** tool with the appropriate team criteria and date range
3. Analyze all returned issues and categorize them into:
   - **Outcome, Accomplishments, Celebrations** (incidents, security, quality, sustainability, product work, AI initiatives)
   - **Risks, Blockers, Challenges, Issues** (delivery risks, quality concerns, unexpected interruptions)
   - **Peer Requests** (cross-team dependencies, coordination needs)
   - **Associate Wellness & Development** (arrivals, departures, kudos, morale indicators)
4. Generate a formatted markdown report with summary statistics, JIRA issue links, and actionable insights

### Example Report Request

**Simple request:**
```
User: "Generate weekly report for Platform Framework team"
```

The agent will automatically use the correct team criteria:
- Component: "Console Framework" OR
- Labels: "platform-experience-services"

**Custom team criteria:**
```
User: "Generate weekly report for the API team using component='API Gateway' OR labels=api-backend"
```

### What the Report Includes

- **Summary Statistics**: Total issues closed, breakdown by type
- **Categorized Accomplishments**: Security fixes, quality improvements, product features, infrastructure work
- **Actionable Insights**: Risks, blockers, cross-team dependencies
- **Team Health Indicators**: Recognition opportunities, workload patterns
- **Clickable JIRA Links**: Direct links to referenced issues

### Report Scope

Reports automatically cover from **the most recent Wednesday through today**, regardless of when you run the report. Only includes issues with status:
- "Release pending"
- "Closed"

This ensures the report reflects completed work from the week.

### Tips for Best Results

1. **Run on Monday or Tuesday** for the previous week's summary
2. **Provide specific team criteria** if the default doesn't match your team
3. **Review the generated report** for accuracy before sharing
4. **Use it regularly** to track team progress and identify trends

### Customizing Team Criteria

If you have a different team structure, provide your own JQL criteria:

```
User: "Generate weekly report for teams identified by: project=RHCLOUD AND (labels=my-team OR component='My Component')"
```

The agent will use your criteria combined with the automatic date range calculation.

## Configuration Management

### Reconfigure Credentials

To update your JIRA credentials, run the setup command again:

```bash
npx hcc-jira-mcp-setup
```

It will detect existing configuration and ask if you want to overwrite it.

### Where Are Credentials Stored?

- **API Token**: Stored securely in your system keychain
  - macOS: `Keychain Access.app` → Search for "hcc-jira-mcp"
  - Windows: `Control Panel` → `Credential Manager` → `Windows Credentials`
  - Linux: Uses Secret Service API (GNOME Keyring, KWallet, etc.)

- **Configuration File**: `~/.hcc-jira-mcp/config.json`
  - Contains: JIRA base URL (non-sensitive)
  - Does NOT contain: API token (stored in keychain)

### Remove Credentials

To remove all stored credentials and configuration:

```bash
# Option 1: Run setup and decline to overwrite, then manually remove
rm -rf ~/.hcc-jira-mcp

# Option 2: Remove from keychain manually
# macOS: Open Keychain Access, search "hcc-jira-mcp", delete entry
# Windows: Open Credential Manager, find "hcc-jira-mcp", remove
# Linux: Use your distribution's keyring manager
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Project Structure

```
src/
├── index.ts                      # Main MCP server entry point
├── setup.ts                      # Interactive setup CLI
└── lib/
    ├── jira-mcp.ts              # MCP server implementation
    ├── types.ts                 # TypeScript type definitions
    ├── tools/
    │   ├── getIssue.ts          # JIRA issue search tool
    │   ├── getIssueDetails.ts   # Get comprehensive issue details
    │   ├── getCreateMeta.ts     # Get issue creation metadata
    │   ├── createIssue.ts       # Create new JIRA issues
    │   ├── editIssue.ts         # Edit/update issue fields
    │   └── comment.ts           # JIRA comment tools (get/add)
    └── utils/
        └── credentialStore.ts   # Secure credential storage utilities
```

## Security

- API tokens are **never** stored in plain text
- Credentials are stored using native OS keychain/credential managers
- Configuration file contains only non-sensitive information
- All JIRA API calls use HTTPS

## Troubleshooting

### MCP Server Won't Start - "Configuration Required" Error

**Symptoms**: You see an error message in your MCP client logs about missing JIRA credentials.

**Solution**: Run the setup command to configure your credentials:
```bash
npx hcc-jira-mcp-setup
```

After setup completes, restart your MCP client.

### "Failed to load JIRA credentials" Error

**Cause**: The keychain entry was deleted but the config file still exists.

**Solution**: Run setup again to reconfigure:
```bash
npx hcc-jira-mcp-setup
```

### Connection Issues / API Errors

Verify your JIRA credentials:
1. Check that your JIRA base URL is correct (no trailing slash)
2. Ensure your API token is valid and hasn't been revoked
   - Visit: https://id.atlassian.com/manage-profile/security/api-tokens
   - Check if your token is still active

### Testing Configuration Interactively

You can test the server interactively in your terminal:

```bash
# This will prompt for setup if needed, then try to start the server
npx hcc-jira-mcp
```

This is useful for:
- Verifying your configuration works
- Testing before adding to your MCP client
- Debugging connection issues

Press Ctrl+C to stop the server when done testing.

## Quick Reference

### MCP Server Setup (One-Time)

```bash
# Install and configure
npm install -g @redhat-cloud-services/hcc-jira-mcp
hcc-jira-mcp-setup

# Add to Claude Code
claude mcp add --transport stdio jira -- hcc-jira-mcp

# Reload VSCode/Claude Code
```

### Weekly Report Generation (Regular Use)

```bash
# In Claude Code chat:
"Show me what Platform Framework accomplished this week"

# With custom team criteria:
"Generate weekly report for teams with component='API Gateway'"
```

### Available Agents

When the **HCC Frontend AI Toolkit** plugin is installed, the following agent is available:

- **hcc-frontend-weekly-report** - Automatically generates weekly reports by:
  - Calculating date ranges (last Wednesday through today)
  - Querying JIRA with team criteria
  - Analyzing and categorizing issues
  - Generating formatted markdown reports

See the [main toolkit README](../../README.md) for agent installation instructions.

## License

Apache-2.0

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.
