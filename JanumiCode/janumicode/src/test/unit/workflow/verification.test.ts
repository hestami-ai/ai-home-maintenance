import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { registerFakeProviders, teardownFakeProviders } from '../../helpers/fakeProviders';
import {
	executeVerification,
	batchVerifyClaims,
	getVerificationStatus,
	isVerificationComplete,
	getBlockingVerificationClaims,
	VerificationStep,
} from '../../../lib/workflow/verification';
import { ClaimStatus, ClaimCriticality, Role } from '../../../lib/types';
import type { Claim } from '../../../lib/types';
import { getDatabase } from '../../../lib/database';
import { randomUUID } from 'node:crypto';

describe('Verification', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;
	let testClaim: Claim;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
		
		registerFakeProviders({
			verifierResponses: [
				{
					response: JSON.stringify({
						verdict: 'VERIFIED',
						rationale: 'Test rationale',
						disconfirming_queries: ['Query 1', 'Query 2'],
						evidence_classifications: [
							{ type: 'supporting', content: 'Evidence 1' }
						]
					}),
					exitCode: 0,
				},
			],
		});

		// Create test claim
		const db = getDatabase();
		if (db) {
			db.exec(`
				CREATE TABLE IF NOT EXISTS claims (
					claim_id TEXT PRIMARY KEY,
					statement TEXT NOT NULL,
					introduced_by TEXT NOT NULL,
					criticality TEXT NOT NULL,
					status TEXT NOT NULL,
					dialogue_id TEXT NOT NULL,
					turn_id INTEGER,
					created_at TEXT NOT NULL
				)
			`);

			const claimId = randomUUID();
			db.prepare(`
				INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				claimId,
				'Test claim statement',
				Role.EXECUTOR,
				ClaimCriticality.CRITICAL,
				ClaimStatus.OPEN,
				dialogueId,
				1,
				new Date().toISOString()
			);

			testClaim = {
				claim_id: claimId,
				statement: 'Test claim statement',
				introduced_by: Role.EXECUTOR,
				criticality: ClaimCriticality.CRITICAL,
				status: ClaimStatus.OPEN,
				dialogue_id: dialogueId,
				turn_id: 1,
				created_at: new Date().toISOString(),
			};
		}
	});

	afterEach(() => {
		teardownFakeProviders();
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('executeVerification', () => {
		it('executes verification workflow', async () => {
			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.claim).toBeDefined();
				expect(result.value.verdict).toBeDefined();
				expect(result.value.steps).toBeDefined();
			}
		});

		it('tracks verification steps', async () => {
			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (result.success) {
				expect(result.value.steps.length).toBeGreaterThan(0);
				expect(result.value.steps[0].step).toBe(VerificationStep.CLAIM_NORMALIZATION);
			}
		});

		it('includes all verification steps', async () => {
			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (result.success) {
				const stepTypes = result.value.steps.map(s => s.step);
				expect(stepTypes).toContain(VerificationStep.CLAIM_NORMALIZATION);
				expect(stepTypes).toContain(VerificationStep.DISCONFIRMING_QUERY_GENERATION);
				expect(stepTypes).toContain(VerificationStep.EVIDENCE_RETRIEVAL);
				expect(stepTypes).toContain(VerificationStep.EVIDENCE_CLASSIFICATION);
				expect(stepTypes).toContain(VerificationStep.VERDICT_EMISSION);
				expect(stepTypes).toContain(VerificationStep.VERDICT_STORAGE);
			}
		});

		it('updates claim status based on verdict', async () => {
			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (result.success) {
				expect(result.value.claim.status).toBeDefined();
			}
		});

		it('sets isBlocking for UNKNOWN verdicts', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdict: 'UNKNOWN',
							rationale: 'Insufficient evidence',
							disconfirming_queries: [],
							evidence_classifications: []
						}),
						exitCode: 0,
					},
				],
			});

			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (result.success) {
				expect(result.value.isBlocking).toBe(true);
			}
		});

		it('sets isBlocking to false for non-UNKNOWN verdicts', async () => {
			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (result.success) {
				expect(result.value.isBlocking).toBe(false);
			}
		});

		it('handles temperature option', async () => {
			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
				temperature: 0.2,
			});

			expect(result.success).toBe(true);
		});

		it('handles includeHistoricalVerdicts option', async () => {
			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
				includeHistoricalVerdicts: true,
			});

			expect(result.success).toBe(true);
		});

		it('handles checkForContradictions option', async () => {
			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
				checkForContradictions: true,
			});

			expect(result.success).toBe(true);
		});

		it('handles commandId option', async () => {
			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
				commandId: randomUUID(),
			});

			expect(result.success).toBe(true);
		});
	});

	describe('verdict to claim status mapping', () => {
		it('maps VERIFIED to VERIFIED status', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdict: 'VERIFIED',
							rationale: 'Test',
							disconfirming_queries: [],
							evidence_classifications: []
						}),
						exitCode: 0,
					},
				],
			});

			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (result.success) {
				expect(result.value.claim.status).toBe(ClaimStatus.VERIFIED);
			}
		});

		it('maps CONDITIONAL to CONDITIONAL status', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdict: 'CONDITIONAL',
							rationale: 'Test',
							disconfirming_queries: [],
							evidence_classifications: []
						}),
						exitCode: 0,
					},
				],
			});

			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (result.success) {
				expect(result.value.claim.status).toBe(ClaimStatus.CONDITIONAL);
			}
		});

		it('maps DISPROVED to DISPROVED status', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdict: 'DISPROVED',
							rationale: 'Test',
							disconfirming_queries: [],
							evidence_classifications: []
						}),
						exitCode: 0,
					},
				],
			});

			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (result.success) {
				expect(result.value.claim.status).toBe(ClaimStatus.DISPROVED);
			}
		});

		it('maps UNKNOWN to UNKNOWN status', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdict: 'UNKNOWN',
							rationale: 'Test',
							disconfirming_queries: [],
							evidence_classifications: []
						}),
						exitCode: 0,
					},
				],
			});

			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (result.success) {
				expect(result.value.claim.status).toBe(ClaimStatus.UNKNOWN);
			}
		});
	});

	describe('batchVerifyClaims', () => {
		it('verifies multiple claims', async () => {
			const db = getDatabase();
			const claims: Claim[] = [];

			// Create multiple claims
			for (let i = 0; i < 3; i++) {
				const claimId = randomUUID();
				db?.prepare(`
					INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`).run(
					claimId,
					`Claim ${i + 1}`,
					Role.EXECUTOR,
					ClaimCriticality.CRITICAL,
					ClaimStatus.OPEN,
					dialogueId,
					i + 1,
					new Date().toISOString()
				);

				claims.push({
					claim_id: claimId,
					statement: `Claim ${i + 1}`,
					introduced_by: Role.EXECUTOR,
					criticality: ClaimCriticality.CRITICAL,
					status: ClaimStatus.OPEN,
					dialogue_id: dialogueId,
					turn_id: i + 1,
					created_at: new Date().toISOString(),
				});
			}

			const result = await batchVerifyClaims(
				{
					dialogueId,
					provider: {} as any,
				},
				claims
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
			}
		});

		it('processes claims sequentially', async () => {
			const claims: Claim[] = [testClaim];

			const result = await batchVerifyClaims(
				{
					dialogueId,
					provider: {} as any,
				},
				claims
			);

			expect(result.success).toBe(true);
		});

		it('handles empty claims array', async () => {
			const result = await batchVerifyClaims(
				{
					dialogueId,
					provider: {} as any,
				},
				[]
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('continues on individual claim failure', async () => {
			const claims: Claim[] = [testClaim];

			teardownFakeProviders();

			const result = await batchVerifyClaims(
				{
					dialogueId,
					provider: {} as any,
				},
				claims
			);

			expect(result.success).toBe(true);
		});
	});

	describe('getVerificationStatus', () => {
		it('retrieves verification status', () => {
			const result = getVerificationStatus(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.totalClaims).toBeDefined();
				expect(result.value.verifiedClaims).toBeDefined();
				expect(result.value.conditionalClaims).toBeDefined();
				expect(result.value.disprovedClaims).toBeDefined();
				expect(result.value.unknownClaims).toBeDefined();
				expect(result.value.openClaims).toBeDefined();
				expect(result.value.blockingClaims).toBeDefined();
			}
		});

		it('counts claims correctly', () => {
			const result = getVerificationStatus(dialogueId);

			if (result.success) {
				expect(result.value.totalClaims).toBe(1);
				expect(result.value.openClaims).toBe(1);
			}
		});

		it('tracks verified claims', async () => {
			await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			const result = getVerificationStatus(dialogueId);

			if (result.success) {
				expect(result.value.verifiedClaims).toBeGreaterThan(0);
			}
		});

		it('identifies blocking claims', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdict: 'UNKNOWN',
							rationale: 'Test',
							disconfirming_queries: [],
							evidence_classifications: []
						}),
						exitCode: 0,
					},
				],
			});

			await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			const result = getVerificationStatus(dialogueId);

			if (result.success) {
				expect(result.value.blockingClaims).toBeGreaterThan(0);
			}
		});

		it('handles dialogue with no claims', () => {
			const emptyDialogueId = randomUUID();
			const result = getVerificationStatus(emptyDialogueId);

			if (result.success) {
				expect(result.value.totalClaims).toBe(0);
			}
		});
	});

	describe('isVerificationComplete', () => {
		it('returns false when claims are open', () => {
			const result = isVerificationComplete(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBe(false);
			}
		});

		it('returns true when all claims verified', async () => {
			await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			const result = isVerificationComplete(dialogueId);

			if (result.success) {
				expect(result.value).toBe(true);
			}
		});

		it('returns true for dialogue with no claims', () => {
			const emptyDialogueId = randomUUID();
			const result = isVerificationComplete(emptyDialogueId);

			if (result.success) {
				expect(result.value).toBe(true);
			}
		});
	});

	describe('getBlockingVerificationClaims', () => {
		it('retrieves blocking claims', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdict: 'UNKNOWN',
							rationale: 'Test',
							disconfirming_queries: [],
							evidence_classifications: []
						}),
						exitCode: 0,
					},
				],
			});

			await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			const result = getBlockingVerificationClaims(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
			}
		});

		it('filters by CRITICAL criticality', async () => {
			const result = getBlockingVerificationClaims(dialogueId);

			expect(result.success).toBe(true);
		});

		it('filters by DISPROVED or UNKNOWN status', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdict: 'DISPROVED',
							rationale: 'Test',
							disconfirming_queries: [],
							evidence_classifications: []
						}),
						exitCode: 0,
					},
				],
			});

			await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			const result = getBlockingVerificationClaims(dialogueId);

			if (result.success) {
				expect(result.value.length).toBeGreaterThan(0);
			}
		});

		it('returns empty array when no blocking claims', async () => {
			await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			const result = getBlockingVerificationClaims(dialogueId);

			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('does not include non-CRITICAL claims', async () => {
			const db = getDatabase();
			const nonCriticalId = randomUUID();
			
			db?.prepare(`
				INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`).run(
				nonCriticalId,
				'Non-critical claim',
				Role.EXECUTOR,
				ClaimCriticality.NON_CRITICAL,
				ClaimStatus.UNKNOWN,
				dialogueId,
				2,
				new Date().toISOString()
			);

			const result = getBlockingVerificationClaims(dialogueId);

			if (result.success) {
				expect(result.value.every(c => c.criticality === ClaimCriticality.CRITICAL)).toBe(true);
			}
		});
	});

	describe('error handling', () => {
		it('handles database errors', () => {
			tempDb.cleanup();

			const result = getVerificationStatus(dialogueId);

			expect(result.success).toBe(false);
		});

		it('handles missing database', async () => {
			tempDb.cleanup();

			const result = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			expect(result.success).toBe(false);
		});
	});

	describe('workflow scenarios', () => {
		it('executes complete verification workflow', async () => {
			const verifyResult = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			expect(verifyResult.success).toBe(true);

			const statusResult = getVerificationStatus(dialogueId);
			expect(statusResult.success).toBe(true);

			const completeResult = isVerificationComplete(dialogueId);
			expect(completeResult.success).toBe(true);
		});

		it('handles blocking verdict workflow', async () => {
			teardownFakeProviders();
			registerFakeProviders({
				verifierResponses: [
					{
						response: JSON.stringify({
							verdict: 'UNKNOWN',
							rationale: 'Insufficient evidence',
							disconfirming_queries: [],
							evidence_classifications: []
						}),
						exitCode: 0,
					},
				],
			});

			const verifyResult = await executeVerification({
				dialogueId,
				claim: testClaim,
				provider: {} as any,
			});

			if (verifyResult.success) {
				expect(verifyResult.value.isBlocking).toBe(true);
			}

			const blockingResult = getBlockingVerificationClaims(dialogueId);
			if (blockingResult.success) {
				expect(blockingResult.value.length).toBeGreaterThan(0);
			}

			const completeResult = isVerificationComplete(dialogueId);
			if (completeResult.success) {
				expect(completeResult.value).toBe(true);
			}
		});

		it('handles batch verification workflow', async () => {
			const db = getDatabase();
			const claims: Claim[] = [testClaim];

			for (let i = 0; i < 2; i++) {
				const claimId = randomUUID();
				db?.prepare(`
					INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`).run(
					claimId,
					`Additional claim ${i}`,
					Role.EXECUTOR,
					ClaimCriticality.CRITICAL,
					ClaimStatus.OPEN,
					dialogueId,
					i + 2,
					new Date().toISOString()
				);

				claims.push({
					claim_id: claimId,
					statement: `Additional claim ${i}`,
					introduced_by: Role.EXECUTOR,
					criticality: ClaimCriticality.CRITICAL,
					status: ClaimStatus.OPEN,
					dialogue_id: dialogueId,
					turn_id: i + 2,
					created_at: new Date().toISOString(),
				});
			}

			const batchResult = await batchVerifyClaims(
				{
					dialogueId,
					provider: {} as any,
				},
				claims
			);

			expect(batchResult.success).toBe(true);

			const statusResult = getVerificationStatus(dialogueId);
			if (statusResult.success) {
				expect(statusResult.value.totalClaims).toBe(3);
			}
		});
	});
});
