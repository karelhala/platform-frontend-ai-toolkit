import { editIssueTool } from '../editIssue';
import { JiraContext } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('editIssueTool', () => {
  const mockContext: JiraContext = {
    baseUrl: 'https://issues.com',
    apiToken: 'test-token-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tool configuration', () => {
    it('should return correct tool name and config', () => {
      const [name, config] = editIssueTool(mockContext);

      expect(name).toBe('edit_jira_issue');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('inputSchema');
      expect(config.description).toContain('Edit/update fields');
    });
  });

  describe('editing issue fields', () => {
    it('should successfully update issue summary', async () => {
      const mockUpdatedIssue = {
        key: 'RHCLOUD-12345',
        fields: {
          summary: 'Updated summary text',
          description: 'Original description',
          status: { name: 'Open' },
        },
      };

      // Mock successful PUT (returns 204 No Content)
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
        })
        // Mock successful GET to fetch updated issue
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUpdatedIssue,
        });

      const [, , handler] = editIssueTool(mockContext);
      const result = await handler({
        issueKey: 'RHCLOUD-12345',
        fields: {
          summary: 'Updated summary text',
        },
      });

      expect(result.content[0].type).toBe('text');
      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.issueKey).toBe('RHCLOUD-12345');
      expect(response.success).toBe(true);
      expect(response.updatedFields).toEqual(['summary']);
      expect(response.currentValues.summary).toBe('Updated summary text');
    });

    it('should successfully update multiple fields', async () => {
      const mockUpdatedIssue = {
        key: 'RHCLOUD-12345',
        fields: {
          summary: 'New summary',
          description: 'New description',
          priority: { name: 'High', id: '1' },
          labels: ['bug', 'urgent'],
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUpdatedIssue,
        });

      const [, , handler] = editIssueTool(mockContext);
      const result = await handler({
        issueKey: 'RHCLOUD-12345',
        fields: {
          summary: 'New summary',
          description: 'New description',
          priority: { id: '1' },
          labels: ['bug', 'urgent'],
        },
      });

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.success).toBe(true);
      expect(response.updatedFields).toContain('summary');
      expect(response.updatedFields).toContain('description');
      expect(response.updatedFields).toContain('priority');
      expect(response.updatedFields).toContain('labels');
      expect(response.currentValues.summary).toBe('New summary');
      expect(response.currentValues.description).toBe('New description');
      expect(response.currentValues.labels).toEqual(['bug', 'urgent']);
    });

    it('should successfully update assignee', async () => {
      const mockUpdatedIssue = {
        key: 'RHCLOUD-12345',
        fields: {
          assignee: {
            name: 'jdoe',
            displayName: 'John Doe',
            emailAddress: 'jdoe@example.com',
          },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUpdatedIssue,
        });

      const [, , handler] = editIssueTool(mockContext);
      const result = await handler({
        issueKey: 'RHCLOUD-12345',
        fields: {
          assignee: { name: 'jdoe' },
        },
      });

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.success).toBe(true);
      expect(response.currentValues.assignee.name).toBe('jdoe');
      expect(response.currentValues.assignee.displayName).toBe('John Doe');
    });

    it('should successfully update custom fields', async () => {
      const mockUpdatedIssue = {
        key: 'RHCLOUD-12345',
        fields: {
          customfield_10001: 'Sprint 5',
          customfield_10002: { value: 'Team A' },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUpdatedIssue,
        });

      const [, , handler] = editIssueTool(mockContext);
      const result = await handler({
        issueKey: 'RHCLOUD-12345',
        fields: {
          customfield_10001: 'Sprint 5',
          customfield_10002: { value: 'Team A' },
        },
      });

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.success).toBe(true);
      expect(response.currentValues.customfield_10001).toBe('Sprint 5');
      expect(response.currentValues.customfield_10002).toEqual({ value: 'Team A' });
    });

    it('should send correct request body', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ key: 'TEST-1', fields: {} }),
        });

      const [, , handler] = editIssueTool(mockContext);
      await handler({
        issueKey: 'RHCLOUD-12345',
        fields: {
          summary: 'New summary',
          labels: ['test'],
        },
      });

      const putCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(putCall[0]).toContain('/issue/RHCLOUD-12345');
      expect(putCall[1].method).toBe('PUT');
      expect(JSON.parse(putCall[1].body)).toEqual({
        fields: {
          summary: 'New summary',
          labels: ['test'],
        },
      });
    });

    it('should handle successful update even when GET fails', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const [, , handler] = editIssueTool(mockContext);
      const result = await handler({
        issueKey: 'RHCLOUD-12345',
        fields: { summary: 'New' },
      });

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.success).toBe(true);
      expect(response.message).toBe('Issue updated successfully');
      expect(response.updatedFields).toEqual(['summary']);
      expect(response.currentValues).toBeUndefined();
    });
  });

  describe('authentication', () => {
    it('should include correct authentication headers', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ key: 'TEST-1', fields: {} }),
        });

      const [, , handler] = editIssueTool(mockContext);
      await handler({
        issueKey: 'RHCLOUD-12345',
        fields: { summary: 'Test' },
      });

      // Check PUT request headers
      const putCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(putCall[1].headers).toEqual(
        expect.objectContaining({
          'Authorization': 'Bearer test-token-123',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
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
        text: async () => '{"errorMessages":["Issue does not exist"]}',
      });

      const [, , handler] = editIssueTool(mockContext);

      await expect(
        handler({
          issueKey: 'INVALID-123',
          fields: { summary: 'Test' },
        })
      ).rejects.toThrow('Failed to edit JIRA issue');
      await expect(
        handler({
          issueKey: 'INVALID-123',
          fields: { summary: 'Test' },
        })
      ).rejects.toThrow('404 Not Found');
    });

    it('should handle validation errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () =>
          '{"errorMessages":[],"errors":{"summary":"Summary is required"}}',
      });

      const [, , handler] = editIssueTool(mockContext);

      await expect(
        handler({
          issueKey: 'RHCLOUD-12345',
          fields: { summary: '' },
        })
      ).rejects.toThrow('Failed to edit JIRA issue');
      await expect(
        handler({
          issueKey: 'RHCLOUD-12345',
          fields: { summary: '' },
        })
      ).rejects.toThrow('400 Bad Request');
    });

    it('should handle permission errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => '{"errorMessages":["You do not have permission to edit this issue"]}',
      });

      const [, , handler] = editIssueTool(mockContext);

      await expect(
        handler({
          issueKey: 'RHCLOUD-12345',
          fields: { summary: 'Test' },
        })
      ).rejects.toThrow('403 Forbidden');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const [, , handler] = editIssueTool(mockContext);

      await expect(
        handler({
          issueKey: 'RHCLOUD-12345',
          fields: { summary: 'Test' },
        })
      ).rejects.toThrow('Error editing JIRA issue');
      await expect(
        handler({
          issueKey: 'RHCLOUD-12345',
          fields: { summary: 'Test' },
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('issue key encoding', () => {
    it('should properly encode issue key in URL', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, status: 204 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ key: 'TEST-1', fields: {} }),
        });

      const [, , handler] = editIssueTool(mockContext);
      await handler({
        issueKey: 'PROJ-123',
        fields: { summary: 'Test' },
      });

      const putCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(putCall[0]).toContain('/issue/PROJ-123');
    });
  });
});
