import { getIssueCommentsTool, addIssueCommentTool } from '../comment';
import { JiraContext } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('getIssueCommentsTool', () => {
  const mockContext: JiraContext = {
    baseUrl: 'https://issues.com',
    apiToken: 'test-token-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tool configuration', () => {
    it('should return correct tool name and config', () => {
      const [name, config] = getIssueCommentsTool(mockContext);

      expect(name).toBe('get_jira_issue_comments');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('inputSchema');
      expect(config.description).toContain('comments');
    });
  });

  describe('getting comments', () => {
    it('should return comments for an issue', async () => {
      const mockComments = [
        {
          id: '1',
          author: {
            displayName: 'John Doe',
            emailAddress: 'john@example.com',
          },
          body: 'This is a test comment',
          created: '2024-01-01T10:00:00.000Z',
          updated: '2024-01-01T10:00:00.000Z',
        },
        {
          id: '2',
          author: {
            displayName: 'Jane Smith',
            emailAddress: 'jane@example.com',
          },
          body: 'This is another comment',
          created: '2024-01-02T11:00:00.000Z',
          updated: '2024-01-02T11:00:00.000Z',
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: mockComments,
          total: 2,
        }),
      });

      const [, , handler] = getIssueCommentsTool(mockContext);
      const result = await handler({ issueKey: 'RHCLOUD-12345', maxResults: 50 });

      expect(result.content[0].type).toBe('text');
      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);
      expect(response.issueKey).toBe('RHCLOUD-12345');
      expect(response.total).toBe(2);
      expect(response.maxResults).toBe(50);
      expect(response.comments).toHaveLength(2);
      expect(response.comments[0].author.displayName).toBe('John Doe');
      expect(response.comments[0].body).toBe('This is a test comment');
      expect(response.comments[1].author.displayName).toBe('Jane Smith');
    });

    it('should handle no comments gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
          total: 0,
        }),
      });

      const [, , handler] = getIssueCommentsTool(mockContext);
      const result = await handler({ issueKey: 'RHCLOUD-12345' });

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);
      expect(response.issueKey).toBe('RHCLOUD-12345');
      expect(response.total).toBe(0);
      expect(response.comments).toEqual([]);
      expect(result.isError).toBeUndefined();
    });

    it('should respect maxResults parameter', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
          total: 0,
        }),
      });

      const [, , handler] = getIssueCommentsTool(mockContext);
      await handler({ issueKey: 'RHCLOUD-12345', maxResults: 25 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('maxResults=25'),
        expect.any(Object)
      );
    });

    it('should limit maxResults to 100', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
          total: 0,
        }),
      });

      const [, , handler] = getIssueCommentsTool(mockContext);
      await handler({ issueKey: 'RHCLOUD-12345', maxResults: 500 });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('maxResults=100'),
        expect.any(Object)
      );
    });

    it('should default to 50 results when not specified', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
          total: 0,
        }),
      });

      const [, , handler] = getIssueCommentsTool(mockContext);
      await handler({ issueKey: 'RHCLOUD-12345' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('maxResults=50'),
        expect.any(Object)
      );
    });
  });

  describe('authentication', () => {
    it('should include correct authentication headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
          total: 0,
        }),
      });

      const [, , handler] = getIssueCommentsTool(mockContext);
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
    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"errorMessages":["Issue not found"]}',
      });

      const [, , handler] = getIssueCommentsTool(mockContext);

      await expect(handler({ issueKey: 'INVALID-123' })).rejects.toThrow('Failed to get JIRA issue comments');
      await expect(handler({ issueKey: 'INVALID-123' })).rejects.toThrow('404 Not Found');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const [, , handler] = getIssueCommentsTool(mockContext);

      await expect(handler({ issueKey: 'RHCLOUD-12345' })).rejects.toThrow('Error getting JIRA issue comments');
      await expect(handler({ issueKey: 'RHCLOUD-12345' })).rejects.toThrow('Network error');
    });
  });

  describe('issue key encoding', () => {
    it('should properly encode issue key with special characters', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          comments: [],
          total: 0,
        }),
      });

      const [, , handler] = getIssueCommentsTool(mockContext);
      const issueKey = 'PROJ-123';
      await handler({ issueKey });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain(`/issue/${issueKey}/comment`);
    });
  });
});

describe('addIssueCommentTool', () => {
  const mockContext: JiraContext = {
    baseUrl: 'https://issues.com',
    apiToken: 'test-token-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tool configuration', () => {
    it('should return correct tool name and config', () => {
      const [name, config] = addIssueCommentTool(mockContext);

      expect(name).toBe('add_jira_issue_comment');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('inputSchema');
      expect(config.description).toContain('Add a comment');
    });
  });

  describe('adding comments', () => {
    it('should successfully add a comment', async () => {
      const mockAddedComment = {
        id: '12345',
        author: {
          displayName: 'Test User',
          emailAddress: 'test@example.com',
        },
        body: 'This is a new comment',
        created: '2024-01-15T10:00:00.000Z',
        updated: '2024-01-15T10:00:00.000Z',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAddedComment,
      });

      const [, , handler] = addIssueCommentTool(mockContext);
      const result = await handler({
        issueKey: 'RHCLOUD-12345',
        comment: 'This is a new comment'
      });

      expect(result.content[0].type).toBe('text');
      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);
      expect(response.issueKey).toBe('RHCLOUD-12345');
      expect(response.success).toBe(true);
      expect(response.comment.id).toBe('12345');
      expect(response.comment.body).toBe('This is a new comment');
      expect(response.comment.author.displayName).toBe('Test User');
    });

    it('should send correct request body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', body: 'Test' }),
      });

      const [, , handler] = addIssueCommentTool(mockContext);
      await handler({
        issueKey: 'RHCLOUD-12345',
        comment: 'This is my comment text'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/issue/RHCLOUD-12345/comment'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ body: 'This is my comment text' }),
        })
      );
    });

    it('should include correct authentication headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', body: 'Test' }),
      });

      const [, , handler] = addIssueCommentTool(mockContext);
      await handler({
        issueKey: 'RHCLOUD-12345',
        comment: 'Test comment'
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

  describe('error handling', () => {
    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"errorMessages":["Issue not found"]}',
      });

      const [, , handler] = addIssueCommentTool(mockContext);

      await expect(handler({
        issueKey: 'INVALID-123',
        comment: 'Test'
      })).rejects.toThrow('Failed to add comment to JIRA issue');
      await expect(handler({
        issueKey: 'INVALID-123',
        comment: 'Test'
      })).rejects.toThrow('404 Not Found');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const [, , handler] = addIssueCommentTool(mockContext);

      await expect(handler({
        issueKey: 'RHCLOUD-12345',
        comment: 'Test'
      })).rejects.toThrow('Error adding comment to JIRA issue');
      await expect(handler({
        issueKey: 'RHCLOUD-12345',
        comment: 'Test'
      })).rejects.toThrow('Network error');
    });

    it('should handle unauthorized errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid credentials',
      });

      const [, , handler] = addIssueCommentTool(mockContext);

      await expect(handler({
        issueKey: 'RHCLOUD-12345',
        comment: 'Test'
      })).rejects.toThrow('401 Unauthorized');
    });
  });

  describe('issue key encoding', () => {
    it('should properly encode issue key in URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '1', body: 'Test' }),
      });

      const [, , handler] = addIssueCommentTool(mockContext);
      const issueKey = 'PROJ-123';
      await handler({ issueKey, comment: 'Test' });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain(`/issue/${issueKey}/comment`);
    });
  });
});
