import { Flexbox, Text } from '@lobehub/ui';
import { Progress } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useChatStore } from '@/store/chat';
import { selectTodosFromMessages } from '@/store/chat/slices/message/selectors/dbMessage';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';

import { useAgentContext } from '../../useAgentContext';
import { normalizeTaskProgress } from './taskProgressAdapter';

const ProgressSection = memo(() => {
  const { t } = useTranslation('chat');
  const context = useAgentContext();
  const chatKey = messageMapKey(context);
  const dbMessages = useChatStore((s) => s.dbMessagesMap[chatKey]);

  const progress = useMemo(
    () => normalizeTaskProgress(selectTodosFromMessages(dbMessages || [])),
    [dbMessages],
  );

  return (
    <Flexbox data-testid="workspace-progress" gap={8} padding={16}>
      <Text strong>{t('workspacePanel.progress')}</Text>
      <Progress percent={progress.completionPercent} showInfo={false} size={'small'} />
      <Text>{progress.currentTask || t('workspacePanel.progress.allCompleted')}</Text>
      {progress.items.map((item) => (
        <Text key={item.id} type={item.status === 'completed' ? 'secondary' : undefined}>
          {item.text} ({item.status})
        </Text>
      ))}
    </Flexbox>
  );
});

ProgressSection.displayName = 'ProgressSection';

export default ProgressSection;
