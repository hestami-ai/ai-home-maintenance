// The de minimis floor's identity/provenance step (§8.4 step 2) must CHECK the subject, not assert it. This locks
// the derivation that replaced five literal `true`s (findings 18/67): a PWA missing a stable id, semantic version,
// provenance, or an identified producer must fail its mandatory criterion. Mutation proof: revert any derived fact
// below to a literal `true` and the matching case here goes red.
import { describe, expect, it } from 'vitest';
import { identityProvenanceFactsOf } from './floor.js';
import type { FloorProducer } from './floor.js';

const PRODUCER: FloorProducer = {
	agentId: 'authoring-agent',
	modelId: 'gpt-5.4',
	providerId: 'openai'
};
const GOOD_PWA: Record<string, unknown> = {
	id: 'pwa_01ARZ3NDEKTSV4RRFFQ69G5P00',
	semanticVersion: 2,
	provenance: { originType: 'USER_INPUT', sourceObjectIds: [], sourceEventIds: [] }
};

describe('identityProvenanceFactsOf — §8.4 step 2 CHECKS the subject, never asserts it', () => {
	it('a well-formed PWA + resolved producer satisfies the four derivable facts', () => {
		const f = identityProvenanceFactsOf(GOOD_PWA, PRODUCER);
		expect(f.hasStableId).toBe(true);
		expect(f.hasSemanticVersion).toBe(true);
		expect(f.hasProvenance).toBe(true);
		expect(f.hasProducer).toBe(true);
	});

	it('a PWA with NO provenance fails IP-03 (was a literal true — could never fail)', () => {
		const { provenance: _omit, ...noProv } = GOOD_PWA;
		expect(identityProvenanceFactsOf(noProv, PRODUCER).hasProvenance).toBe(false);
	});

	it('a PWA with an empty id fails IP-01', () => {
		expect(identityProvenanceFactsOf({ ...GOOD_PWA, id: '' }, PRODUCER).hasStableId).toBe(false);
	});

	it('a PWA with no semantic version fails IP-02', () => {
		const { semanticVersion: _omit, ...noVer } = GOOD_PWA;
		expect(identityProvenanceFactsOf(noVer, PRODUCER).hasSemanticVersion).toBe(false);
	});

	it('an unidentified producer (no agent id) fails IP-04', () => {
		const anon: FloorProducer = { agentId: '', modelId: '', providerId: '' };
		expect(identityProvenanceFactsOf(GOOD_PWA, anon).hasProducer).toBe(false);
	});
});
