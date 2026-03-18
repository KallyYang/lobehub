import type { RuntimeHeaders } from '../types/chat';

export const toHeadersInit = (headers?: RuntimeHeaders): Record<string, string> | undefined => {
  if (!headers) return undefined;

  const normalized = new Headers();

  if (headers instanceof Headers || Array.isArray(headers)) {
    new Headers(headers).forEach((value, key) => {
      normalized.set(key, value);
    });

    return Object.fromEntries(normalized.entries());
  }

  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized.set(key, value);
    }
  }

  return Object.fromEntries(normalized.entries());
};

export const mergeHeaders = (
  ...headersList: Array<RuntimeHeaders | undefined>
): Record<string, string> => {
  const merged = new Headers();

  for (const header of headersList) {
    const normalized = toHeadersInit(header);
    if (!normalized) continue;

    new Headers(normalized).forEach((value, key) => {
      merged.set(key, value);
    });
  }

  return Object.fromEntries(merged.entries());
};
