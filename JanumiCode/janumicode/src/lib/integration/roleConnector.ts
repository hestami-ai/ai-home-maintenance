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
import { CodedError, Role, Phase } from '../types';
import type { RoleCLIProvider } from '../cli/roleCLIProvider';
import type { EvidencePacket } from '../roles/technicalExpert';
import { invokeExecutor } from '../roles/executor';
import { invokeVerifier } from '../roles/verifier';
import { invokeTechnicalExpert } from '../roles/technicalExpert';
import { invokeHistorianInterpreter } from '../roles/historianInterpreter';
import { HistorianQueryType, assembleContext } from '../context';

/**
 * Invoke executor with context compilation
 */
export async function invokeExecutorWithContext(
	dialogueId: string,
	proposal: string,
	provider: RoleCLIProvider,
): Promise<Result<ExecutorResponse>> {
	try {
		return await invokeExecutor({
			dialogueId,
			goal: proposal,
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
 */
export async function invokeTechnicalExpertWithContext(
	dialogueId: string,
	query: string,
	provider: RoleCLIProvider,
): Promise<Result<EvidencePacket>> {
	try {
		return await invokeTechnicalExpert({
			dialogueId,
			question: query,
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
 */
export async function invokeVerifierWithContext(
	dialogueId: string,
	claim: Claim,
	provider: RoleCLIProvider,
): Promise<Result<VerifierResponse>> {
	try {
		return await invokeVerifier({
			dialogueId,
			claimToVerify: claim,
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
 */
export async function invokeHistorianInterpreterWithContext(
	dialogueId: string,
	query: string,
	provider: RoleCLIProvider,
): Promise<Result<HistorianInterpreterResponse>> {
	try {
		return await invokeHistorianInterpreter({
			dialogueId,
			query,
			queryType: HistorianQueryType.GENERAL_HISTORY,
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
 * Compile role-specific context.
 * Creates context for a specific role using the policy registry.
 */
export async function compileRoleContext(
	roleType: Role,
	dialogueId: string,
): Promise<Result<string>> {
	try {
		// Determine phase based on role (best-effort mapping for generic connector)
		const phaseMap: Record<string, Phase> = {
			[Role.EXECUTOR]: Phase.EXECUTE,
			[Role.VERIFIER]: Phase.VERIFY,
			[Role.HISTORIAN]: Phase.HISTORICAL_CHECK,
			[Role.TECHNICAL_EXPERT]: Phase.PROPOSE,
		};
		const phase = phaseMap[roleType] ?? Phase.PROPOSE;

		const contextResult = await assembleContext({
			dialogueId,
			role: roleType,
			phase,
		});

		if (!contextResult.success) {
			return {
				success: false,
				error: contextResult.error,
			};
		}

		return {
			success: true,
			value: contextResult.value.briefing,
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
