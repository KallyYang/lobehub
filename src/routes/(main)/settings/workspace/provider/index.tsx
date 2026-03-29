import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import { useWorkspaceStore, workspaceSelectors } from '@/store/workspace';

import SettingHeader from '../../features/SettingHeader';

const WorkspaceProviderPage = () => {
  const { t } = useTranslation('setting');
  const isAdmin = useWorkspaceStore(workspaceSelectors.isAdmin);

  if (!isAdmin) {
    return (
      <Flexbox padding={24}>
        <Alert message="You don't have permission to manage workspace providers." type="warning" />
      </Flexbox>
    );
  }

  return (
    <>
      <SettingHeader title="Workspace AI Providers" />
      <Flexbox padding={24}>
        <Alert
          description="Workspace-level AI provider configuration will be available here. Configurations set here will apply to all workspace members."
          message="Coming Soon"
          type="info"
        />
      </Flexbox>
    </>
  );
};

export default WorkspaceProviderPage;
