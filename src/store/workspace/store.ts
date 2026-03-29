import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { type StateCreator } from 'zustand/vanilla';

import { createDevtools } from '../middleware/createDevtools';
import { expose } from '../middleware/expose';
import { flattenActions } from '../utils/flattenActions';
import { type WorkspaceState, initialWorkspaceState } from './initialState';
import { type WorkspaceAction, createWorkspaceSlice } from './slices/action';

export type WorkspaceStore = WorkspaceState & WorkspaceAction;

const createStore: StateCreator<WorkspaceStore, [['zustand/devtools', never]]> = (
  ...parameters: Parameters<StateCreator<WorkspaceStore, [['zustand/devtools', never]]>>
) => ({
  ...initialWorkspaceState,
  ...flattenActions<WorkspaceAction>([createWorkspaceSlice(...parameters)]),
});

const devtools = createDevtools('workspace');

export const useWorkspaceStore = createWithEqualityFn<WorkspaceStore>()(
  devtools(createStore),
  shallow,
);

expose('workspace', useWorkspaceStore);

export const getWorkspaceStoreState = () => useWorkspaceStore.getState();
