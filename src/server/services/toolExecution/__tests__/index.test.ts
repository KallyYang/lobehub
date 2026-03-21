import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToolExecutionService } from '../index';
import { type ToolExecutionContext } from '../types';

// Mock debug
vi.mock('debug', () => ({
  default: () => vi.fn(),
}));

// Mock truncateToolResult
vi.mock('@/server/utils/truncateToolResult', () => ({
  DEFAULT_TOOL_RESULT_MAX_LENGTH: 25_000,
  truncateToolResult: vi.fn((content: string, maxLength?: number) => {
    const limit = maxLength ?? 25_000;
    return content.length > limit ? content.slice(0, limit) : content;
  }),
}));

// Mock contentBlocksToString
vi.mock('@/server/services/mcp/contentProcessor', () => ({
  contentBlocksToString: vi.fn((blocks: any[]) => {
    if (!blocks || blocks.length === 0) return '';
    return blocks.map((b: any) => (b.type === 'text' ? b.text : JSON.stringify(b))).join('\n');
  }),
}));

// Mock safeParseJSON
vi.mock('@lobechat/utils', () => ({
  safeParseJSON: vi.fn((str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }),
}));

// Mock DiscoverService
const mockCallCloudMcpEndpoint = vi.fn();
vi.mock('../discover', () => ({
  DiscoverService: vi.fn().mockImplementation(() => ({
    callCloudMcpEndpoint: mockCallCloudMcpEndpoint,
  })),
}));

vi.mock('../../discover', () => ({
  DiscoverService: vi.fn().mockImplementation(() => ({
    callCloudMcpEndpoint: mockCallCloudMcpEndpoint,
  })),
}));

const mockBuiltinExecutor = {
  execute: vi.fn(),
};

const mockMcpService = {
  callTool: vi.fn(),
};

const mockPluginGatewayService = {
  execute: vi.fn(),
};

const createService = () =>
  new ToolExecutionService({
    builtinToolsExecutor: mockBuiltinExecutor as any,
    mcpService: mockMcpService as any,
    pluginGatewayService: mockPluginGatewayService as any,
  });

const baseContext: ToolExecutionContext = {
  toolManifestMap: {},
  userId: 'user-1',
};

describe('ToolExecutionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeTool', () => {
    describe('builtin tools', () => {
      it('should route builtin tools to builtinToolsExecutor', async () => {
        mockBuiltinExecutor.execute.mockResolvedValue({
          content: 'builtin result',
          success: true,
        });

        const service = createService();
        const result = await service.executeTool(
          {
            apiName: 'search',
            arguments: '{}',
            id: 'call-1',
            identifier: 'lobehub-search',
            type: 'builtin',
          },
          baseContext,
        );

        expect(mockBuiltinExecutor.execute).toHaveBeenCalledOnce();
        expect(result.content).toBe('builtin result');
        expect(result.success).toBe(true);
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      });

      it('should include executionTime in response', async () => {
        mockBuiltinExecutor.execute.mockResolvedValue({
          content: 'result',
          success: true,
        });

        const service = createService();
        const result = await service.executeTool(
          {
            apiName: 'test',
            arguments: '{}',
            id: 'call-1',
            identifier: 'builtin-tool',
            type: 'builtin',
          },
          baseContext,
        );

        expect(typeof result.executionTime).toBe('number');
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      });
    });

    describe('plugin/default tools', () => {
      it('should route non-builtin, non-mcp tools to pluginGatewayService', async () => {
        mockPluginGatewayService.execute.mockResolvedValue({
          content: 'plugin result',
          success: true,
        });

        const service = createService();
        const result = await service.executeTool(
          {
            apiName: 'run',
            arguments: '{"query":"test"}',
            id: 'call-2',
            identifier: 'my-plugin',
            type: 'default',
          },
          baseContext,
        );

        expect(mockPluginGatewayService.execute).toHaveBeenCalledOnce();
        expect(result.content).toBe('plugin result');
        expect(result.success).toBe(true);
      });

      it('should route standalone type to pluginGatewayService', async () => {
        mockPluginGatewayService.execute.mockResolvedValue({
          content: 'standalone result',
          success: true,
        });

        const service = createService();
        await service.executeTool(
          {
            apiName: 'action',
            arguments: '{}',
            id: 'call-3',
            identifier: 'standalone-plugin',
            type: 'standalone',
          },
          baseContext,
        );

        expect(mockPluginGatewayService.execute).toHaveBeenCalledOnce();
      });
    });

    describe('error handling', () => {
      it('should return error response when builtinToolsExecutor throws', async () => {
        mockBuiltinExecutor.execute.mockRejectedValue(new Error('execution failed'));

        const service = createService();
        const result = await service.executeTool(
          {
            apiName: 'search',
            arguments: '{}',
            id: 'call-err',
            identifier: 'builtin-tool',
            type: 'builtin',
          },
          baseContext,
        );

        expect(result.success).toBe(false);
        expect(result.content).toBe('execution failed');
        expect(result.error?.message).toBe('execution failed');
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      });

      it('should return error response when pluginGatewayService throws', async () => {
        mockPluginGatewayService.execute.mockRejectedValue(new Error('gateway error'));

        const service = createService();
        const result = await service.executeTool(
          {
            apiName: 'run',
            arguments: '{}',
            id: 'call-err',
            identifier: 'my-plugin',
            type: 'default',
          },
          baseContext,
        );

        expect(result.success).toBe(false);
        expect(result.content).toBe('gateway error');
      });
    });

    describe('result truncation', () => {
      it('should truncate long content using toolResultMaxLength from context', async () => {
        const longContent = 'x'.repeat(100);
        mockBuiltinExecutor.execute.mockResolvedValue({
          content: longContent,
          success: true,
        });

        const service = createService();
        const result = await service.executeTool(
          {
            apiName: 'search',
            arguments: '{}',
            id: 'call-1',
            identifier: 'builtin-tool',
            type: 'builtin',
          },
          { ...baseContext, toolResultMaxLength: 50 },
        );

        expect(result.content.length).toBeLessThanOrEqual(50);
      });

      it('should use default max length when toolResultMaxLength is not set', async () => {
        const content = 'short content';
        mockBuiltinExecutor.execute.mockResolvedValue({ content, success: true });

        const service = createService();
        const result = await service.executeTool(
          {
            apiName: 'search',
            arguments: '{}',
            id: 'call-1',
            identifier: 'builtin-tool',
            type: 'builtin',
          },
          baseContext,
        );

        expect(result.content).toBe(content);
      });
    });
  });

  describe('executeMCPTool (via executeTool with type=mcp)', () => {
    it('should return error when manifest is not found', async () => {
      const service = createService();
      const result = await service.executeTool(
        {
          apiName: 'list',
          arguments: '{}',
          id: 'call-mcp',
          identifier: 'missing-tool',
          type: 'mcp',
        },
        { ...baseContext, toolManifestMap: {} },
      );

      expect(result.success).toBe(false);
      expect(result.content).toContain('Manifest not found for tool: missing-tool');
      expect(result.error?.code).toBe('MANIFEST_NOT_FOUND');
    });

    it('should return error when mcpParams is not in manifest', async () => {
      const service = createService();
      const result = await service.executeTool(
        {
          apiName: 'list',
          arguments: '{}',
          id: 'call-mcp',
          identifier: 'my-tool',
          type: 'mcp',
        },
        {
          ...baseContext,
          toolManifestMap: {
            'my-tool': { identifier: 'my-tool' } as any,
          },
        },
      );

      expect(result.success).toBe(false);
      expect(result.content).toContain('MCP configuration not found for tool: my-tool');
      expect(result.error?.code).toBe('MCP_CONFIG_NOT_FOUND');
    });

    it('should call mcpService for stdio type MCP tools', async () => {
      mockMcpService.callTool.mockResolvedValue('mcp result string');

      const service = createService();
      const result = await service.executeTool(
        {
          apiName: 'list',
          arguments: '{"path":"/"}',
          id: 'call-mcp',
          identifier: 'filesystem',
          type: 'mcp',
        },
        {
          ...baseContext,
          toolManifestMap: {
            filesystem: {
              identifier: 'filesystem',
              mcpParams: { type: 'stdio', command: 'npx', args: ['fs-mcp'] },
            } as any,
          },
        },
      );

      expect(mockMcpService.callTool).toHaveBeenCalledWith({
        argsStr: '{"path":"/"}',
        clientParams: { type: 'stdio', command: 'npx', args: ['fs-mcp'] },
        toolName: 'list',
      });
      expect(result.success).toBe(true);
      expect(result.content).toBe('mcp result string');
    });

    it('should serialize non-string MCP result to JSON', async () => {
      const objectResult = { files: ['a.txt', 'b.txt'] };
      mockMcpService.callTool.mockResolvedValue(objectResult);

      const service = createService();
      const result = await service.executeTool(
        {
          apiName: 'list',
          arguments: '{}',
          id: 'call-mcp',
          identifier: 'filesystem',
          type: 'mcp',
        },
        {
          ...baseContext,
          toolManifestMap: {
            filesystem: {
              identifier: 'filesystem',
              mcpParams: { type: 'http', url: 'http://mcp-server' },
            } as any,
          },
        },
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe(JSON.stringify(objectResult));
      expect(result.state).toEqual(objectResult);
    });

    it('should return error when mcpService.callTool throws', async () => {
      mockMcpService.callTool.mockRejectedValue(new Error('MCP connection failed'));

      const service = createService();
      const result = await service.executeTool(
        {
          apiName: 'list',
          arguments: '{}',
          id: 'call-mcp',
          identifier: 'filesystem',
          type: 'mcp',
        },
        {
          ...baseContext,
          toolManifestMap: {
            filesystem: {
              identifier: 'filesystem',
              mcpParams: { type: 'sse', url: 'http://sse-server' },
            } as any,
          },
        },
      );

      expect(result.success).toBe(false);
      expect(result.content).toBe('MCP connection failed');
      expect(result.error?.code).toBe('MCP_EXECUTION_ERROR');
    });

    it('should call cloud MCP endpoint for cloud type', async () => {
      mockCallCloudMcpEndpoint.mockResolvedValue({
        content: [{ type: 'text', text: 'cloud result' }],
        isError: false,
      });

      const service = createService();
      const result = await service.executeTool(
        {
          apiName: 'search',
          arguments: '{"query":"test"}',
          id: 'call-cloud-mcp',
          identifier: 'cloud-tool',
          type: 'mcp',
        },
        {
          ...baseContext,
          toolManifestMap: {
            'cloud-tool': {
              identifier: 'cloud-tool',
              mcpParams: { type: 'cloud', cloudEndpoint: 'https://cloud.example.com' },
            } as any,
          },
        },
      );

      expect(mockCallCloudMcpEndpoint).toHaveBeenCalledWith({
        apiParams: { query: 'test' },
        identifier: 'cloud-tool',
        toolName: 'search',
      });
      expect(result.success).toBe(true);
      expect(result.content).toBe('cloud result');
    });

    it('should return success=false when cloud MCP returns isError=true', async () => {
      mockCallCloudMcpEndpoint.mockResolvedValue({
        content: [{ type: 'text', text: 'error occurred' }],
        isError: true,
      });

      const service = createService();
      const result = await service.executeTool(
        {
          apiName: 'search',
          arguments: '{}',
          id: 'call-cloud-mcp',
          identifier: 'cloud-tool',
          type: 'mcp',
        },
        {
          ...baseContext,
          toolManifestMap: {
            'cloud-tool': {
              identifier: 'cloud-tool',
              mcpParams: { type: 'cloud' },
            } as any,
          },
        },
      );

      expect(result.success).toBe(false);
      expect(result.content).toBe('error occurred');
    });

    it('should return error when cloud MCP endpoint throws', async () => {
      mockCallCloudMcpEndpoint.mockRejectedValue(new Error('cloud endpoint unreachable'));

      const service = createService();
      const result = await service.executeTool(
        {
          apiName: 'search',
          arguments: '{}',
          id: 'call-cloud-mcp',
          identifier: 'cloud-tool',
          type: 'mcp',
        },
        {
          ...baseContext,
          toolManifestMap: {
            'cloud-tool': {
              identifier: 'cloud-tool',
              mcpParams: { type: 'cloud' },
            } as any,
          },
        },
      );

      expect(result.success).toBe(false);
      expect(result.content).toBe('cloud endpoint unreachable');
      expect(result.error?.code).toBe('CLOUD_MCP_EXECUTION_ERROR');
    });

    it('should handle null cloud MCP result gracefully', async () => {
      mockCallCloudMcpEndpoint.mockResolvedValue(null);

      const service = createService();
      const result = await service.executeTool(
        {
          apiName: 'search',
          arguments: '{}',
          id: 'call-cloud-mcp',
          identifier: 'cloud-tool',
          type: 'mcp',
        },
        {
          ...baseContext,
          toolManifestMap: {
            'cloud-tool': {
              identifier: 'cloud-tool',
              mcpParams: { type: 'cloud' },
            } as any,
          },
        },
      );

      // null result: isError is undefined → !undefined = true → success = true
      expect(result.success).toBe(true);
      expect(result.content).toBe('');
    });
  });
});
