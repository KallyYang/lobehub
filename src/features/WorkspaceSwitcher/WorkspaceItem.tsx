'use client';

import { Avatar, Icon } from '@lobehub/ui';
import { Check } from 'lucide-react';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

interface WorkspaceItemProps {
  avatar?: string | null;
  isActive: boolean;
  name: string;
  onClick: () => void;
  type: 'personal' | 'team';
}

const WorkspaceItem = memo<WorkspaceItemProps>(({ avatar, name, type, isActive, onClick }) => {
  return (
    <Flexbox
      align="center"
      gap={8}
      horizontal
      onClick={onClick}
      padding={'8px 12px'}
      style={{ borderRadius: 6, cursor: 'pointer' }}
    >
      <Avatar
        avatar={avatar || (type === 'personal' ? '👤' : '👥')}
        shape="square"
        size={28}
      />
      <Flexbox flex={1} style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </Flexbox>
      {isActive && <Icon icon={Check} size={16} />}
    </Flexbox>
  );
});

WorkspaceItem.displayName = 'WorkspaceItem';

export default WorkspaceItem;
