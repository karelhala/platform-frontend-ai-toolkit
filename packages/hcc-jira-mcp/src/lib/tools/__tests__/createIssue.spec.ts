import { createIssueTool } from '../createIssue';
import { JiraContext } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('createIssueTool', () => {
  const mockContext: JiraContext = {
    baseUrl: 'https://issues.com',
    apiToken: 'test-token-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tool configuration', () => {
    it('should return correct tool name and config', () => {
      const [name, config] = createIssueTool(mockContext);

      expect(name).toBe('create_jira_issue');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('inputSchema');
      expect(config.description).toContain('Create a new JIRA issue');
    });
  });

  describe('creating issues', () => {
    it('should successfully create a basic issue', async () => {
      const mockCreatedIssue = {
        id: '12345',
        key: 'RHCLOUD-12345',
        self: 'https://issues.com/rest/api/2/issue/12345',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedIssue,
      });

      const [, , handler] = createIssueTool(mockContext);
      const result = await handler({
        fields: {
          project: { key: 'RHCLOUD' },
          summary: 'Test issue summary',
          issuetype: { name: 'Bug' },
        },
      });

      expect(result.content[0].type).toBe('text');
      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.success).toBe(true);
      expect(response.message).toBe('Issue created successfully');
      expect(response.issueKey).toBe('RHCLOUD-12345');
      expect(response.issueId).toBe('12345');
      expect(response.issueUrl).toBe('https://issues.com/browse/RHCLOUD-12345');
      expect(response.self).toBe('https://issues.com/rest/api/2/issue/12345');
    });

    it('should successfully create an issue with all optional fields', async () => {
      const mockCreatedIssue = {
        id: '12345',
        key: 'RHCLOUD-12345',
        self: 'https://issues.com/rest/api/2/issue/12345',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedIssue,
      });

      const [, , handler] = createIssueTool(mockContext);
      const result = await handler({
        fields: {
          project: { key: 'RHCLOUD' },
          summary: 'Complete test issue',
          issuetype: { name: 'Story' },
          description: 'This is a detailed description',
          assignee: { name: 'jdoe' },
          priority: { name: 'High' },
          labels: ['bug', 'urgent'],
          customfield_10001: 'Sprint 5',
        },
      });

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.success).toBe(true);
      expect(response.issueKey).toBe('RHCLOUD-12345');
      expect(response.issueUrl).toBe('https://issues.com/browse/RHCLOUD-12345');
    });

    it('should send correct request body with project key', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'TEST-1', id: '1', self: 'url' }),
      });

      const [, , handler] = createIssueTool(mockContext);
      await handler({
        fields: {
          project: { key: 'RHCLOUD' },
          summary: 'Test summary',
          issuetype: { name: 'Bug' },
        },
      });

      const postCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(postCall[0]).toContain('/issue');
      expect(postCall[1].method).toBe('POST');
      expect(JSON.parse(postCall[1].body)).toEqual({
        fields: {
          project: { key: 'RHCLOUD' },
          summary: 'Test summary',
          issuetype: { name: 'Bug' },
        },
      });
    });

    it('should send correct request body with project id', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'TEST-1', id: '1', self: 'url' }),
      });

      const [, , handler] = createIssueTool(mockContext);
      await handler({
        fields: {
          project: { id: '10001' },
          summary: 'Test summary',
          issuetype: { id: '1' },
        },
      });

      const postCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(postCall[1].body)).toEqual({
        fields: {
          project: { id: '10001' },
          summary: 'Test summary',
          issuetype: { id: '1' },
        },
      });
    });

    it('should include correct authentication headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: 'TEST-1', id: '1', self: 'url' }),
      });

      const [, , handler] = createIssueTool(mockContext);
      await handler({
        fields: {
          project: { key: 'RHCLOUD' },
          summary: 'Test',
          issuetype: { name: 'Bug' },
        },
      });

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

  describe('validation', () => {
    it('should throw error when project field is missing', async () => {
      const [, , handler] = createIssueTool(mockContext);

      await expect(
        handler({
          fields: {
            summary: 'Test',
            issuetype: { name: 'Bug' },
          },
        })
      ).rejects.toThrow('Missing required field: project');
    });

    it('should throw error when summary field is missing', async () => {
      const [, , handler] = createIssueTool(mockContext);

      await expect(
        handler({
          fields: {
            project: { key: 'RHCLOUD' },
            issuetype: { name: 'Bug' },
          },
        })
      ).rejects.toThrow('Missing required field: summary');
    });

    it('should throw error when issuetype field is missing', async () => {
      const [, , handler] = createIssueTool(mockContext);

      await expect(
        handler({
          fields: {
            project: { key: 'RHCLOUD' },
            summary: 'Test',
          },
        })
      ).rejects.toThrow('Missing required field: issuetype');
    });
  });

  describe('error handling', () => {
    it('should handle API validation errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () =>
          '{"errorMessages":["Field \'priority\' is invalid"],"errors":{}}',
      });

      const [, , handler] = createIssueTool(mockContext);

      await expect(
        handler({
          fields: {
            project: { key: 'RHCLOUD' },
            summary: 'Valid summary',
            issuetype: { name: 'Bug' },
            priority: { name: 'InvalidPriority' },
          },
        })
      ).rejects.toThrow('Failed to create JIRA issue');
      await expect(
        handler({
          fields: {
            project: { key: 'RHCLOUD' },
            summary: 'Valid summary',
            issuetype: { name: 'Bug' },
            priority: { name: 'InvalidPriority' },
          },
        })
      ).rejects.toThrow('400 Bad Request');
    });

    it('should handle project not found errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"errorMessages":["Project does not exist"]}',
      });

      const [, , handler] = createIssueTool(mockContext);

      await expect(
        handler({
          fields: {
            project: { key: 'INVALID' },
            summary: 'Test',
            issuetype: { name: 'Bug' },
          },
        })
      ).rejects.toThrow('404 Not Found');
    });

    it('should handle permission errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () =>
          '{"errorMessages":["You do not have permission to create issues in this project"]}',
      });

      const [, , handler] = createIssueTool(mockContext);

      await expect(
        handler({
          fields: {
            project: { key: 'RHCLOUD' },
            summary: 'Test',
            issuetype: { name: 'Bug' },
          },
        })
      ).rejects.toThrow('403 Forbidden');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const [, , handler] = createIssueTool(mockContext);

      await expect(
        handler({
          fields: {
            project: { key: 'RHCLOUD' },
            summary: 'Test',
            issuetype: { name: 'Bug' },
          },
        })
      ).rejects.toThrow('Error creating JIRA issue');
      await expect(
        handler({
          fields: {
            project: { key: 'RHCLOUD' },
            summary: 'Test',
            issuetype: { name: 'Bug' },
          },
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle invalid issue type errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () =>
          '{"errorMessages":[],"errors":{"issuetype":"Issue type is invalid"}}',
      });

      const [, , handler] = createIssueTool(mockContext);

      await expect(
        handler({
          fields: {
            project: { key: 'RHCLOUD' },
            summary: 'Test',
            issuetype: { name: 'InvalidType' },
          },
        })
      ).rejects.toThrow('400 Bad Request');
    });
  });

  describe('custom fields', () => {
    it('should support custom fields in creation', async () => {
      const mockCreatedIssue = {
        id: '12345',
        key: 'RHCLOUD-12345',
        self: 'https://issues.com/rest/api/2/issue/12345',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedIssue,
      });

      const [, , handler] = createIssueTool(mockContext);
      await handler({
        fields: {
          project: { key: 'RHCLOUD' },
          summary: 'Test with custom fields',
          issuetype: { name: 'Story' },
          customfield_10001: 'Sprint 5',
          customfield_10002: { value: 'Team A' },
          customfield_10003: 42,
        },
      });

      const postCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(postCall[1].body);
      expect(body.fields.customfield_10001).toBe('Sprint 5');
      expect(body.fields.customfield_10002).toEqual({ value: 'Team A' });
      expect(body.fields.customfield_10003).toBe(42);
    });
  });
});
