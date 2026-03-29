import { useCallback, useEffect } from 'react';

import { getWorkspaceStoreState, useWorkspaceStore } from '@/store/workspace';

/**
 * Custom hook to provide workspace context for tRPC requests.
 *
 * Returns a function that generates headers with the active workspace ID.
 * This should be used in the tRPC client link to automatically inject
 * the X-Workspace-Id header on every request.
 *
 * Usage in tRPC client setup:
 * ```ts
 * const headers = useWorkspaceHeader();
 * // Use headers() in httpBatchLink config
 * ```
 */
export const useWorkspaceHeader = () => {
  // Restore workspace from localStorage on mount
  const restore = useWorkspaceStore((s) => s._restoreActiveWorkspace);

  useEffect(() => {
    restore();
  }, [restore]);

  return useCallback(() => {
    const { activeWorkspaceId } = getWorkspaceStoreState();
    if (!activeWorkspaceId) return {};

    return {
      'x-workspace-id': activeWorkspaceId,
    };
  }, []);
};

/**
 * Static helper to get workspace headers (for use outside React components)
 */
export const getWorkspaceHeaders = (): Record<string, string> => {
  const { activeWorkspaceId } = getWorkspaceStoreState();
  if (!activeWorkspaceId) return {};

  return {
    'x-workspace-id': activeWorkspaceId,
  };
};
