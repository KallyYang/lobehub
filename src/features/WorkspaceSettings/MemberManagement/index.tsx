import { Button, Typography } from 'antd';
import { UserPlus } from 'lucide-react';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';

import MemberList from './MemberList';

const MemberManagement = memo(() => {
  const canManage = useWorkspaceStore(workspaceSelectors.canManageMembers);

  return (
    <Flexbox gap={16}>
      <Flexbox align="center" horizontal justify="space-between">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Members
        </Typography.Title>
        {canManage && (
          <Button
            icon={<UserPlus size={14} />}
            onClick={() => {
              // TODO: open invite modal
            }}
            type="primary"
          >
            Invite
          </Button>
        )}
      </Flexbox>

      <MemberList />
    </Flexbox>
  );
});

MemberManagement.displayName = 'MemberManagement';

export default MemberManagement;
