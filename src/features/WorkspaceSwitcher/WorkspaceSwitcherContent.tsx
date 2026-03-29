'use client';

import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';

import WorkspaceItem from './WorkspaceItem';

interface WorkspaceSwitcherContentProps {
  onClose?: () => void;
}

const WorkspaceSwitcherContent = memo<WorkspaceSwitcherContentProps>(({ onClose }) => {
  const workspaces = useWorkspaceStore(workspaceSelectors.workspaces);
  const activeId = useWorkspaceStore(workspaceSelectors.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);

  const handleSwitch = (id: string) => {
    switchWorkspace(id);
    onClose?.();
  };

  return (
    <Flexbox gap={4} style={{ maxHeight: 400, minWidth: 220, overflow: 'auto' }} padding={4}>
      {workspaces.map((workspace) => (
        <WorkspaceItem
          avatar={workspace.avatar}
          isActive={workspace.id === activeId}
          key={workspace.id}
          name={workspace.name}
          onClick={() => handleSwitch(workspace.id)}
          type={workspace.type as 'personal' | 'team'}
        />
      ))}
    </Flexbox>
  );
});

WorkspaceSwitcherContent.displayName = 'WorkspaceSwitcherContent';

export default WorkspaceSwitcherContent;
