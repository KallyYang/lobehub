import { Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import AgentDocumentsGroup from './AgentDocumentsGroup';

const ResourcesSection = memo(() => {
  const { t } = useTranslation('chat');

  return (
    <Flexbox data-testid="workspace-resources" gap={12} padding={16}>
      <Text strong>{t('workspacePanel.resources')}</Text>
      <AgentDocumentsGroup />
    </Flexbox>
  );
});

ResourcesSection.displayName = 'ResourcesSection';

export default ResourcesSection;
