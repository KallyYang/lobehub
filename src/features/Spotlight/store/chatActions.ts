import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';

import { sendSpotlightMessage } from '../services/chat';

export interface ChatMessage {
  content: string;
  id: string;
  loading?: boolean;
  role: 'user' | 'assistant';
}

export interface SpotlightChatActions {
  abortStreaming: () => void;
  resetChat: () => void;
  sendMessage: (content: string) => Promise<void>;
}

export interface SpotlightChatState {
  _abortController: AbortController | null;
  messages: ChatMessage[];
  streaming: boolean;
  topicId: string | null;
}

export const chatInitialState: SpotlightChatState = {
  _abortController: null,
  messages: [],
  streaming: false,
  topicId: null,
};

export const createChatActions: StateCreator<
  SpotlightChatState &
    SpotlightChatActions & {
      agentId: string;
      currentModel: { model: string; provider: string };
      groupId?: string;
    },
  [],
  [],
  SpotlightChatActions
> = (set, get) => ({
  abortStreaming: () => {
    const { _abortController } = get();
    _abortController?.abort();
    set({ _abortController: null, streaming: false });
    set((state) => ({
      messages: state.messages.map((msg, i) =>
        i === state.messages.length - 1 && msg.role === 'assistant'
          ? { ...msg, loading: false }
          : msg,
      ),
    }));
  },

  resetChat: () => {
    const { _abortController } = get();
    _abortController?.abort();
    set(chatInitialState);
    window.electronAPI?.invoke?.('spotlight:setChatState', false);
  },

  sendMessage: async (content: string) => {
    const { agentId, currentModel, groupId, topicId } = get();
    const userMsgId = nanoid();
    const assistantMsgId = nanoid();
    const abortController = new AbortController();

    set((state) => ({
      _abortController: abortController,
      messages: [
        ...state.messages,
        { content, id: userMsgId, role: 'user' as const },
        { content: '', id: assistantMsgId, loading: true, role: 'assistant' as const },
      ],
      streaming: true,
    }));

    const result = await sendSpotlightMessage({
      abortController,
      agentId,
      content,
      groupId,
      model: currentModel.model,
      onContentUpdate: (updatedContent) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: updatedContent } : msg,
          ),
        }));
      },
      onError: (error) => {
        set((state) => ({
          _abortController: null,
          messages: state.messages.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: `Error: ${error.message}`, loading: false }
              : msg,
          ),
          streaming: false,
        }));
      },
      onFinish: () => {
        set((state) => ({
          _abortController: null,
          messages: state.messages.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, loading: false } : msg,
          ),
          streaming: false,
        }));

        window.electronAPI?.invoke?.('spotlight.notifySync', {
          keys: ['chat/messages', 'chat/topics'],
        });
      },
      provider: currentModel.provider,
      topicId: topicId || undefined,
    });

    if (result) {
      set({ topicId: result.topicId });
    }
  },
});
