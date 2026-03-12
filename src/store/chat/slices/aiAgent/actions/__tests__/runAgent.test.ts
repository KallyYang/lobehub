import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type StreamEvent } from '@/services/agentRuntime';
import { useChatStore } from '@/store/chat/store';

// Keep zustand mock as it's needed globally
vi.mock('zustand/traditional');

// Mock packages that have cloud-specific import chains to prevent resolution errors
vi.mock('@lobechat/business-model-runtime', () => ({}));
vi.mock('@lobechat/model-runtime', () => ({
  ModelProviderList: [],
  ProviderRuntimeMap: {},
}));

// Test Constants
const TEST_IDS = {
  ASSISTANT_MESSAGE_ID: 'test-assistant-id',
  OPERATION_ID: 'test-operation-id',
  TMP_ASSISTANT_ID: 'tmp-assistant-id',
} as const;

// Helper to reset test environment
const resetTestEnvironment = () => {
  vi.clearAllMocks();
  useChatStore.setState(
    {
      operations: {},
      messageOperationMap: {},
      messagesMap: {},
      dbMessagesMap: {},
    },
    false,
  );
};

// Helper to create streaming context
const createStreamingContext = (overrides: any = {}) => ({
  assistantId: '',
  content: '',
  reasoning: '',
  tmpAssistantId: TEST_IDS.TMP_ASSISTANT_ID,
  ...overrides,
});

// Helper to create stream_start event
const createStreamStartEvent = (overrides = {}): StreamEvent => ({
  type: 'stream_start',
  timestamp: Date.now(),
  operationId: TEST_IDS.OPERATION_ID,
  data: {
    assistantMessage: {
      id: TEST_IDS.ASSISTANT_MESSAGE_ID,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  },
  ...overrides,
});

describe('runAgent actions', () => {
  beforeEach(() => {
    resetTestEnvironment();

    // Setup default mocks for store methods
    act(() => {
      useChatStore.setState({
        internal_dispatchMessage: vi.fn(),
        internal_toggleMessageLoading: vi.fn(),
        optimisticUpdateMessageContent: vi.fn(),
        refreshMessages: vi.fn(),
        updateOperationMetadata: vi.fn(),
        operations: {
          [TEST_IDS.OPERATION_ID]: {
            id: TEST_IDS.OPERATION_ID,
            type: 'groupAgentGenerate',
            status: 'running',
            context: {},
            abortController: new AbortController(),
            metadata: {
              startTime: Date.now(),
              lastEventId: '0',
              stepCount: 0,
            },
          },
        },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('internal_handleAgentStreamEvent', () => {
    describe('stream_start event', () => {
      it('should skip message creation/deletion when assistantId is already set (Group Chat flow)', async () => {
        const { result } = renderHook(() => useChatStore());

        // Context with assistantId already set (Group Chat scenario)
        const context = createStreamingContext({
          assistantId: TEST_IDS.ASSISTANT_MESSAGE_ID, // Already set from backend response
        });

        const event = createStreamStartEvent();

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            event,
            context,
          );
        });

        // Should NOT call dispatchMessage for delete or create
        expect(result.current.internal_dispatchMessage).not.toHaveBeenCalled();

        // assistantId should remain unchanged
        expect(context.assistantId).toBe(TEST_IDS.ASSISTANT_MESSAGE_ID);
      });

      it('should delete temp message and create new message when assistantId is empty (normal Agent flow)', async () => {
        const { result } = renderHook(() => useChatStore());

        // Context with empty assistantId (normal Agent scenario)
        const context = createStreamingContext({
          assistantId: '', // Empty, waiting for stream_start
        });

        const event = createStreamStartEvent();

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            event,
            context,
          );
        });

        // Should call dispatchMessage for deleteMessage
        expect(result.current.internal_dispatchMessage).toHaveBeenCalledWith({
          id: TEST_IDS.TMP_ASSISTANT_ID,
          type: 'deleteMessage',
        });

        // Should call dispatchMessage for createMessage
        expect(result.current.internal_dispatchMessage).toHaveBeenCalledWith({
          id: TEST_IDS.ASSISTANT_MESSAGE_ID,
          type: 'createMessage',
          value: expect.objectContaining({
            id: TEST_IDS.ASSISTANT_MESSAGE_ID,
            role: 'assistant',
          }),
        });

        // assistantId should be updated from event
        expect(context.assistantId).toBe(TEST_IDS.ASSISTANT_MESSAGE_ID);
      });

      it('should update assistantId in context from event data when empty', async () => {
        const { result } = renderHook(() => useChatStore());

        const context = createStreamingContext({
          assistantId: '',
        });

        const customAssistantId = 'custom-assistant-id-from-event';
        const event = createStreamStartEvent({
          data: {
            assistantMessage: {
              id: customAssistantId,
              role: 'assistant',
              content: '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
        });

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            event,
            context,
          );
        });

        // assistantId should be updated to the ID from event
        expect(context.assistantId).toBe(customAssistantId);
      });

      it('should NOT update assistantId when stream_start has the same assistantId', async () => {
        const { result } = renderHook(() => useChatStore());

        const originalAssistantId = 'original-assistant-id';
        const context = createStreamingContext({
          assistantId: originalAssistantId,
        });

        const event = createStreamStartEvent({
          data: {
            assistantMessage: {
              id: originalAssistantId, // Same ID
              role: 'assistant',
              content: '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
        });

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            event,
            context,
          );
        });

        // assistantId should remain unchanged
        expect(context.assistantId).toBe(originalAssistantId);
        // Should NOT call refreshMessages or dispatchMessage
        expect(result.current.refreshMessages).not.toHaveBeenCalled();
        expect(result.current.internal_dispatchMessage).not.toHaveBeenCalled();
      });
    });

    describe('multi-step tool execution (stream_start with new assistantId)', () => {
      it('should switch assistantId when a new stream_start arrives with different ID', async () => {
        const { result } = renderHook(() => useChatStore());

        const step0AssistantId = 'step-0-assistant-id';
        const step1AssistantId = 'step-1-assistant-id';
        const context = createStreamingContext({
          assistantId: step0AssistantId,
          content: 'Step 0 content',
          reasoning: 'Step 0 reasoning',
          toolsCalling: [
            {
              id: 'tool-1',
              identifier: 'search',
              type: 'default',
              apiName: 'search',
              arguments: '{}',
            },
          ],
        });

        const event = createStreamStartEvent({
          data: {
            assistantMessage: {
              id: step1AssistantId,
              role: 'assistant',
              content: '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
          stepIndex: 2,
        });

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            event,
            context,
          );
        });

        // assistantId should switch to the new message
        expect(context.assistantId).toBe(step1AssistantId);
        // Accumulated content should be reset
        expect(context.content).toBe('');
        expect(context.reasoning).toBe('');
        expect(context.toolsCalling).toBeUndefined();
        // Should refresh messages to load tool result messages
        expect(result.current.refreshMessages).toHaveBeenCalled();
        // Should start loading on the new assistant message
        expect(result.current.internal_toggleMessageLoading).toHaveBeenCalledWith(
          true,
          step1AssistantId,
        );
      });

      it('should stream text to the correct (new) assistant message after switching', async () => {
        const { result } = renderHook(() => useChatStore());

        const step0AssistantId = 'step-0-assistant-id';
        const step1AssistantId = 'step-1-assistant-id';
        const context = createStreamingContext({
          assistantId: step0AssistantId,
          content: 'Step 0 content',
        });

        // Step 1 stream_start with new assistant ID
        const streamStartEvent = createStreamStartEvent({
          data: {
            assistantMessage: {
              id: step1AssistantId,
              role: 'assistant',
              content: '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
          stepIndex: 2,
        });

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            streamStartEvent,
            context,
          );
        });

        // Now send a text chunk — it should go to the NEW assistant message
        const textChunkEvent: StreamEvent = {
          type: 'stream_chunk',
          timestamp: Date.now(),
          operationId: TEST_IDS.OPERATION_ID,
          stepIndex: 2,
          data: {
            chunkType: 'text',
            content: 'Step 1 response',
          },
        };

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            textChunkEvent,
            context,
          );
        });

        // Content should only contain step 1's text (not step 0's)
        expect(context.content).toBe('Step 1 response');
        // Update should target the NEW assistant message
        expect(result.current.internal_dispatchMessage).toHaveBeenCalledWith({
          id: step1AssistantId,
          type: 'updateMessage',
          value: { content: 'Step 1 response' },
        });
        // Should NOT have updated the old assistant message with step 1 content
        expect(result.current.internal_dispatchMessage).not.toHaveBeenCalledWith(
          expect.objectContaining({
            id: step0AssistantId,
            type: 'updateMessage',
            value: expect.objectContaining({ content: expect.stringContaining('Step 1') }),
          }),
        );
      });

      it('should handle full multi-step lifecycle: stream → tools → new stream', async () => {
        const { result } = renderHook(() => useChatStore());

        const step0AssistantId = 'step-0-assistant-id';
        const step1AssistantId = 'step-1-assistant-id';
        const context = createStreamingContext({ assistantId: '' });

        // === Step 0: First stream_start ===
        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            createStreamStartEvent({
              data: {
                assistantMessage: {
                  id: step0AssistantId,
                  role: 'assistant',
                  content: '',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              },
              stepIndex: 0,
            }),
            context,
          );
        });
        expect(context.assistantId).toBe(step0AssistantId);

        // === Step 0: Text chunk ===
        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            {
              type: 'stream_chunk',
              timestamp: Date.now(),
              operationId: TEST_IDS.OPERATION_ID,
              stepIndex: 0,
              data: { chunkType: 'text', content: 'Let me search' },
            },
            context,
          );
        });
        expect(context.content).toBe('Let me search');

        // === Step 0: Tools calling chunk ===
        const toolPayload = [
          {
            id: 'call-1',
            identifier: 'web-search',
            type: 'default' as const,
            apiName: 'search',
            arguments: '{"q":"test"}',
          },
        ];
        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            {
              type: 'stream_chunk',
              timestamp: Date.now(),
              operationId: TEST_IDS.OPERATION_ID,
              stepIndex: 0,
              data: { chunkType: 'tools_calling', toolsCalling: toolPayload },
            },
            context,
          );
        });
        expect(context.toolsCalling).toEqual(toolPayload);

        // === Step 0: stream_end ===
        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            {
              type: 'stream_end',
              timestamp: Date.now(),
              operationId: TEST_IDS.OPERATION_ID,
              stepIndex: 0,
              data: { finalContent: 'Let me search', toolCalls: toolPayload },
            },
            context,
          );
        });

        // === Step 1: New stream_start with different assistant ID ===
        vi.mocked(result.current.internal_dispatchMessage).mockClear();

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            createStreamStartEvent({
              data: {
                assistantMessage: {
                  id: step1AssistantId,
                  role: 'assistant',
                  content: '',
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                },
              },
              stepIndex: 2,
            }),
            context,
          );
        });

        // Context should be reset for step 1
        expect(context.assistantId).toBe(step1AssistantId);
        expect(context.content).toBe('');
        expect(context.reasoning).toBe('');
        expect(context.toolsCalling).toBeUndefined();

        // === Step 1: Text chunk ===
        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            {
              type: 'stream_chunk',
              timestamp: Date.now(),
              operationId: TEST_IDS.OPERATION_ID,
              stepIndex: 2,
              data: { chunkType: 'text', content: 'Based on the search results' },
            },
            context,
          );
        });

        // Step 1 content should only have step 1's text
        expect(context.content).toBe('Based on the search results');
        // Should update the NEW assistant message
        expect(result.current.internal_dispatchMessage).toHaveBeenCalledWith({
          id: step1AssistantId,
          type: 'updateMessage',
          value: { content: 'Based on the search results' },
        });
      });
    });

    describe('stream_chunk event', () => {
      it('should update content correctly using existing assistantId', async () => {
        const { result } = renderHook(() => useChatStore());

        const context = createStreamingContext({
          assistantId: TEST_IDS.ASSISTANT_MESSAGE_ID,
          content: 'Hello ',
        });

        const event: StreamEvent = {
          type: 'stream_chunk',
          timestamp: Date.now(),
          operationId: TEST_IDS.OPERATION_ID,
          data: {
            chunkType: 'text',
            content: 'World',
          },
        };

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            event,
            context,
          );
        });

        // Should update message with accumulated content
        expect(result.current.internal_dispatchMessage).toHaveBeenCalledWith({
          id: TEST_IDS.ASSISTANT_MESSAGE_ID,
          type: 'updateMessage',
          value: { content: 'Hello World' },
        });

        // Context content should be accumulated
        expect(context.content).toBe('Hello World');
      });

      it('should use tmpAssistantId when assistantId is not yet set', async () => {
        const { result } = renderHook(() => useChatStore());

        const context = createStreamingContext({
          assistantId: '', // Not yet set
          content: '',
        });

        const event: StreamEvent = {
          type: 'stream_chunk',
          timestamp: Date.now(),
          operationId: TEST_IDS.OPERATION_ID,
          data: {
            chunkType: 'text',
            content: 'Hello',
          },
        };

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            event,
            context,
          );
        });

        // Should use tmpAssistantId as fallback
        expect(result.current.internal_dispatchMessage).toHaveBeenCalledWith({
          id: TEST_IDS.TMP_ASSISTANT_ID,
          type: 'updateMessage',
          value: { content: 'Hello' },
        });
      });
    });

    describe('agent_runtime_end event', () => {
      it('should call refreshMessages to sync final state', async () => {
        const { result } = renderHook(() => useChatStore());

        const context = createStreamingContext({
          assistantId: TEST_IDS.ASSISTANT_MESSAGE_ID,
        });

        const event: StreamEvent = {
          type: 'agent_runtime_end',
          timestamp: Date.now(),
          operationId: TEST_IDS.OPERATION_ID,
          stepIndex: 2,
          data: {
            reason: 'completed',
            reasonDetail: 'Agent completed successfully',
            finalState: { status: 'done' },
          },
        };

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            TEST_IDS.OPERATION_ID,
            event,
            context,
          );
        });

        // Should refresh messages to ensure all tool results are synced
        expect(result.current.refreshMessages).toHaveBeenCalled();
        // Should stop loading
        expect(result.current.internal_toggleMessageLoading).toHaveBeenCalledWith(
          false,
          TEST_IDS.ASSISTANT_MESSAGE_ID,
        );
      });
    });

    describe('operation validation', () => {
      it('should ignore events when operation is not found', async () => {
        const { result } = renderHook(() => useChatStore());

        // Clear operations so no operation is found
        act(() => {
          useChatStore.setState({ operations: {} });
        });

        const context = createStreamingContext();
        const event = createStreamStartEvent();

        await act(async () => {
          await result.current.internal_handleAgentStreamEvent(
            'non-existent-operation',
            event,
            context,
          );
        });

        // Should not process event
        expect(result.current.internal_dispatchMessage).not.toHaveBeenCalled();
      });
    });
  });
});
