// Disable the auto sort key eslint rule to make the code more logic and readable
import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { LOADING_FLAT } from '@lobechat/const';
import {
  type ChatImageItem,
  type ChatThreadType,
  type ChatVideoItem,
  type ConversationContext,
  type SendMessageParams,
  type SendMessageServerResponse,
} from '@lobechat/types';
import { nanoid } from '@lobechat/utils';
import { TRPCClientError } from '@trpc/client';
import debug from 'debug';
import { t } from 'i18next';

import { markUserValidAction } from '@/business/client/markUserValidAction';
import { lambdaClient } from '@/libs/trpc/client';
import { agentRuntimeClient, type StreamEvent } from '@/services/agentRuntime';
import { aiAgentService } from '@/services/aiAgent';
import { aiChatService } from '@/services/aiChat';
import { getAgentStoreState } from '@/store/agent';
import { agentByIdSelectors, agentSelectors } from '@/store/agent/selectors';
import { agentGroupByIdSelectors, getChatGroupStoreState } from '@/store/agentGroup';
import { type ChatStore } from '@/store/chat/store';
import { getFileStoreState } from '@/store/file/store';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { type StoreSetter } from '@/store/types';
import { useUserMemoryStore } from '@/store/userMemory';

import { dbMessageSelectors, displayMessageSelectors, topicSelectors } from '../../../selectors';
import { messageMapKey } from '../../../utils/messageMapKey';

const log = debug('store:chat:conversationLifecycle');

/**
 * Extended params for sendMessage with context
 */
export interface SendMessageWithContextParams extends SendMessageParams {
  /**
   * Conversation context (required for cross-store usage)
   * Contains sessionId, topicId, and threadId
   */
  context: ConversationContext;
}

/**
 * Result returned from sendMessage
 */
export interface SendMessageResult {
  /** The created assistant message ID */
  assistantMessageId: string;
  /** The created thread ID (if a new thread was created) */
  createdThreadId?: string;
  /** The created user message ID */
  userMessageId: string;
}

/**
 * Actions managing the complete lifecycle of conversations including sending,
 * regenerating, and resending messages
 */

type Setter = StoreSetter<ChatStore>;
export const conversationLifecycle = (set: Setter, get: () => ChatStore, _api?: unknown) =>
  new ConversationLifecycleActionImpl(set, get, _api);

export class ConversationLifecycleActionImpl {
  readonly #get: () => ChatStore;

  constructor(set: Setter, get: () => ChatStore, _api?: unknown) {
    void _api;
    void set;
    this.#get = get;
  }

  sendMessage = async ({
    message,
    files,
    onlyAddUserMessage,
    context,
    messages: inputMessages,
    parentId: inputParentId,
    pageSelections,
  }: SendMessageWithContextParams): Promise<SendMessageResult | undefined> => {
    const { internal_execAgentRuntime, mainInputEditor } = this.#get();

    // Use context from params (required)
    const { agentId } = context;
    // If creating new thread (isNew + scope='thread'), threadId will be created by server
    const isCreatingNewThread = context.isNew && context.scope === 'thread';
    // Build newThread params for server from new context format
    // Only create newThread if we have both sourceMessageId and threadType
    const newThread =
      isCreatingNewThread && context.sourceMessageId && context.threadType
        ? {
            sourceMessageId: context.sourceMessageId,
            type: context.threadType as ChatThreadType,
          }
        : undefined;

    if (!agentId) return;

    // When creating new thread, override threadId to undefined (server will create it)
    // Check if current agentId is the supervisor agent of the group
    let isGroupSupervisor = false;
    if (context.groupId) {
      const group = agentGroupByIdSelectors.groupById(context.groupId)(getChatGroupStoreState());
      isGroupSupervisor = group?.supervisorAgentId === agentId;
    }
    const operationContext = {
      ...context,
      ...(isCreatingNewThread && { threadId: undefined }),
      ...(isGroupSupervisor && { isSupervisor: true }),
    };

    const fileIdList = files?.map((f) => f.id);

    const hasFile = !!fileIdList && fileIdList.length > 0;

    // if message is empty or no files, then stop
    if (!message && !hasFile) return;

    if (onlyAddUserMessage) {
      await this.#get().addUserMessage({ message, fileList: fileIdList });

      return;
    }

    // Use provided messages or query from store
    const contextKey = messageMapKey(context);
    const messages =
      inputMessages ?? displayMessageSelectors.getDisplayMessagesByKey(contextKey)(this.#get());
    const lastMessage = messages.at(-1);

    useUserMemoryStore.getState().setActiveMemoryContext({
      agent: agentSelectors.getAgentMetaById(agentId)(getAgentStoreState()),
      topic: topicSelectors.currentActiveTopic(this.#get()),
      latestUserMessage: lastMessage?.content,
      sendingMessage: message,
    });

    // Use provided parentId or calculate from messages
    let parentId: string | undefined = inputParentId;
    if (!parentId && lastMessage) {
      parentId = displayMessageSelectors.findLastMessageId(lastMessage.id)(this.#get());
    }

    // Create operation for send message first, so we can use operationId for optimistic updates
    const tempId = 'tmp_' + nanoid();
    const tempAssistantId = 'tmp_' + nanoid();
    const { operationId, abortController } = this.#get().startOperation({
      type: 'sendMessage',
      context: { ...operationContext, messageId: tempId },
      label: 'Send Message',
      metadata: {
        // Mark this as thread operation if threadId exists
        inThread: !!operationContext.threadId,
      },
    });

    // Construct local media preview for server-mode temporary messages (S3 URL takes priority)
    const filesInStore = getFileStoreState().chatUploadFileList;
    const tempImages: ChatImageItem[] = filesInStore
      .filter((f) => f.file?.type?.startsWith('image'))
      .map((f) => ({
        id: f.id,
        url: f.fileUrl || f.base64Url || f.previewUrl || '',
        alt: f.file?.name || f.id,
      }));
    const tempVideos: ChatVideoItem[] = filesInStore
      .filter((f) => f.file?.type?.startsWith('video'))
      .map((f) => ({
        id: f.id,
        url: f.fileUrl || f.base64Url || f.previewUrl || '',
        alt: f.file?.name || f.id,
      }));

    // use optimistic update to avoid the slow waiting (now with operationId for correct context)
    this.#get().optimisticCreateTmpMessage(
      {
        content: message,
        // if message has attached with files, then add files to message and the agent
        files: fileIdList,
        role: 'user',
        agentId: operationContext.agentId,
        // if there is topicId，then add topicId to message
        topicId: operationContext.topicId ?? undefined,
        threadId: operationContext.threadId ?? undefined,
        imageList: tempImages.length > 0 ? tempImages : undefined,
        videoList: tempVideos.length > 0 ? tempVideos : undefined,
        // Pass pageSelections metadata for immediate display
        metadata: pageSelections?.length ? { pageSelections } : undefined,
      },
      { operationId, tempMessageId: tempId },
    );
    this.#get().optimisticCreateTmpMessage(
      {
        content: LOADING_FLAT,
        role: 'assistant',
        agentId: operationContext.agentId,
        // if there is topicId，then add topicId to message
        topicId: operationContext.topicId ?? undefined,
        threadId: operationContext.threadId ?? undefined,
        // Pass isSupervisor metadata for group orchestration (consistent with server)
        metadata: operationContext.isSupervisor ? { isSupervisor: true } : undefined,
      },
      { operationId, tempMessageId: tempAssistantId },
    );
    this.#get().internal_toggleMessageLoading(true, tempId);

    // Associate temp messages with operation
    this.#get().associateMessageWithOperation(tempId, operationId);
    this.#get().associateMessageWithOperation(tempAssistantId, operationId);

    // Store message content in operation metadata for cancel restoration
    // Note: editor JSON state is already cleared at this point (clearContent in handleSend),
    // so we store the raw message text instead
    this.#get().updateOperationMetadata(operationId, {
      inputMessageContent: message,
      inputSendErrorMsg: undefined,
    });

    // ===== Agent Mode Branch =====
    // When agent mode is enabled, use server-side execution (execAgent TRPC + SSE)
    // instead of the client-side agent loop (sendMessageInServer + internal_execAgentRuntime)
    const isAgentMode = agentByIdSelectors.getAgentEnableModeById(agentId)(getAgentStoreState());
    if (isAgentMode) {
      return this.#execAgentModeSendMessage({
        abortController,
        context: operationContext,
        fileIds: fileIdList,
        message,
        messages,
        newThread,
        operationId,
        pageSelections,
        tempAssistantId,
        tempId,
      });
    }

    let data: SendMessageServerResponse | undefined;
    try {
      const { model, provider } = agentSelectors.getAgentConfigById(agentId)(getAgentStoreState());

      const topicId = operationContext.topicId;
      data = await aiChatService.sendMessageInServer(
        {
          newUserMessage: { content: message, files: fileIdList, pageSelections, parentId },
          // if there is topicId，then add topicId to message
          topicId: topicId ?? undefined,
          threadId: operationContext.threadId ?? undefined,
          // Support creating new thread along with message
          newThread: newThread
            ? {
                sourceMessageId: newThread.sourceMessageId,
                type: newThread.type,
              }
            : undefined,
          newTopic: !topicId
            ? {
                topicMessageIds: messages.map((m) => m.id),
                title: message.slice(0, 20) || t('defaultTitle', { ns: 'topic' }),
              }
            : undefined,
          agentId: operationContext.agentId,
          // Pass groupId for group chat scenarios
          groupId: operationContext.groupId ?? undefined,
          newAssistantMessage: {
            // Pass isSupervisor metadata for group orchestration
            metadata: operationContext.isSupervisor ? { isSupervisor: true } : undefined,
            model,
            provider: provider!,
          },
        },
        abortController,
      );
      // Use created topicId/threadId if available, otherwise use original from context
      let finalTopicId = operationContext.topicId;
      const finalThreadId = data.createdThreadId ?? operationContext.threadId;

      // refresh the total data
      if (data?.topics) {
        const pageSize = systemStatusSelectors.topicPageSize(useGlobalStore.getState());
        this.#get().internal_updateTopics(operationContext.agentId, {
          groupId: operationContext.groupId,
          items: data.topics.items,
          pageSize,
          total: data.topics.total,
        });
        finalTopicId = data.topicId;

        // Record the created topicId in metadata (not context)
        this.#get().updateOperationMetadata(operationId, { createdTopicId: data.topicId });
      } else if (operationContext.topicId) {
        // Optimistically update topic's updatedAt so sidebar re-groups immediately
        this.#get().internal_dispatchTopic({
          type: 'updateTopic',
          id: operationContext.topicId,
          value: { updatedAt: Date.now() },
        });
      }

      // Record created threadId in operation metadata
      if (data.createdThreadId) {
        this.#get().updateOperationMetadata(operationId, { createdThreadId: data.createdThreadId });

        // Update portalThreadId to switch from "new thread" mode to "existing thread" mode
        // This ensures the Portal Thread UI displays correctly with the real thread ID
        this.#get().openThreadInPortal(data.createdThreadId, context.sourceMessageId);

        // Refresh threads list to update the sidebar
        this.#get().refreshThreads();
      }

      // Create final context with updated topicId/threadId from server response
      const finalContext = { ...operationContext, topicId: finalTopicId, threadId: finalThreadId };
      this.#get().replaceMessages(data.messages, {
        context: finalContext,
        action: 'sendMessage/serverResponse',
      });

      if (data.isCreateNewTopic && data.topicId) {
        // clearNewKey: true ensures the _new key data is cleared after topic creation
        await this.#get().switchTopic(data.topicId, {
          clearNewKey: true,
          skipRefreshMessage: true,
        });
      }
    } catch (e) {
      console.error(e);
      // Fail operation on error
      this.#get().failOperation(operationId, {
        type: e instanceof Error ? e.name : 'unknown_error',
        message: e instanceof Error ? e.message : 'Unknown error',
      });

      if (e instanceof TRPCClientError) {
        const isAbort = e.message.includes('aborted') || e.name === 'AbortError';
        // Check if error is due to cancellation
        if (!isAbort) {
          this.#get().updateOperationMetadata(operationId, { inputSendErrorMsg: e.message });
          this.#get().mainInputEditor?.setDocument('markdown', message);
        }
      }
    } finally {
      // A new topic was created, or the user cancelled the message (or it failed), so data is absent here
      if (data?.isCreateNewTopic || !data) {
        this.#get().internal_dispatchMessage(
          { type: 'deleteMessages', ids: [tempId, tempAssistantId] },
          { operationId },
        );
      }
    }

    this.#get().internal_toggleMessageLoading(false, tempId);

    // Clear editor temp state after message created
    if (data) {
      this.#get().updateOperationMetadata(operationId, { inputMessageContent: null });
    }

    if (ENABLE_BUSINESS_FEATURES) {
      markUserValidAction();
    }

    if (!data) return;

    if (data.topicId) this.#get().internal_updateTopicLoading(data.topicId, true);

    const summaryTitle = async () => {
      // check activeTopic and then auto update topic title
      if (data.isCreateNewTopic) {
        await this.#get().summaryTopicTitle(data.topicId, data.messages);
        return;
      }

      if (!data.topicId) return;

      const topic = topicSelectors.getTopicById(data.topicId)(this.#get());

      if (topic && !topic.title) {
        const chats = displayMessageSelectors
          .getDisplayMessagesByKey(messageMapKey({ agentId, topicId: topic.id }))(this.#get())
          .filter((item) => item.id !== data.assistantMessageId);

        await this.#get().summaryTopicTitle(topic.id, chats);
      }
    };

    summaryTitle().catch(console.error);

    // Complete sendMessage operation here - message creation is done
    // execAgentRuntime is a separate operation (child) that handles AI response generation
    this.#get().completeOperation(operationId);

    // Create final context for AI execution (with updated topicId/threadId from server)
    const execContext = {
      ...operationContext,
      topicId: data.topicId ?? operationContext.topicId,
      threadId: data.createdThreadId ?? operationContext.threadId,
    };

    // Get the current messages to generate AI response
    const displayMessages = displayMessageSelectors.getDisplayMessagesByKey(
      messageMapKey(execContext),
    )(this.#get());

    try {
      await internal_execAgentRuntime({
        context: execContext,
        messages: displayMessages,
        parentMessageId: data.assistantMessageId,
        parentMessageType: 'assistant',
        parentOperationId: operationId, // Pass as parent operation
        // If a new thread was created, mark as inPortalThread for consistent behavior
        inPortalThread: !!data.createdThreadId,
        skipCreateFirstMessage: true,
      });

      const userFiles = dbMessageSelectors
        .dbUserFiles(this.#get())
        .map((f) => f?.id)
        .filter(Boolean) as string[];

      if (userFiles.length > 0) {
        await getAgentStoreState().addFilesToAgent(userFiles, false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (data.topicId) this.#get().internal_updateTopicLoading(data.topicId, false);
    }

    // Return result for callers who need message IDs
    return {
      assistantMessageId: data.assistantMessageId,
      createdThreadId: data.createdThreadId,
      userMessageId: data.userMessageId,
    };
  };

  /**
   * Server-side agent execution flow (agentMode=true).
   * Follows the same pattern as sendGroupMessage:
   * 1. Call execAgent TRPC (creates messages + starts background task)
   * 2. Sync messages from response
   * 3. Connect SSE stream for real-time updates
   */
  #execAgentModeSendMessage = async ({
    abortController,
    context,
    fileIds,
    message,
    messages,
    newThread,
    operationId,
    pageSelections,
    tempAssistantId,
    tempId,
  }: {
    abortController: AbortController;
    context: ConversationContext;
    fileIds?: string[];
    message: string;
    messages: { id: string }[];
    newThread?: { sourceMessageId: string; type: string };
    operationId: string;
    pageSelections?: SendMessageParams['pageSelections'];
    tempAssistantId: string;
    tempId: string;
  }): Promise<SendMessageResult | undefined> => {
    const { agentId, topicId } = context;

    try {
      // 1. Call execAgent TRPC - creates messages + starts background agent task
      const result = await lambdaClient.aiAgent.execAgent.mutate(
        {
          agentId,
          appContext: {
            groupId: context.groupId ?? undefined,
            threadId: context.threadId ?? undefined,
            topicId: topicId ?? undefined,
          },
          fileIds,
          newThread: newThread
            ? { sourceMessageId: newThread.sourceMessageId, type: newThread.type }
            : undefined,
          newTopic: !topicId ? { topicMessageIds: messages.map((m) => m.id) } : undefined,
          pageSelections,
          prompt: message,
        },
        { signal: abortController.signal },
      );

      log(
        'execAgent result: operationId=%s, topicId=%s, success=%s',
        result.operationId,
        result.topicId,
        result.success,
      );

      // 2. Update topics if new topic was created
      if (result.topics) {
        const pageSize = systemStatusSelectors.topicPageSize(useGlobalStore.getState());
        this.#get().internal_updateTopics(agentId, {
          groupId: context.groupId,
          items: result.topics.items as any,
          pageSize,
          total: result.topics.total,
        });
      }

      // 3. Switch to new topic if created
      if (result.isCreateNewTopic && result.topicId) {
        await this.#get().switchTopic(result.topicId, {
          clearNewKey: true,
          skipRefreshMessage: true,
        });
      }

      // 4. Handle thread creation
      if (result.createdThreadId) {
        this.#get().updateOperationMetadata(operationId, {
          createdThreadId: result.createdThreadId,
        });
        this.#get().openThreadInPortal(result.createdThreadId, context.sourceMessageId);
        this.#get().refreshThreads();
      }

      // 5. Create exec context with updated topicId from server
      const execContext = { ...context, topicId: result.topicId || topicId };

      // 6. Replace temp messages with server messages
      if (result.messages) {
        this.#get().replaceMessages(result.messages, {
          action: 'sendMessage/agentMode/syncMessages',
          context: execContext,
        });
        this.#get().internal_dispatchMessage(
          { ids: [tempId, tempAssistantId], type: 'deleteMessages' },
          { operationId },
        );
      }

      // 7. Check if operation failed to start (e.g., QStash unavailable)
      if (result.success === false) {
        log('Agent operation failed to start: %s', result.error);
        this.#get().failOperation(operationId, {
          message: result.error || 'Agent operation failed to start',
          type: 'AgentStartupError',
        });
        this.#get().internal_toggleMessageLoading(false, result.assistantMessageId);
        return {
          assistantMessageId: result.assistantMessageId,
          createdThreadId: result.createdThreadId,
          userMessageId: result.userMessageId,
        };
      }

      // Clear editor temp state after successful creation
      this.#get().updateOperationMetadata(operationId, { inputMessageContent: null });

      if (ENABLE_BUSINESS_FEATURES) {
        markUserValidAction();
      }

      // 8. Topic title summarization (fire and forget)
      if (result.topicId) {
        const summaryTitle = async () => {
          if (result.isCreateNewTopic) {
            await this.#get().summaryTopicTitle(result.topicId, result.messages || []);
            return;
          }
          const topic = topicSelectors.getTopicById(result.topicId)(this.#get());
          if (topic && !topic.title) {
            const chats = displayMessageSelectors
              .getDisplayMessagesByKey(messageMapKey({ agentId, topicId: topic.id }))(this.#get())
              .filter((item) => item.id !== result.assistantMessageId);
            await this.#get().summaryTopicTitle(topic.id, chats);
          }
        };
        summaryTitle().catch(console.error);
      }

      // 9. Complete sendMessage operation - agent execution is handled by SSE child operation
      this.#get().completeOperation(operationId);

      // 10. Create streaming context
      const streamContext = {
        assistantId: result.assistantMessageId,
        content: '',
        reasoning: '',
        tmpAssistantId: tempAssistantId,
      };

      // 11. Start child operation for SSE stream using backend operationId
      this.#get().startOperation({
        context: { ...execContext, messageId: result.assistantMessageId },
        label: 'Agent Mode Stream',
        operationId: result.operationId,
        parentOperationId: operationId,
        type: 'agentModeStream',
      });

      // Associate assistant message with both operations
      this.#get().associateMessageWithOperation(result.assistantMessageId, operationId);
      this.#get().associateMessageWithOperation(result.assistantMessageId, result.operationId);

      // 12. Connect to SSE stream
      const { internal_handleAgentStreamEvent } = this.#get();
      const eventSource = agentRuntimeClient.createStreamConnection(result.operationId, {
        includeHistory: false,
        onConnect: () => {
          log('Stream connected to %s', result.operationId);
        },
        onDisconnect: () => {
          log('Stream disconnected from %s', result.operationId);
          this.#get().completeOperation(result.operationId);
          if (result.topicId) this.#get().internal_updateTopicLoading(result.topicId, false);
        },
        onError: (error: Error) => {
          log('Stream error for %s: %O', result.operationId, error);
          this.#get().failOperation(result.operationId, {
            message: error.message,
            type: 'AgentStreamError',
          });
          if (streamContext.assistantId) {
            this.#get().internal_handleAgentError(streamContext.assistantId, error.message);
          }
        },
        onEvent: async (event: StreamEvent) => {
          await internal_handleAgentStreamEvent(result.operationId, event, streamContext);
        },
      });

      // 13. Register cancel handler
      this.#get().onOperationCancel(result.operationId, async () => {
        log('Cancelling SSE stream for operation %s', result.operationId);
        eventSource.abort();

        // Notify server to stop the agent execution
        try {
          await aiAgentService.interruptTask({ operationId: result.operationId });
        } catch (e) {
          log('Failed to interrupt server task: %O', e);
        }
      });

      // 14. Topic loading state
      if (result.topicId) this.#get().internal_updateTopicLoading(result.topicId, true);

      return {
        assistantMessageId: result.assistantMessageId,
        createdThreadId: result.createdThreadId,
        userMessageId: result.userMessageId,
      };
    } catch (error) {
      const isAbortError =
        error instanceof Error &&
        (error.name === 'AbortError' ||
          error.message.includes('aborted') ||
          error.message.includes('cancelled'));

      if (isAbortError) {
        log('sendMessage (agentMode) aborted by user');
      } else {
        console.error('sendMessage (agentMode) failed:', error);
        this.#get().failOperation(operationId, {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: 'SendAgentModeMessageError',
        });

        if (error instanceof TRPCClientError) {
          this.#get().updateOperationMetadata(operationId, { inputSendErrorMsg: error.message });
          this.#get().mainInputEditor?.setDocument('markdown', message);
        }
      }

      // Clean up temp messages
      this.#get().internal_dispatchMessage(
        { ids: [tempId, tempAssistantId], type: 'deleteMessages' },
        { operationId },
      );

      return undefined;
    } finally {
      this.#get().internal_toggleMessageLoading(false, tempId);
      this.#get().internal_toggleMessageLoading(false, tempAssistantId);
    }
  };

  continueGenerationMessage = async (id: string, messageId: string): Promise<void> => {
    const message = dbMessageSelectors.getDbMessageById(id)(this.#get());
    if (!message) return;

    const { activeAgentId, activeTopicId, activeThreadId, activeGroupId } = this.#get();

    // Create base context for continue operation (using global state)
    const continueContext = {
      agentId: activeAgentId,
      topicId: activeTopicId,
      threadId: activeThreadId ?? undefined,
      groupId: activeGroupId,
    };

    // Create continue operation
    const { operationId } = this.#get().startOperation({
      type: 'continue',
      context: { ...continueContext, messageId },
    });

    try {
      const chats = displayMessageSelectors.mainAIChatsWithHistoryConfig(this.#get());

      await this.#get().internal_execAgentRuntime({
        context: continueContext,
        messages: chats,
        parentMessageId: id,
        parentMessageType: message.role as 'assistant' | 'tool' | 'user',
        parentOperationId: operationId,
      });

      this.#get().completeOperation(operationId);
    } catch (error) {
      this.#get().failOperation(operationId, {
        type: 'ContinueError',
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export type ConversationLifecycleAction = Pick<
  ConversationLifecycleActionImpl,
  keyof ConversationLifecycleActionImpl
>;
