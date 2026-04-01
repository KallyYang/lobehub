import {
  DropdownMenuPopup,
  DropdownMenuPortal,
  DropdownMenuPositioner,
  DropdownMenuRoot,
  DropdownMenuTrigger,
  stopPropagation,
  TooltipGroup,
} from '@lobehub/ui';
import { lazy, memo, Suspense, useCallback, useState } from 'react';

import { styles } from './styles';
import { type ModelSwitchPanelProps } from './types';

const LazyPanelContent = lazy(async () => {
  const panelModule = await import('./components/PanelContent');

  return { default: panelModule.PanelContent };
});

const ModelSwitchPanel = memo<ModelSwitchPanelProps>(
  ({
    ModelItemComponent,
    children,
    enabledList,
    model: modelProp,
    onModelChange,
    onOpenChange,
    open,
    placement = 'topLeft',
    pricingMode,
    provider: providerProp,
    openOnHover = true,
  }) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = open ?? internalOpen;

    const handleOpenChange = useCallback(
      (nextOpen: boolean) => {
        setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
      },
      [onOpenChange],
    );

    return (
      <TooltipGroup>
        <DropdownMenuRoot open={isOpen} onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger className={styles.trigger} openOnHover={openOnHover}>
            {children}
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuPositioner hoverTrigger={openOnHover} placement={placement}>
              <DropdownMenuPopup className={styles.container} onKeyDown={stopPropagation}>
                {isOpen ? (
                  <Suspense fallback={<div style={{ minHeight: 360, width: 320 }} />}>
                    <LazyPanelContent
                      ModelItemComponent={ModelItemComponent}
                      enabledList={enabledList}
                      model={modelProp}
                      pricingMode={pricingMode}
                      provider={providerProp}
                      onModelChange={onModelChange}
                      onOpenChange={handleOpenChange}
                    />
                  </Suspense>
                ) : null}
              </DropdownMenuPopup>
            </DropdownMenuPositioner>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </TooltipGroup>
    );
  },
);

ModelSwitchPanel.displayName = 'ModelSwitchPanel';

export default ModelSwitchPanel;

export { type ModelSwitchPanelProps } from './types';
