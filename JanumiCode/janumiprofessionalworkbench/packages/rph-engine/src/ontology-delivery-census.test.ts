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
import type { AuthedEngineHandle } from './engine.js';
import { authorProductRealizationPwa, seedAdditivePolicies } from './seed-workbench.js';

/** Capture every command the seeder issues, without an engine — the payload keys are the delivered surface. */
function capturePolicySeeding(): DomainCommand[] {
	const sent: DomainCommand[] = [];
	const handle = {
		ontology,
		dispatch: (command: DomainCommand): CommandResult => {
			sent.push(command);
			return { commandId: command.commandId, status: 'ACCEPTED', producedEventIds: [] };
		}
	} as unknown as AuthedEngineHandle;
	seedAdditivePolicies(handle);
	return sent;
}

/** Capture the PWU-TYPE seeding the same way — `authorProductRealizationPwa` publishes the PWA and defines every
 *  PWU Type, so its `DefinePwuType` payloads are the delivered surface for `pwuTemplates`. */
function captureTemplateSeeding(): DomainCommand[] {
	const sent: DomainCommand[] = [];
	const handle = {
		ontology,
		dispatch: (command: DomainCommand): CommandResult => {
			sent.push(command);
			return { commandId: command.commandId, status: 'ACCEPTED', producedEventIds: [] };
		}
	} as unknown as AuthedEngineHandle;
	authorProductRealizationPwa(handle);
	return sent;
}

/** The union of keys the ontology authors across all PWU TEMPLATES. */
function authoredTemplateKeys(): string[] {
	const keys = new Set<string>();
	for (const t of ontology.pwuTemplates) for (const k of Object.keys(t)) keys.add(k);
	return [...keys].sort((a, b) => a.localeCompare(b));
}

/** The union of keys the seeder puts on its DefinePwuType payloads. */
function deliveredTemplateKeys(): string[] {
	const keys = new Set<string>();
	for (const c of captureTemplateSeeding()) {
		if (c.commandType !== 'DefinePwuType') continue;
		for (const k of Object.keys(c.payload as Record<string, unknown>)) keys.add(k);
	}
	return [...keys].sort((a, b) => a.localeCompare(b));
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

/** `candidateChildren` is optional on `PwuTemplate`, so the generated literal's union does not carry it on every
 *  member. One accessor rather than a cast at each site — a cast per use is how one of them quietly reads
 *  something else. */
const candidateChildrenOf = (t: unknown): readonly string[] =>
	((t as { candidateChildren?: readonly string[] }).candidateChildren ?? []);

/**
 * The template equivalent of `ACCOUNTED_FOR`. Two rows, and both are CHECKED below rather than trusted — the
 * policy census's own notation records that this table once carried a false exemption, so an entry here is a
 * claim with a test behind it.
 */
const TEMPLATE_ACCOUNTED_FOR: Readonly<Record<string, string>> = {
	// ── DELIVERED 2026-08-06, UNDER TRANSFORMED NAMES ─────────────────────────────────────────────────────────
	// These four reached nothing when REG-F-033 measured them. They are now delivered into the ratified PWU_TYPE
	// homes they always had — and the NAMES DIFFER, so a name-level census cannot see the delivery and would go
	// on reporting a gap that is closed. Each row is asserted per kind below; an exemption nobody checks is how
	// this table rots into an allowlist, which is recorded in the policy half of this file as having happened.
	candidateChildren:
		'TRANSFORMED — the composition tree. Delivered as `permittedChildren` + `permittedChildTypeIds`, ' +
		'intersected with the kinds that HAVE a pwuTemplate: the ontology names 63 candidate kinds and 50 have no ' +
		'template, and a kind with no template has no defaultPolicyIds, so publishing it would mint a child type ' +
		'that cannot be assessed (REG-F-029 throws on an undescribed kind).',
	inputs: 'TRANSFORMED — delivered verbatim as PWU_TYPE.requiredInputs.',
	outputArtifactTypes: 'TRANSFORMED — delivered verbatim as PWU_TYPE.requiredOutputs.',
	completionClaims:
		'TRANSFORMED — `completionClaims` is a string[] and `completionRule` a single required string, so the ' +
		'claims are delivered as an explicit CONJUNCTION ("All of: …"). Lossy in SHAPE and not in CONTENT: every ' +
		'claim survives, which is what the per-kind assertion below checks.',
	requiredEvidenceTypes:
		'SUPERSEDED — not homeless. PWU_TYPE has no evidence field and should not gain one: DOC-004 §6.1 makes ' +
		'evidence requirements a property of POLICIES, and a type already names its policies. This 2-4 value ' +
		'summary duplicates, at lower resolution, what those policies now state as §6.1 EvidenceRequirements ' +
		'(REG-E-026, 89 items). The route is checked below: a template\'s declared types must be a SUBSET of what ' +
		'its own policies require.',
	defaultPolicyIds:
		'TRANSFORMED — delivered as `requiredAssurancePolicyIds` via policiesForKind(), which is what replaced the ' +
		'hand-written per-type policy lists. Asserted per kind below.',
	sourceSection:
		'ONTOLOGY-INTERNAL — provenance about the transcription (which corpus section, what is verbatim, what is ' +
		'AUTHORED). It documents the ontology; the runtime governs with the content, not with its citation.'
};

/**
 * Templates whose `requiredEvidenceTypes` names a type NONE of their own `defaultPolicyIds` require.
 *
 * Six of fourteen — the same authored-guess pattern, and nearly the same rate, as the twelve policies REG-E-026
 * measured (6 of 12 named an evidence type no item in their own ratified list supported). It is pinned rather
 * than corrected because correcting it means editing authored governance content to make a check pass; the
 * SUPERSEDED accounting route is honest for the other eight and this is the disclosed remainder.
 *
 * THE MAP MAY SHRINK AND MAY NOT GROW: a new unsupported type reddens, which is the point.
 */
const UNSUPPORTED_EVIDENCE_TYPES: Readonly<Record<string, readonly string[]>> = {
	PRODUCT_REALIZATION: ['ANALYSIS'],
	INTENT_AND_PRODUCT_DEFINITION: ['TRACE'],
	INTENT_DISCOVERY: ['OBSERVATION'],
	ARCHITECTURE_DEFINITION: ['REVIEW'],
	WORK_DECOMPOSITION: ['ANALYSIS'],
	INTEGRATED_PRODUCT_VALIDATION: ['ANALYSIS']
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

	// ── THE SAME QUESTION, ONE OBJECT TYPE OVER: PWU TEMPLATES (REG-F-022's other half) ────────────────────────
	//
	// This file walked `seedPolicies` and nothing else — so 64 authored declarations across FIVE template fields
	// sat outside the very instrument built to find them. That is the lesson REG-E-025 produced the same day, when
	// two `failureClass` fields turned out to be invisible to the enumRef census because they declared no enum:
	// A FIELD IS NOT SAFE BECAUSE THE CENSUS IS QUIET ABOUT IT — it may simply be below the census's floor.
	//
	// The engine's port makes it structural, exactly as it did for policies: `EngineOntology.pwuTemplates` is
	// declared `{ pwuKind, isRoot }` — two members — so no type error was ever available for the other eight.
	describe('PWU TEMPLATES: what the ontology authors vs what authorProductRealizationPwa delivers', () => {
		it('CONTROL: the capture sees real PWU-type seeding', () => {
			const defines = captureTemplateSeeding().filter((c) => c.commandType === 'DefinePwuType');
			expect(defines.length).toBeGreaterThanOrEqual(9);
			expect(
				Object.keys(defines[0]!.payload as Record<string, unknown>).length
			).toBeGreaterThan(5);
			expect(authoredTemplateKeys().length).toBeGreaterThan(5);
		});

		it('EVERY authored template field is now delivered or accounted for', () => {
			const delivered = new Set(deliveredTemplateKeys());
			const unexplained = authoredTemplateKeys().filter(
				(k) => !delivered.has(k) && !(k in TEMPLATE_ACCOUNTED_FOR)
			);
			expect(
				unexplained,
				'AUTHORED PWU-TEMPLATE FIELDS THAT REACH NOTHING — REG-F-033. Deliver, or add a ' +
					'TEMPLATE_ACCOUNTED_FOR row naming the route. "Not yet" is not a route.'
			).toEqual([]);
			// EMPTY SINCE 2026-08-06. This list pinned FIVE fields and 64 declarations. Four are now delivered into
			// the ratified PWU_TYPE homes they always had, and one is superseded by the policies' §6.1
			// requirements. NOTE WHY THE PIN COULD NOT SIMPLY BE DELETED: the delivered names DIFFER from the
			// authored ones (`inputs` -> `requiredInputs`), so this name-level check could not see the delivery —
			// it would have gone on reporting a CLOSED gap as open. Every route is asserted per kind below.
		});

		it('no TEMPLATE_ACCOUNTED_FOR row is stale, and none guards a field the ontology does not author', () => {
			const delivered = new Set(deliveredTemplateKeys());
			expect(Object.keys(TEMPLATE_ACCOUNTED_FOR).filter((k) => delivered.has(k))).toEqual([]);
			const authored = new Set(authoredTemplateKeys());
			expect(Object.keys(TEMPLATE_ACCOUNTED_FOR).filter((k) => !authored.has(k))).toEqual([]);
		});

		it('defaultPolicyIds really IS transformed — the exemption is checked, not asserted', () => {
			// The row claims `defaultPolicyIds` reaches the runtime as `requiredAssurancePolicyIds`. An exemption
			// nobody checks is how a census rots into an allowlist (REG-F-022's own notation), so it is checked.
			const byKind = new Map(
				captureTemplateSeeding()
					.filter((c) => c.commandType === 'DefinePwuType')
					.map((c) => [
						(c.payload as { pwuKind: string }).pwuKind,
						(c.payload as { requiredAssurancePolicyIds?: readonly string[] })
							.requiredAssurancePolicyIds ?? []
					])
			);
			expect(byKind.size).toBeGreaterThan(0);
			for (const [kind, delivered] of byKind) {
				const authored = ontology.pwuTemplates.find((t) => t.pwuKind === kind)?.defaultPolicyIds ?? [];
				expect([...delivered].sort(), `${kind} must deliver its authored defaultPolicyIds`).toEqual(
					[...authored].sort()
				);
			}
		});

		it('the four TRANSFORMED routes actually happened, per kind', () => {
			// The exemptions above are CLAIMS. This is what makes them checkable — the discipline the policy half
			// of this file records as having been violated once already by a row that was asserted, not checked.
			const defines = captureTemplateSeeding().filter((c) => c.commandType === 'DefinePwuType');
			const byKind = new Map(
				defines.map((c) => [(c.payload as { pwuKind: string }).pwuKind, c.payload as Record<string, unknown>])
			);
			expect(byKind.size).toBeGreaterThan(9);
			let checkedInputs = 0;
			let checkedClaims = 0;
			for (const t of ontology.pwuTemplates) {
				const p = byKind.get(t.pwuKind);
				if (!p) continue; // unpublished kinds are accounted for separately
				const tt = t as unknown as Record<string, readonly string[] | undefined>;
				if (tt.inputs?.length) {
					expect(p.requiredInputs, `${t.pwuKind}: inputs -> requiredInputs`).toEqual([...tt.inputs]);
					checkedInputs += 1;
				}
				if (tt.outputArtifactTypes?.length)
					expect(p.requiredOutputs, `${t.pwuKind}: outputArtifactTypes -> requiredOutputs`).toEqual([
						...tt.outputArtifactTypes
					]);
				if (tt.completionClaims?.length) {
					// CONTENT, not shape: every claim must survive the conjunction.
					for (const claim of tt.completionClaims)
						expect(
							String(p.completionRule),
							`${t.pwuKind}: completionClaims -> completionRule dropped a claim`
						).toContain(claim);
					checkedClaims += 1;
				}
			}
			// CONTROL: the loop above skips absent fields, so a run that checked NOTHING would also pass.
			expect(checkedInputs, 'no inputs were actually compared').toBeGreaterThan(5);
			expect(checkedClaims, 'no completion claims were actually compared').toBeGreaterThan(5);
		});

		it('requiredEvidenceTypes is SUPERSEDED — every declared type is one its own policies require', () => {
			// The accounting row claims the template's summary is subsumed by its policies' §6.1 requirements.
			// Checked, because that is the difference between a route and an excuse.
			const evidenceTypesOf = (policyId: string): Set<string> => {
				const pol = ontology.seedPolicies.find((x) => x.policyId === policyId.replace(/_v\d+$/, ''));
				return new Set(
					[...(pol?.requiredEvidence ?? []), ...(pol?.optionalEvidence ?? [])].map((r) => r.evidenceType)
				);
			};
			let checked = 0;
			for (const t of ontology.pwuTemplates) {
				const declared = (t as unknown as { requiredEvidenceTypes?: readonly string[] })
					.requiredEvidenceTypes;
				if (!declared?.length) continue;
				const covered = new Set<string>();
				for (const pid of t.defaultPolicyIds ?? [])
					for (const et of evidenceTypesOf(pid)) covered.add(et);
				const missing = declared.filter((d) => !covered.has(d));
				// ── SIX EXCEPTIONS, MEASURED AND PINNED RATHER THAN EDITED AWAY ────────────────────────────────
				// The SUPERSEDED route holds for 8 of 14 templates. Six declare an evidence type NONE of their own
				// policies require — the SAME authored-guess pattern REG-E-026 measured on the POLICY side, at
				// almost the same rate (6 of 12 there, 6 of 14 here): a 2-4 value summary naming types no ratified
				// item supports.
				//
				// The policy-side field could be REMOVED because §6.1's 89 requirements strictly superseded it.
				// This one has no richer replacement on PWU_TYPE, so it survives — and deleting the six values to
				// make this check pass would be editing authored governance data to satisfy a gate, which is the
				// inversion this register exists to prevent. Disclosed, counted, and held: the map may SHRINK.
				expect(
					missing,
					`${t.pwuKind} declares evidence types its own policies never require: ${missing.join(', ')}`
				).toEqual(UNSUPPORTED_EVIDENCE_TYPES[t.pwuKind] ?? []);
				checked += 1;
			}
			expect(checked, 'no template evidence types were compared').toBeGreaterThan(10);
		});

		// THE ONE THAT IS NOT MERELY UNREAD — IT CONTRADICTS THE TREE THAT SHIPS.
		it('candidateChildren DIVERGES from the published tree, and the divergence is named', () => {
			// A census that only counted "unread fields" would file this as one inert field among five and hide
			// that the shipped composition tree and the authored one disagree. `permittedChildren` comes from a
			// hand-written PWU_TYPES list — the copy that `policiesForKind`'s comment says was supposed to stop
			// existing ("a THIRD copy of content the ontology already carries"). The policy list was fixed; this
			// one was not.
			const defines = captureTemplateSeeding().filter((c) => c.commandType === 'DefinePwuType');
			const kindOf = new Map(
				defines.map((c) => [
					(c.payload as { pwuTypeId: string }).pwuTypeId,
					(c.payload as { pwuKind: string }).pwuKind
				])
			);
			const shippedChildKinds = (pwuKind: string): string[] =>
				(
					defines.find((c) => (c.payload as { pwuKind: string }).pwuKind === pwuKind)?.payload as
						| { permittedChildTypeIds?: readonly string[] }
						| undefined
				)?.permittedChildTypeIds?.map((id) => kindOf.get(id) ?? id) ?? [];

			// The root AGREES — so the divergence below is specific, not "the seed ignores the ontology".
			expect([...shippedChildKinds('PRODUCT_REALIZATION')].sort()).toEqual(
				[
					...candidateChildrenOf(
						ontology.pwuTemplates.find((t) => t.pwuKind === 'PRODUCT_REALIZATION')
					)
				].sort()
			);
			// ARCHITECTURE_DEFINITION does not: it ships ONE child, and that child is not among the ten authored.
			const archAuthored = candidateChildrenOf(
				ontology.pwuTemplates.find((t) => t.pwuKind === 'ARCHITECTURE_DEFINITION')
			);
			const archShipped = shippedChildKinds('ARCHITECTURE_DEFINITION');
			expect(archShipped).toEqual(['ARCHITECTURE_CONCERN']);
			// RESOLVED 2026-08-05. This assertion used to read `.not.toContain('ARCHITECTURE_CONCERN')` with the
			// note "the two lists are not subset-related, they disagree" — a CONTRADICTION, not a narrowing. It is
			// fixed by TRANSCRIPTION, not by weakening the check: RPH-DOC-010 lists "Custom Architecture Concern"
			// among Architecture Definition's permitted children, and the workbench seeds that type and
			// instantiates five of it, so its absence from the authored candidates was the error.
			expect(
				archAuthored,
				'the shipped child must be among the authored candidates — "candidate children" is a menu the PWA ' +
					'selects FROM, so the published tree may narrow it and may never contradict it'
			).toContain('ARCHITECTURE_CONCERN');
			expect(archAuthored).toHaveLength(11);
			// THE GENERAL PROPERTY, now that the contradiction is gone: every shipped child of every type must be
			// an authored candidate of that type. Stated over all types rather than the one that was wrong, so the
			// next divergence is caught wherever it appears.
			for (const c of defines) {
				const kind = (c.payload as { pwuKind: string }).pwuKind;
				const authored = candidateChildrenOf(ontology.pwuTemplates.find((t) => t.pwuKind === kind));
				if (authored.length === 0) continue; // a type authoring no candidates constrains nothing
				for (const child of shippedChildKinds(kind))
					expect(authored, `${kind} ships child ${child}, which it does not author as a candidate`).toContain(
						child
					);
			}
		});

		it('50 of the 62 authored candidate kinds have NO template — which is why wiring it is not the fix', () => {
			// A kind with no pwuTemplate row has no defaultPolicyIds, and `requireGoverningPolicies` THROWS on an
			// undescribed kind (REG-F-029). Deriving permittedChildren from candidateChildren would therefore
			// publish a tree offering 50 child types that cannot be assessed and cannot be driven — trading an
			// inert field for 50 unusable affordances. The number is asserted so the argument stays checkable.
			const templateKinds = new Set<string>(ontology.pwuTemplates.map((t) => t.pwuKind));
			const candidates = new Set(ontology.pwuTemplates.flatMap((t) => candidateChildrenOf(t)));
			expect(candidates.size).toBe(63);
			expect([...candidates].filter((k) => !templateKinds.has(k))).toHaveLength(50);
		});
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
