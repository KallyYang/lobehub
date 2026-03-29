import { Alert, Typography } from 'antd';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';

/**
 * Workspace-level AI Provider settings page.
 * Reuses the same provider configuration UI pattern as user-level settings,
 * but scoped to the workspace. Only admin+ can access.
 */
const WorkspaceProviderSettings = memo(() => {
  const isAdmin = useWorkspaceStore(workspaceSelectors.isAdmin);
  const activeWorkspace = useWorkspaceStore(workspaceSelectors.activeWorkspace);

  if (!isAdmin) {
    return (
      <Flexbox padding={24}>
        <Alert
          description="You need admin or owner permissions to configure workspace AI providers."
          message="Permission Denied"
          showIcon
          type="warning"
        />
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={24} padding={24} style={{ maxWidth: 720 }}>
      <Typography.Title level={4}>Workspace AI Provider Settings</Typography.Title>

      <Alert
        description="Provider configurations here apply to all workspace members. Individual users can override with their personal Key Vault settings."
        message="Workspace-level Configuration"
        showIcon
        type="info"
      />

      {/* TODO: Reuse provider configuration components from src/features/Setting/ */}
      <Typography.Text type="secondary">
        Provider configuration UI will be integrated from the existing settings components.
        Workspace: {activeWorkspace?.name}
      </Typography.Text>
    </Flexbox>
  );
});

WorkspaceProviderSettings.displayName = 'WorkspaceProviderSettings';

export default WorkspaceProviderSettings;
