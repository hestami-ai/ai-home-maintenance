import { describe, it, expect } from 'vitest';
import { ExecutorAgent } from '../../../lib/agents/executorAgent';

describe('ExecutorAgent', () => {
  describe('computeFileHash', () => {
    it('computes SHA-256 hash of content', () => {
      const hash = ExecutorAgent.computeFileHash('hello world');
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('produces different hashes for different content', () => {
      const hash1 = ExecutorAgent.computeFileHash('version 1');
      const hash2 = ExecutorAgent.computeFileHash('version 2');
      expect(hash1).not.toBe(hash2);
    });

    it('produces consistent hashes', () => {
      const hash1 = ExecutorAgent.computeFileHash('consistent');
      const hash2 = ExecutorAgent.computeFileHash('consistent');
      expect(hash1).toBe(hash2);
    });
  });
});
