import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hashApiKey } from './apiKeyHash';

const TEST_SECRET = 'test-secret-key-for-unit-tests';
const TEST_API_KEY = 'sk-lh-abc123def456';

describe('hashApiKey', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.KEY_VAULTS_SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.KEY_VAULTS_SECRET;
    } else {
      process.env.KEY_VAULTS_SECRET = originalSecret;
    }
  });

  describe('when KEY_VAULTS_SECRET is set', () => {
    beforeEach(() => {
      process.env.KEY_VAULTS_SECRET = TEST_SECRET;
    });

    it('should return a hex string', () => {
      const result = hashApiKey(TEST_API_KEY);
      expect(result).toMatch(/^[\da-f]{64}$/);
    });

    it('should produce a SHA-256 HMAC hash (64 hex chars)', () => {
      const result = hashApiKey(TEST_API_KEY);
      expect(result).toHaveLength(64);
    });

    it('should produce the same hash for the same input', () => {
      const hash1 = hashApiKey(TEST_API_KEY);
      const hash2 = hashApiKey(TEST_API_KEY);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different API keys', () => {
      const hash1 = hashApiKey('sk-lh-key-one');
      const hash2 = hashApiKey('sk-lh-key-two');
      expect(hash1).not.toBe(hash2);
    });

    it('should match the expected HMAC-SHA256 value', () => {
      const expected = createHmac('sha256', TEST_SECRET).update(TEST_API_KEY).digest('hex');
      expect(hashApiKey(TEST_API_KEY)).toBe(expected);
    });

    it('should produce different hashes when the secret changes', () => {
      const hash1 = hashApiKey(TEST_API_KEY);
      process.env.KEY_VAULTS_SECRET = 'different-secret';
      const hash2 = hashApiKey(TEST_API_KEY);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle an empty string API key', () => {
      const result = hashApiKey('');
      expect(result).toMatch(/^[\da-f]{64}$/);
    });

    it('should handle API keys with special characters', () => {
      const result = hashApiKey('sk-lh-special!@#$%^&*()_+');
      expect(result).toMatch(/^[\da-f]{64}$/);
    });

    it('should handle a very long API key', () => {
      const longKey = 'sk-lh-' + 'a'.repeat(1000);
      const result = hashApiKey(longKey);
      expect(result).toMatch(/^[\da-f]{64}$/);
    });
  });

  describe('when KEY_VAULTS_SECRET is missing', () => {
    beforeEach(() => {
      delete process.env.KEY_VAULTS_SECRET;
    });

    it('should throw an error when KEY_VAULTS_SECRET is not set', () => {
      expect(() => hashApiKey(TEST_API_KEY)).toThrow(
        '`KEY_VAULTS_SECRET` is required for API key hash calculation.',
      );
    });

    it('should throw an Error instance', () => {
      expect(() => hashApiKey(TEST_API_KEY)).toThrow(Error);
    });
  });

  describe('when KEY_VAULTS_SECRET is empty string', () => {
    beforeEach(() => {
      process.env.KEY_VAULTS_SECRET = '';
    });

    it('should throw an error when KEY_VAULTS_SECRET is empty', () => {
      expect(() => hashApiKey(TEST_API_KEY)).toThrow(
        '`KEY_VAULTS_SECRET` is required for API key hash calculation.',
      );
    });
  });
});
