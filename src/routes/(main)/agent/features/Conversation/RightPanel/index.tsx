import { Flexbox } from '@lobehub/ui';
import { memo, useLayoutEffect } from 'react';

import RightPanel from '@/features/RightPanel';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

import AgentWorkspaceSummary from './AgentWorkspaceSummary';
import ProgressSection from './ProgressSection';
import ResourcesSection from './ResourcesSection';

const AgentWorkspaceRightPanel = memo(() => {
  useLayoutEffect(() => {
    const { status } = useGlobalStore.getState();
    const previousExpand = systemStatusSelectors.showRightPanel(useGlobalStore.getState());

    if (previousExpand) {
      useGlobalStore.setState({
        status: {
          ...status,
          showRightPanel: false,
        },
      });
    }

    return () => {
      if (previousExpand) {
        useGlobalStore.setState({
          status: {
            ...useGlobalStore.getState().status,
            showRightPanel: true,
          },
        });
      }
    };
  }, []);

  return (
    <RightPanel defaultWidth={360} maxWidth={520} minWidth={300}>
      <Flexbox gap={8} height={'100%'} style={{ overflowY: 'auto' }} width={'100%'}>
        <AgentWorkspaceSummary />
        <ProgressSection />
        <ResourcesSection />
      </Flexbox>
    </RightPanel>
  );
});

export default AgentWorkspaceRightPanel;
