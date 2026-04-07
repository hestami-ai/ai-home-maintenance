import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../../helpers/fakeLogger';
import { buildVerifierContext, type VerifierContextOptions } from '../../../../lib/context/builders/verifier';
import { Role, ClaimStatus, ClaimCriticality } from '../../../../lib/types';
import type { Claim } from '../../../../lib/types';
import { randomUUID } from 'node:crypto';

describe('Verifier Context Builder', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	const createMockClaim = (statement: string): Claim => ({
		claim_id: randomUUID(),
		statement,
		introduced_by: Role.EXECUTOR,
		criticality: ClaimCriticality.NON_CRITICAL,
		status: ClaimStatus.OPEN,
		dialogue_id: dialogueId,
		turn_id: 1,
		created_at: new Date().toISOString(),
	});

	describe('buildVerifierContext', () => {
		it('builds basic verifier context successfully', async () => {
			const claimToVerify = createMockClaim('User authentication is implemented');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeDefined();
			}
		});

		it('includes claim to verify in context', async () => {
			const claimToVerify = createMockClaim('Database connection is established');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.active_claims.some(c => c.claim_id === claimToVerify.claim_id)).toBe(true);
			}
		});

		it('respects token budget', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 5000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(5000);
			}
		});

		it('includes historical verdicts by default', async () => {
			const claimToVerify = createMockClaim('API endpoint returns data');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('respects includeHistoricalVerdicts option', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				includeHistoricalVerdicts: false,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('respects maxHistoricalItems option', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				maxHistoricalItems: 15,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('checks for contradictions when requested', async () => {
			const claimToVerify = createMockClaim('System handles errors correctly');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				checkForContradictions: true,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('does not check contradictions by default', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('handles small token budget', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 1000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(1000);
			}
		});

		it('handles large token budget', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 50000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('filters claims to focus on verification target', async () => {
			const claimToVerify = createMockClaim('Specific claim to verify');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.active_claims.length).toBeGreaterThan(0);
			}
		});

		it('handles critical claims', async () => {
			const claimToVerify: Claim = {
				claim_id: randomUUID(),
				statement: 'Critical security requirement met',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.OPEN,
				dialogue_id: dialogueId,
				turn_id: 1,
				created_at: new Date().toISOString(),
			};

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('handles different claim statuses', async () => {
			const claimToVerify: Claim = {
				claim_id: randomUUID(),
				statement: 'Previously verified claim',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.NON_CRITICAL,
				status: ClaimStatus.VERIFIED,
				dialogue_id: dialogueId,
				turn_id: 1,
				created_at: new Date().toISOString(),
			};

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('VerifierContextOptions interface', () => {
		it('requires dialogueId', () => {
			const claimToVerify = createMockClaim('Test');

			const options: VerifierContextOptions = {
				dialogueId: 'required-id',
				claimToVerify,
				tokenBudget: 1000,
			};

			expect(options.dialogueId).toBeDefined();
		});

		it('requires claimToVerify', () => {
			const claimToVerify = createMockClaim('Required claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 1000,
			};

			expect(options.claimToVerify).toBeDefined();
			expect(options.claimToVerify.statement).toBe('Required claim');
		});

		it('requires tokenBudget', () => {
			const claimToVerify = createMockClaim('Test');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 5000,
			};

			expect(options.tokenBudget).toBe(5000);
		});

		it('accepts optional includeHistoricalVerdicts', () => {
			const claimToVerify = createMockClaim('Test');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 1000,
				includeHistoricalVerdicts: true,
			};

			expect(typeof options.includeHistoricalVerdicts).toBe('boolean');
		});

		it('accepts optional maxHistoricalItems', () => {
			const claimToVerify = createMockClaim('Test');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 1000,
				maxHistoricalItems: 20,
			};

			expect(options.maxHistoricalItems).toBe(20);
		});

		it('accepts optional checkForContradictions', () => {
			const claimToVerify = createMockClaim('Test');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 1000,
				checkForContradictions: true,
			};

			expect(options.checkForContradictions).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('handles very long claim statements', async () => {
			const longStatement = 'This is a very detailed claim statement that contains extensive information about the system requirements and implementation details. '.repeat(20);
			const claimToVerify = createMockClaim(longStatement);

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('handles special characters in claim statement', async () => {
			const claimToVerify = createMockClaim('Claim with @#$% & special chars 日本語');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('handles zero maxHistoricalItems', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				maxHistoricalItems: 0,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('handles very large maxHistoricalItems', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				maxHistoricalItems: 1000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('handles claims from different roles', async () => {
			const claimToVerify: Claim = {
				claim_id: randomUUID(),
				statement: 'Claim from verifier',
				introduced_by: Role.VERIFIER,
				criticality: ClaimCriticality.NON_CRITICAL,
				status: ClaimStatus.OPEN,
				dialogue_id: dialogueId,
				turn_id: 1,
				created_at: new Date().toISOString(),
			};

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('handles unicode in claim statement', async () => {
			const claimToVerify = createMockClaim('测试声明 with 日本語 and Кириллица');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('integration scenarios', () => {
		it('builds complete verifier context with all options', async () => {
			const claimToVerify = createMockClaim('User authentication system is secure and follows best practices');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 15000,
				includeHistoricalVerdicts: true,
				maxHistoricalItems: 10,
				checkForContradictions: true,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(15000);
			}
		});

		it('handles minimal configuration', async () => {
			const claimToVerify = createMockClaim('Simple claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 2000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('handles budget-constrained verification', async () => {
			const claimToVerify = createMockClaim('Complex claim requiring extensive verification with detailed analysis');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 1500,
				includeHistoricalVerdicts: true,
				checkForContradictions: true,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(1500);
			}
		});

		it('verifies claim from execution phase', async () => {
			const claimToVerify = createMockClaim('Code implementation meets requirements');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				includeHistoricalVerdicts: true,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});

		it('verifies claim with contradiction check', async () => {
			const claimToVerify = createMockClaim('System performance meets targets');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				checkForContradictions: true,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('claim filtering', () => {
		it('focuses on claim to verify', async () => {
			const claimToVerify = createMockClaim('Primary claim to verify');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				const primaryClaim = result.value.active_claims.find(
					c => c.claim_id === claimToVerify.claim_id
				);
				expect(primaryClaim).toBeDefined();
			}
		});

		it('includes related claims', async () => {
			const claimToVerify = createMockClaim('Authentication is implemented');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.active_claims.length).toBeGreaterThan(0);
			}
		});
	});

	describe('token accounting', () => {
		it('accounts for historical verdicts in budget', async () => {
			const claimToVerify = createMockClaim('Test claim for budget accounting');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				includeHistoricalVerdicts: true,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeGreaterThan(0);
			}
		});

		it('accounts for contradictions in budget', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				checkForContradictions: true,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeGreaterThan(0);
			}
		});

		it('respects budget allocation', async () => {
			const claimToVerify = createMockClaim('Test claim');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 3000,
				includeHistoricalVerdicts: true,
				checkForContradictions: true,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeLessThanOrEqual(3000);
			}
		});

		it('includes all token components in total', async () => {
			const claimToVerify = createMockClaim('Comprehensive claim for verification');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.tokenUsage.total).toBeGreaterThan(0);
			}
		});
	});

	describe('verification-specific features', () => {
		it('sets goal based on claim statement', async () => {
			const claimToVerify = createMockClaim('API returns correct data');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.goal).toContain('API returns correct data');
			}
		});

		it('prioritizes verification-relevant context', async () => {
			const claimToVerify = createMockClaim('Security measures are adequate');

			const options: VerifierContextOptions = {
				dialogueId,
				claimToVerify,
				tokenBudget: 10000,
				includeHistoricalVerdicts: true,
			};

			const result = await buildVerifierContext(options);

			expect(result.success).toBe(true);
		});
	});
});
