import { GlobeOffIcon } from '@lobehub/ui/icons';
import { cssVar } from 'antd-style';
import { Globe } from 'lucide-react';
import { lazy, memo, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsMobile } from '@/hooks/useIsMobile';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors, chatConfigByIdSelectors } from '@/store/agent/selectors';

import { useAgentEnableSearch } from '../../hooks/useAgentEnableSearch';
import { useAgentId } from '../../hooks/useAgentId';
import { useUpdateAgentConfig } from '../../hooks/useUpdateAgentConfig';
import Action from '../components/Action';

const LazyControls = lazy(() => import('./Controls'));

const Search = memo(() => {
  const { t } = useTranslation('chat');
  const agentId = useAgentId();
  const { updateAgentChatConfig } = useUpdateAgentConfig();
  const [isLoading, mode] = useAgentStore((s) => [
    agentByIdSelectors.isAgentConfigLoadingById(agentId)(s),
    chatConfigByIdSelectors.getSearchModeById(agentId)(s),
  ]);
  const isAgentEnableSearch = useAgentEnableSearch();
  const isMobile = useIsMobile();
  const [hasOpened, setHasOpened] = useState(false);

  if (isLoading) return <Action disabled icon={GlobeOffIcon} />;

  return (
    <Action
      color={isAgentEnableSearch ? cssVar.colorInfo : undefined}
      icon={isAgentEnableSearch ? Globe : GlobeOffIcon}
      showTooltip={false}
      title={t('search.title')}
      popover={{
        content: hasOpened ? (
          <Suspense fallback={null}>
            <LazyControls />
          </Suspense>
        ) : null,
        maxWidth: 320,
        minWidth: 320,
        placement: 'topLeft',
        styles: {
          content: {
            padding: 4,
          },
        },
        trigger: isMobile ? 'click' : 'hover',
      }}
      onClick={
        isMobile
          ? undefined
          : async (e) => {
              e?.preventDefault?.();
              e?.stopPropagation?.();
              const next = mode === 'off' ? 'auto' : 'off';
              await updateAgentChatConfig({ searchMode: next });
            }
      }
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
    />
  );
});

Search.displayName = 'Search';

export default Search;
