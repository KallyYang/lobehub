import { Avatar } from '@lobehub/ui';
import { Button, Popconfirm, Select, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Trash2 } from 'lucide-react';
import { memo, useMemo } from 'react';

import type { WorkspaceRole } from '@/libs/trpc/lambda/middleware/workspace';
import { type WorkspaceMemberItem, useWorkspaceStore, workspaceSelectors } from '@/store/workspace';

const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Member', value: 'member' },
];

const MemberList = memo(() => {
  const members = useWorkspaceStore(workspaceSelectors.members);
  const canManage = useWorkspaceStore(workspaceSelectors.canManageMembers);
  const isOwner = useWorkspaceStore(workspaceSelectors.isOwner);
  const removeMember = useWorkspaceStore((s) => s.removeMember);
  const updateMemberRole = useWorkspaceStore((s) => s.updateMemberRole);

  const columns: ColumnsType<WorkspaceMemberItem> = useMemo(
    () => [
      {
        dataIndex: 'userId',
        key: 'avatar',
        render: (userId: string) => <Avatar avatar={userId.slice(0, 2)} size={32} />,
        title: '',
        width: 48,
      },
      {
        dataIndex: 'userId',
        key: 'userId',
        render: (userId: string) => (
          <Typography.Text ellipsis style={{ maxWidth: 200 }}>
            {userId}
          </Typography.Text>
        ),
        title: 'User',
      },
      {
        dataIndex: 'role',
        key: 'role',
        render: (role: WorkspaceRole, record) => {
          if (role === 'owner') {
            return <Typography.Text strong>Owner</Typography.Text>;
          }

          if (!isOwner) {
            return <Typography.Text>{role}</Typography.Text>;
          }

          return (
            <Select
              onChange={(value) => updateMemberRole(record.userId, value as WorkspaceRole)}
              options={ROLE_OPTIONS}
              size="small"
              value={role}
              style={{ width: 100 }}
            />
          );
        },
        title: 'Role',
        width: 130,
      },
      {
        dataIndex: 'joinedAt',
        key: 'joinedAt',
        render: (date: string) => new Date(date).toLocaleDateString(),
        title: 'Joined',
        width: 120,
      },
      ...(canManage
        ? [
            {
              key: 'actions',
              render: (_: unknown, record: WorkspaceMemberItem) => {
                if (record.role === 'owner') return null;
                return (
                  <Popconfirm
                    onConfirm={() => removeMember(record.userId)}
                    title="Remove this member?"
                  >
                    <Button danger icon={<Trash2 size={14} />} size="small" type="text" />
                  </Popconfirm>
                );
              },
              title: '',
              width: 48,
            },
          ]
        : []),
    ],
    [canManage, isOwner, removeMember, updateMemberRole],
  );

  return (
    <Table
      columns={columns}
      dataSource={members}
      pagination={false}
      rowKey={(record) => `${record.workspaceId}-${record.userId}`}
      size="small"
    />
  );
});

MemberList.displayName = 'MemberList';

export default MemberList;
