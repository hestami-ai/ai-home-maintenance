/**
 * Verification Submachine
 * Implements Phase 7.5: Detailed verification workflow
 * Orchestrates the multi-step verification process for claims
 */

import type {
	Result,
	Claim,
	Verdict,
} from '../types';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import { VerdictType, ClaimStatus } from '../types';
import { invokeVerifier, storeVerdict } from '../roles/verifier';
import { getDatabase } from '../database';
import { getLogger, isLoggerInitialized } from '../logging';

/**
 * Verification step types
 */
export enum VerificationStep {
	CLAIM_NORMALIZATION = 'CLAIM_NORMALIZATION',
	DISCONFIRMING_QUERY_GENERATION = 'DISCONFIRMING_QUERY_GENERATION',
	EVIDENCE_RETRIEVAL = 'EVIDENCE_RETRIEVAL',
	EVIDENCE_CLASSIFICATION = 'EVIDENCE_CLASSIFICATION',
	VERDICT_EMISSION = 'VERDICT_EMISSION',
	VERDICT_STORAGE = 'VERDICT_STORAGE',
}

/**
 * Verification execution options
 */
export interface VerificationExecutionOptions {
	dialogueId: string;
	claim: Claim;
	provider: RoleCLIProvider;
	tokenBudget: number;
	temperature?: number;
	includeHistoricalVerdicts?: boolean;
	checkForContradictions?: boolean;
	commandId?: string;
}

/**
 * Verification execution result
 */
export interface VerificationExecutionResult {
	claim: Claim;
	verdict: Verdict;
	steps: VerificationStepResult[];
	isBlocking: boolean; // True if verdict is UNKNOWN
}

/**
 * Verification step result
 */
export interface VerificationStepResult {
	step: VerificationStep;
	success: boolean;
	timestamp: string;
	metadata: Record<string, unknown>;
}

/**
 * Execute verification submachine
 * Runs the complete verification workflow for a claim
 *
 * @param options Verification execution options
 * @returns Result containing verification execution result
 */
export async function executeVerification(
	options: VerificationExecutionOptions
): Promise<Result<VerificationExecutionResult>> {
	const steps: VerificationStepResult[] = [];
	const startTime = new Date();

	try {
		// Step 1: Claim normalization
		// (Currently handled within verifier, but logged here)
		steps.push({
			step: VerificationStep.CLAIM_NORMALIZATION,
			success: true,
			timestamp: new Date().toISOString(),
			metadata: {
				originalStatement: options.claim.statement,
			},
		});

		// Step 2-5: Invoke verifier (handles disconfirming queries, evidence retrieval, classification)
		// The verifier internally handles these steps
		const verifierResult = await invokeVerifier({
			dialogueId: options.dialogueId,
			claimToVerify: options.claim,
			tokenBudget: options.tokenBudget,
			provider: options.provider,
			temperature: options.temperature,
			includeHistoricalVerdicts: options.includeHistoricalVerdicts,
			checkForContradictions: options.checkForContradictions,
			commandId: options.commandId,
		});

		if (!verifierResult.success) {
			return verifierResult as Result<VerificationExecutionResult>;
		}

		const verifierResponse = verifierResult.value;

		// Log verifier steps
		steps.push({
			step: VerificationStep.DISCONFIRMING_QUERY_GENERATION,
			success: true,
			timestamp: new Date().toISOString(),
			metadata: {
				queryCount: verifierResponse.disconfirming_queries.length,
				queries: verifierResponse.disconfirming_queries,
			},
		});

		steps.push({
			step: VerificationStep.EVIDENCE_RETRIEVAL,
			success: true,
			timestamp: new Date().toISOString(),
			metadata: {
				evidenceCount: verifierResponse.evidence_classifications.length,
			},
		});

		steps.push({
			step: VerificationStep.EVIDENCE_CLASSIFICATION,
			success: true,
			timestamp: new Date().toISOString(),
			metadata: {
				evidenceTypes: verifierResponse.evidence_classifications.map((e) => e.type),
			},
		});

		// Step 6: Verdict emission
		steps.push({
			step: VerificationStep.VERDICT_EMISSION,
			success: true,
			timestamp: new Date().toISOString(),
			metadata: {
				verdict: verifierResponse.verdict,
				rationale: verifierResponse.rationale,
			},
		});

		// Step 7: Verdict storage
		const storeResult = storeVerdict(options.claim.claim_id, verifierResponse);

		if (!storeResult.success) {
			steps.push({
				step: VerificationStep.VERDICT_STORAGE,
				success: false,
				timestamp: new Date().toISOString(),
				metadata: {
					error: storeResult.error.message,
				},
			});
			return storeResult as Result<VerificationExecutionResult>;
		}

		steps.push({
			step: VerificationStep.VERDICT_STORAGE,
			success: true,
			timestamp: new Date().toISOString(),
			metadata: {
				verdictId: storeResult.value.verdict_id,
			},
		});

		// Update claim status based on verdict
		const updatedClaim = await updateClaimStatus(
			options.claim.claim_id,
			verifierResponse.verdict
		);

		if (!updatedClaim.success) {
			return updatedClaim as Result<VerificationExecutionResult>;
		}

		// Check if verdict is blocking (UNKNOWN)
		const isBlocking = verifierResponse.verdict === VerdictType.UNKNOWN;

		return {
			success: true,
			value: {
				claim: updatedClaim.value,
				verdict: storeResult.value,
				steps,
				isBlocking,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Verification execution failed'),
		};
	}
}

/**
 * Update claim status based on verdict
 * Maps verdict type to claim status
 *
 * @param claimId Claim ID
 * @param verdictType Verdict type
 * @returns Result containing updated claim
 */
async function updateClaimStatus(
	claimId: string,
	verdictType: VerdictType
): Promise<Result<Claim>> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Map verdict to claim status
		let claimStatus: ClaimStatus;
		switch (verdictType) {
			case VerdictType.VERIFIED:
				claimStatus = ClaimStatus.VERIFIED;
				break;
			case VerdictType.CONDITIONAL:
				claimStatus = ClaimStatus.CONDITIONAL;
				break;
			case VerdictType.DISPROVED:
				claimStatus = ClaimStatus.DISPROVED;
				break;
			case VerdictType.UNKNOWN:
				claimStatus = ClaimStatus.UNKNOWN;
				break;
			default:
				return {
					success: false,
					error: new Error(`Unknown verdict type: ${verdictType}`),
				};
		}

		// Update claim status
		db.prepare(
			`
			UPDATE claims
			SET status = ?
			WHERE claim_id = ?
		`
		).run(claimStatus, claimId);

		// Retrieve updated claim
		const claim = db
			.prepare(
				`
			SELECT claim_id, statement, introduced_by, criticality,
			       status, dialogue_id, turn_id, created_at
			FROM claims
			WHERE claim_id = ?
		`
			)
			.get(claimId) as Claim | undefined;

		if (!claim) {
			return {
				success: false,
				error: new Error(`Claim not found: ${claimId}`),
			};
		}

		return { success: true, value: claim };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to update claim status'),
		};
	}
}

/**
 * Batch verify claims
 * Verifies multiple claims in sequence
 *
 * @param options Verification options (shared across claims)
 * @param claims Claims to verify
 * @returns Result containing verification results
 */
export async function batchVerifyClaims(
	options: Omit<VerificationExecutionOptions, 'claim'>,
	claims: Claim[]
): Promise<Result<VerificationExecutionResult[]>> {
	const results: VerificationExecutionResult[] = [];

	for (const claim of claims) {
		const result = await executeVerification({
			...options,
			claim,
		});

		if (!result.success) {
			// Log error but continue with other claims
			if (isLoggerInitialized()) {
				getLogger().child({ component: 'workflow:verification' }).error('Failed to verify claim', {
					claimId: claim.claim_id,
					error: result.error.message,
				});
			}
			continue;
		}

		results.push(result.value);
	}

	return { success: true, value: results };
}

/**
 * Get verification status for dialogue
 * Retrieves verification progress for all claims in a dialogue
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing verification status
 */
export function getVerificationStatus(
	dialogueId: string
): Result<{
	totalClaims: number;
	verifiedClaims: number;
	conditionalClaims: number;
	disprovedClaims: number;
	unknownClaims: number;
	openClaims: number;
	blockingClaims: number;
}> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const stats = db
			.prepare(
				`
			SELECT
				COUNT(*) as total,
				SUM(CASE WHEN status = 'VERIFIED' THEN 1 ELSE 0 END) as verified,
				SUM(CASE WHEN status = 'CONDITIONAL' THEN 1 ELSE 0 END) as conditional,
				SUM(CASE WHEN status = 'DISPROVED' THEN 1 ELSE 0 END) as disproved,
				SUM(CASE WHEN status = 'UNKNOWN' THEN 1 ELSE 0 END) as unknown,
				SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as open,
				SUM(CASE WHEN criticality = 'CRITICAL' AND status IN ('DISPROVED', 'UNKNOWN') THEN 1 ELSE 0 END) as blocking
			FROM claims
			WHERE dialogue_id = ?
		`
			)
			.get(dialogueId) as {
			total: number;
			verified: number;
			conditional: number;
			disproved: number;
			unknown: number;
			open: number;
			blocking: number;
		};

		return {
			success: true,
			value: {
				totalClaims: stats.total,
				verifiedClaims: stats.verified,
				conditionalClaims: stats.conditional,
				disprovedClaims: stats.disproved,
				unknownClaims: stats.unknown,
				openClaims: stats.open,
				blockingClaims: stats.blocking,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get verification status'),
		};
	}
}

/**
 * Check if verification is complete
 * Determines if all claims have been verified
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing completion status
 */
export function isVerificationComplete(
	dialogueId: string
): Result<boolean> {
	try {
		const statusResult = getVerificationStatus(dialogueId);
		if (!statusResult.success) {
			return statusResult as Result<boolean>;
		}

		const status = statusResult.value;

		// Verification is complete if there are no open claims
		return { success: true, value: status.openClaims === 0 };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to check verification completion'),
		};
	}
}

/**
 * Get blocking claims from verification
 * Retrieves claims with UNKNOWN verdict (blocking)
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing blocking claims
 */
export function getBlockingVerificationClaims(
	dialogueId: string
): Result<Claim[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const claims = db
			.prepare(
				`
			SELECT claim_id, statement, introduced_by, criticality,
			       status, dialogue_id, turn_id, created_at
			FROM claims
			WHERE dialogue_id = ?
			  AND criticality = 'CRITICAL'
			  AND status IN ('DISPROVED', 'UNKNOWN')
		`
			)
			.all(dialogueId) as Claim[];

		return { success: true, value: claims };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get blocking verification claims'),
		};
	}
}
