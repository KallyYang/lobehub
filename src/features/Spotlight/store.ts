import { create } from 'zustand';

import {
  chatInitialState,
  type ChatMessage,
  createChatActions,
  type SpotlightChatActions,
  type SpotlightChatState,
} from './store/chatActions';

export type { ChatMessage };

interface SpotlightUIState {
  activePlugins: string[];
  agentId: string;
  currentModel: { model: string; provider: string };
  groupId?: string;
  inputValue: string;
  viewState: 'input' | 'chat';
}

interface SpotlightUIActions {
  reset: () => void;
  setCurrentModel: (model: { model: string; provider: string }) => void;
  setInputValue: (value: string) => void;
  setViewState: (state: 'input' | 'chat') => void;
  togglePlugin: (pluginId: string) => void;
}

type SpotlightStore = SpotlightUIState &
  SpotlightUIActions &
  SpotlightChatState &
  SpotlightChatActions;

const uiInitialState: SpotlightUIState = {
  activePlugins: [],
  agentId: 'default',
  currentModel: { model: '', provider: '' },
  inputValue: '',
  viewState: 'input',
};

export const useSpotlightStore = create<SpotlightStore>()((...args) => {
  const [set] = args;

  return {
    ...uiInitialState,
    ...chatInitialState,

    ...createChatActions(...args),

    reset: () => {
      set({ ...uiInitialState, ...chatInitialState });
      window.electronAPI?.invoke?.('spotlight:setChatState', false);
    },

    setCurrentModel: (model) => set({ currentModel: model }),

    setInputValue: (value) => set({ inputValue: value }),

    setViewState: (viewState) => {
      set({ viewState });
      window.electronAPI?.invoke?.('spotlight:setChatState', viewState === 'chat');
    },

    togglePlugin: (pluginId) =>
      set((state) => ({
        activePlugins: state.activePlugins.includes(pluginId)
          ? state.activePlugins.filter((id) => id !== pluginId)
          : [...state.activePlugins, pluginId],
      })),
  };
});
