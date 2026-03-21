import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BuiltinToolsExecutor } from '../builtin';
import { type ToolExecutionContext } from '../types';

// Mock debug
vi.mock('debug', () => ({
  default: () => vi.fn(),
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

const mockExecuteLobehubSkill = vi.hoisted(() => vi.fn());
const mockExecuteKlavisTool = vi.hoisted(() => vi.fn());
const mockGetServerRuntime = vi.hoisted(() => vi.fn());
const mockHasServerRuntime = vi.hoisted(() => vi.fn());

vi.mock('@/server/services/market', () => ({
  MarketService: vi.fn().mockImplementation(() => ({
    executeLobehubSkill: mockExecuteLobehubSkill,
  })),
}));

vi.mock('@/server/services/klavis', () => ({
  KlavisService: vi.fn().mockImplementation(() => ({
    executeKlavisTool: mockExecuteKlavisTool,
  })),
}));

vi.mock('../serverRuntimes', () => ({
  getServerRuntime: mockGetServerRuntime,
  hasServerRuntime: mockHasServerRuntime,
}));

const mockDb = {} as any;
const baseContext: ToolExecutionContext = {
  toolManifestMap: {},
  userId: 'user-1',
};

describe('BuiltinToolsExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('execute - lobehubSkill source', () => {
    it('should route to marketService.executeLobehubSkill', async () => {
      mockExecuteLobehubSkill.mockResolvedValue({ content: 'skill result', success: true });

      const executor = new BuiltinToolsExecutor(mockDb, 'user-1');
      const result = await executor.execute(
        {
          apiName: 'searchPlugins',
          arguments: '{"query":"weather"}',
          id: 'call-1',
          identifier: 'lobehub-market',
          source: 'lobehubSkill',
          type: 'builtin',
        },
        baseContext,
      );

      expect(mockExecuteLobehubSkill).toHaveBeenCalledWith({
        args: { query: 'weather' },
        provider: 'lobehub-market',
        toolName: 'searchPlugins',
      });
      expect(result.content).toBe('skill result');
      expect(result.success).toBe(true);
    });

    it('should pass empty args when arguments cannot be parsed', async () => {
      mockExecuteLobehubSkill.mockResolvedValue({ content: 'result', success: true });

      const executor = new BuiltinToolsExecutor(mockDb, 'user-1');
      await executor.execute(
        {
          apiName: 'doSomething',
          arguments: 'invalid json',
          id: 'call-1',
          identifier: 'market',
          source: 'lobehubSkill',
          type: 'builtin',
        },
        baseContext,
      );

      expect(mockExecuteLobehubSkill).toHaveBeenCalledWith(expect.objectContaining({ args: {} }));
    });
  });

  describe('execute - klavis source', () => {
    it('should route to klavisService.executeKlavisTool', async () => {
      mockExecuteKlavisTool.mockResolvedValue({ content: 'klavis result', success: true });

      const executor = new BuiltinToolsExecutor(mockDb, 'user-1');
      const result = await executor.execute(
        {
          apiName: 'connect',
          arguments: '{"service":"github"}',
          id: 'call-2',
          identifier: 'klavis-integration',
          source: 'klavis',
          type: 'builtin',
        },
        baseContext,
      );

      expect(mockExecuteKlavisTool).toHaveBeenCalledWith({
        args: { service: 'github' },
        identifier: 'klavis-integration',
        toolName: 'connect',
      });
      expect(result.content).toBe('klavis result');
      expect(result.success).toBe(true);
    });
  });

  describe('execute - server runtime', () => {
    it('should throw when identifier has no registered server runtime', async () => {
      mockHasServerRuntime.mockReturnValue(false);

      const executor = new BuiltinToolsExecutor(mockDb, 'user-1');
      await expect(
        executor.execute(
          {
            apiName: 'run',
            arguments: '{}',
            id: 'call-3',
            identifier: 'unknown-builtin',
            type: 'builtin',
          },
          baseContext,
        ),
      ).rejects.toThrow('Builtin tool "unknown-builtin" is not implemented');
    });

    it('should throw when apiName is not found in runtime', async () => {
      mockHasServerRuntime.mockReturnValue(true);
      mockGetServerRuntime.mockResolvedValue({}); // runtime with no methods

      const executor = new BuiltinToolsExecutor(mockDb, 'user-1');
      await expect(
        executor.execute(
          {
            apiName: 'missingMethod',
            arguments: '{}',
            id: 'call-4',
            identifier: 'my-builtin',
            type: 'builtin',
          },
          baseContext,
        ),
      ).rejects.toThrow("Builtin tool my-builtin's missingMethod is not implemented");
    });

    it('should call the runtime method and return result', async () => {
      const mockRuntime = {
        doAction: vi.fn().mockResolvedValue({ content: 'runtime result', success: true }),
      };
      mockHasServerRuntime.mockReturnValue(true);
      mockGetServerRuntime.mockResolvedValue(mockRuntime);

      const executor = new BuiltinToolsExecutor(mockDb, 'user-1');
      const result = await executor.execute(
        {
          apiName: 'doAction',
          arguments: '{"param":"value"}',
          id: 'call-5',
          identifier: 'my-builtin',
          type: 'builtin',
        },
        baseContext,
      );

      expect(mockRuntime.doAction).toHaveBeenCalledWith({ param: 'value' }, baseContext);
      expect(result.content).toBe('runtime result');
      expect(result.success).toBe(true);
    });

    it('should catch runtime method errors and return error result', async () => {
      const mockRuntime = {
        doAction: vi.fn().mockRejectedValue(new Error('runtime crashed')),
      };
      mockHasServerRuntime.mockReturnValue(true);
      mockGetServerRuntime.mockResolvedValue(mockRuntime);

      const executor = new BuiltinToolsExecutor(mockDb, 'user-1');
      const result = await executor.execute(
        {
          apiName: 'doAction',
          arguments: '{}',
          id: 'call-6',
          identifier: 'my-builtin',
          type: 'builtin',
        },
        baseContext,
      );

      expect(result.success).toBe(false);
      expect(result.content).toBe('runtime crashed');
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe('runtime crashed');
    });

    it('should pass parsed args to the runtime method', async () => {
      const mockRuntime = {
        process: vi.fn().mockResolvedValue({ content: 'ok', success: true }),
      };
      mockHasServerRuntime.mockReturnValue(true);
      mockGetServerRuntime.mockResolvedValue(mockRuntime);

      const executor = new BuiltinToolsExecutor(mockDb, 'user-1');
      await executor.execute(
        {
          apiName: 'process',
          arguments: '{"items":[1,2,3],"flag":true}',
          id: 'call-7',
          identifier: 'processor',
          type: 'builtin',
        },
        baseContext,
      );

      expect(mockRuntime.process).toHaveBeenCalledWith(
        { flag: true, items: [1, 2, 3] },
        baseContext,
      );
    });
  });
});
