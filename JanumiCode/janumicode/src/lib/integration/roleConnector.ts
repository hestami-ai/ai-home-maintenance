/**
 * Role Connector Integration
 * Implements Phase 9.1.2: Connect role implementations to context compiler
 * Integrates role invocation with context compilation
 *
 * Integrates role invocation with context compilation.
 * Each function delegates to the actual role implementation which handles
 * its own context building and LLM invocation.
 */

import type {
	Result,
	ExecutorResponse,
	VerifierResponse,
	HistorianInterpreterResponse,
	Claim,
} from '../types';
import { CodedError, Role } from '../types';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import type { EvidencePacket } from '../roles/technicalExpert';
import { invokeExecutor } from '../roles/executor';
import { invokeVerifier } from '../roles/verifier';
import { invokeTechnicalExpert } from '../roles/technicalExpert';
import { invokeHistorianInterpreter } from '../roles/historianInterpreter';
import { HistorianQueryType } from '../context';
import { compileContextPack, type CompileContextOptions } from '../context';

/**
 * Invoke executor with context compilation
 * Compiles context for executor role and invokes
 *
 * @param dialogueId Dialogue ID
 * @param proposal Execution proposal
 * @param config LLM configuration
 * @param tokenBudget Token budget
 * @returns Result with executor response
 */
export async function invokeExecutorWithContext(
	dialogueId: string,
	proposal: string,
	provider: RoleCLIProvider,
	tokenBudget: number = 10000
): Promise<Result<ExecutorResponse>> {
	try {
		return await invokeExecutor({
			dialogueId,
			goal: proposal,
			tokenBudget,
			provider,
			includeHistoricalFindings: true,
		});
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'EXECUTOR_INVOCATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Invoke technical expert with context compilation
 * Compiles context for technical expert role and invokes
 *
 * @param dialogueId Dialogue ID
 * @param query Technical query
 * @param config LLM configuration
 * @param tokenBudget Token budget
 * @returns Result with technical expert response
 */
export async function invokeTechnicalExpertWithContext(
	dialogueId: string,
	query: string,
	provider: RoleCLIProvider,
	tokenBudget: number = 10000
): Promise<Result<EvidencePacket>> {
	try {
		return await invokeTechnicalExpert({
			dialogueId,
			question: query,
			tokenBudget,
			provider,
			includeHistoricalEvidence: true,
		});
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'TECHNICAL_EXPERT_INVOCATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Invoke verifier with context compilation
 * Compiles context for verifier role and invokes
 *
 * @param dialogueId Dialogue ID
 * @param claimId Claim ID to verify
 * @param config LLM configuration
 * @param tokenBudget Token budget
 * @returns Result with verifier response
 */
export async function invokeVerifierWithContext(
	dialogueId: string,
	claim: Claim,
	provider: RoleCLIProvider,
	tokenBudget: number = 10000
): Promise<Result<VerifierResponse>> {
	try {
		return await invokeVerifier({
			dialogueId,
			claimToVerify: claim,
			tokenBudget,
			provider,
			includeHistoricalVerdicts: true,
			checkForContradictions: true,
		});
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'VERIFIER_INVOCATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Invoke historian interpreter with context compilation
 * Compiles context for historian interpreter role and invokes
 *
 * @param dialogueId Dialogue ID
 * @param claimId Claim ID to check
 * @param config LLM configuration
 * @param tokenBudget Token budget
 * @returns Result with historian interpreter response
 */
export async function invokeHistorianInterpreterWithContext(
	dialogueId: string,
	query: string,
	provider: RoleCLIProvider,
	tokenBudget: number = 10000
): Promise<Result<HistorianInterpreterResponse>> {
	try {
		return await invokeHistorianInterpreter({
			dialogueId,
			query,
			queryType: HistorianQueryType.GENERAL_HISTORY,
			tokenBudget,
			provider,
		});
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'HISTORIAN_INVOCATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Compile role-specific context
 * Creates optimized context for a specific role
 *
 * @param roleType Role enum value
 * @param dialogueId Dialogue ID
 * @param tokenBudget Token budget
 * @returns Result with compiled context pack
 */
export function compileRoleContext(
	roleType: Role,
	dialogueId: string,
	tokenBudget: number = 10000
): Result<string> {
	try {
		// Compile context pack for role
		const contextOptions: CompileContextOptions = {
			role: roleType,
			dialogueId,
			tokenBudget,
			includeHistorical: roleType === Role.HISTORIAN,
		};

		const contextResult = compileContextPack(contextOptions);

		if (!contextResult.success) {
			return {
				success: false,
				error: contextResult.error,
			};
		}

		// Serialize context pack to string
		return {
			success: true,
			value: JSON.stringify(contextResult.value, null, 2),
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'ROLE_CONTEXT_COMPILATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}
