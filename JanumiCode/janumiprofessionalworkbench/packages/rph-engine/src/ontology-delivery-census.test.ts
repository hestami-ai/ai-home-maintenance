// THE ONTOLOGY DELIVERY CENSUS — which authored ontology fields reach the runtime, and which are dropped.
//
// ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────────────────
// REG-F-022: twelve ratified catalog policies declared `requiredEvidenceTypes`, and `seedAdditivePolicies` built
// its `CreateAssurancePolicy` payload as an explicit eleven-key literal that did not name it. The authored value
// never reached an AssurancePolicy object, so Gate A read an empty set on every policy the product could produce.
//
// CLOSED 2026-08-05 (REG-E-026). The field is SUPERSEDED — not merely wired — by `requiredEvidence` /
// `optionalEvidence`, DOC-004 §6.1's ratified shape, carrying the 89 evidence items §15-§26 actually list. This
// file keeps its shape and its teeth: the unexplained list is now empty, and the assertions below are what stop
// that emptiness being reached by adding an exemption instead of a wire.
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
	appliesToPwuKinds:
		'TRANSFORMED (2026-08-05) — delivered nested as `applicability.pwuKindConditions`, which is DOC-004 ' +
		'§5.1’s ratified home for it, so a name-level census cannot see it. The dedicated test below asserts the ' +
		'actual delivery per policy, including that a policy restricting NO kind delivers the field ABSENT rather ' +
		'than empty. THIS ROW WAS HERE ONCE BEFORE AND WAS FALSE: it first read “the value is not silently ' +
		'lost — it is overridden by a broader scope”, which was asserted and not checked, and one grep showed ' +
		'nothing read either field. It was moved OUT into the finding, and is back only now that the route it ' +
		'claims actually exists and is asserted. That is the difference between an exemption and an allowlist ' +
		'entry, and it is why the staleness check below exists.'
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
		).toEqual([]);
		// EMPTY SINCE 2026-08-05 (REG-E-026). This list held `requiredEvidenceTypes` — REG-F-022's own instance —
		// for as long as that field existed. It is now removed from the ontology, superseded by `requiredEvidence`
		// and `optionalEvidence`, which ARE delivered. An empty list here is the strongest state this census can
		// report: nothing authored reaches nothing.
		//
		// AND IT MUST NOT BE ACHIEVED BY EXEMPTION. `ACCOUNTED_FOR` still holds only the four TRANSFORMED/internal
		// rows it always did; the staleness assertion below is what stops a future author reaching this same green
		// by adding a row instead of a wire.
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

	// THE SECOND INSTANCE, DELIVERED 2026-08-05. `appliesToPwuKinds` left the unexplained list above — not by being
	// exempted, but by reaching the runtime. DOC-004 §5.1's `ApplicabilityRule.pwuKindConditions` was always its
	// ratified home; what stood in the way was that `ApplicabilityRuleSchema` was `z.record(string, unknown)` — an
	// opaque bag — and the handler hardcoded `applicability: {}`. Schematizing §5.1 made `{}` illegal (its one
	// REQUIRED field is `objectTypeConditions`) and gave the authored value somewhere to land.
	it('policy SCOPE now reaches the runtime in its ratified §5.1 home', () => {
		const scoped = ontology.seedPolicies.filter(
			(p) => ((p as { appliesToPwuKinds?: readonly string[] }).appliesToPwuKinds ?? []).length > 0
		);
		expect(scoped.length).toBeGreaterThan(0);
		const creates = capturePolicySeeding().filter((c) => c.commandType === 'CreateAssurancePolicy');
		const byId = new Map(
			creates.map((c) => [
				(c.payload as { policyId: string }).policyId,
				(c.payload as { applicability?: { pwuKindConditions?: readonly string[] } }).applicability
			])
		);
		for (const p of scoped) {
			expect(
				byId.get(p.policyId)?.pwuKindConditions,
				`${p.policyId} authors appliesToPwuKinds and must deliver it as §5.1 pwuKindConditions`
			).toEqual([...(p as { appliesToPwuKinds?: readonly string[] }).appliesToPwuKinds!]);
		}
		// And a policy that restricts NO kind delivers the field ABSENT, not empty: [] would read as "applies to no
		// PWU kind", which is the opposite of what the ontology means by declaring nothing.
		const unrestricted = ontology.seedPolicies.filter(
			(p) => !((p as { appliesToPwuKinds?: readonly string[] }).appliesToPwuKinds ?? []).length
		);
		for (const p of unrestricted)
			expect(byId.get(p.policyId)).not.toHaveProperty('pwuKindConditions');
		// Every policy still declares WHAT IT APPLIES TO — §5.1's one required field is never empty.
		for (const c of creates)
			expect(
				(c.payload as { applicability?: { objectTypeConditions?: unknown[] } }).applicability
					?.objectTypeConditions?.length
			).toBeGreaterThan(0);
	});

	// REG-F-022's own instance, now asserted in its CLOSED form so the register entry keeps a live citation.
	it('REG-F-022 CLOSED: the evidence the catalog declares reaches the payload', () => {
		// The finding was: 12 policies declared `requiredEvidenceTypes` and the payload named eleven fields, not
		// that one. The field is gone — superseded, not merely wired — and both ratified fields are delivered.
		expect(
			ontology.seedPolicies.some((p) => 'requiredEvidenceTypes' in p),
			'requiredEvidenceTypes is superseded by requiredEvidence/optionalEvidence; keeping both would be the ' +
				'drifting twin REG-F-029 review finding (c) caught, on the field REG-F-022 is about'
		).toBe(false);
		expect(deliveredKeys()).toContain('requiredEvidence');
		expect(deliveredKeys()).toContain('optionalEvidence');
		// And the content is non-empty where the corpus has content — a delivered pair of empty arrays would
		// satisfy every assertion above while reproducing the exact vacuum the finding is about.
		const creates = capturePolicySeeding().filter((c) => c.commandType === 'CreateAssurancePolicy');
		const items = creates.reduce((n, c) => {
			const p = c.payload as {
				requiredEvidence?: readonly unknown[];
				optionalEvidence?: readonly unknown[];
			};
			return n + (p.requiredEvidence?.length ?? 0) + (p.optionalEvidence?.length ?? 0);
		}, 0);
		expect(items, 'the twelve catalog policies carry DOC-004’s 89 ratified evidence items').toBe(89);
	});
});
