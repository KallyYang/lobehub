import type * as ModelBankModule from 'model-bank';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiAgentService } from '../index';

const {
  mockMessageCreate,
  mockCreateOperation,
  mockTopicCreate,
  mockThreadCreate,
  mockUploadFromUrl,
} = vi.hoisted(() => ({
  mockCreateOperation: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockThreadCreate: vi.fn(),
  mockTopicCreate: vi.fn(),
  mockUploadFromUrl: vi.fn(),
}));

vi.mock('@/libs/trusted-client', () => ({
  generateTrustedClientToken: vi.fn().mockReturnValue(undefined),
  getTrustedClientTokenForSession: vi.fn().mockResolvedValue(undefined),
  isTrustedClientEnabled: vi.fn().mockReturnValue(false),
}));

vi.mock('@/database/models/message', () => ({
  MessageModel: vi.fn().mockImplementation(() => ({
    create: mockMessageCreate,
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock('@/database/models/agent', () => ({
  AgentModel: vi.fn().mockImplementation(() => ({
    getAgentConfig: vi.fn().mockResolvedValue({
      chatConfig: {},
      files: [],
      id: 'agent-1',
      knowledgeBases: [],
      model: 'gpt-4',
      plugins: [],
      provider: 'openai',
      systemRole: 'You are a helpful assistant',
    }),
  })),
}));

vi.mock('@/server/services/agent', () => ({
  AgentService: vi.fn().mockImplementation(() => ({
    getAgentConfig: vi.fn().mockResolvedValue({
      chatConfig: {},
      files: [],
      id: 'agent-1',
      knowledgeBases: [],
      model: 'gpt-4',
      plugins: [],
      provider: 'openai',
      systemRole: 'You are a helpful assistant',
    }),
  })),
}));

vi.mock('@/database/models/plugin', () => ({
  PluginModel: vi.fn().mockImplementation(() => ({
    query: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/database/models/topic', () => ({
  TopicModel: vi.fn().mockImplementation(() => ({
    create: mockTopicCreate,
  })),
}));

vi.mock('@/database/models/thread', () => ({
  ThreadModel: vi.fn().mockImplementation(() => ({
    create: mockThreadCreate,
    findById: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock('@/server/services/agentRuntime', () => ({
  AgentRuntimeService: vi.fn().mockImplementation(() => ({
    createOperation: mockCreateOperation,
  })),
}));

vi.mock('@/server/services/market', () => ({
  MarketService: vi.fn().mockImplementation(() => ({
    getLobehubSkillManifests: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/server/services/klavis', () => ({
  KlavisService: vi.fn().mockImplementation(() => ({
    getKlavisManifests: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn().mockImplementation(() => ({
    uploadFromUrl: mockUploadFromUrl,
  })),
}));

vi.mock('@/server/modules/Mecha', () => ({
  createServerAgentToolsEngine: vi.fn().mockReturnValue({
    generateToolsDetailed: vi.fn().mockReturnValue({ enabledToolIds: [], tools: [] }),
    getEnabledPluginManifests: vi.fn().mockReturnValue(new Map()),
  }),
  serverMessagesEngine: vi.fn().mockResolvedValue([{ content: 'test', role: 'user' }]),
}));

vi.mock('@/server/services/toolExecution/deviceProxy', () => ({
  deviceProxy: {
    isConfigured: false,
    queryDeviceList: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('model-bank', async (importOriginal) => {
  const actual = await importOriginal<typeof ModelBankModule>();
  return {
    ...actual,
    LOBE_DEFAULT_MODEL_LIST: [
      {
        abilities: { functionCall: true, video: false, vision: true },
        id: 'gpt-4',
        providerId: 'openai',
      },
    ],
  };
});

describe('AiAgentService.execAgent - regression tests for sendMessage support', () => {
  let service: AiAgentService;
  const mockDb = {} as any;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    mockMessageCreate.mockResolvedValue({ id: 'msg-1' });
    mockTopicCreate.mockResolvedValue({ id: 'topic-1' });
    mockCreateOperation.mockResolvedValue({
      autoStarted: true,
      messageId: 'queue-msg-1',
      operationId: 'op-123',
      success: true,
    });

    service = new AiAgentService(mockDb, userId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========== Gap 1: fileIds passthrough ==========
  describe('fileIds - pass already-uploaded file IDs', () => {
    it('should pass fileIds directly to user message without calling uploadFromUrl', async () => {
      const result = await service.execAgent({
        agentId: 'agent-1',
        fileIds: ['file-already-1', 'file-already-2'],
        prompt: 'Analyze these files',
      });

      // Should NOT call uploadFromUrl since files are already uploaded
      expect(mockUploadFromUrl).not.toHaveBeenCalled();

      // Verify user message was created with the provided fileIds
      const userMessageCall = mockMessageCreate.mock.calls.find((call) => call[0].role === 'user');
      expect(userMessageCall![0].files).toEqual(['file-already-1', 'file-already-2']);
      expect(result.success).toBe(true);
    });

    it('should merge fileIds with newly uploaded file IDs', async () => {
      mockUploadFromUrl.mockResolvedValue({
        fileId: 'file-new-1',
        key: 'files/test-user-id/xxx/photo.png',
        url: 'https://app.lobehub.com/f/file-new-1',
      });

      await service.execAgent({
        agentId: 'agent-1',
        fileIds: ['file-existing-1'],
        files: [
          {
            mimeType: 'image/png',
            name: 'photo.png',
            size: 12345,
            url: 'https://cdn.example.com/photo.png',
          },
        ],
        prompt: 'Look at these',
      });

      // Verify both existing and new file IDs are included
      const userMessageCall = mockMessageCreate.mock.calls.find((call) => call[0].role === 'user');
      expect(userMessageCall![0].files).toContain('file-existing-1');
      expect(userMessageCall![0].files).toContain('file-new-1');
      expect(userMessageCall![0].files).toHaveLength(2);
    });
  });

  // ========== Gap 2: newTopic.topicMessageIds ==========
  describe('newTopic.topicMessageIds - associate existing messages with new topic', () => {
    it('should pass topicMessageIds to topicModel.create when creating new topic', async () => {
      await service.execAgent({
        agentId: 'agent-1',
        newTopic: {
          topicMessageIds: ['existing-msg-1', 'existing-msg-2'],
        },
        prompt: 'Continue this conversation',
      });

      // Verify topicModel.create was called with messages
      expect(mockTopicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: ['existing-msg-1', 'existing-msg-2'],
        }),
      );
    });

    it('should create topic without topicMessageIds when not provided', async () => {
      await service.execAgent({
        agentId: 'agent-1',
        prompt: 'Hello',
      });

      // topicModel.create should be called (new topic created since no topicId given)
      expect(mockTopicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: undefined,
        }),
      );
    });
  });

  // ========== Gap 3: newThread creation ==========
  describe('newThread - create thread during execution', () => {
    it('should create a thread and use its ID for messages', async () => {
      mockThreadCreate.mockResolvedValue({ id: 'thread-new-1' });

      const result = await service.execAgent({
        agentId: 'agent-1',
        appContext: { topicId: 'topic-existing' },
        newThread: {
          sourceMessageId: 'source-msg-1',
          title: 'Sub-task thread',
          type: 'agent_task',
        },
        prompt: 'Execute this sub-task',
      });

      // Verify thread was created with correct params
      expect(mockThreadCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceMessageId: 'source-msg-1',
          title: 'Sub-task thread',
          type: 'agent_task',
        }),
      );

      // Verify both user and assistant messages use the new thread ID
      const userMsgCall = mockMessageCreate.mock.calls.find((call) => call[0].role === 'user');
      const asstMsgCall = mockMessageCreate.mock.calls.find((call) => call[0].role === 'assistant');
      expect(userMsgCall![0].threadId).toBe('thread-new-1');
      expect(asstMsgCall![0].threadId).toBe('thread-new-1');

      // Verify createdThreadId is in the result
      expect(result.createdThreadId).toBe('thread-new-1');
    });

    it('should use appContext.threadId when newThread is not provided', async () => {
      const result = await service.execAgent({
        agentId: 'agent-1',
        appContext: { threadId: 'existing-thread', topicId: 'topic-existing' },
        prompt: 'Reply in this thread',
      });

      // Should NOT create a new thread
      expect(mockThreadCreate).not.toHaveBeenCalled();

      // Messages should use appContext.threadId
      const userMsgCall = mockMessageCreate.mock.calls.find((call) => call[0].role === 'user');
      expect(userMsgCall![0].threadId).toBe('existing-thread');

      // No createdThreadId
      expect(result.createdThreadId).toBeUndefined();
    });

    it('should pass newThread.parentThreadId for nested threads', async () => {
      mockThreadCreate.mockResolvedValue({ id: 'thread-nested-1' });

      await service.execAgent({
        agentId: 'agent-1',
        newThread: {
          parentThreadId: 'parent-thread-1',
          sourceMessageId: 'source-msg-1',
          type: 'agent_task',
        },
        prompt: 'Nested task',
      });

      expect(mockThreadCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          parentThreadId: 'parent-thread-1',
          sourceMessageId: 'source-msg-1',
        }),
      );
    });
  });

  // ========== Gap 4: isCreateNewTopic and createdThreadId in response ==========
  describe('response includes isCreateNewTopic and createdThreadId', () => {
    it('should return isCreateNewTopic=true when a new topic was created', async () => {
      // No topicId in appContext → creates new topic
      const result = await service.execAgent({
        agentId: 'agent-1',
        prompt: 'Start new conversation',
      });

      expect(result.isCreateNewTopic).toBe(true);
      expect(result.topicId).toBe('topic-1');
    });

    it('should return isCreateNewTopic=false when using existing topicId', async () => {
      const result = await service.execAgent({
        agentId: 'agent-1',
        appContext: { topicId: 'topic-existing' },
        prompt: 'Continue conversation',
      });

      expect(result.isCreateNewTopic).toBe(false);
      expect(result.topicId).toBe('topic-existing');
    });

    it('should include createdThreadId when newThread is provided', async () => {
      mockThreadCreate.mockResolvedValue({ id: 'thread-created' });

      const result = await service.execAgent({
        agentId: 'agent-1',
        newThread: {
          sourceMessageId: 'src-msg',
          type: 'agent_task',
        },
        prompt: 'Task with thread',
      });

      expect(result.createdThreadId).toBe('thread-created');
    });

    it('should include isCreateNewTopic and createdThreadId even on operation error', async () => {
      mockThreadCreate.mockResolvedValue({ id: 'thread-err' });
      mockCreateOperation.mockRejectedValue(new Error('QStash unavailable'));

      const result = await service.execAgent({
        agentId: 'agent-1',
        newThread: {
          sourceMessageId: 'src-msg',
          type: 'agent_task',
        },
        prompt: 'This will fail',
      });

      expect(result.success).toBe(false);
      expect(result.isCreateNewTopic).toBe(true);
      expect(result.createdThreadId).toBe('thread-err');
      expect(result.error).toBe('QStash unavailable');
    });
  });

  // ========== pageSelections metadata ==========
  describe('pageSelections - attach metadata to user message', () => {
    it('should include pageSelections in user message metadata', async () => {
      await service.execAgent({
        agentId: 'agent-1',
        pageSelections: [
          { content: 'Selected text from page', title: 'Test Page', url: 'https://example.com' },
        ],
        prompt: 'Summarize this selection',
      });

      const userMessageCall = mockMessageCreate.mock.calls.find((call) => call[0].role === 'user');
      expect(userMessageCall![0].metadata).toEqual({
        pageSelections: [
          {
            content: 'Selected text from page',
            title: 'Test Page',
            url: 'https://example.com',
          },
        ],
      });
    });

    it('should not set metadata when pageSelections is empty', async () => {
      await service.execAgent({
        agentId: 'agent-1',
        prompt: 'No selections',
      });

      const userMessageCall = mockMessageCreate.mock.calls.find((call) => call[0].role === 'user');
      expect(userMessageCall![0].metadata).toBeUndefined();
    });
  });
});
