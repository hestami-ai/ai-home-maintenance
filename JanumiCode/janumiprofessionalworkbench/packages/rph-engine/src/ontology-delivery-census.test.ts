// THE ONTOLOGY DELIVERY CENSUS — which authored ontology fields reach the runtime, and which are dropped.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// REG-F-022: twelve ratified catalog policies declare `requiredEvidenceTypes`, and `seedAdditivePolicies` builds
// its `CreateAssurancePolicy` payload as an explicit eleven-key literal that does not name it. The authored value
// never reaches an AssurancePolicy object, so Gate A reads an empty set on every policy the product can produce.
//
// NOTHING CAUGHT IT, AND NOTHING WOULD CATCH THE NEXT ONE. The field is absent from `EngineSeedPolicy` — the
// engine's own port type for an ontology policy — so it is structurally invisible past the package boundary and
// no type error was ever available. `validateOntology` reads three fields and does not check it either. A field
// can be authored, well-typed at its source, carried through codegen, and unreachable by every consumer, with no
// gate anywhere reporting it.
//
// So this asks the general question REG-F-022 is one instance of: **of everything the ontology AUTHORS, what does
// the seeding DELIVER?** It is derived by intercepting the real seeder's dispatches, not by reading either side's
// source — the same discipline that made the state-reachability count trustworthy after a regex under-counted it.
//
// ── WHAT A DROPPED FIELD IS AND IS NOT ───────────────────────────────────────────────────────────────────────
// Not every authored field must appear verbatim in a payload. Some are TRANSFORMED (`findingTypes` +
// `findingAnnotations` become `findingDefinitions`), and some are ontology-internal bookkeeping that the runtime
// has no business carrying (`sourceSection` is provenance about the transcription). Those are named below with
// their reason. What may NOT happen is a field being dropped because nobody noticed — which is the whole of
// REG-F-022.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import type { CommandResult, DomainCommand } from '@janumipwb/rph-contracts';
import { describe, expect, it } from 'vitest';
import type { EngineHandle } from './engine.js';
import { seedAdditivePolicies } from './seed-workbench.js';

/** Capture every command the seeder issues, without an engine — the payload keys are the delivered surface. */
function capturePolicySeeding(): DomainCommand[] {
	const sent: DomainCommand[] = [];
	const handle = {
		ontology,
		dispatch: (command: DomainCommand): CommandResult => {
			sent.push(command);
			return { commandId: command.commandId, status: 'ACCEPTED', producedEventIds: [] };
		}
	} as unknown as EngineHandle;
	seedAdditivePolicies(handle);
	return sent;
}

/** The union of keys the ontology actually authors across all seed policies. */
function authoredKeys(): string[] {
	const keys = new Set<string>();
	for (const p of ontology.seedPolicies) for (const k of Object.keys(p)) keys.add(k);
	return [...keys].sort((a, b) => a.localeCompare(b));
}

/** The union of keys the seeder puts on its CreateAssurancePolicy payloads. */
function deliveredKeys(): string[] {
	const keys = new Set<string>();
	for (const c of capturePolicySeeding()) {
		if (c.commandType !== 'CreateAssurancePolicy') continue;
		for (const k of Object.keys(c.payload as Record<string, unknown>)) keys.add(k);
	}
	return [...keys].sort((a, b) => a.localeCompare(b));
}

/**
 * Authored fields that legitimately do not appear verbatim on the payload, each with why. An entry here is a
 * CLAIM that the field's content still reaches the runtime by another route, or that the runtime has no business
 * with it — never "we did not get to it".
 */
const ACCOUNTED_FOR: Readonly<Record<string, string>> = {
	findingTypes:
		'TRANSFORMED — becomes findingDefinitions via findingsFor(), which derives each finding\'s severity and ' +
		'control actions from the policy itself so a finding cannot claim an action its own policy forbids.',
	findingAnnotations:
		'TRANSFORMED — the same route: the 11 annotated codes supply description + defaultSeverity to findingsFor().',
	failureSeverity:
		'TRANSFORMED — the per-policy fallback severity findingsFor() applies to any finding the ontology does not ' +
		'annotate, so an unannotated finding inherits its policy\'s declared severity rather than an invented one.',
	sourceSection:
		'ONTOLOGY-INTERNAL — provenance about the transcription (which DOC-004 section, what was verbatim, what was ' +
		'AUTHORED). It documents the ontology; the runtime governs with the content, not with its citation.',
	// `appliesToPwuKinds` was FIRST WRITTEN HERE, with the reasoning "the value is not silently lost — it is
	// overridden by a broader scope (applicableObjectTypes: [PROFESSIONAL_WORK_UNIT])". That was wrong, and it was
	// the exact rot this file's next test exists to prevent: an exemption asserted rather than checked.
	//
	// Checked: `appliesToPwuKinds` is read by NOTHING — it appears only in the ontology's own type and data. And
	// `applicableObjectTypes`, the field I claimed overrides it, is STORED on the policy object and consulted by no
	// applicability decision anywhere. So nothing is overriding anything; the scope is dropped exactly as
	// `requiredEvidenceTypes` is. It belongs in the finding, not in the accounting.
};

describe('REG-F-022 generalized: what the ontology authors vs what the seeding delivers', () => {
	it('CONTROL: the capture sees real seeding — a zero here makes every list below vacuous', () => {
		const sent = capturePolicySeeding();
		const creates = sent.filter((c) => c.commandType === 'CreateAssurancePolicy');
		expect(creates.length).toBeGreaterThanOrEqual(12);
		expect(sent.some((c) => c.commandType === 'ActivateAssurancePolicy')).toBe(true);
		// And the payloads are populated, not empty objects that would make "delivered" trivially small.
		expect(Object.keys(creates[0]!.payload as Record<string, unknown>).length).toBeGreaterThan(8);
	});

	it('CONTROL: the ontology authors more than it delivers verbatim — otherwise there is nothing to census', () => {
		expect(authoredKeys().length).toBeGreaterThan(10);
	});

	// THE FINDING, GENERALIZED. Every authored key must either be delivered verbatim, or be named in
	// ACCOUNTED_FOR with the route its content takes. Anything else is a field nobody noticed.
	it('every authored ontology field is delivered or accounted for', () => {
		const delivered = new Set(deliveredKeys());
		const unexplained = authoredKeys().filter((k) => !delivered.has(k) && !(k in ACCOUNTED_FOR));
		expect(
			unexplained,
			'AUTHORED ONTOLOGY FIELDS THAT REACH NOTHING. Each is governance content someone wrote into the ' +
				'ratified catalog that no runtime object carries — REG-F-022\'s exact shape. Deliver it, or add a ' +
				'row to ACCOUNTED_FOR saying which route its content takes. "Not yet" is not a route.'
		).toEqual(['appliesToPwuKinds', 'requiredEvidenceTypes']);
	});

	// The accounting must stay honest in the other direction too: a stale exemption is how a list like this rots
	// into an allowlist. If a field named here starts being delivered verbatim, the row is obsolete and must go.
	it('no ACCOUNTED_FOR row is stale — an exemption for a field that IS delivered is an allowlist', () => {
		const delivered = new Set(deliveredKeys());
		const stale = Object.keys(ACCOUNTED_FOR).filter((k) => delivered.has(k));
		expect(stale).toEqual([]);
		// And every exemption must name a field the ontology actually authors, or it is guarding nothing.
		const authored = new Set(authoredKeys());
		expect(Object.keys(ACCOUNTED_FOR).filter((k) => !authored.has(k))).toEqual([]);
	});

	// THE SECOND INSTANCE, which is a SCOPE rather than a requirement — and is why this census exists at all.
	// REG-F-022 was found by chasing one field. The general question found another beside it.
	it('REG-F-022 second instance: policy SCOPE is authored per PWU kind and delivered to nothing', () => {
		const scoped = ontology.seedPolicies.filter(
			(p) => ((p as { appliesToPwuKinds?: readonly string[] }).appliesToPwuKinds ?? []).length > 0
		);
		expect(scoped.length).toBeGreaterThan(0);
		expect(deliveredKeys()).not.toContain('appliesToPwuKinds');
		// Every catalog policy is seeded with the same wholesale object scope instead.
		const creates = capturePolicySeeding().filter((c) => c.commandType === 'CreateAssurancePolicy');
		const scopes = new Set(
			creates.map((c) =>
				JSON.stringify((c.payload as { applicableObjectTypes?: unknown }).applicableObjectTypes)
			)
		);
		expect(
			[...scopes],
			'every catalog policy gets the identical object-type scope, so a policy the ontology authored for ONE ' +
				'PWU kind is seeded as applying to all of them. And the field that replaced it is itself read by no ' +
				'applicability decision — so policy scope is authored, dropped, and then not consulted either'
		).toEqual(['["PROFESSIONAL_WORK_UNIT"]']);
	});

	// REG-F-022's own instance, asserted directly so the entry has a live citation rather than a prose claim.
	it('REG-F-022: every catalog policy declares requiredEvidenceTypes and NO payload carries it', () => {
		const declaring = ontology.seedPolicies.filter(
			(p) => ((p as { requiredEvidenceTypes?: readonly string[] }).requiredEvidenceTypes ?? []).length > 0
		);
		expect(declaring.length).toBe(ontology.seedPolicies.length);
		expect(deliveredKeys()).not.toContain('requiredEvidenceTypes');
		expect(
			deliveredKeys(),
			'the field the policy object would need is requiredEvidence (a 9-field EvidenceRequirement array); the ' +
				'ontology carries ONE of those nine, as readonly string[], so delivering it is authoring against a ' +
				'ratified schema and not a mapping — which is why REG-F-022 is filed rather than patched'
		).not.toContain('requiredEvidence');
	});
});
