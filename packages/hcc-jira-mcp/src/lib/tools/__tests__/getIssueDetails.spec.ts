import { getIssueDetailsTool } from '../getIssueDetails';
import { JiraContext } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('getIssueDetailsTool', () => {
  const mockContext: JiraContext = {
    baseUrl: 'https://issues.com',
    apiToken: 'test-token-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tool configuration', () => {
    it('should return correct tool name and config', () => {
      const [name, config] = getIssueDetailsTool(mockContext);

      expect(name).toBe('get_jira_issue_details');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('inputSchema');
      expect(config.description).toContain('comprehensive details');
      expect(config.description).toContain('specific issue');
    });
  });

  describe('getting issue details', () => {
    it('should return full issue details with all expanded fields', async () => {
      const mockIssue = {
        id: '12345',
        key: 'RHCLOUD-12345',
        self: 'https://issues.com/rest/api/2/issue/12345',
        fields: {
          summary: 'Test Issue',
          description: 'This is a detailed test issue description',
          status: { name: 'Open' },
          assignee: { displayName: 'John Doe', emailAddress: 'john@example.com' },
          reporter: { displayName: 'Jane Smith', emailAddress: 'jane@example.com' },
          created: '2024-01-01T10:00:00.000Z',
          updated: '2024-01-15T14:30:00.000Z',
          issuetype: { name: 'Bug' },
          priority: { name: 'High' },
          labels: ['bug', 'critical'],
          components: [{ name: 'API' }],
          fixVersions: [{ name: '1.2.0' }],
          customfield_12345: 'Custom value',
        },
        renderedFields: {
          description: '<p>This is a detailed test issue description</p>',
        },
        transitions: [
          { id: '1', name: 'Start Progress' },
          { id: '2', name: 'Resolve Issue' },
        ],
        operations: {
          linkGroups: [],
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssue,
      });

      const [, , handler] = getIssueDetailsTool(mockContext);
      const result = await handler({ issueKey: 'RHCLOUD-12345' });

      expect(result.content[0].type).toBe('text');
      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.key).toBe('RHCLOUD-12345');
      expect(response.id).toBe('12345');
      expect(response.self).toBe('https://issues.com/rest/api/2/issue/12345');
      expect(response.fields.summary).toBe('Test Issue');
      expect(response.fields.description).toBe('This is a detailed test issue description');
      expect(response.fields.status.name).toBe('Open');
      expect(response.fields.assignee.displayName).toBe('John Doe');
      expect(response.fields.priority.name).toBe('High');
      expect(response.fields.labels).toEqual(['bug', 'critical']);
      expect(response.renderedFields.description).toBe('<p>This is a detailed test issue description</p>');
      expect(response.transitions).toHaveLength(2);
      expect(response.transitions[0].name).toBe('Start Progress');
    });

    it('should include custom fields in the response', async () => {
      const mockIssue = {
        key: 'RHCLOUD-12345',
        id: '12345',
        fields: {
          summary: 'Test',
          customfield_10001: 'Sprint 1',
          customfield_10002: { value: 'Team A' },
          customfield_10003: 42,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssue,
      });

      const [, , handler] = getIssueDetailsTool(mockContext);
      const result = await handler({ issueKey: 'RHCLOUD-12345' });

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.fields.customfield_10001).toBe('Sprint 1');
      expect(response.fields.customfield_10002).toEqual({ value: 'Team A' });
      expect(response.fields.customfield_10003).toBe(42);
    });

    it('should request expanded fields in the API call', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'TEST-1', fields: {} }),
      });

      const [, , handler] = getIssueDetailsTool(mockContext);
      await handler({ issueKey: 'RHCLOUD-12345' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('expand=renderedFields,names,schema,transitions,operations,editmeta'),
        expect.any(Object)
      );
    });

    it('should properly encode issue key in URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'TEST-1', fields: {} }),
      });

      const [, , handler] = getIssueDetailsTool(mockContext);
      await handler({ issueKey: 'RHCLOUD-12345' });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('/issue/RHCLOUD-12345');
    });
  });

  describe('authentication', () => {
    it('should include correct authentication headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'TEST-1', fields: {} }),
      });

      const [, , handler] = getIssueDetailsTool(mockContext);
      await handler({ issueKey: 'RHCLOUD-12345' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle issue not found errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"errorMessages":["Issue does not exist or you do not have permission to see it."]}',
      });

      const [, , handler] = getIssueDetailsTool(mockContext);

      await expect(handler({ issueKey: 'INVALID-123' })).rejects.toThrow('Failed to get JIRA issue details');
      await expect(handler({ issueKey: 'INVALID-123' })).rejects.toThrow('404 Not Found');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const [, , handler] = getIssueDetailsTool(mockContext);

      await expect(handler({ issueKey: 'RHCLOUD-12345' })).rejects.toThrow('Error getting JIRA issue details');
      await expect(handler({ issueKey: 'RHCLOUD-12345' })).rejects.toThrow('Network error');
    });

    it('should handle unauthorized errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid credentials',
      });

      const [, , handler] = getIssueDetailsTool(mockContext);

      await expect(handler({ issueKey: 'RHCLOUD-12345' })).rejects.toThrow('401 Unauthorized');
    });

    it('should handle permission errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => '{"errorMessages":["You do not have permission to view this issue."]}',
      });

      const [, , handler] = getIssueDetailsTool(mockContext);

      await expect(handler({ issueKey: 'RHCLOUD-12345' })).rejects.toThrow('403 Forbidden');
    });
  });

  describe('issue key encoding', () => {
    it('should properly encode issue key with special characters', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'TEST-1', fields: {} }),
      });

      const [, , handler] = getIssueDetailsTool(mockContext);
      const issueKey = 'PROJ-123';
      await handler({ issueKey });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain(`/issue/${issueKey}`);
    });
  });

  describe('response structure', () => {
    it('should include all main sections in response', async () => {
      const mockIssue = {
        key: 'RHCLOUD-1',
        id: '1',
        self: 'https://example.com',
        fields: { summary: 'Test' },
        renderedFields: { description: '<p>Test</p>' },
        transitions: [],
        operations: {},
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockIssue,
      });

      const [, , handler] = getIssueDetailsTool(mockContext);
      const result = await handler({ issueKey: 'RHCLOUD-1' });

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response).toHaveProperty('key');
      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('self');
      expect(response).toHaveProperty('fields');
      expect(response).toHaveProperty('renderedFields');
      expect(response).toHaveProperty('transitions');
      expect(response).toHaveProperty('operations');
    });
  });
});
