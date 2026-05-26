import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { phase1CanonicalVocabularyContract, type CanonicalVocabularyArtifact } from './phase1-canonical-vocabulary-discovery.contract';
import ideal from './fixtures/phase1-canonical-vocabulary.ideal.json' assert { type: 'json' };

describe('Phase 1.0f canonical_vocabulary_discovery contract — forward', () => {
  it('ideal fixture passes', () => {
    const results = runContractSuite(
      phase1CanonicalVocabularyContract,
      ideal as unknown as CanonicalVocabularyArtifact,
      { workflowRunId: 'fwd', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    if (failures.length) console.error(failures.map((f) => `${f.clauseId}: ${f.message}`).join('\n'));
    expect(failures).toEqual([]);
  });

  it('breaks C-1.0f.3 on duplicate terms (case-insensitive)', () => {
    const broken: CanonicalVocabularyArtifact = {
      kind: 'canonical_vocabulary_discovery',
      vocabulary: [
        { term: 'Slug', definition: 'A' },
        { term: 'slug', definition: 'B' },
      ],
    };
    const results = runContractSuite(phase1CanonicalVocabularyContract, broken, { workflowRunId: 'neg', relatedArtifacts: new Map() });
    const f = results.find((r) => r.clauseId === 'C-1.0f.3');
    expect(f?.passed).toBe(false);
  });
});
