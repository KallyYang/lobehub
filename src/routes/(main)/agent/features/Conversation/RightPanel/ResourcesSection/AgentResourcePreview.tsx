import { Markdown, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useClientDataSWR } from '@/libs/swr';
import { agentDocumentService } from '@/services/agentDocument';

interface AgentResourcePreviewProps {
  agentId: string;
  resourceId: string | null;
}

const AgentResourcePreview = memo<AgentResourcePreviewProps>(({ agentId, resourceId }) => {
  const { t } = useTranslation('chat');

  const { data, error, isLoading } = useClientDataSWR(
    resourceId ? ['workspace-agent-document-preview', agentId, resourceId] : null,
    () => agentDocumentService.readDocument({ agentId, id: resourceId! }),
  );

  if (!resourceId) return null;
  if (isLoading) {
    return <Text type={'secondary'}>{t('workspacePanel.resources.previewLoading')}</Text>;
  }
  if (error) {
    return <Text type={'danger'}>{t('workspacePanel.resources.previewError')}</Text>;
  }
  if (!data) return null;

  return (
    <Markdown fontSize={13} style={{ maxHeight: 220, overflowY: 'auto' }} variant={'chat'}>
      {data.content}
    </Markdown>
  );
});

AgentResourcePreview.displayName = 'AgentResourcePreview';

export default AgentResourcePreview;
