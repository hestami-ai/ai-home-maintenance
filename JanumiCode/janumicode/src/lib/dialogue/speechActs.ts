/**
 * Speech Act Handlers
 * Implements Phase 2.4: Speech Act Processing
 * Handlers for CLAIM, ASSUMPTION, EVIDENCE, VERDICT, DECISION
 */

import type {
	Result,
	Claim,
	ClaimEvent,
	Verdict,
	HumanDecision,
	DialogueTurn,
	ContentRef,
} from '../types';
import {
	Role,
	Phase,
	SpeechAct,
	ClaimCriticality,
	ClaimStatus,
} from '../types';
import { writeClaim, writeVerdict, writeHumanDecision } from '../events';
import { createAndAddTurn } from './session';

/**
 * Handle CLAIM speech act
 * Creates a new claim and associates it with a dialogue turn
 * @param params Claim parameters
 * @returns Result containing created claim and turn
 */
export function handleClaimSpeechAct(params: {
	dialogue_id: string;
	statement: string;
	introduced_by: Role;
	criticality: ClaimCriticality;
	content_ref: ContentRef;
	phase: Phase;
}): Result<{ claim: Claim; turn: DialogueTurn }> {
	try {
		// First, create the dialogue turn
		const turnResult = createAndAddTurn({
			dialogue_id: params.dialogue_id,
			role: params.introduced_by,
			phase: params.phase,
			speech_act: SpeechAct.CLAIM,
			content_ref: params.content_ref,
		});

		if (!turnResult.success) {
			return {
				success: false,
				error: turnResult.error,
			};
		}

		const turn = turnResult.value;

		// Create the claim
		const claimResult = writeClaim({
			statement: params.statement,
			introduced_by: params.introduced_by,
			criticality: params.criticality,
			status: ClaimStatus.OPEN,
			dialogue_id: params.dialogue_id,
			turn_id: turn.turn_id,
		});

		if (!claimResult.success) {
			return {
				success: false,
				error: claimResult.error,
			};
		}

		return {
			success: true,
			value: {
				claim: claimResult.value,
				turn,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to handle CLAIM speech act'),
		};
	}
}

/**
 * Handle ASSUMPTION speech act
 * Similar to CLAIM but specifically for assumptions that need verification
 * @param params Assumption parameters
 * @returns Result containing created claim and turn
 */
export function handleAssumptionSpeechAct(params: {
	dialogue_id: string;
	statement: string;
	introduced_by: Role;
	content_ref: ContentRef;
	phase: Phase;
}): Result<{ claim: Claim; turn: DialogueTurn }> {
	// Assumptions are always CRITICAL as they must be verified
	return handleClaimSpeechAct({
		dialogue_id: params.dialogue_id,
		statement: params.statement,
		introduced_by: params.introduced_by,
		criticality: ClaimCriticality.CRITICAL,
		content_ref: params.content_ref,
		phase: params.phase,
	});
}

/**
 * Handle EVIDENCE speech act
 * Creates a dialogue turn for evidence provision (by Technical Expert or Historian)
 * @param params Evidence parameters
 * @returns Result containing turn
 */
export function handleEvidenceSpeechAct(params: {
	dialogue_id: string;
	role: Role.TECHNICAL_EXPERT | Role.HISTORIAN;
	phase: Phase;
	content_ref: ContentRef;
	related_claims: string[];
}): Result<DialogueTurn> {
	try {
		// Create dialogue turn with evidence
		const turnResult = createAndAddTurn({
			dialogue_id: params.dialogue_id,
			role: params.role,
			phase: params.phase,
			speech_act: SpeechAct.EVIDENCE,
			content_ref: params.content_ref,
			related_claims: params.related_claims,
		});

		if (!turnResult.success) {
			return {
				success: false,
				error: turnResult.error,
			};
		}

		return {
			success: true,
			value: turnResult.value,
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to handle EVIDENCE speech act'),
		};
	}
}

/**
 * Handle VERDICT speech act
 * Creates a verdict on a claim and updates claim status
 * @param params Verdict parameters
 * @returns Result containing verdict and turn
 */
export function handleVerdictSpeechAct(params: {
	dialogue_id: string;
	claim_id: string;
	verdict: ClaimStatus;
	rationale: string;
	constraints_ref?: string | null;
	evidence_ref?: string | null;
	content_ref: ContentRef;
}): Result<{ verdict: Verdict; turn: DialogueTurn }> {
	try {
		// Create dialogue turn
		const turnResult = createAndAddTurn({
			dialogue_id: params.dialogue_id,
			role: Role.VERIFIER,
			phase: Phase.VERIFY,
			speech_act: SpeechAct.VERDICT,
			content_ref: params.content_ref,
			related_claims: [params.claim_id],
		});

		if (!turnResult.success) {
			return {
				success: false,
				error: turnResult.error,
			};
		}

		const turn = turnResult.value;

		// Create verdict
		const verdictResult = writeVerdict({
			claim_id: params.claim_id,
			verdict: params.verdict as any, // VerdictType
			rationale: params.rationale,
			constraints_ref: params.constraints_ref || null,
			evidence_ref: params.evidence_ref || null,
		});

		if (!verdictResult.success) {
			return {
				success: false,
				error: verdictResult.error,
			};
		}

		return {
			success: true,
			value: {
				verdict: verdictResult.value,
				turn,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to handle VERDICT speech act'),
		};
	}
}

/**
 * Handle DECISION speech act
 * Records a human decision at a gate
 * @param params Decision parameters
 * @returns Result containing decision and turn
 */
export function handleDecisionSpeechAct(params: {
	dialogue_id: string;
	gate_id: string;
	action: 'APPROVE' | 'REJECT' | 'OVERRIDE' | 'REFRAME';
	rationale: string;
	attachments_ref?: string | null;
	content_ref: ContentRef;
	phase: Phase;
	related_claims: string[];
}): Result<{ decision: HumanDecision; turn: DialogueTurn }> {
	try {
		// Create dialogue turn
		const turnResult = createAndAddTurn({
			dialogue_id: params.dialogue_id,
			role: Role.HUMAN,
			phase: params.phase,
			speech_act: SpeechAct.DECISION,
			content_ref: params.content_ref,
			related_claims: params.related_claims,
		});

		if (!turnResult.success) {
			return {
				success: false,
				error: turnResult.error,
			};
		}

		const turn = turnResult.value;

		// Record human decision
		const decisionResult = writeHumanDecision({
			gate_id: params.gate_id,
			action: params.action as any,
			rationale: params.rationale,
			attachments_ref: params.attachments_ref || null,
		});

		if (!decisionResult.success) {
			return {
				success: false,
				error: decisionResult.error,
			};
		}

		return {
			success: true,
			value: {
				decision: decisionResult.value,
				turn,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to handle DECISION speech act'),
		};
	}
}

/**
 * Validate speech act parameters based on type
 * @param speech_act Speech act type
 * @param params Parameters object
 * @returns Result indicating if parameters are valid
 */
export function validateSpeechActParams(
	speech_act: SpeechAct,
	params: Record<string, unknown>
): Result<boolean> {
	const errors: string[] = [];

	switch (speech_act) {
		case SpeechAct.CLAIM:
		case SpeechAct.ASSUMPTION:
			if (!params.statement || typeof params.statement !== 'string') {
				errors.push('statement is required and must be a string');
			}
			if (!params.introduced_by || typeof params.introduced_by !== 'string') {
				errors.push('introduced_by is required and must be a Role');
			}
			break;

		case SpeechAct.EVIDENCE:
			if (!params.content_ref || typeof params.content_ref !== 'string') {
				errors.push('content_ref is required and must be a string');
			}
			if (!params.role || typeof params.role !== 'string') {
				errors.push('role is required and must be a Role');
			}
			break;

		case SpeechAct.VERDICT:
			if (!params.claim_id || typeof params.claim_id !== 'string') {
				errors.push('claim_id is required and must be a string');
			}
			if (!params.verdict || typeof params.verdict !== 'string') {
				errors.push('verdict is required and must be a VerdictType');
			}
			if (!params.rationale || typeof params.rationale !== 'string') {
				errors.push('rationale is required and must be a string');
			}
			break;

		case SpeechAct.DECISION:
			if (!params.gate_id || typeof params.gate_id !== 'string') {
				errors.push('gate_id is required and must be a string');
			}
			if (!params.action || typeof params.action !== 'string') {
				errors.push('action is required and must be a HumanAction');
			}
			if (!params.rationale || typeof params.rationale !== 'string') {
				errors.push('rationale is required and must be a string');
			}
			break;

		default:
			errors.push(`Unknown speech act: ${speech_act}`);
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(
				`Speech act parameter validation failed:\n${errors.join('\n')}`
			),
		};
	}

	return { success: true, value: true };
}
