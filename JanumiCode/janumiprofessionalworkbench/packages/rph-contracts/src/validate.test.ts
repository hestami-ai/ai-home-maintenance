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
		// 8 envelope/primitive + 72 enums + 17 domain objects + 51 commands + 103 events = 251
		// (51 = 43 + the 8 commands added for live command-drive: BeginIntentDiscovery, ProvisionIntent,
		// SubmitBaselineForReview, ApproveBaseline, Request/Authorize/Deny RuntimeBinding, RevokeRuntimeCapability;
		// 103 = 102 + IntentProvisioned — RPH-DOC-010; see OPEN-QUESTIONS)
		expect(buildContractRegistry().ids().length).toBe(251);
	});
});
