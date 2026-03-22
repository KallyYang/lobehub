import { type OpenAIPluginManifest } from '@lobechat/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { convertOpenAIManifestToLobeManifest, getToolManifest } from './toolManifest';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseOpenAIManifest: OpenAIPluginManifest = {
  api: { type: 'openapi', url: 'https://example.com/openapi.yaml' },
  auth: { instructions: '', type: 'none' },
  contact_email: 'dev@example.com',
  description_for_human: 'A handy test plugin',
  description_for_model: 'Use this plugin for tests',
  legal_info_url: 'https://example.com/legal',
  logo_url: 'https://example.com/logo.png',
  name_for_human: 'Test Plugin',
  name_for_model: 'test_plugin',
  schema_version: 'v1',
};

// ─── convertOpenAIManifestToLobeManifest ──────────────────────────────────────

describe('convertOpenAIManifestToLobeManifest', () => {
  describe('basic field mapping', () => {
    it('should map identifier from name_for_model', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.identifier).toBe('test_plugin');
    });

    it('should map homepage from legal_info_url', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.homepage).toBe('https://example.com/legal');
    });

    it('should map meta.avatar from logo_url', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.meta?.avatar).toBe('https://example.com/logo.png');
    });

    it('should map meta.title from name_for_human', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.meta?.title).toBe('Test Plugin');
    });

    it('should map meta.description from description_for_human', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.meta?.description).toBe('A handy test plugin');
    });

    it('should map systemRole from description_for_model', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.systemRole).toBe('Use this plugin for tests');
    });

    it('should map openapi from api.url', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.openapi).toBe('https://example.com/openapi.yaml');
    });

    it('should set type to "default"', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.type).toBe('default');
    });

    it('should set version to "1"', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.version).toBe('1');
    });

    it('should set api to empty array', () => {
      const result = convertOpenAIManifestToLobeManifest(baseOpenAIManifest);
      expect(result.api).toEqual([]);
    });
  });

  describe('auth type: none', () => {
    it('should not add settings when auth type is none', () => {
      const manifest: OpenAIPluginManifest = {
        ...baseOpenAIManifest,
        auth: { instructions: '', type: 'none' },
      };
      const result = convertOpenAIManifestToLobeManifest(manifest);
      expect(result.settings).toBeUndefined();
    });
  });

  describe('auth type: service_http', () => {
    it('should add settings with apiAuthKey property when auth type is service_http', () => {
      const manifest: OpenAIPluginManifest = {
        ...baseOpenAIManifest,
        auth: {
          authorization_type: 'bearer',
          instructions: '',
          type: 'service_http',
          verification_tokens: { openai: 'tok_abc123' },
        },
      };
      const result = convertOpenAIManifestToLobeManifest(manifest);
      expect(result.settings).toBeDefined();
      expect(result.settings?.properties?.apiAuthKey).toBeDefined();
    });

    it('should set apiAuthKey default to the openai verification token', () => {
      const manifest: OpenAIPluginManifest = {
        ...baseOpenAIManifest,
        auth: {
          authorization_type: 'bearer',
          instructions: '',
          type: 'service_http',
          verification_tokens: { openai: 'tok_abc123' },
        },
      };
      const result = convertOpenAIManifestToLobeManifest(manifest);
      expect(result.settings?.properties?.apiAuthKey?.default).toBe('tok_abc123');
    });

    it('should set apiAuthKey format to password', () => {
      const manifest: OpenAIPluginManifest = {
        ...baseOpenAIManifest,
        auth: {
          authorization_type: 'bearer',
          instructions: '',
          type: 'service_http',
          verification_tokens: { openai: 'secret' },
        },
      };
      const result = convertOpenAIManifestToLobeManifest(manifest);
      expect(result.settings?.properties?.apiAuthKey?.format).toBe('password');
    });

    it('should set settings type to object', () => {
      const manifest: OpenAIPluginManifest = {
        ...baseOpenAIManifest,
        auth: {
          authorization_type: 'bearer',
          instructions: '',
          type: 'service_http',
          verification_tokens: { openai: 'secret' },
        },
      };
      const result = convertOpenAIManifestToLobeManifest(manifest);
      expect(result.settings?.type).toBe('object');
    });
  });
});

// ─── getToolManifest ──────────────────────────────────────────────────────────

describe('getToolManifest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validLobeManifest = {
    api: [],
    identifier: 'test-plugin',
    meta: { title: 'Test', description: 'desc', avatar: '' },
    openapi: 'https://example.com/api.yaml',
    type: 'default',
    version: '1',
  };

  describe('error cases', () => {
    it('should throw noManifest when url is undefined', async () => {
      await expect(getToolManifest(undefined)).rejects.toThrow('noManifest');
    });

    it('should throw noManifest when url is empty string', async () => {
      await expect(getToolManifest('')).rejects.toThrow('noManifest');
    });

    it('should throw fetchError when fetch throws a network error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('network failure'));
      await expect(getToolManifest('https://example.com/manifest.json')).rejects.toThrow(
        'fetchError',
      );
    });

    it('should throw fetchError when response is not ok', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        headers: { get: () => null },
      } as any);
      await expect(getToolManifest('https://example.com/manifest.json')).rejects.toThrow(
        'fetchError',
      );
    });

    it('should throw urlError when JSON parsing fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => {
          throw new Error('invalid json');
        },
      } as any);
      await expect(getToolManifest('https://example.com/manifest.json')).rejects.toThrow(
        'urlError',
      );
    });

    it('should throw manifestInvalid when manifest schema validation fails', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ invalid: 'data' }),
      } as any);
      await expect(getToolManifest('https://example.com/manifest.json')).rejects.toThrow(
        'manifestInvalid',
      );
    });
  });

  describe('successful fetch', () => {
    it('should return parsed lobe manifest for application/json content type', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => validLobeManifest,
      } as any);

      const result = await getToolManifest('https://example.com/manifest.json');
      expect(result.identifier).toBe('test-plugin');
    });

    it('should use proxy URL when useProxy is true', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => validLobeManifest,
      } as any);

      await getToolManifest('https://example.com/manifest.json', true);

      // fetch should have been called with proxy endpoint, not direct url
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('proxy'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should call fetch directly when useProxy is false', async () => {
      const targetUrl = 'https://example.com/manifest.json';
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => validLobeManifest,
      } as any);

      await getToolManifest(targetUrl, false);

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(targetUrl);
    });

    it('should convert OpenAI manifest format when description_for_model is present', async () => {
      const openAIStyleManifest = {
        api: { type: 'openapi', url: 'https://example.com/api.yaml' },
        auth: { instructions: '', type: 'none' },
        contact_email: 'dev@example.com',
        description_for_human: 'Human description',
        description_for_model: 'Model description',
        legal_info_url: 'https://example.com/legal',
        logo_url: 'https://example.com/logo.png',
        name_for_human: 'My Plugin',
        name_for_model: 'my_plugin',
        schema_version: 'v1',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => openAIStyleManifest,
      } as any);

      const result = await getToolManifest('https://example.com/manifest.json');
      expect(result.identifier).toBe('my_plugin');
      expect(result.meta?.title).toBe('My Plugin');
      expect(result.systemRole).toBe('Model description');
    });
  });
});
