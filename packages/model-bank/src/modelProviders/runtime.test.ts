import { describe, expect, it } from 'vitest';

import { DEFAULT_MODEL_PROVIDER_LIST } from './index';
import { isProviderDisableBrowserRequest, PROVIDER_RUNTIME_CONFIG } from './runtime';

describe('provider runtime metadata', () => {
  it('covers every default provider id', () => {
    const providerIds = DEFAULT_MODEL_PROVIDER_LIST.map((provider) => provider.id).sort();
    const runtimeConfigIds = Object.keys(PROVIDER_RUNTIME_CONFIG).sort();

    expect(runtimeConfigIds).toEqual(providerIds);
  });

  it('matches browser-request disable semantics from provider cards', () => {
    for (const provider of DEFAULT_MODEL_PROVIDER_LIST) {
      expect(isProviderDisableBrowserRequest(provider.id)).toBe(
        !!provider.disableBrowserRequest || !!provider.settings?.disableBrowserRequest,
      );
    }
  });
});
