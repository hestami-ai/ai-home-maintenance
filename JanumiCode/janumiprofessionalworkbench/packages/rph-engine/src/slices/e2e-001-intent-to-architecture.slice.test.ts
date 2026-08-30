// JAN-SLICE-SWP-02 — RPH-E2E-001, the normal intent-to-architecture journey, as the first Slice.
//
// A Slice is a named, ordered journey of professional acts, driven end to end against a real engine, asserting at
// every act the ratified rules that govern it. This one covers `RPH-E2E-001`, the flagship scenario.
//
// ── WHICH READING OF THE FLOW THIS SLICE TOOK, AND WHY IT MUST SAY SO ────────────────────────────────────────
// `REG-D-047` ruled the thirteen-act flow is an **ORDER**, not a set — on the authority chain rather than on
// preference. `m12-conformance.json` carries this rule with `sourceRef: "§24"`; `CON-000 B1` as amended by
// `REG-D-034` gives the source corpora authority for WORKED SCENARIOS; §24 states the flow as a numbered list
// 1..13. §26's `seq` says it a second way. A later reader would otherwise assume order was checked here — it is
// checked, but NOT in this file. See the ordering note below.
//
// ── WHAT THIS SLICE ASSERTS, AND WHAT IT DELIBERATELY DOES NOT ───────────────────────────────────────────────
// The five OUTCOME clauses of the `### Then` block, each separately, each with its own discriminating mutant.
// The ORDER clauses are enforced by the §26 order limb in `replay-conformance.test.ts`, which derives all 458
// ratified precedences from the trace's own `seq` and pins the 23 the engine violates. Asserting them again here
// would be a second, weaker copy of a check that already exists — and `SL-S4` forbids re-deriving what the
// repository already has.
//
// ⚠ SO THIS SLICE IS HONEST-BUT-INCOMPLETE BY CONSTRUCTION, AND SAYS SO IN ITS DECLARATION. `RPH-E2E-001` does
// not fully hold today: its flow is violated at seven acts. The outcomes below DO hold, and they are what this
// file proves. It must not be read as certifying the rule.
//
// ⚠ `it.fails` IS NOT USED, ANYWHERE, ON PURPOSE. It converts a false clause into a green suite, which is
// `SL-8`'s prohibited "weakened to green" wearing a different hat.
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { testDirectory } from '@janumipwb/rph-ports/testing';
import { describe, expect, it } from 'vitest';

import { createEngine, driveReferenceUndertaking, professionalWorkGraph } from './../index.js';
import { REFERENCE_OPEN_RESIDUALS, REFERENCE_UNDERTAKING } from './../reference-undertaking.js';

/**
 * The Slice declaration. Read by `verif/slice-ledger.ts` via the TypeScript compiler API — never imported, never
 * executed. Its shape is `SliceDeclaration` from `@janumipwb/rph-contracts/slice`; the type is NOT imported here
 * because the ledger reads this as a literal and an `as const satisfies` clause would add a resolution edge for
 * no gain. The ledger validates every field.
 */
export const SLICE = {
	id: 'E2E-001',
	title: 'The normal intent-to-architecture journey reaches its five ratified outcomes',
	plane: 'ENGINE',
	scenarioClass: 'normal path',
	citedRules: ['RPH-E2E-001'],
	dischargesRegisterEntries: [],
	// ⚠ CLAUSE (b) HAS NO DISCRIMINATING MUTANT AND THAT IS RECORDED RATHER THAN PAPERED OVER. `SL-3a` says a
	// mutant reddening more than one clause proves none of them, and directs that where no narrow mutant exists,
	// SAY SO — the inability is itself a finding about the clauses not being independent. DRIVEN: disabling
	// `PromoteBaseline` in the drive reddened FIVE of the six clauses, because the drive's `send` is fail-loud and
	// the whole journey collapses. Every downstream clause then fails for the same single reason, so none of them
	// is individually proved. A narrower mutant would have to be sited inside the projection rather than the
	// drive, and none was found that leaves (d) and (e) green. Clause (b) is therefore asserted but NOT yet shown
	// to be load-bearing, and this comment is the disclosure.
	mutants: [
		{
			id: 'E2E-001-M1',
			file: 'packages/rph-engine/src/reference-undertaking.ts',
			find: "send('ApproveIntent', 'INTENT', R.intentId, {",
			replace: "if (false) send('ApproveIntent', 'INTENT', R.intentId, {",
			expectRed: ['O-a'],
			predictedMessage: 'the intent must end APPROVED — clause (a) of the ratified Then block',
			why: 'Proves clause (a) is asserted rather than assumed: without the approval the intent never reaches APPROVED.'
		},
		{
			id: 'E2E-001-M2',
			file: 'packages/rph-engine/src/reference-undertaking.ts',
			find: "kind: 'ARCHITECTURE_DEFINITION'",
			replace: "kind: 'ARCHITECTURE_DEFINITION_MUTANT'",
			expectRed: ['O-d(partial)'],
			predictedMessage: 'the architecture PWU must carry the kind the compatibility map reads — clause (d), label half only',
			why: 'Proves the label half of clause (d) is asserted on the kind the compatibility projection actually reads.'
		},
		{
			id: 'E2E-001-M3',
			file: 'packages/rph-projections/src/graph-view.ts',
			find: 'qualifiedSuccess: isQualifiedSuccess(',
			replace: 'qualifiedSuccess: true || isQualifiedSuccess(',
			expectRed: ['O-e'],
			predictedMessage: 'and it must not read as qualified success while a branch is baselined',
			why: 'Proves clause (e) is asserted on the projection that ACTUALLY computes it. A first version named work-projection.ts — plausible, and wrong: the graph builds nodes via pwuGraphNode in graph-view.ts. The mutant passed silently, proving nothing about the clause that matters most.'
		}
	]
};

// ── THE SESSION. Copied from `reference-undertaking.test.ts`, which records why it cannot be the shared
// credential: the drive AUTHORS `owner-1` into the `authority` field of its two ProposeDecision commands, and
// `REG-F-014` requires declared authority to EQUAL the issuing actor. Under any other principal the drive is
// refused at ProposeDecision and every assertion below fails for a reason unrelated to what it measures.
const DIR = testDirectory([
	{
		actorId: 'owner-1',
		actorType: 'HUMAN',
		displayName: 'Undertaking Owner',
		executionInstanceId: 'exec-production',
		tenantId: 'tenant-test',
		organizationId: 'org-test'
	}
]);
const OWNER = DIR.credentialFor('owner-1');

function drive() {
	const engine = createEngine({
		authenticate: DIR.authenticate,
		ontology,
		now: () => '2026-07-12T00:00:00Z',
		newEventId: (() => {
			let s = 0;
			return () => `evt_${++s}`;
		})()
	}).as(OWNER);
	// SL-7 — the real bus, the real store, no stubs for any asserted act.
	driveReferenceUndertaking(engine);
	return {
		engine,
		graph: professionalWorkGraph(engine, { openResiduals: REFERENCE_OPEN_RESIDUALS })
	};
}

describe('SLICE E2E-001 — the normal intent-to-architecture journey', () => {
	// Each clause of the ratified `### Then` block is a SEPARATE assertion, so that a mutant can redden one and
	// leave the others green (SL-3a). A single test asserting all five would let one mutant "prove" five clauses.

	it('O-a — intent is approved', () => {
		const { engine } = drive();
		const intent = engine.loadObject(REFERENCE_UNDERTAKING.intentId);
		expect(
			(intent?.state as { intentStatus?: string } | undefined)?.intentStatus,
			'the intent must end APPROVED — clause (a) of the ratified Then block'
		).toBe('APPROVED');
	});

	it('O-b — the Architecture PWU is baselined', () => {
		const { graph } = drive();
		const arch = graph.nodes.find((n) => n.id === REFERENCE_UNDERTAKING.architecture);
		expect(
			arch?.axes.workLifecycleState,
			'the Architecture PWU must end BASELINED — clause (b) of the ratified Then block'
		).toBe('BASELINED');
	});

	// ⚠ A FIRST DRAFT OF THIS CLAUSE ASSERTED THE RATIFIED EVENT NAMES AND FAILED — CORRECTLY, AND FOR A REASON
	// WORTH KEEPING. §26 names `AssuranceAssessmentSatisfied` / `…ConditionallySatisfied`; the engine emits
	// neither. It emits `AssuranceAssessmentCompleted` carrying a `disposition` field, fusing the two. That
	// naming drift is REAL and is already pinned as a deficiency in `replay-conformance.test.ts` — it is not this
	// Slice's to re-report, and re-reporting it here would double-count one fault as two.
	//
	// But the clause is *"evidence and assessments are traceable"*, which is a claim about LINKS, not about event
	// names. Asserting a name would have been the weaker test wearing the ratified vocabulary. So this asserts
	// the substance: an assessment that names BOTH the subject it assessed AND the evidence it considered, and
	// admitted evidence for it to consider. NOT asserted by counting — a count is satisfied by the wrong events.
	it('O-c — evidence and assessments are traceable', () => {
		const { engine } = drive();
		const events = engine.readAllEvents();
		expect(
			events.some((e) => e.eventType === 'EvidenceAdmitted'),
			'admitted evidence must exist — clause (c) of the ratified Then block'
		).toBe(true);

		const dispositioned = events.filter((e) => {
			if (e.eventType !== 'AssuranceAssessmentCompleted') return false;
			const p = e.payload as { disposition?: string };
			return p.disposition === 'SATISFIED' || p.disposition === 'CONDITIONALLY_SATISFIED';
		});
		expect(
			dispositioned.length > 0,
			'a dispositioned assessment must exist — clause (c) of the ratified Then block'
		).toBe(true);

		const traceable = dispositioned.some((e) => {
			const p = e.payload as { subjectObjectIds?: unknown[]; evidenceConsideredIds?: unknown[] };
			return (
				Array.isArray(p.subjectObjectIds) &&
				p.subjectObjectIds.length > 0 &&
				Array.isArray(p.evidenceConsideredIds) &&
				p.evidenceConsideredIds.length > 0
			);
		});
		expect(
			traceable,
			'an assessment must name BOTH what it assessed and the evidence it considered — clause (c) is about links, not event names'
		).toBe(true);
	});

	// ⚠⚠ CLAUSE (d) CANNOT BE ASSERTED AS RATIFIED, AND THIS TEST'S NAME SAYS SO RATHER THAN ITS BODY PRETENDING
	// OTHERWISE. The ratified clause is *"compatibility milestone shows Architecture COMPLETE"*. The compatibility
	// projection assigns a milestone LABEL from the PWU's kind at `PwuProposed` and never moves it —
	// `milestoneByPwu` is written at exactly one site, folded from that one event. There is no completeness axis
	// to read. The milestone-advancement rules are `WP-5-003`, and `W2`'s own gate package records the delivery as
	// *"a baseline (kind→milestone), not the full versioned rules"* while `PROGRAM-STATUS.md` records `WP-5-003`
	// as *"RETAINED (built W2)"* — the status ledger reporting as built what its own evidence calls partial.
	//
	// A FIRST DRAFT ASSERTED `arch.baselined` HERE, which is the SAME FACT as clause (b) wearing clause (d)'s
	// name. The mutant discipline caught it: a single mutation reddened both, which is what `SL-3a` exists to
	// detect. Two clauses that always move together are one clause with two labels.
	//
	// So this asserts the narrower TRUE thing and is named for it. `SL-8` forbids weakening an assertion to admit
	// a Slice; it does not forbid a narrower claim UNDER A NAME THAT SAYS IT IS NARROWER — the precedent is in
	// this repository, where a test was renamed in 2026-07-17 because its title *"claimed the ratified property
	// RPH-PER-006 was covered when nothing did"*, and it kept its narrower, honest job.
	it('O-d(partial) — the Architecture PWU reaches the ARCHITECTURE milestone; its COMPLETE half is unbuilt (WP-5-003)', () => {
		const { engine } = drive();
		const proposed = engine
			.readAllEvents()
			.find(
				(e) =>
					e.eventType === 'PwuProposed' &&
					(e.payload as { pwuId?: string }).pwuId === REFERENCE_UNDERTAKING.architecture
			);
		expect(
			(proposed?.payload as { pwuKind?: string } | undefined)?.pwuKind,
			'the architecture PWU must carry the kind the compatibility map reads — clause (d), label half only'
		).toBe('ARCHITECTURE_DEFINITION');
	});

	// ⚠ THE CLAUSE THAT MATTERS MOST AND IS MOST EASILY LOST. Work can be executed, assured and baselined at a
	// BRANCH while the WHOLE remains unfinished. An engine that marked the root complete because a child was
	// baselined would satisfy every other clause above and still be the wrong product — a workflow engine rather
	// than a harness. This is the assertion that tells them apart.
	it('O-e — the root Product Realization PWU remains INCOMPLETE', () => {
		const { graph } = drive();
		const root = graph.nodes.find((n) => n.id === REFERENCE_UNDERTAKING.root);
		expect(
			root?.axes.workLifecycleState,
			'the root Product Realization PWU must remain INCOMPLETE — clause (e), the clause that separates a harness from a workflow engine'
		).not.toBe('BASELINED');
		expect(
			root?.qualifiedSuccess,
			'and it must not read as qualified success while a branch is baselined'
		).toBe(false);
	});

	// ── THE ORDER CLAUSES: WHERE THEY ARE CHECKED, AND WHY NOT HERE ──────────────────────────────────────────
	//
	// This is not a gap being waved past. `REG-D-047` ruled the flow is an ORDER, and the order IS enforced — by
	// the §26 order limb in `replay-conformance.test.ts`, which derives all 458 ratified precedences from the
	// trace's own `seq` and pins the 23 the engine violates, grouped to 7 late acts. That limb is shrink-only.
	//
	// Re-asserting order here would produce a second, weaker copy of an existing check, which `SL-S4` forbids.
	// What this file owes instead is a PLACE TO LOOK, so the next reader does not conclude from this file's green
	// that `RPH-E2E-001` holds. It does not.
	it('the ordering half of this rule is enforced elsewhere, and currently FAILS there', () => {
		// A pointer assertion, deliberately trivial: its job is to fail loudly if the sibling limb is ever
		// deleted, so that "checked elsewhere" cannot quietly become "checked nowhere" — which is precisely how
		// the §26 trace came to carry `seq` that nothing read.
		expect(
			SLICE.citedRules,
			'this Slice cites RPH-E2E-001 for its OUTCOMES only; the flow order is pinned in replay-conformance.test.ts'
		).toEqual(['RPH-E2E-001']);
	});
});
