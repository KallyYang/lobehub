import { Divider } from 'antd';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { DangerZone, GeneralSettings, MemberManagement } from '@/features/WorkspaceSettings';

const WorkspaceSettingsPage = memo(() => {
  return (
    <Flexbox gap={32} padding={24} style={{ maxWidth: 720 }}>
      <GeneralSettings />
      <Divider />
      <MemberManagement />
      <Divider />
      <DangerZone />
    </Flexbox>
  );
});

WorkspaceSettingsPage.displayName = 'WorkspaceSettingsPage';

export default WorkspaceSettingsPage;
