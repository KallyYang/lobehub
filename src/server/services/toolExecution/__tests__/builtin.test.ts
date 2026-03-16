import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BuiltinToolsExecutor } from '../builtin';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const mockExecuteLobehubSkill = vi.hoisted(() => vi.fn());
const mockExecuteKlavisTool = vi.hoisted(() => vi.fn());

const MockMarketService = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    executeLobehubSkill: mockExecuteLobehubSkill,
  })),
);

const MockKlavisService = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    executeKlavisTool: mockExecuteKlavisTool,
  })),
);

const mockHasServerRuntime = vi.hoisted(() => vi.fn());
const mockGetServerRuntime = vi.hoisted(() => vi.fn());

vi.mock('@/server/services/market', () => ({
  MarketService: MockMarketService,
}));

vi.mock('@/server/services/klavis', () => ({
  KlavisService: MockKlavisService,
}));

vi.mock('../serverRuntimes', () => ({
  getServerRuntime: mockGetServerRuntime,
  hasServerRuntime: mockHasServerRuntime,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const makePayload = (overrides: Record<string, any> = {}) => ({
  apiName: 'myTool',
  arguments: '{"key":"value"}',
  id: 'call-1',
  identifier: 'my-plugin',
  source: 'default',
  type: 'builtin',
  ...overrides,
});

const makeContext = () => ({
  toolManifestMap: {},
  userId: 'user-1',
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BuiltinToolsExecutor', () => {
  let executor: BuiltinToolsExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new BuiltinToolsExecutor({} as any, 'user-1');
  });

  describe('constructor', () => {
    it('should instantiate MarketService and KlavisService with correct args', () => {
      expect(MockMarketService).toHaveBeenCalledWith({ userInfo: { userId: 'user-1' } });
      expect(MockKlavisService).toHaveBeenCalledWith({ db: {}, userId: 'user-1' });
    });
  });

  describe('execute – lobehubSkill routing', () => {
    it('should route to marketService.executeLobehubSkill when source is "lobehubSkill"', async () => {
      const expectedResult = { content: 'skill result', success: true };
      mockExecuteLobehubSkill.mockResolvedValue(expectedResult);

      const payload = makePayload({
        source: 'lobehubSkill',
        identifier: 'my-skill',
        apiName: 'run',
      });

      const result = await executor.execute(payload as any, makeContext());

      expect(mockExecuteLobehubSkill).toHaveBeenCalledWith({
        args: { key: 'value' },
        provider: 'my-skill',
        toolName: 'run',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should parse JSON arguments before forwarding to marketService', async () => {
      mockExecuteLobehubSkill.mockResolvedValue({ content: 'ok', success: true });

      const payload = makePayload({
        source: 'lobehubSkill',
        arguments: '{"count":3,"flag":true}',
      });

      await executor.execute(payload as any, makeContext());

      expect(mockExecuteLobehubSkill).toHaveBeenCalledWith(
        expect.objectContaining({ args: { count: 3, flag: true } }),
      );
    });

    it('should default to empty object when arguments is invalid JSON', async () => {
      mockExecuteLobehubSkill.mockResolvedValue({ content: 'ok', success: true });

      const payload = makePayload({ source: 'lobehubSkill', arguments: 'not-json' });

      await executor.execute(payload as any, makeContext());

      expect(mockExecuteLobehubSkill).toHaveBeenCalledWith(expect.objectContaining({ args: {} }));
    });
  });

  describe('execute – klavis routing', () => {
    it('should route to klavisService.executeKlavisTool when source is "klavis"', async () => {
      const expectedResult = { content: 'klavis result', success: true };
      mockExecuteKlavisTool.mockResolvedValue(expectedResult);

      const payload = makePayload({
        source: 'klavis',
        identifier: 'klavis-plugin',
        apiName: 'doSomething',
      });

      const result = await executor.execute(payload as any, makeContext());

      expect(mockExecuteKlavisTool).toHaveBeenCalledWith({
        args: { key: 'value' },
        identifier: 'klavis-plugin',
        toolName: 'doSomething',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should not call marketService when source is "klavis"', async () => {
      mockExecuteKlavisTool.mockResolvedValue({ content: 'ok', success: true });

      const payload = makePayload({ source: 'klavis' });
      await executor.execute(payload as any, makeContext());

      expect(mockExecuteLobehubSkill).not.toHaveBeenCalled();
    });
  });

  describe('execute – server runtime routing', () => {
    it('should throw when identifier is not found in server runtime registry', async () => {
      mockHasServerRuntime.mockReturnValue(false);

      const payload = makePayload({ source: 'default', identifier: 'unknown-tool' });

      await expect(executor.execute(payload as any, makeContext())).rejects.toThrow(
        'Builtin tool "unknown-tool" is not implemented',
      );
    });

    it('should throw when apiName method does not exist on the runtime', async () => {
      mockHasServerRuntime.mockReturnValue(true);
      mockGetServerRuntime.mockResolvedValue({}); // runtime with no methods

      const payload = makePayload({ source: 'default', identifier: 'calc', apiName: 'compute' });

      await expect(executor.execute(payload as any, makeContext())).rejects.toThrow(
        "Builtin tool calc's compute is not implemented",
      );
    });

    it('should execute the tool method and return its result', async () => {
      const expectedResult = { content: '42', success: true };
      const mockRuntime = { add: vi.fn().mockResolvedValue(expectedResult) };
      mockHasServerRuntime.mockReturnValue(true);
      mockGetServerRuntime.mockResolvedValue(mockRuntime);

      const payload = makePayload({ source: 'default', identifier: 'calc', apiName: 'add' });
      const context = makeContext();

      const result = await executor.execute(payload as any, context);

      expect(mockGetServerRuntime).toHaveBeenCalledWith('calc', context);
      expect(mockRuntime.add).toHaveBeenCalledWith({ key: 'value' }, context);
      expect(result).toEqual(expectedResult);
    });

    it('should catch runtime errors and return failure result', async () => {
      const runtimeError = new Error('runtime crash');
      const mockRuntime = { add: vi.fn().mockRejectedValue(runtimeError) };
      mockHasServerRuntime.mockReturnValue(true);
      mockGetServerRuntime.mockResolvedValue(mockRuntime);

      const payload = makePayload({ source: 'default', identifier: 'calc', apiName: 'add' });

      const result = await executor.execute(payload as any, makeContext());

      expect(result).toEqual({
        content: 'runtime crash',
        error: runtimeError,
        success: false,
      });
    });

    it('should not call klavis or market when routing to server runtime', async () => {
      const mockRuntime = { doThing: vi.fn().mockResolvedValue({ content: 'ok', success: true }) };
      mockHasServerRuntime.mockReturnValue(true);
      mockGetServerRuntime.mockResolvedValue(mockRuntime);

      const payload = makePayload({ source: 'other', apiName: 'doThing' });
      await executor.execute(payload as any, makeContext());

      expect(mockExecuteLobehubSkill).not.toHaveBeenCalled();
      expect(mockExecuteKlavisTool).not.toHaveBeenCalled();
    });
  });
});
