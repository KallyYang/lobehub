import { Button, Popconfirm, Typography } from 'antd';
import { Trash2 } from 'lucide-react';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';

const DangerZone = memo(() => {
  const canDelete = useWorkspaceStore(workspaceSelectors.canDeleteWorkspace);
  const activeWorkspace = useWorkspaceStore(workspaceSelectors.activeWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);

  if (!canDelete || !activeWorkspace) return null;

  return (
    <Flexbox gap={16}>
      <Typography.Title level={4} type="danger">
        Danger Zone
      </Typography.Title>

      <Flexbox
        align="center"
        horizontal
        justify="space-between"
        style={{
          border: '1px solid var(--lobe-color-error)',
          borderRadius: 8,
          padding: '12px 16px',
        }}
      >
        <Flexbox gap={4}>
          <Typography.Text strong>Delete Workspace</Typography.Text>
          <Typography.Text type="secondary">
            This action cannot be undone. All data will be permanently removed.
          </Typography.Text>
        </Flexbox>

        <Popconfirm
          onConfirm={() => deleteWorkspace(activeWorkspace.id)}
          title={`Delete "${activeWorkspace.name}"? This cannot be undone.`}
        >
          <Button danger icon={<Trash2 size={14} />}>
            Delete
          </Button>
        </Popconfirm>
      </Flexbox>
    </Flexbox>
  );
});

DangerZone.displayName = 'DangerZone';

export default DangerZone;
