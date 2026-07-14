import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ObjectEnvelopeSchema } from './envelopes.js';
import { buildContractRegistry, schemaId, validateAgainst } from './validate.js';

describe('validate', () => {
	it('returns the typed value on success', () => {
		const r = validateAgainst(
			z.strictObject({ a: z.string() }),
			{ a: 'x' },
			{ correlationId: 'c1' }
		);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.value.a).toBe('x');
	});

	it('yields RPH_VALIDATION_SCHEMA_FAILED with structured issues on failure', () => {
		const r = validateAgainst(
			z.strictObject({ a: z.string() }),
			{ a: 1, b: 2 },
			{ correlationId: 'c1' }
		);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
			expect(r.error.correlationId).toBe('c1');
			const issues = (r.error.details as { issues: unknown[] }).issues;
			expect(issues.length).toBeGreaterThan(0);
		}
	});

	it('registry validates by id and rejects unknown ids', () => {
		const reg = buildContractRegistry();
		const envId = schemaId('object', 'ObjectEnvelope');
		expect(reg.has(envId)).toBe(true);
		expect(reg.get(envId)).toBe(ObjectEnvelopeSchema);
		const bad = reg.validate('urn:janumi:rph:schema:object:Nope:1', {}, { correlationId: 'c1' });
		expect(bad.ok).toBe(false);
	});

	it('registers envelope + enum + object + command + event schemas', () => {
		// 8 envelope/primitive + 72 enums + 22 objects + 68 commands + 120 events = 290
		// (+3 objects PROFESSIONAL_WORK_ARCHITECTURE / PWU_TYPE / UNDERTAKING; +8 PWA-authoring commands +8 events —
		// the RPH-DOC-010 PWA-authoring context; then +3 DRAFT-authoring commands EditPwa/EditPwuType/RemovePwuType
		// +3 events; then +1 DeletePwa command +1 PwaDeleted event — PWA discard/soft-delete; then +1
		// AUTHORING_CONVERSATION object +1 AppendConversationEntries command +1 ConversationEntriesAppended event —
		// the durable event-sourced authoring conversation, governed-stream precursor; then +1 AUTHORING_ASSESSMENT
		// object +3 commands (Record/Escalate/Resolve AuthoringAssessment) +3 events — the authoring-plane
		// faithfulness assessment (governed-stream precursor; exec != assurance); then +1 CreateAssurancePolicy command
		// +1 AssurancePolicyCreated event — the assurance-floor policy create path (guide §8.9); see OPEN-QUESTIONS)
		expect(buildContractRegistry().ids().length).toBe(290);
	});
});
