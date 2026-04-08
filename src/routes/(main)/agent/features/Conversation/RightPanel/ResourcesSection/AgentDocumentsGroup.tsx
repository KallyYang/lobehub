import { type SkillResourceTreeNode } from '@lobechat/types';
import { Flexbox, Text } from '@lobehub/ui';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import FileTree from '@/features/AgentSkillDetail/FileTree';
import { useClientDataSWR } from '@/libs/swr';
import { agentDocumentService } from '@/services/agentDocument';
import { useAgentStore } from '@/store/agent';

import AgentResourcePreview from './AgentResourcePreview';

const AgentDocumentsGroup = memo(() => {
  const { t } = useTranslation('chat');
  const agentId = useAgentStore((s) => s.activeAgentId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    data = [],
    error,
    isLoading,
  } = useClientDataSWR(agentId ? ['workspace-agent-documents', agentId] : null, () =>
    agentDocumentService.getDocuments({ agentId: agentId! }),
  );

  const resourceTree = useMemo<SkillResourceTreeNode[]>(
    () => [
      {
        children: data.map((item) => ({
          name: item.title || item.filename,
          path: item.id,
          type: 'file' as const,
        })),
        name: t('workspacePanel.agentDocuments'),
        path: 'agent-documents',
        type: 'directory' as const,
      },
    ],
    [data, t],
  );

  if (!agentId) return null;

  return (
    <Flexbox gap={8}>
      <Text strong>{t('workspacePanel.agentDocuments')}</Text>
      {isLoading && <Text type={'secondary'}>{t('workspacePanel.resources.loading')}</Text>}
      {error && <Text type={'danger'}>{t('workspacePanel.resources.error')}</Text>}
      {!isLoading && !error && data.length === 0 && (
        <Text type={'secondary'}>{t('workspacePanel.resources.empty')}</Text>
      )}
      {!isLoading && !error && data.length > 0 && (
        <FileTree
          resourceTree={resourceTree}
          rootFile={null}
          selectedFile={selectedId || ''}
          onSelectFile={setSelectedId}
        />
      )}
      <AgentResourcePreview agentId={agentId} resourceId={selectedId} />
    </Flexbox>
  );
});

AgentDocumentsGroup.displayName = 'AgentDocumentsGroup';

export default AgentDocumentsGroup;
