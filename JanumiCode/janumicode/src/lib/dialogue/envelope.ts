/**
 * Dialogue Envelope Factory and Utilities
 * Implements Phase 2.1: Dialogue Envelope Implementation
 * Based on Technical Specification Section 4.1
 */

import { randomUUID } from 'node:crypto';
import type {
	DialogueEnvelope,
	Result,
	ContentRef,
} from '../types';
import {
	Role,
	Phase,
	SpeechAct,
} from '../types';

/**
 * Create a new dialogue envelope
 * @param params Envelope parameters
 * @returns Dialogue envelope
 */
export function createEnvelope(params: {
	dialogue_id: string;
	turn_id: number;
	role: Role;
	phase: Phase;
	speech_act: SpeechAct;
	content_ref: ContentRef;
	related_claims?: string[];
}): DialogueEnvelope {
	return {
		dialogue_id: params.dialogue_id,
		turn_id: params.turn_id,
		role: params.role,
		phase: params.phase,
		speech_act: params.speech_act,
		content_ref: params.content_ref,
		related_claims: params.related_claims || [],
		timestamp: new Date().toISOString(),
	};
}

/**
 * Create a new dialogue ID
 * @returns UUID for new dialogue
 */
export function createDialogueId(): string {
	return randomUUID();
}

/**
 * Create an Executor envelope
 * @param dialogue_id Dialogue ID
 * @param turn_id Turn number
 * @param phase Current phase
 * @param speech_act Speech act type
 * @param content_ref Content reference
 * @param related_claims Related claim IDs
 * @returns Dialogue envelope
 */
export function createExecutorEnvelope(
	dialogue_id: string,
	turn_id: number,
	phase: Phase,
	speech_act: SpeechAct,
	content_ref: ContentRef,
	related_claims: string[] = []
): DialogueEnvelope {
	return createEnvelope({
		dialogue_id,
		turn_id,
		role: Role.EXECUTOR,
		phase,
		speech_act,
		content_ref,
		related_claims,
	});
}

/**
 * Create a Technical Expert envelope
 * @param dialogue_id Dialogue ID
 * @param turn_id Turn number
 * @param phase Current phase
 * @param content_ref Content reference (usually evidence)
 * @param related_claims Related claim IDs
 * @returns Dialogue envelope
 */
export function createTechnicalExpertEnvelope(
	dialogue_id: string,
	turn_id: number,
	phase: Phase,
	content_ref: ContentRef,
	related_claims: string[] = []
): DialogueEnvelope {
	return createEnvelope({
		dialogue_id,
		turn_id,
		role: Role.TECHNICAL_EXPERT,
		phase,
		speech_act: SpeechAct.EVIDENCE,
		content_ref,
		related_claims,
	});
}

/**
 * Create a Verifier envelope
 * @param dialogue_id Dialogue ID
 * @param turn_id Turn number
 * @param content_ref Content reference (verdict)
 * @param related_claims Related claim IDs (claims being verified)
 * @returns Dialogue envelope
 */
export function createVerifierEnvelope(
	dialogue_id: string,
	turn_id: number,
	content_ref: ContentRef,
	related_claims: string[] = []
): DialogueEnvelope {
	return createEnvelope({
		dialogue_id,
		turn_id,
		role: Role.VERIFIER,
		phase: Phase.VERIFY,
		speech_act: SpeechAct.VERDICT,
		content_ref,
		related_claims,
	});
}

/**
 * Create a Historian envelope
 * @param dialogue_id Dialogue ID
 * @param turn_id Turn number
 * @param phase Current phase
 * @param content_ref Content reference
 * @param related_claims Related claim IDs
 * @returns Dialogue envelope
 */
export function createHistorianEnvelope(
	dialogue_id: string,
	turn_id: number,
	phase: Phase,
	content_ref: ContentRef,
	related_claims: string[] = []
): DialogueEnvelope {
	return createEnvelope({
		dialogue_id,
		turn_id,
		role: Role.HISTORIAN,
		phase,
		speech_act: SpeechAct.EVIDENCE,
		content_ref,
		related_claims,
	});
}

/**
 * Create a Human envelope
 * @param dialogue_id Dialogue ID
 * @param turn_id Turn number
 * @param phase Current phase
 * @param content_ref Content reference (decision)
 * @param related_claims Related claim IDs
 * @returns Dialogue envelope
 */
export function createHumanEnvelope(
	dialogue_id: string,
	turn_id: number,
	phase: Phase,
	content_ref: ContentRef,
	related_claims: string[] = []
): DialogueEnvelope {
	return createEnvelope({
		dialogue_id,
		turn_id,
		role: Role.HUMAN,
		phase,
		speech_act: SpeechAct.DECISION,
		content_ref,
		related_claims,
	});
}

/**
 * Validate dialogue envelope structure
 * @param envelope Envelope to validate
 * @returns Result indicating if envelope is valid
 */
export function validateEnvelope(
	envelope: DialogueEnvelope
): Result<boolean> {
	const errors: string[] = [];

	// Validate dialogue_id is UUID format
	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (!uuidRegex.test(envelope.dialogue_id)) {
		errors.push('dialogue_id must be a valid UUID');
	}

	// Validate turn_id is positive
	if (envelope.turn_id < 1) {
		errors.push('turn_id must be positive (>= 1)');
	}

	// Validate role is valid enum value
	if (!Object.values(Role).includes(envelope.role)) {
		errors.push(`Invalid role: ${envelope.role}`);
	}

	// Validate phase is valid enum value
	if (!Object.values(Phase).includes(envelope.phase)) {
		errors.push(`Invalid phase: ${envelope.phase}`);
	}

	// Validate speech_act is valid enum value
	if (!Object.values(SpeechAct).includes(envelope.speech_act)) {
		errors.push(`Invalid speech_act: ${envelope.speech_act}`);
	}

	// Validate content_ref is not empty
	if (!envelope.content_ref || envelope.content_ref.trim() === '') {
		errors.push('content_ref cannot be empty');
	}

	// Validate timestamp is ISO-8601
	try {
		const date = new Date(envelope.timestamp);
		if (isNaN(date.getTime())) {
			errors.push('timestamp must be valid ISO-8601 format');
		}
	} catch {
		errors.push('timestamp must be valid ISO-8601 format');
	}

	// Validate related_claims are UUIDs
	for (const claimId of envelope.related_claims) {
		if (!uuidRegex.test(claimId)) {
			errors.push(`Invalid claim ID in related_claims: ${claimId}`);
		}
	}

	if (errors.length > 0) {
		return {
			success: false,
			error: new Error(
				`Envelope validation failed:\n${errors.join('\n')}`
			),
		};
	}

	return { success: true, value: true };
}

/**
 * Validate role-specific speech act constraints
 * Based on Technical Specification Section 3 (Role constraints)
 * @param role Role
 * @param speech_act Speech act
 * @returns Result indicating if combination is valid
 */
export function validateRoleSpeechAct(
	role: Role,
	speech_act: SpeechAct
): Result<boolean> {
	const validCombinations: Record<Role, SpeechAct[]> = {
		[Role.EXECUTOR]: [
			SpeechAct.CLAIM,
			SpeechAct.ASSUMPTION,
		],
		[Role.TECHNICAL_EXPERT]: [SpeechAct.EVIDENCE],
		[Role.VERIFIER]: [SpeechAct.VERDICT],
		[Role.HISTORIAN]: [SpeechAct.EVIDENCE],
		[Role.HUMAN]: [SpeechAct.DECISION],
	};

	const allowedSpeechActs = validCombinations[role];
	if (!allowedSpeechActs.includes(speech_act)) {
		return {
			success: false,
			error: new Error(
				`Invalid speech act ${speech_act} for role ${role}. Allowed: ${allowedSpeechActs.join(', ')}`
			),
		};
	}

	return { success: true, value: true };
}

/**
 * Serialize envelope to JSON string
 * @param envelope Dialogue envelope
 * @returns JSON string
 */
export function serializeEnvelope(envelope: DialogueEnvelope): string {
	return JSON.stringify(envelope, null, 2);
}

/**
 * Deserialize envelope from JSON string
 * @param json JSON string
 * @returns Result containing envelope or error
 */
export function deserializeEnvelope(
	json: string
): Result<DialogueEnvelope> {
	try {
		const envelope = JSON.parse(json) as DialogueEnvelope;

		// Validate deserialized envelope
		const validationResult = validateEnvelope(envelope);
		if (!validationResult.success) {
			return {
				success: false,
				error: new Error(
					`Deserialization validation failed: ${validationResult.error.message}`
				),
			};
		}

		return { success: true, value: envelope };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to deserialize envelope'),
		};
	}
}

/**
 * Create content reference for blob storage
 * @param hash SHA-256 hash
 * @returns Content reference
 */
export function createBlobRef(hash: string): ContentRef {
	return `blob://${hash}`;
}

/**
 * Create content reference for file storage
 * @param path File path
 * @returns Content reference
 */
export function createFileRef(path: string): ContentRef {
	return `file://${path}`;
}

/**
 * Create content reference for evidence storage
 * @param id Evidence ID
 * @returns Content reference
 */
export function createEvidenceRef(id: string): ContentRef {
	return `evidence://${id}`;
}

/**
 * Parse content reference
 * @param ref Content reference
 * @returns Parsed reference with type and value
 */
export function parseContentRef(ref: ContentRef): {
	type: 'blob' | 'file' | 'evidence' | 'unknown';
	value: string;
} {
	if (ref.startsWith('blob://')) {
		return { type: 'blob', value: ref.substring(7) };
	}
	if (ref.startsWith('file://')) {
		return { type: 'file', value: ref.substring(7) };
	}
	if (ref.startsWith('evidence://')) {
		return { type: 'evidence', value: ref.substring(11) };
	}
	return { type: 'unknown', value: ref };
}
