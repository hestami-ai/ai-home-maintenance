import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	computeFingerprint,
	getCachedPacket,
	cachePacket,
	invalidateForDialogue,
	clearContextCache,
	getCacheSize,
} from '../../../lib/context/contextCache';
import { Role, Phase } from '../../../lib/types';
import type { HandoffPacket } from '../../../lib/context/engineTypes';
import { randomUUID } from 'node:crypto';

/**
 * Context cache tests for the post-budget HandoffPacket shape.
 *
 * The cache fingerprints on (role, phase, subPhase, intent, policyVersion,
 * dialogueId, extras) — token budget is no longer part of the key.
 */
describe('Context Cache', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		clearContextCache();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
		clearContextCache();
	});

	const makePacket = (): HandoffPacket => ({
		briefing: '# Context Briefing\n\nTest briefing.',
		sectionManifest: [
			{
				blockId: 'goal',
				label: 'Goal',
				source: 'db_query',
				retrievalPointer: 'db:intake_plan:test',
			},
		],
		sufficiency: {
			sufficient: true,
			missingRequired: [],
			warnings: [],
		},
		fingerprint: randomUUID(),
		diagnostics: {
			policyKey: 'EXECUTOR:PROPOSE:*:*',
			policyVersion: 1,
			handoffDocsConsumed: [],
			sqlQueriesExecuted: 0,
			wallClockMs: 0,
		},
	});

	describe('computeFingerprint', () => {
		it('returns identical fingerprints for identical inputs', () => {
			const dialogueId = randomUUID();
			const fp1 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, dialogueId);
			const fp2 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, dialogueId);
			expect(fp1).toBe(fp2);
		});

		it('differs by role', () => {
			const dialogueId = randomUUID();
			const fp1 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, dialogueId);
			const fp2 = computeFingerprint(Role.VERIFIER, Phase.PROPOSE, undefined, undefined, 1, dialogueId);
			expect(fp1).not.toBe(fp2);
		});

		it('differs by phase', () => {
			const dialogueId = randomUUID();
			const fp1 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, dialogueId);
			const fp2 = computeFingerprint(Role.EXECUTOR, Phase.VERIFY, undefined, undefined, 1, dialogueId);
			expect(fp1).not.toBe(fp2);
		});

		it('differs by subPhase', () => {
			const dialogueId = randomUUID();
			const fp1 = computeFingerprint(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'DECOMPOSING', undefined, 1, dialogueId);
			const fp2 = computeFingerprint(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'MODELING', undefined, 1, dialogueId);
			expect(fp1).not.toBe(fp2);
		});

		it('differs by intent', () => {
			const dialogueId = randomUUID();
			const fp1 = computeFingerprint(Role.EXECUTOR, Phase.EXECUTE, '*', 'MAKER_PLANNER', 1, dialogueId);
			const fp2 = computeFingerprint(Role.EXECUTOR, Phase.EXECUTE, '*', '*', 1, dialogueId);
			expect(fp1).not.toBe(fp2);
		});

		it('differs by policy version', () => {
			const dialogueId = randomUUID();
			const fp1 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, dialogueId);
			const fp2 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 2, dialogueId);
			expect(fp1).not.toBe(fp2);
		});

		it('differs by dialogueId', () => {
			const fp1 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, randomUUID());
			const fp2 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, randomUUID());
			expect(fp1).not.toBe(fp2);
		});

		it('differs by extras content', () => {
			const dialogueId = randomUUID();
			const fp1 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, dialogueId, { goal: 'A' });
			const fp2 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, dialogueId, { goal: 'B' });
			expect(fp1).not.toBe(fp2);
		});

		it('is stable across extras key order', () => {
			const dialogueId = randomUUID();
			const fp1 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, dialogueId, { a: 1, b: 2 });
			const fp2 = computeFingerprint(Role.EXECUTOR, Phase.PROPOSE, undefined, undefined, 1, dialogueId, { b: 2, a: 1 });
			expect(fp1).toBe(fp2);
		});
	});

	describe('cache get/set', () => {
		it('returns null on miss', () => {
			expect(getCachedPacket('nonexistent-fingerprint')).toBeNull();
		});

		it('returns a stored packet by fingerprint', () => {
			const fp = 'fp-1';
			const packet = makePacket();
			cachePacket(fp, packet);
			const retrieved = getCachedPacket(fp);
			expect(retrieved).not.toBeNull();
			expect(retrieved?.briefing).toBe(packet.briefing);
		});

		it('returns a deep copy (mutating retrieved does not affect cache)', () => {
			const fp = 'fp-2';
			cachePacket(fp, makePacket());
			const first = getCachedPacket(fp);
			expect(first).not.toBeNull();
			first!.briefing = 'mutated';
			const second = getCachedPacket(fp);
			expect(second?.briefing).not.toBe('mutated');
		});

		it('overwrites existing entry on duplicate fingerprint', () => {
			const fp = 'fp-3';
			const a = makePacket();
			a.briefing = 'first';
			cachePacket(fp, a);
			const b = makePacket();
			b.briefing = 'second';
			cachePacket(fp, b);
			expect(getCachedPacket(fp)?.briefing).toBe('second');
		});
	});

	describe('cache invalidation', () => {
		it('clearContextCache empties the cache', () => {
			cachePacket('fp-a', makePacket());
			cachePacket('fp-b', makePacket());
			expect(getCacheSize()).toBe(2);
			clearContextCache();
			expect(getCacheSize()).toBe(0);
		});

		it('invalidateForDialogue clears the cache', () => {
			cachePacket('fp-a', makePacket());
			cachePacket('fp-b', makePacket());
			invalidateForDialogue('any-dialogue-id');
			expect(getCacheSize()).toBe(0);
		});
	});

	describe('LRU eviction', () => {
		it('caps the cache at MAX_CACHE_SIZE entries', () => {
			// MAX_CACHE_SIZE in contextCache.ts is 50 — cache should not exceed it.
			for (let i = 0; i < 100; i++) {
				cachePacket(`fp-${i}`, makePacket());
			}
			expect(getCacheSize()).toBeLessThanOrEqual(50);
		});

		it('evicts oldest entries when capacity is exceeded', () => {
			cachePacket('oldest', makePacket());
			for (let i = 0; i < 60; i++) {
				cachePacket(`fp-${i}`, makePacket());
			}
			// 'oldest' should have been evicted by FIFO/LRU after 60 inserts.
			expect(getCachedPacket('oldest')).toBeNull();
		});
	});
});
