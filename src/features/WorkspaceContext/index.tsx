'use client';

import { type PropsWithChildren, memo, useEffect } from 'react';

import { useWorkspaceStore } from '@/store/workspace';

/**
 * WorkspaceContextProvider restores the active workspace from localStorage on mount.
 * Place this high in the component tree (e.g., in the main layout) to ensure
 * workspace context is available before any tRPC requests are made.
 */
const WorkspaceContextProvider = memo<PropsWithChildren>(({ children }) => {
  const restoreActiveWorkspace = useWorkspaceStore((s) => s.restoreActiveWorkspace);

  useEffect(() => {
    restoreActiveWorkspace();
  }, [restoreActiveWorkspace]);

  return <>{children}</>;
});

WorkspaceContextProvider.displayName = 'WorkspaceContextProvider';

export default WorkspaceContextProvider;
