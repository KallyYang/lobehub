import { Avatar } from '@lobehub/ui';
import { Button, Form, Input, Typography } from 'antd';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';

const GeneralSettings = memo(() => {
  const { t } = useTranslation('common');
  const activeWorkspace = useWorkspaceStore(workspaceSelectors.activeWorkspace);
  const canManage = useWorkspaceStore(workspaceSelectors.canManageWorkspace);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);

  const handleSave = useCallback(
    (values: { description?: string; name?: string }) => {
      updateWorkspace(values);
    },
    [updateWorkspace],
  );

  if (!activeWorkspace) return null;

  return (
    <Flexbox gap={24}>
      <Typography.Title level={4}>Workspace Settings</Typography.Title>

      <Flexbox align="center" gap={16} horizontal>
        <Avatar
          avatar={activeWorkspace.avatar || (activeWorkspace.type === 'personal' ? '👤' : '🏢')}
          size={64}
        />
        <Flexbox gap={4}>
          <Typography.Text strong style={{ fontSize: 18 }}>
            {activeWorkspace.name}
          </Typography.Text>
          <Typography.Text type="secondary">{activeWorkspace.slug}</Typography.Text>
        </Flexbox>
      </Flexbox>

      <Form
        disabled={!canManage}
        initialValues={{
          description: activeWorkspace.description || '',
          name: activeWorkspace.name,
        }}
        layout="vertical"
        onFinish={handleSave}
      >
        <Form.Item label="Workspace Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>

        {canManage && (
          <Form.Item>
            <Button htmlType="submit" type="primary">
              Save
            </Button>
          </Form.Item>
        )}
      </Form>
    </Flexbox>
  );
});

GeneralSettings.displayName = 'GeneralSettings';

export default GeneralSettings;
