import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	compileContextPack,
	clearContextPackCache,
	clearExpiredCacheEntries,
	getCacheStatistics,
	serializeContextPack,
	deserializeContextPack,
} from '../../../lib/context/compiler';
import { getDatabase } from '../../../lib/database/init';
import { Role } from '../../../lib/types';
import { randomUUID } from 'node:crypto';

describe('Context Compiler', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		clearContextPackCache();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
		clearContextPackCache();
	});

	describe('compileContextPack', () => {
		it('compiles basic context pack for executor role', () => {
			const dialogueId = randomUUID();
			
			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				goal: 'Build a REST API',
				tokenBudget: 10000,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.role).toBe(Role.EXECUTOR);
				expect(result.value.goal).toBe('Build a REST API');
				expect(result.value.token_budget).toBe(10000);
				expect(result.value.tokenUsage).toBeDefined();
				expect(result.value.compiled_at).toBeDefined();
			}
		});

		it('includes active claims in context pack', () => {
			const dialogueId = randomUUID();
			
			const db = getDatabase()!;
			db.prepare(`
				INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(randomUUID(), 'Database must use PostgreSQL', 'VERIFIER', 'HIGH', 'OPEN', dialogueId, 1, new Date().toISOString());

			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.active_claims).toHaveLength(1);
				expect(result.value.active_claims[0].statement).toBe('Database must use PostgreSQL');
			}
		});

		it('includes verdicts for claims', () => {
			const dialogueId = randomUUID();
			const claimId = randomUUID();
			
			const db = getDatabase()!;
			db.prepare(`
				INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(claimId, 'Use TypeScript', 'VERIFIER', 'MEDIUM', 'OPEN', dialogueId, 1, new Date().toISOString());

			db.prepare(`
				INSERT INTO verdicts (verdict_id, claim_id, verdict, constraints_ref, evidence_ref, rationale, timestamp)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`).run(randomUUID(), claimId, 'PROCEED', null, null, 'TypeScript is appropriate', new Date().toISOString());

			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.verdicts).toHaveLength(1);
				expect(result.value.verdicts[0].verdict).toBe('PROCEED');
				expect(result.value.verdicts[0].rationale).toBe('TypeScript is appropriate');
			}
		});

		it('caches compiled context packs', () => {
			const dialogueId = randomUUID();
			
			const result1 = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			const result2 = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			expect(result1.success).toBe(true);
			expect(result2.success).toBe(true);
			if (result1.success && result2.success) {
				expect(result1.value.compiled_at).toBe(result2.value.compiled_at);
			}
		});

		it('uses separate cache entries for different roles', () => {
			const dialogueId = randomUUID();
			
			const executorResult = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			const verifierResult = compileContextPack({
				role: Role.VERIFIER,
				dialogueId,
				tokenBudget: 10000,
			});

			expect(executorResult.success).toBe(true);
			expect(verifierResult.success).toBe(true);
			if (executorResult.success && verifierResult.success) {
				expect(executorResult.value.role).toBe(Role.EXECUTOR);
				expect(verifierResult.value.role).toBe(Role.VERIFIER);
			}
		});

		it('calculates token usage breakdown', () => {
			const dialogueId = randomUUID();
			
			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				goal: 'Build authentication system',
				tokenBudget: 10000,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.goal).toBeGreaterThan(0);
				expect(result.value.tokenUsage.total).toBeGreaterThan(0);
				expect(result.value.tokenUsage.claims).toBeGreaterThanOrEqual(0);
				expect(result.value.tokenUsage.verdicts).toBeGreaterThanOrEqual(0);
			}
		});

		it('truncates context when over budget', () => {
			const dialogueId = randomUUID();
			
			const db = getDatabase()!;
			for (let i = 0; i < 50; i++) {
				db.prepare(`
					INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`).run(randomUUID(), `Claim ${i}: Very long statement that takes many tokens`, 'VERIFIER', 'MEDIUM', 'OPEN', dialogueId, i, new Date().toISOString());
			}

			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 500,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(500);
			}
		});

		it('handles empty dialogue gracefully', () => {
			const dialogueId = randomUUID();
			
			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.active_claims).toEqual([]);
				expect(result.value.verdicts).toEqual([]);
				expect(result.value.human_decisions).toEqual([]);
			}
		});

		it('respects includeHistorical option', () => {
			const dialogueId = randomUUID();
			
			const withoutHistory = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
				includeHistorical: false,
			});

			const withHistory = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
				includeHistorical: true,
			});

			expect(withoutHistory.success).toBe(true);
			expect(withHistory.success).toBe(true);
			if (withoutHistory.success && withHistory.success) {
				expect(withoutHistory.value.historical_findings).toEqual([]);
			}
		});

		it('limits historical findings to maxHistoricalFindings', () => {
			const dialogueId = randomUUID();
			
			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
				includeHistorical: true,
				maxHistoricalFindings: 5,
			});

			expect(result.success).toBe(true);
		});

		it('includes artifact references', () => {
			const dialogueId = randomUUID();
			const claimId = randomUUID();
			
			const db = getDatabase()!;
			db.prepare(`
				INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(claimId, 'Test claim', 'VERIFIER', 'MEDIUM', 'OPEN', dialogueId, 1, new Date().toISOString());

			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.artifact_refs).toBeDefined();
			}
		});
	});

	describe('cache management', () => {
		it('clearContextPackCache clears all entries', () => {
			const dialogueId = randomUUID();
			
			compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			let stats = getCacheStatistics();
			expect(stats.size).toBeGreaterThan(0);

			clearContextPackCache();

			stats = getCacheStatistics();
			expect(stats.size).toBe(0);
		});

		it('getCacheStatistics returns cache info', () => {
			const dialogueId = randomUUID();
			
			compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			const stats = getCacheStatistics();
			expect(stats.size).toBe(1);
			expect(stats.entries).toHaveLength(1);
			expect(stats.entries[0].key).toBe(`EXECUTOR:${dialogueId}`);
			expect(stats.entries[0].compiledAt).toBeDefined();
			expect(stats.entries[0].expiresAt).toBeDefined();
		});

		it('clearExpiredCacheEntries removes only expired entries', async () => {
			vi.useFakeTimers();
			
			const dialogueId = randomUUID();
			
			compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			let stats = getCacheStatistics();
			expect(stats.size).toBe(1);

			vi.advanceTimersByTime(6 * 60 * 1000);

			clearExpiredCacheEntries();

			stats = getCacheStatistics();
			expect(stats.size).toBe(0);

			vi.useRealTimers();
		});
	});

	describe('serialization', () => {
		it('serializes context pack to JSON string', () => {
			const dialogueId = randomUUID();
			
			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				goal: 'Test goal',
				tokenBudget: 10000,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				const serialized = serializeContextPack(result.value);
				expect(typeof serialized).toBe('string');
				expect(serialized).toContain('EXECUTOR');
				expect(serialized).toContain('Test goal');
			}
		});

		it('deserializes context pack from JSON string', () => {
			const dialogueId = randomUUID();
			
			const compileResult = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				goal: 'Test goal',
				tokenBudget: 10000,
			});

			expect(compileResult.success).toBe(true);
			if (compileResult.success) {
				const serialized = serializeContextPack(compileResult.value);
				const deserializeResult = deserializeContextPack(serialized);

				expect(deserializeResult.success).toBe(true);
				if (deserializeResult.success) {
					expect(deserializeResult.value.role).toBe(Role.EXECUTOR);
					expect(deserializeResult.value.goal).toBe('Test goal');
				}
			}
		});

		it('handles invalid JSON during deserialization', () => {
			const result = deserializeContextPack('{ invalid json }');
			
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Failed to deserialize');
			}
		});
	});

	describe('edge cases', () => {
		it('handles missing database gracefully', () => {
			tempDb.cleanup();
			
			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId: randomUUID(),
				tokenBudget: 10000,
			});

			expect(result.success).toBe(false);
		});

		it('handles null goal', () => {
			const dialogueId = randomUUID();
			
			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.goal).toBeNull();
			}
		});

		it('handles zero token budget', () => {
			const dialogueId = randomUUID();
			
			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 0,
			});

			expect(result.success).toBe(true);
		});

		it('handles very large token budget', () => {
			const dialogueId = randomUUID();
			
			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 1000000,
			});

			expect(result.success).toBe(true);
		});
	});

	describe('integration scenarios', () => {
		it('compiles complete context with all components', () => {
			const dialogueId = randomUUID();
			const claimId = randomUUID();
			const gateId = randomUUID();
			
			const db = getDatabase()!;
			db.prepare(`
				INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(claimId, 'Use microservices architecture', 'VERIFIER', 'HIGH', 'OPEN', dialogueId, 1, new Date().toISOString());

			db.prepare(`
				INSERT INTO verdicts (verdict_id, claim_id, verdict, constraints_ref, evidence_ref, rationale, timestamp)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`).run(randomUUID(), claimId, 'ESCALATE_HUMAN', null, null, 'Needs human decision', new Date().toISOString());

			db.prepare(`
				INSERT INTO gates (gate_id, dialogue_id, reason, status, blocking_claims, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`).run(gateId, dialogueId, 'Review architecture', 'OPEN', JSON.stringify([claimId]), new Date().toISOString());

			db.prepare(`
				INSERT INTO human_decisions (decision_id, gate_id, action, rationale, attachments_ref, timestamp)
				VALUES (?, ?, ?, ?, ?, ?)
			`).run(randomUUID(), gateId, 'APPROVE', 'Architecture looks good', null, new Date().toISOString());

			const result = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				goal: 'Build microservices platform',
				tokenBudget: 10000,
				includeHistorical: true,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.active_claims).toHaveLength(1);
				expect(result.value.verdicts).toHaveLength(1);
				expect(result.value.human_decisions).toHaveLength(1);
				expect(result.value.tokenUsage.total).toBeGreaterThan(0);
			}
		});

		it('handles re-compilation after cache expiry', async () => {
			vi.useFakeTimers();
			
			const dialogueId = randomUUID();
			
			const result1 = compileContextPack({
				role: Role.EXECUTOR,
				dialogueId,
				tokenBudget: 10000,
			});

			expect(result1.success).toBe(true);
			if (result1.success) {
				const compiledAt1 = result1.value.compiled_at;

				vi.advanceTimersByTime(6 * 60 * 1000);

				const result2 = compileContextPack({
					role: Role.EXECUTOR,
					dialogueId,
					tokenBudget: 10000,
				});

				expect(result2.success).toBe(true);
				if (result2.success) {
					expect(result2.value.compiled_at).not.toBe(compiledAt1);
				}
			}

			vi.useRealTimers();
		});
	});
});
