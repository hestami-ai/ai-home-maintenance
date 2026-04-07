import { describe, it, expect } from 'vitest';
import {
	createEnvelope,
	createDialogueId,
	createExecutorEnvelope,
	createTechnicalExpertEnvelope,
	createVerifierEnvelope,
	createHistorianEnvelope,
	createHumanEnvelope,
	validateEnvelope,
	validateRoleSpeechAct,
	serializeEnvelope,
	deserializeEnvelope,
	createBlobRef,
	createFileRef,
	createEvidenceRef,
	parseContentRef,
} from '../../../lib/dialogue/envelope';
import { Role, Phase, SpeechAct } from '../../../lib/types';

describe('Envelope', () => {
	describe('createDialogueId', () => {
		it('generates a valid UUID', () => {
			const id = createDialogueId();
			const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			expect(uuidRegex.test(id)).toBe(true);
		});

		it('generates unique IDs', () => {
			const id1 = createDialogueId();
			const id2 = createDialogueId();
			expect(id1).not.toBe(id2);
		});
	});

	describe('createEnvelope', () => {
		it('creates a valid envelope with all required fields', () => {
			const dialogueId = createDialogueId();
			const envelope = createEnvelope({
				dialogue_id: dialogueId,
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test-hash',
				related_claims: ['claim-1', 'claim-2'],
			});

			expect(envelope.dialogue_id).toBe(dialogueId);
			expect(envelope.turn_id).toBe(1);
			expect(envelope.role).toBe(Role.EXECUTOR);
			expect(envelope.phase).toBe(Phase.PROPOSE);
			expect(envelope.speech_act).toBe(SpeechAct.CLAIM);
			expect(envelope.content_ref).toBe('blob://test-hash');
			expect(envelope.related_claims).toEqual(['claim-1', 'claim-2']);
			expect(envelope.timestamp).toBeDefined();
		});

		it('defaults related_claims to empty array', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			expect(envelope.related_claims).toEqual([]);
		});

		it('generates ISO-8601 timestamp', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			const timestamp = new Date(envelope.timestamp);
			expect(isNaN(timestamp.getTime())).toBe(false);
		});
	});

	describe('createExecutorEnvelope', () => {
		it('creates envelope with EXECUTOR role', () => {
			const dialogueId = createDialogueId();
			const envelope = createExecutorEnvelope(
				dialogueId,
				1,
				Phase.PROPOSE,
				SpeechAct.CLAIM,
				'blob://test'
			);

			expect(envelope.role).toBe(Role.EXECUTOR);
			expect(envelope.phase).toBe(Phase.PROPOSE);
			expect(envelope.speech_act).toBe(SpeechAct.CLAIM);
		});

		it('supports ASSUMPTION speech act', () => {
			const envelope = createExecutorEnvelope(
				createDialogueId(),
				1,
				Phase.ASSUMPTION_SURFACING,
				SpeechAct.ASSUMPTION,
				'blob://test'
			);

			expect(envelope.speech_act).toBe(SpeechAct.ASSUMPTION);
		});

		it('includes related claims', () => {
			const envelope = createExecutorEnvelope(
				createDialogueId(),
				1,
				Phase.PROPOSE,
				SpeechAct.CLAIM,
				'blob://test',
				['claim-1', 'claim-2']
			);

			expect(envelope.related_claims).toEqual(['claim-1', 'claim-2']);
		});
	});

	describe('createTechnicalExpertEnvelope', () => {
		it('creates envelope with TECHNICAL_EXPERT role and EVIDENCE speech act', () => {
			const envelope = createTechnicalExpertEnvelope(
				createDialogueId(),
				1,
				Phase.ASSUMPTION_SURFACING,
				'blob://evidence'
			);

			expect(envelope.role).toBe(Role.TECHNICAL_EXPERT);
			expect(envelope.speech_act).toBe(SpeechAct.EVIDENCE);
		});

		it('includes related claims', () => {
			const envelope = createTechnicalExpertEnvelope(
				createDialogueId(),
				1,
				Phase.ASSUMPTION_SURFACING,
				'blob://evidence',
				['assumption-1']
			);

			expect(envelope.related_claims).toEqual(['assumption-1']);
		});
	});

	describe('createVerifierEnvelope', () => {
		it('creates envelope with VERIFIER role and VERDICT speech act', () => {
			const envelope = createVerifierEnvelope(
				createDialogueId(),
				1,
				'blob://verdict'
			);

			expect(envelope.role).toBe(Role.VERIFIER);
			expect(envelope.phase).toBe(Phase.VERIFY);
			expect(envelope.speech_act).toBe(SpeechAct.VERDICT);
		});

		it('includes related claims being verified', () => {
			const envelope = createVerifierEnvelope(
				createDialogueId(),
				1,
				'blob://verdict',
				['claim-1', 'claim-2']
			);

			expect(envelope.related_claims).toEqual(['claim-1', 'claim-2']);
		});
	});

	describe('createHistorianEnvelope', () => {
		it('creates envelope with HISTORIAN role and EVIDENCE speech act', () => {
			const envelope = createHistorianEnvelope(
				createDialogueId(),
				1,
				Phase.HISTORICAL_CHECK,
				'blob://history'
			);

			expect(envelope.role).toBe(Role.HISTORIAN);
			expect(envelope.speech_act).toBe(SpeechAct.EVIDENCE);
		});

		it('includes related claims', () => {
			const envelope = createHistorianEnvelope(
				createDialogueId(),
				1,
				Phase.HISTORICAL_CHECK,
				'blob://history',
				['claim-1']
			);

			expect(envelope.related_claims).toEqual(['claim-1']);
		});
	});

	describe('createHumanEnvelope', () => {
		it('creates envelope with HUMAN role and DECISION speech act', () => {
			const envelope = createHumanEnvelope(
				createDialogueId(),
				1,
				Phase.REVIEW,
				'blob://decision'
			);

			expect(envelope.role).toBe(Role.HUMAN);
			expect(envelope.speech_act).toBe(SpeechAct.DECISION);
		});

		it('includes related claims', () => {
			const envelope = createHumanEnvelope(
				createDialogueId(),
				1,
				Phase.REVIEW,
				'blob://decision',
				['claim-1', 'claim-2']
			);

			expect(envelope.related_claims).toEqual(['claim-1', 'claim-2']);
		});
	});

	describe('validateEnvelope', () => {
		it('validates a correct envelope', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(true);
		});

		it('rejects invalid dialogue_id format', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			envelope.dialogue_id = 'not-a-uuid';

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('valid UUID');
			}
		});

		it('rejects turn_id < 1', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			envelope.turn_id = 0;

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('must be positive');
			}
		});

		it('rejects invalid role', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			(envelope as any).role = 'INVALID_ROLE';

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Invalid role');
			}
		});

		it('rejects invalid phase', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			(envelope as any).phase = 'INVALID_PHASE';

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Invalid phase');
			}
		});

		it('rejects invalid speech_act', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			(envelope as any).speech_act = 'INVALID_ACT';

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Invalid speech_act');
			}
		});

		it('rejects empty content_ref', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			envelope.content_ref = '';

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('cannot be empty');
			}
		});

		it('rejects invalid timestamp', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			envelope.timestamp = 'not-a-timestamp';

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('ISO-8601');
			}
		});

		it('rejects invalid claim IDs in related_claims', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
				related_claims: ['not-a-uuid'],
			});

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Invalid claim ID');
			}
		});

		it('validates envelope with valid related_claims', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
				related_claims: [createDialogueId(), createDialogueId()],
			});

			const result = validateEnvelope(envelope);
			expect(result.success).toBe(true);
		});
	});

	describe('validateRoleSpeechAct', () => {
		it('allows EXECUTOR with CLAIM', () => {
			const result = validateRoleSpeechAct(Role.EXECUTOR, SpeechAct.CLAIM);
			expect(result.success).toBe(true);
		});

		it('allows EXECUTOR with ASSUMPTION', () => {
			const result = validateRoleSpeechAct(Role.EXECUTOR, SpeechAct.ASSUMPTION);
			expect(result.success).toBe(true);
		});

		it('rejects EXECUTOR with VERDICT', () => {
			const result = validateRoleSpeechAct(Role.EXECUTOR, SpeechAct.VERDICT);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Invalid speech act');
			}
		});

		it('allows TECHNICAL_EXPERT with EVIDENCE', () => {
			const result = validateRoleSpeechAct(Role.TECHNICAL_EXPERT, SpeechAct.EVIDENCE);
			expect(result.success).toBe(true);
		});

		it('rejects TECHNICAL_EXPERT with CLAIM', () => {
			const result = validateRoleSpeechAct(Role.TECHNICAL_EXPERT, SpeechAct.CLAIM);
			expect(result.success).toBe(false);
		});

		it('allows VERIFIER with VERDICT', () => {
			const result = validateRoleSpeechAct(Role.VERIFIER, SpeechAct.VERDICT);
			expect(result.success).toBe(true);
		});

		it('rejects VERIFIER with CLAIM', () => {
			const result = validateRoleSpeechAct(Role.VERIFIER, SpeechAct.CLAIM);
			expect(result.success).toBe(false);
		});

		it('allows HISTORIAN with EVIDENCE', () => {
			const result = validateRoleSpeechAct(Role.HISTORIAN, SpeechAct.EVIDENCE);
			expect(result.success).toBe(true);
		});

		it('rejects HISTORIAN with DECISION', () => {
			const result = validateRoleSpeechAct(Role.HISTORIAN, SpeechAct.DECISION);
			expect(result.success).toBe(false);
		});

		it('allows HUMAN with DECISION', () => {
			const result = validateRoleSpeechAct(Role.HUMAN, SpeechAct.DECISION);
			expect(result.success).toBe(true);
		});

		it('rejects HUMAN with EVIDENCE', () => {
			const result = validateRoleSpeechAct(Role.HUMAN, SpeechAct.EVIDENCE);
			expect(result.success).toBe(false);
		});
	});

	describe('serializeEnvelope', () => {
		it('serializes envelope to JSON string', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			const json = serializeEnvelope(envelope);
			expect(typeof json).toBe('string');

			const parsed = JSON.parse(json);
			expect(parsed.role).toBe(Role.EXECUTOR);
			expect(parsed.turn_id).toBe(1);
		});

		it('formats JSON with indentation', () => {
			const envelope = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			const json = serializeEnvelope(envelope);
			expect(json).toContain('\n');
		});
	});

	describe('deserializeEnvelope', () => {
		it('deserializes valid JSON to envelope', () => {
			const original = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
			});

			const json = serializeEnvelope(original);
			const result = deserializeEnvelope(json);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.dialogue_id).toBe(original.dialogue_id);
				expect(result.value.turn_id).toBe(original.turn_id);
				expect(result.value.role).toBe(original.role);
			}
		});

		it('rejects invalid JSON', () => {
			const result = deserializeEnvelope('not valid json');
			expect(result.success).toBe(false);
		});

		it('validates deserialized envelope', () => {
			const invalidEnvelope = {
				dialogue_id: 'not-a-uuid',
				turn_id: 1,
				role: Role.EXECUTOR,
				phase: Phase.PROPOSE,
				speech_act: SpeechAct.CLAIM,
				content_ref: 'blob://test',
				related_claims: [],
				timestamp: new Date().toISOString(),
			};

			const result = deserializeEnvelope(JSON.stringify(invalidEnvelope));
			expect(result.success).toBe(false);
		});

		it('round-trips envelope through serialization', () => {
			const original = createEnvelope({
				dialogue_id: createDialogueId(),
				turn_id: 5,
				role: Role.VERIFIER,
				phase: Phase.VERIFY,
				speech_act: SpeechAct.VERDICT,
				content_ref: 'blob://verdict-hash',
				related_claims: [createDialogueId()],
			});

			const json = serializeEnvelope(original);
			const result = deserializeEnvelope(json);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual(original);
			}
		});
	});

	describe('content reference helpers', () => {
		describe('createBlobRef', () => {
			it('creates blob:// reference', () => {
				const ref = createBlobRef('abc123');
				expect(ref).toBe('blob://abc123');
			});

			it('handles hash values', () => {
				const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
				const ref = createBlobRef(hash);
				expect(ref).toBe(`blob://${hash}`);
			});
		});

		describe('createFileRef', () => {
			it('creates file:// reference', () => {
				const ref = createFileRef('/path/to/file.txt');
				expect(ref).toBe('file:///path/to/file.txt');
			});

			it('handles relative paths', () => {
				const ref = createFileRef('src/index.ts');
				expect(ref).toBe('file://src/index.ts');
			});
		});

		describe('createEvidenceRef', () => {
			it('creates evidence:// reference', () => {
				const ref = createEvidenceRef('evidence-id-123');
				expect(ref).toBe('evidence://evidence-id-123');
			});

			it('handles UUID identifiers', () => {
				const id = createDialogueId();
				const ref = createEvidenceRef(id);
				expect(ref).toBe(`evidence://${id}`);
			});
		});

		describe('parseContentRef', () => {
			it('parses blob:// reference', () => {
				const parsed = parseContentRef('blob://abc123');
				expect(parsed.type).toBe('blob');
				expect(parsed.value).toBe('abc123');
			});

			it('parses file:// reference', () => {
				const parsed = parseContentRef('file:///path/to/file.txt');
				expect(parsed.type).toBe('file');
				expect(parsed.value).toBe('/path/to/file.txt');
			});

			it('parses evidence:// reference', () => {
				const parsed = parseContentRef('evidence://evidence-123');
				expect(parsed.type).toBe('evidence');
				expect(parsed.value).toBe('evidence-123');
			});

			it('handles unknown reference types', () => {
				const parsed = parseContentRef('unknown://something');
				expect(parsed.type).toBe('unknown');
				expect(parsed.value).toBe('unknown://something');
			});

			it('handles references without scheme', () => {
				const parsed = parseContentRef('just-a-string');
				expect(parsed.type).toBe('unknown');
				expect(parsed.value).toBe('just-a-string');
			});
		});
	});

	describe('envelope workflow scenarios', () => {
		it('creates complete PROPOSE phase envelope', () => {
			const dialogueId = createDialogueId();
			const envelope = createExecutorEnvelope(
				dialogueId,
				1,
				Phase.PROPOSE,
				SpeechAct.CLAIM,
				createBlobRef('proposal-hash')
			);

			const validation = validateEnvelope(envelope);
			expect(validation.success).toBe(true);

			const roleSpeechActValidation = validateRoleSpeechAct(envelope.role, envelope.speech_act);
			expect(roleSpeechActValidation.success).toBe(true);
		});

		it('creates VERIFY phase envelope with related claims', () => {
			const dialogueId = createDialogueId();
			const claimId1 = createDialogueId();
			const claimId2 = createDialogueId();

			const envelope = createVerifierEnvelope(
				dialogueId,
				2,
				createBlobRef('verdict-hash'),
				[claimId1, claimId2]
			);

			expect(envelope.related_claims).toHaveLength(2);
			expect(validateEnvelope(envelope).success).toBe(true);
		});

		it('serializes and deserializes envelope for storage', () => {
			const envelope = createHumanEnvelope(
				createDialogueId(),
				3,
				Phase.REVIEW,
				createFileRef('/decisions/review-1.json')
			);

			const json = serializeEnvelope(envelope);
			const restored = deserializeEnvelope(json);

			expect(restored.success).toBe(true);
			if (restored.success) {
				expect(restored.value.role).toBe(Role.HUMAN);
				expect(restored.value.phase).toBe(Phase.REVIEW);
			}
		});

		it('validates all role-specific envelopes', () => {
			const dialogueId = createDialogueId();

			const executorEnvelope = createExecutorEnvelope(dialogueId, 1, Phase.PROPOSE, SpeechAct.CLAIM, 'blob://1');
			expect(validateRoleSpeechAct(executorEnvelope.role, executorEnvelope.speech_act).success).toBe(true);

			const expertEnvelope = createTechnicalExpertEnvelope(dialogueId, 2, Phase.ASSUMPTION_SURFACING, 'blob://2');
			expect(validateRoleSpeechAct(expertEnvelope.role, expertEnvelope.speech_act).success).toBe(true);

			const verifierEnvelope = createVerifierEnvelope(dialogueId, 3, 'blob://3');
			expect(validateRoleSpeechAct(verifierEnvelope.role, verifierEnvelope.speech_act).success).toBe(true);

			const historianEnvelope = createHistorianEnvelope(dialogueId, 4, Phase.HISTORICAL_CHECK, 'blob://4');
			expect(validateRoleSpeechAct(historianEnvelope.role, historianEnvelope.speech_act).success).toBe(true);

			const humanEnvelope = createHumanEnvelope(dialogueId, 5, Phase.REVIEW, 'blob://5');
			expect(validateRoleSpeechAct(humanEnvelope.role, humanEnvelope.speech_act).success).toBe(true);
		});
	});
});
