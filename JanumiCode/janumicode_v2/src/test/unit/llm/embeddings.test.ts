// Wave 6 dedup — unit tests for the cosine-similarity helpers.
// The ollama HTTP path itself requires a live ollama instance and is
// covered in the calibration integration runs; here we exercise only
// the pure-math layer that drives flag-but-don't-merge decisions.

import { describe, it, expect } from 'vitest';
import { cosineSimilarity, findNearestAbove } from '../../../lib/llm/embeddings';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
    expect(cosineSimilarity([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])).toBeCloseTo(1, 6);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 6);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('returns -1 for antiparallel vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1, 6);
  });

  it('returns NaN for mismatched dimensions', () => {
    expect(Number.isNaN(cosineSimilarity([1, 0], [1, 0, 0]))).toBe(true);
  });

  it('returns NaN for zero-norm vectors', () => {
    expect(Number.isNaN(cosineSimilarity([0, 0, 0], [1, 1, 1]))).toBe(true);
    expect(Number.isNaN(cosineSimilarity([1, 1, 1], [0, 0, 0]))).toBe(true);
  });

  it('is symmetric and normalizes magnitude', () => {
    const a = [2, 4, 0];
    const b = [1, 2, 0]; // same direction, smaller
    const sim1 = cosineSimilarity(a, b);
    const sim2 = cosineSimilarity(b, a);
    expect(sim1).toBeCloseTo(sim2, 6);
    expect(sim1).toBeCloseTo(1, 6);
  });
});

describe('findNearestAbove', () => {
  const candidate = [1, 0, 0];
  const priors = [
    { id: 'A-0001', vector: [0.9, 0.1, 0.1] },  // high sim
    { id: 'A-0002', vector: [0, 1, 0] },        // orthogonal
    { id: 'A-0003', vector: [0.95, 0, 0.05] },  // higher sim
  ];

  it('returns null when no prior exceeds threshold', () => {
    // 0.9999 is higher than any of the fixture priors' sim with candidate.
    const result = findNearestAbove(candidate, priors, 0.9999);
    expect(result).toBeNull();
  });

  it('returns the highest-similarity prior above threshold', () => {
    const result = findNearestAbove(candidate, priors, 0.9);
    expect(result?.id).toBe('A-0003');
    expect(result?.similarity).toBeGreaterThan(0.99);
  });

  it('returns null when priors is empty', () => {
    expect(findNearestAbove(candidate, [], 0.5)).toBeNull();
  });

  it('skips malformed (mismatched-dim) priors without throwing', () => {
    const mixed = [
      { id: 'bad', vector: [1, 0] },              // dim mismatch
      { id: 'good', vector: [0.99, 0.01, 0] },    // valid, high sim
    ];
    const result = findNearestAbove(candidate, mixed, 0.9);
    expect(result?.id).toBe('good');
  });
});
