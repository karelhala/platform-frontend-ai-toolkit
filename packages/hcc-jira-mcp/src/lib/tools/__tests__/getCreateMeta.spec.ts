import { getCreateMetaTool } from '../getCreateMeta';
import { JiraContext } from '../../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('getCreateMetaTool', () => {
  const mockContext: JiraContext = {
    baseUrl: 'https://issues.com',
    apiToken: 'test-token-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('tool configuration', () => {
    it('should return correct tool name and config', () => {
      const [name, config] = getCreateMetaTool(mockContext);

      expect(name).toBe('get_jira_create_metadata');
      expect(config).toHaveProperty('description');
      expect(config).toHaveProperty('inputSchema');
      expect(config.description).toContain('Get metadata about creating issues');
    });
  });

  describe('getting create metadata', () => {
    it('should successfully get create metadata for all projects', async () => {
      const mockMetadata = {
        expand: 'projects',
        projects: [
          {
            key: 'RHCLOUD',
            id: '10001',
            name: 'Red Hat Cloud',
            issuetypes: [
              {
                id: '1',
                name: 'Bug',
                description: 'A problem which impairs functionality',
                subtask: false,
                fields: {
                  summary: {
                    name: 'Summary',
                    required: true,
                    hasDefaultValue: false,
                    schema: { type: 'string', system: 'summary' },
                    operations: ['set'],
                  },
                  description: {
                    name: 'Description',
                    required: false,
                    hasDefaultValue: false,
                    schema: { type: 'string', system: 'description' },
                    operations: ['set'],
                  },
                  priority: {
                    name: 'Priority',
                    required: false,
                    hasDefaultValue: true,
                    schema: { type: 'priority', system: 'priority' },
                    operations: ['set'],
                    allowedValues: [
                      { id: '1', name: 'High' },
                      { id: '2', name: 'Medium' },
                      { id: '3', name: 'Low' },
                    ],
                  },
                },
              },
            ],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      const result = await handler({});

      expect(result.content[0].type).toBe('text');
      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.projects).toHaveLength(1);
      expect(response.projects[0].key).toBe('RHCLOUD');
      expect(response.projects[0].issuetypes).toHaveLength(1);
      expect(response.projects[0].issuetypes[0].name).toBe('Bug');
      expect(response.projects[0].issuetypes[0].fields.summary.required).toBe(true);
      expect(response.projects[0].issuetypes[0].fields.description.required).toBe(false);
    });

    it('should filter by project key', async () => {
      const mockMetadata = {
        projects: [
          {
            key: 'RHCLOUD',
            id: '10001',
            name: 'Red Hat Cloud',
            issuetypes: [],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      await handler({ projectKey: 'RHCLOUD' });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain('projectKeys=RHCLOUD');
      expect(fetchCall[0]).toContain('expand=projects.issuetypes.fields');
    });

    it('should filter by project id', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      await handler({ projectId: '10001' });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain('projectIds=10001');
    });

    it('should filter by issue type name', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      await handler({ issuetypeName: 'Bug' });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain('issuetypeNames=Bug');
    });

    it('should filter by issue type id', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      await handler({ issuetypeId: '1' });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain('issuetypeIds=1');
    });

    it('should handle multiple filters', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      await handler({
        projectKey: 'RHCLOUD',
        issuetypeName: 'Bug',
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain('projectKeys=RHCLOUD');
      expect(fetchCall[0]).toContain('issuetypeNames=Bug');
    });

    it('should include authentication headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      await handler({});

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

    it('should include field details with allowed values', async () => {
      const mockMetadata = {
        projects: [
          {
            key: 'PROJ',
            id: '1',
            name: 'Project',
            issuetypes: [
              {
                id: '1',
                name: 'Bug',
                fields: {
                  priority: {
                    name: 'Priority',
                    required: true,
                    allowedValues: [
                      { id: '1', name: 'High', description: 'High priority' },
                      { id: '2', name: 'Low', description: 'Low priority' },
                    ],
                    schema: { type: 'priority' },
                  },
                },
              },
            ],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      const result = await handler({});

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.projects[0].issuetypes[0].fields.priority.allowedValues).toHaveLength(2);
      expect(response.projects[0].issuetypes[0].fields.priority.allowedValues[0].name).toBe('High');
    });

    it('should include custom fields in metadata', async () => {
      const mockMetadata = {
        projects: [
          {
            key: 'PROJ',
            id: '1',
            name: 'Project',
            issuetypes: [
              {
                id: '1',
                name: 'Story',
                fields: {
                  customfield_10001: {
                    name: 'Sprint',
                    required: false,
                    schema: { type: 'array', items: 'string', custom: 'com.sprint' },
                    operations: ['add', 'set', 'remove'],
                  },
                },
              },
            ],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      const result = await handler({});

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.projects[0].issuetypes[0].fields).toHaveProperty('customfield_10001');
      expect(response.projects[0].issuetypes[0].fields.customfield_10001.name).toBe('Sprint');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '{"errorMessages":["Project does not exist"]}',
      });

      const [, , handler] = getCreateMetaTool(mockContext);

      await expect(handler({ projectKey: 'INVALID' })).rejects.toThrow(
        'Failed to get JIRA create metadata'
      );
      await expect(handler({ projectKey: 'INVALID' })).rejects.toThrow('404 Not Found');
    });

    it('should handle permission errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () =>
          '{"errorMessages":["You do not have permission to view this project"]}',
      });

      const [, , handler] = getCreateMetaTool(mockContext);

      await expect(handler({ projectKey: 'RHCLOUD' })).rejects.toThrow('403 Forbidden');
    });

    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const [, , handler] = getCreateMetaTool(mockContext);

      await expect(handler({})).rejects.toThrow('Error getting JIRA create metadata');
      await expect(handler({})).rejects.toThrow('Network error');
    });

    it('should handle invalid authentication', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => '{"errorMessages":["Authentication required"]}',
      });

      const [, , handler] = getCreateMetaTool(mockContext);

      await expect(handler({})).rejects.toThrow('401 Unauthorized');
    });
  });

  describe('response structure', () => {
    it('should include all relevant field properties', async () => {
      const mockMetadata = {
        projects: [
          {
            key: 'PROJ',
            id: '1',
            name: 'Project',
            issuetypes: [
              {
                id: '1',
                name: 'Bug',
                description: 'Bug description',
                subtask: false,
                fields: {
                  summary: {
                    name: 'Summary',
                    required: true,
                    hasDefaultValue: false,
                    schema: { type: 'string' },
                    operations: ['set'],
                    autoCompleteUrl: 'https://example.com/autocomplete',
                  },
                },
              },
            ],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      const result = await handler({});

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      const field = response.projects[0].issuetypes[0].fields.summary;
      expect(field).toHaveProperty('name');
      expect(field).toHaveProperty('required');
      expect(field).toHaveProperty('hasDefaultValue');
      expect(field).toHaveProperty('schema');
      expect(field).toHaveProperty('operations');
      expect(field).toHaveProperty('autoCompleteUrl');
    });

    it('should handle issuetype without fields', async () => {
      const mockMetadata = {
        projects: [
          {
            key: 'PROJ',
            id: '1',
            name: 'Project',
            issuetypes: [
              {
                id: '1',
                name: 'Bug',
                description: 'Bug',
                subtask: false,
              },
            ],
          },
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetadata,
      });

      const [, , handler] = getCreateMetaTool(mockContext);
      const result = await handler({});

      const textContent = result.content[0] as { type: 'text'; text: string };
      const response = JSON.parse(textContent.text);

      expect(response.projects[0].issuetypes[0].fields).toEqual({});
    });
  });
});
