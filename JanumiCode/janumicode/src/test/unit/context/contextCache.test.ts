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
import { getDatabase } from '../../../lib/database/init';
import { Role, Phase } from '../../../lib/types';
import type { HandoffPacket } from '../../../lib/context/engineTypes';
import { randomUUID } from 'node:crypto';

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

	const createMockHandoffPacket = (): HandoffPacket => ({
		briefing: '# Context Briefing\n\nTest context briefing for testing.',
		sectionManifest: [
			{
				blockId: 'goal',
				label: 'Goal',
				source: 'db_query',
				tokenCount: 50,
				retrievalPointer: 'db:intake_plan:test',
			},
		],
		omissions: [],
		tokenAccounting: {
			budget: 10000,
			used: 300,
			remaining: 9700,
			perSection: {
				goal: 50,
				claims: 100,
				verdicts: 50,
			},
		},
		sufficiency: {
			sufficient: true,
			missingRequired: [],
			warnings: [],
			confidenceLevel: 'high',
		},
		fingerprint: randomUUID(),
		diagnostics: {
			policyKey: 'EXECUTOR:PROPOSE:*:*',
			policyVersion: 1,
			handoffDocsConsumed: [],
			sqlQueriesExecuted: 3,
			agentReasoningTokens: 0,
			wallClockMs: 100,
		},
	});

	describe('computeFingerprint', () => {
		it('generates consistent fingerprints for same parameters', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint1).toBe(fingerprint2);
		});

		it('generates different fingerprints for different roles', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const fingerprint2 = computeFingerprint(
				Role.VERIFIER,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint1).not.toBe(fingerprint2);
		});

		it('generates different fingerprints for different phases', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.VERIFY,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint1).not.toBe(fingerprint2);
		});

		it('generates different fingerprints for different subPhases', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.INTAKE,
				'INTENT_DISCOVERY',
				undefined,
				10000,
				1,
				dialogueId
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.INTAKE,
				'PRODUCT_REVIEW',
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint1).not.toBe(fingerprint2);
		});

		it('generates different fingerprints for different token budgets', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				20000,
				1,
				dialogueId
			);

			expect(fingerprint1).not.toBe(fingerprint2);
		});

		it('generates different fingerprints for different policy versions', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				2,
				dialogueId
			);

			expect(fingerprint1).not.toBe(fingerprint2);
		});

		it('generates different fingerprints for different dialogues', () => {
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				randomUUID()
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				randomUUID()
			);

			expect(fingerprint1).not.toBe(fingerprint2);
		});

		it('includes extras hash in fingerprint', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId,
				{ customField: 'value1' }
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId,
				{ customField: 'value2' }
			);

			expect(fingerprint1).not.toBe(fingerprint2);
		});

		it('generates same fingerprint for same extras regardless of key order', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId,
				{ a: 1, b: 2 }
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId,
				{ b: 2, a: 1 }
			);

			expect(fingerprint1).toBe(fingerprint2);
		});

		it('handles undefined subPhase consistently', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint1).toBe(fingerprint2);
		});

		it('reflects latest event ID from database', () => {
			const dialogueId = randomUUID();
			const db = getDatabase()!;
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			db.prepare(`
				INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, content, summary, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`).run(dialogueId, 'turn', Role.EXECUTOR, Phase.PROPOSE, 'test', 'test', new Date().toISOString());

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint1).not.toBe(fingerprint2);
		});
	});

	describe('cachePacket and getCachedPacket', () => {
		it('caches and retrieves packet successfully', () => {
			const dialogueId = randomUUID();
			const packet = createMockHandoffPacket();
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			cachePacket(fingerprint, packet);
			const retrieved = getCachedPacket(fingerprint);

			expect(retrieved).not.toBeNull();
			expect(retrieved?.briefing).toBe(packet.briefing);
			expect(retrieved?.diagnostics.policyKey).toBe(packet.diagnostics.policyKey);
		});

		it('returns null for non-existent fingerprint', () => {
			const retrieved = getCachedPacket('non-existent-fingerprint');

			expect(retrieved).toBeNull();
		});

		it('returns deep copy to prevent cache mutation', () => {
			const dialogueId = randomUUID();
			const packet = createMockHandoffPacket();
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			cachePacket(fingerprint, packet);
			const retrieved = getCachedPacket(fingerprint);

			expect(retrieved).not.toBe(packet);
			
			if (retrieved) {
				retrieved.briefing = 'Modified briefing';
			}

			const retrievedAgain = getCachedPacket(fingerprint);
			expect(retrievedAgain?.briefing).toBe(packet.briefing);
		});

		it('implements LRU behavior', () => {
			const dialogueId = randomUUID();
			const packet = createMockHandoffPacket();
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			cachePacket(fingerprint, packet);
			const initialSize = getCacheSize();

			getCachedPacket(fingerprint);
			
			expect(getCacheSize()).toBe(initialSize);
		});

		it('evicts oldest entries when cache is full', () => {
			const packets: HandoffPacket[] = [];
			const fingerprints: string[] = [];

			for (let i = 0; i < 60; i++) {
				const dialogueId = randomUUID();
				const packet = createMockHandoffPacket();
				const fingerprint = computeFingerprint(
					Role.EXECUTOR,
					Phase.PROPOSE,
					undefined,
					undefined,
					10000 + i,
					1,
					dialogueId
				);
				
				packets.push(packet);
				fingerprints.push(fingerprint);
				cachePacket(fingerprint, packet);
			}

			expect(getCacheSize()).toBeLessThanOrEqual(50);
			
			const firstPacket = getCachedPacket(fingerprints[0]);
			expect(firstPacket).toBeNull();

			const lastPacket = getCachedPacket(fingerprints[59]);
			expect(lastPacket).not.toBeNull();
		});
	});

	describe('invalidateForDialogue', () => {
		it('clears all cache entries', () => {
			const dialogueId = randomUUID();
			const packet = createMockHandoffPacket();
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			cachePacket(fingerprint, packet);
			expect(getCacheSize()).toBeGreaterThan(0);

			invalidateForDialogue(dialogueId);

			expect(getCacheSize()).toBe(0);
		});

		it('clears cache even with multiple dialogues', () => {
			for (let i = 0; i < 5; i++) {
				const dialogueId = randomUUID();
				const packet = createMockHandoffPacket();
				const fingerprint = computeFingerprint(
					Role.EXECUTOR,
					Phase.PROPOSE,
					undefined,
					undefined,
					10000,
					1,
					dialogueId
				);
				cachePacket(fingerprint, packet);
			}

			expect(getCacheSize()).toBe(5);

			invalidateForDialogue(randomUUID());

			expect(getCacheSize()).toBe(0);
		});
	});

	describe('clearContextCache', () => {
		it('clears entire cache', () => {
			for (let i = 0; i < 10; i++) {
				const dialogueId = randomUUID();
				const packet = createMockHandoffPacket();
				const fingerprint = computeFingerprint(
					Role.EXECUTOR,
					Phase.PROPOSE,
					undefined,
					undefined,
					10000 + i,
					1,
					dialogueId
				);
				cachePacket(fingerprint, packet);
			}

			expect(getCacheSize()).toBe(10);

			clearContextCache();

			expect(getCacheSize()).toBe(0);
		});

		it('allows caching after clear', () => {
			const dialogueId = randomUUID();
			const packet = createMockHandoffPacket();
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			cachePacket(fingerprint, packet);
			clearContextCache();
			
			cachePacket(fingerprint, packet);
			const retrieved = getCachedPacket(fingerprint);

			expect(retrieved).not.toBeNull();
		});
	});

	describe('getCacheSize', () => {
		it('returns 0 for empty cache', () => {
			expect(getCacheSize()).toBe(0);
		});

		it('returns correct size for cached items', () => {
			for (let i = 0; i < 5; i++) {
				const dialogueId = randomUUID();
				const packet = createMockHandoffPacket();
				const fingerprint = computeFingerprint(
					Role.EXECUTOR,
					Phase.PROPOSE,
					undefined,
					undefined,
					10000 + i,
					1,
					dialogueId
				);
				cachePacket(fingerprint, packet);
			}

			expect(getCacheSize()).toBe(5);
		});

		it('updates after cache operations', () => {
			const dialogueId = randomUUID();
			const packet = createMockHandoffPacket();
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(getCacheSize()).toBe(0);

			cachePacket(fingerprint, packet);
			expect(getCacheSize()).toBe(1);

			clearContextCache();
			expect(getCacheSize()).toBe(0);
		});
	});

	describe('integration scenarios', () => {
		it('handles complete cache lifecycle', () => {
			const dialogueId = randomUUID();
			const packet = createMockHandoffPacket();

			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(getCachedPacket(fingerprint)).toBeNull();

			cachePacket(fingerprint, packet);
			expect(getCachedPacket(fingerprint)).not.toBeNull();

			invalidateForDialogue(dialogueId);
			expect(getCachedPacket(fingerprint)).toBeNull();
		});

		it('handles cache miss and subsequent cache', () => {
			const dialogueId = randomUUID();
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const missResult = getCachedPacket(fingerprint);
			expect(missResult).toBeNull();

			const packet = createMockHandoffPacket();
			cachePacket(fingerprint, packet);

			const hitResult = getCachedPacket(fingerprint);
			expect(hitResult).not.toBeNull();
		});

		it('supports multiple roles and phases simultaneously', () => {
			const dialogueId = randomUUID();
			
			const executorPacket = createMockHandoffPacket();
			const executorFingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const verifierPacket = createMockHandoffPacket();
			const verifierFingerprint = computeFingerprint(
				Role.VERIFIER,
				Phase.VERIFY,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			cachePacket(executorFingerprint, executorPacket);
			cachePacket(verifierFingerprint, verifierPacket);

			const executorRetrieved = getCachedPacket(executorFingerprint);
			const verifierRetrieved = getCachedPacket(verifierFingerprint);
			expect(executorRetrieved).not.toBeNull();
			expect(verifierRetrieved).not.toBeNull();
		});

		it('invalidates cache when dialogue state changes', () => {
			const dialogueId = randomUUID();
			const db = getDatabase()!;
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const packet = createMockHandoffPacket();
			cachePacket(fingerprint1, packet);

			db.prepare(`
				INSERT INTO dialogue_events (dialogue_id, event_type, role, phase, content, summary, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`).run(dialogueId, 'turn', Role.EXECUTOR, Phase.PROPOSE, 'test', 'test', new Date().toISOString());

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint1).not.toBe(fingerprint2);
			expect(getCachedPacket(fingerprint2)).toBeNull();
		});
	});

	describe('edge cases', () => {
		it('handles empty extras object', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId,
				{}
			);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint1).toBe(fingerprint2);
		});

		it('handles zero token budget', () => {
			const dialogueId = randomUUID();
			
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				0,
				1,
				dialogueId
			);

			expect(fingerprint).toBeDefined();
			expect(typeof fingerprint).toBe('string');
		});

		it('handles undefined intent', () => {
			const dialogueId = randomUUID();
			
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.INTAKE,
				'INTENT_DISCOVERY',
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint).toBeDefined();
		});

		it('handles very large extras object', () => {
			const dialogueId = randomUUID();
			const largeExtras: Record<string, unknown> = {};
			for (let i = 0; i < 100; i++) {
				largeExtras[`field${i}`] = `value${i}`;
			}
			
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId,
				largeExtras
			);

			expect(fingerprint).toBeDefined();
			expect(typeof fingerprint).toBe('string');
		});

		it('handles nested extras objects', () => {
			const dialogueId = randomUUID();
			
			const fingerprint = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId,
				{ nested: { deep: { value: 'test' } } }
			);

			expect(fingerprint).toBeDefined();
		});

		it('returns consistent fingerprints after cache operations', () => {
			const dialogueId = randomUUID();
			
			const fingerprint1 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			const packet = createMockHandoffPacket();
			cachePacket(fingerprint1, packet);
			getCachedPacket(fingerprint1);

			const fingerprint2 = computeFingerprint(
				Role.EXECUTOR,
				Phase.PROPOSE,
				undefined,
				undefined,
				10000,
				1,
				dialogueId
			);

			expect(fingerprint1).toBe(fingerprint2);
		});
	});
});
