import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	truncateContextPack,
	estimateTruncationImpact,
	TruncationStrategy,
} from '../../../lib/context/truncation';
import type { CompiledContextPack } from '../../../lib/context/compiler';
import { Role, ClaimCriticality, ClaimStatus, VerdictType, HumanAction } from '../../../lib/types';
import type { Claim, Verdict, HumanDecision } from '../../../lib/types';
import { randomUUID } from 'node:crypto';

describe('Context Truncation', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	const createMockClaim = (overrides?: Partial<Claim>): Claim => ({
		claim_id: randomUUID(),
		statement: 'Test claim statement',
		introduced_by: Role.VERIFIER,
		criticality: ClaimCriticality.NON_CRITICAL,
		status: ClaimStatus.OPEN,
		dialogue_id: randomUUID(),
		turn_id: 1,
		created_at: new Date().toISOString(),
		...overrides,
	});

	const createMockVerdict = (overrides?: Partial<Verdict>): Verdict => ({
		verdict_id: randomUUID(),
		claim_id: randomUUID(),
		verdict: VerdictType.VERIFIED,
		constraints_ref: null,
		evidence_ref: null,
		rationale: 'Verdict rationale text',
		novel_dependency: false,
		timestamp: new Date().toISOString(),
		...overrides,
	});

	const createMockDecision = (overrides?: Partial<HumanDecision>): HumanDecision => ({
		decision_id: randomUUID(),
		gate_id: randomUUID(),
		action: HumanAction.APPROVE,
		rationale: 'Decision rationale text',
		attachments_ref: null,
		timestamp: new Date().toISOString(),
		...overrides,
	});

	const createMockContextPack = (
		claimsCount: number = 5,
		verdictsCount: number = 3,
		decisionsCount: number = 2
	): CompiledContextPack => ({
		role: Role.EXECUTOR,
		goal: 'Test goal for context pack',
		constraint_manifest: null,
		active_claims: Array.from({ length: claimsCount }, (_, i) =>
			createMockClaim({ statement: `Claim ${i}: This is a test claim statement` })
		),
		verdicts: Array.from({ length: verdictsCount }, (_, i) =>
			createMockVerdict({ rationale: `Verdict ${i} rationale text` })
		),
		human_decisions: Array.from({ length: decisionsCount }, (_, i) =>
			createMockDecision({ rationale: `Decision ${i} rationale text` })
		),
		historical_findings: ['Finding 1', 'Finding 2', 'Finding 3'],
		artifact_refs: [],
		token_budget: 10000,
		compiled_at: new Date().toISOString(),
		tokenUsage: {
			goal: 50,
			constraints: 0,
			claims: 500,
			verdicts: 300,
			decisions: 200,
			historical: 300,
			workspace: 0,
			total: 1350,
		},
	});

	describe('truncateContextPack', () => {
		it('truncates claims when over budget', () => {
			const pack = createMockContextPack(10, 0, 0);
			pack.tokenUsage.claims = 1000;
			pack.tokenUsage.total = 1050;

			// Budget much smaller than the per-claim token sum forces truncation.
			const budget = {
				total: 50,
				goal: 20,
				constraints: 0,
				claims: 10,
				verdicts: 10,
				decisions: 5,
				historical: 5,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.truncatedPack.active_claims.length).toBeLessThan(pack.active_claims.length);
				expect(result.value.removedItems.claims).toBeGreaterThan(0);
				expect(result.value.tokensSaved).toBeGreaterThan(0);
			}
		});

		it('preserves critical claims when preserveCritical is true', () => {
			const pack = createMockContextPack(5, 0, 0);
			pack.active_claims[0].criticality = ClaimCriticality.CRITICAL;
			pack.active_claims[0].statement = 'Critical claim that must be preserved';
			pack.tokenUsage.claims = 1000;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 100,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget, {
				preserveCritical: true,
				strategy: TruncationStrategy.PRIORITY_BASED,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				const criticalClaim = result.value.truncatedPack.active_claims.find(
					c => c.criticality === ClaimCriticality.CRITICAL
				);
				expect(criticalClaim).toBeDefined();
				expect(criticalClaim?.statement).toBe('Critical claim that must be preserved');
			}
		});

		it('preserves human decisions when preserveDecisions is true', () => {
			const pack = createMockContextPack(0, 0, 5);
			pack.tokenUsage.decisions = 1000;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 100,
				verdicts: 100,
				decisions: 50,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget, {
				preserveDecisions: true,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.truncatedPack.human_decisions.length).toBe(pack.human_decisions.length);
				expect(result.value.warnings.some(w => w.includes('preserved'))).toBe(true);
			}
		});

		it('removes decisions when preserveDecisions is false', () => {
			const pack = createMockContextPack(0, 0, 5);
			pack.tokenUsage.decisions = 1000;

			// Small decisions budget forces truncation of 5 decisions.
			const budget = {
				total: 30,
				goal: 10,
				constraints: 0,
				claims: 5,
				verdicts: 5,
				decisions: 5,
				historical: 5,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget, {
				preserveDecisions: false,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.truncatedPack.human_decisions.length).toBeLessThan(pack.human_decisions.length);
				expect(result.value.removedItems.decisions).toBeGreaterThan(0);
			}
		});

		it('uses OLDEST_FIRST strategy correctly', () => {
			const pack = createMockContextPack(5, 0, 0);
			const now = new Date();
			pack.active_claims.forEach((claim, i) => {
				claim.created_at = new Date(now.getTime() - (4 - i) * 1000).toISOString();
			});
			pack.tokenUsage.claims = 1000;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 200,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget, {
				strategy: TruncationStrategy.OLDEST_FIRST,
			});

			expect(result.success).toBe(true);
		});

		it('uses NEWEST_FIRST strategy correctly', () => {
			const pack = createMockContextPack(5, 0, 0);
			const now = new Date();
			pack.active_claims.forEach((claim, i) => {
				claim.created_at = new Date(now.getTime() - (4 - i) * 1000).toISOString();
			});
			pack.tokenUsage.claims = 1000;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 200,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget, {
				strategy: TruncationStrategy.NEWEST_FIRST,
			});

			expect(result.success).toBe(true);
		});

		it('uses LARGEST_FIRST strategy correctly', () => {
			const pack = createMockContextPack(5, 0, 0);
			pack.active_claims[0].statement = 'Short';
			pack.active_claims[1].statement = 'This is a much longer claim statement with many words';
			pack.tokenUsage.claims = 1000;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 100,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget, {
				strategy: TruncationStrategy.LARGEST_FIRST,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				const hasShortClaim = result.value.truncatedPack.active_claims.some(
					c => c.statement === 'Short'
				);
				expect(hasShortClaim).toBe(true);
			}
		});

		it('truncates goal when over budget', () => {
			const pack = createMockContextPack(0, 0, 0);
			pack.goal = 'This is a very long goal statement that exceeds the token budget allocated for goals';
			pack.tokenUsage.goal = 500;
			pack.tokenUsage.total = 550;

			// Small goal budget forces the truncator to shorten the long goal string.
			const budget = {
				total: 20,
				goal: 3,
				constraints: 0,
				claims: 5,
				verdicts: 5,
				decisions: 5,
				historical: 0,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.truncatedPack.goal).not.toBe(pack.goal);
				expect(result.value.warnings.some(w => w.includes('Goal was truncated'))).toBe(true);
			}
		});

		it('truncates verdicts when over budget', () => {
			const pack = createMockContextPack(0, 10, 0);
			pack.tokenUsage.verdicts = 1000;

			// Small verdicts budget forces truncation of 10 verdicts.
			const budget = {
				total: 30,
				goal: 10,
				constraints: 0,
				claims: 5,
				verdicts: 5,
				decisions: 5,
				historical: 5,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.truncatedPack.verdicts.length).toBeLessThan(pack.verdicts.length);
				expect(result.value.removedItems.verdicts).toBeGreaterThan(0);
			}
		});

		it('truncates historical findings when over budget', () => {
			const pack = createMockContextPack(0, 0, 0);
			pack.historical_findings = Array.from({ length: 20 }, (_, i) => `Finding ${i}`);
			pack.tokenUsage.historical = 2000;

			// Small historical budget forces truncation of 20 findings.
			const budget = {
				total: 30,
				goal: 10,
				constraints: 0,
				claims: 5,
				verdicts: 5,
				decisions: 5,
				historical: 5,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.truncatedPack.historical_findings.length).toBeLessThan(
					pack.historical_findings.length
				);
				expect(result.value.removedItems.historicalFindings).toBeGreaterThan(0);
			}
		});

		it('recalculates token usage after truncation', () => {
			const pack = createMockContextPack(10, 5, 3);
			pack.tokenUsage.claims = 1000;
			pack.tokenUsage.verdicts = 500;
			pack.tokenUsage.total = 1800;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 200,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.truncatedPack.tokenUsage.total).toBeLessThan(pack.tokenUsage.total);
				expect(result.value.tokensSaved).toBeGreaterThan(0);
			}
		});

		it('handles empty context pack gracefully', () => {
			const pack = createMockContextPack(0, 0, 0);
			pack.historical_findings = [];

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 100,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.truncatedPack.active_claims).toEqual([]);
				expect(result.value.truncatedPack.verdicts).toEqual([]);
				expect(result.value.truncatedPack.human_decisions).toEqual([]);
			}
		});

		it('returns warnings for removed items', () => {
			const pack = createMockContextPack(10, 5, 3);
			pack.tokenUsage.claims = 1000;
			pack.tokenUsage.verdicts = 500;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 100,
				verdicts: 50,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.warnings.length).toBeGreaterThan(0);
			}
		});
	});

	describe('estimateTruncationImpact', () => {
		it('estimates removal counts correctly', () => {
			const pack = createMockContextPack(10, 5, 3);
			pack.tokenUsage.claims = 1000;
			pack.tokenUsage.verdicts = 500;
			pack.tokenUsage.total = 1800;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 200,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const impact = estimateTruncationImpact(pack, budget);

			expect(impact.wouldRemove.claims).toBeGreaterThan(0);
			expect(impact.wouldRemove.verdicts).toBeGreaterThan(0);
			expect(impact.wouldSaveTokens).toBeGreaterThan(0);
		});

		it('detects when critical claims would be affected', () => {
			const pack = createMockContextPack(5, 0, 0);
			pack.active_claims[0].criticality = ClaimCriticality.CRITICAL;
			pack.active_claims[0].statement = 'Critical claim with long text that exceeds budget';
			pack.tokenUsage.claims = 1000;

			// Budget too small even for the critical claim (12+ tokens).
			const budget = {
				total: 20,
				goal: 5,
				constraints: 0,
				claims: 3,
				verdicts: 5,
				decisions: 5,
				historical: 0,
				artifacts: 0,
				overhead: 0,
			};

			const impact = estimateTruncationImpact(pack, budget, {
				preserveCritical: true,
			});

			expect(impact.criticalClaimsAffected).toBe(true);
		});

		it('estimates zero removal when within budget', () => {
			const pack = createMockContextPack(2, 1, 1);
			pack.tokenUsage.claims = 100;
			pack.tokenUsage.verdicts = 50;
			pack.tokenUsage.total = 250;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 200,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const impact = estimateTruncationImpact(pack, budget);

			expect(impact.wouldRemove.claims).toBe(0);
			expect(impact.wouldRemove.verdicts).toBe(0);
			expect(impact.wouldRemove.decisions).toBe(0);
			expect(impact.wouldSaveTokens).toBe(0);
		});

		it('respects preserveDecisions option in estimation', () => {
			const pack = createMockContextPack(0, 0, 10);
			pack.tokenUsage.decisions = 1000;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 100,
				verdicts: 100,
				decisions: 50,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const impactPreserve = estimateTruncationImpact(pack, budget, {
				preserveDecisions: true,
			});

			const impactRemove = estimateTruncationImpact(pack, budget, {
				preserveDecisions: false,
			});

			expect(impactPreserve.wouldRemove.decisions).toBe(0);
			expect(impactRemove.wouldRemove.decisions).toBeGreaterThan(0);
		});
	});

	describe('edge cases', () => {
		it('handles null goal gracefully', () => {
			const pack = createMockContextPack(5, 0, 0);
			pack.goal = null;
			pack.tokenUsage.goal = 0;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 200,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
		});

		it('handles zero budget gracefully', () => {
			const pack = createMockContextPack(5, 3, 2);

			const budget = {
				total: 0,
				goal: 0,
				constraints: 0,
				claims: 0,
				verdicts: 0,
				decisions: 0,
				historical: 0,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
		});

		it('handles very large budget gracefully', () => {
			const pack = createMockContextPack(5, 3, 2);

			const budget = {
				total: 1000000,
				goal: 100000,
				constraints: 100000,
				claims: 200000,
				verdicts: 200000,
				decisions: 200000,
				historical: 200000,
				artifacts: 0,
			overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.removedItems.claims).toBe(0);
				expect(result.value.removedItems.verdicts).toBe(0);
				expect(result.value.removedItems.decisions).toBe(0);
			}
		});

		it('handles all items being critical', () => {
			const pack = createMockContextPack(5, 0, 0);
			pack.active_claims.forEach(claim => {
				claim.criticality = ClaimCriticality.CRITICAL;
			});
			pack.tokenUsage.claims = 1000;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 100,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget, {
				preserveCritical: true,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.truncatedPack.active_claims.length).toBe(pack.active_claims.length);
				expect(result.value.warnings.some(w => w.includes('exceed budget'))).toBe(true);
			}
		});
	});

	describe('integration scenarios', () => {
		it('performs complete truncation with multiple strategies', () => {
			const pack = createMockContextPack(20, 10, 5);
			pack.tokenUsage.claims = 2000;
			pack.tokenUsage.verdicts = 1000;
			pack.tokenUsage.decisions = 500;
			pack.tokenUsage.total = 3800;

			const budget = {
				total: 1000,
				goal: 50,
				constraints: 0,
				claims: 400,
				verdicts: 200,
				decisions: 150,
				historical: 200,
				artifacts: 0,
			overhead: 0,
			};

			const strategies = [
				TruncationStrategy.OLDEST_FIRST,
				TruncationStrategy.NEWEST_FIRST,
				TruncationStrategy.LARGEST_FIRST,
				TruncationStrategy.PRIORITY_BASED,
			];

			for (const strategy of strategies) {
				const result = truncateContextPack(pack, budget, { strategy });
				expect(result.success).toBe(true);
			}
		});

		it('maintains data integrity after truncation', () => {
			const pack = createMockContextPack(10, 5, 3);
			pack.tokenUsage.claims = 1000;
			pack.tokenUsage.total = 1500;

			const budget = {
				total: 500,
				goal: 50,
				constraints: 0,
				claims: 200,
				verdicts: 100,
				decisions: 100,
				historical: 50,
				artifacts: 0,
				overhead: 0,
			};

			const result = truncateContextPack(pack, budget);

			expect(result.success).toBe(true);
			if (result.success) {
				const truncated = result.value.truncatedPack;
				expect(truncated.role).toBe(pack.role);
				expect(truncated.token_budget).toBe(pack.token_budget);
				expect(truncated.compiled_at).toBe(pack.compiled_at);
				
				expect(Array.isArray(truncated.active_claims)).toBe(true);
				expect(Array.isArray(truncated.verdicts)).toBe(true);
				expect(Array.isArray(truncated.human_decisions)).toBe(true);
				
				truncated.active_claims.forEach(claim => {
					expect(claim.claim_id).toBeDefined();
					expect(claim.statement).toBeDefined();
				});
			}
		});
	});
});
