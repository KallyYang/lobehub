'use client';

import { lazy, memo, Suspense, useEffect, useState } from 'react';

import { useGlobalStore } from '@/store/global';

const CmdkComponent = lazy(() => import('@/features/CommandMenu'));

const CmdkLazy = memo(() => {
  const open = useGlobalStore((s) => s.status.showCommandMenu);
  const [hasLoaded, setHasLoaded] = useState(open);

  useEffect(() => {
    if (open) setHasLoaded(true);
  }, [open]);

  if (!(hasLoaded || open)) return null;

  return (
    <Suspense fallback={null}>
      <CmdkComponent />
    </Suspense>
  );
});

CmdkLazy.displayName = 'CmdkLazy';

export default CmdkLazy;
