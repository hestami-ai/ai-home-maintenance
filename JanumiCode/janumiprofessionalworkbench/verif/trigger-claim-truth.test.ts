// C-0d — audit the TRANSITION TRIGGER TEXT, a third record of what each command does that nothing had compared.
//
// ⚠⚠ THIS HEADER CLAIMED THE TRIGGER IS "the only authoritative one" AND THAT "the trigger wins". CORRECTED THE
// SAME DAY: that holds for 3 machines of 27. `m2-transitions.json` records provenance per machine, and for 18 the
// transitions are an author's RECONSTRUCTION — states verbatim, arrows and triggers inferred from events +
// commands + invariants, with "NO explicit matrix". See the provenance pins below and `trigger-claim-truth.ts`.
//
// C-0c audits two AUTHORED records (`BINDINGS` and the vocab `commands[].drives*` copy). This audits a third. On
// the 3 VERBATIM machines it is the corpus speaking and it does outrank them; on the other 24 it is a third
// opinion — still worth auditing, because three records disagreeing is evidence even when none is authoritative.
//
// ⚠ IT REDISCOVERED TWO KNOWN FINDINGS ON ITS FIRST RUN, FROM THE OTHER DIRECTION. REG-F-085 (`CompleteRecomposition`
// COMPOSABLE -> SATISFIED, a target nothing can reach) and REG-F-088 (`ProposeExecutionPlan` skipping PROPOSED) were
// both found by hand, by tripping over them, from the HANDLER side. C-0d derives both from the CORPUS side without
// being told they exist — which is the strongest available evidence that the control measures what it claims to.
import { STATE_MACHINES } from '@janumipwb/rph-domain';
import { describe, expect, it } from 'vitest';
import { auditClaims } from './binding-row-truth.js';
import { provenanceOf, provenanceOfArrow, triggerClaims, triggerCoverage } from './trigger-claim-truth.js';

const AUDIT = auditClaims(triggerClaims());

describe('C-0d — every arrow the ratified trigger text assigns to a command', () => {
	// ⚠ PARTIAL COVERAGE, PINNED RATHER THAN IMPLIED. Most triggers are prose ("Missing information", "Begin
	// discovery") and name no command, so they yield no claim. That is fine — what is not fine is a claim
	// extractor that quietly thins its own population, which is exactly what REG-F-087 measured in the arrow
	// census (115 of 304 arrows read, behind a control that could only detect total death). Stated as a number
	// so a change in what the extractor understands cannot pass as a change in what the corpus says.
	it('PINNED — how much of the ratified trigger surface yields a claim at all', () => {
		expect(triggerCoverage()).toEqual({
			transitions: 304,
			withTrigger: 304,
			namingAKnownCommand: 68,
			claims: 70
		});
	});

	it('no trigger claim names a machine the controls have ruled is not a lifecycle', () => {
		// Both entries are AssuranceAssessment.disposition, an excluded machine — the exclusion is C-0c's and is
		// inherited deliberately rather than re-litigated here.
		expect(AUDIT.excluded).toHaveLength(2);
	});

	it('every state token in a ratified trigger resolves to a declared state', () => {
		expect(AUDIT.unknown, AUDIT.unknown.join('\n')).toEqual([]);
		expect(AUDIT.unresolved, AUDIT.unresolved.join('\n')).toEqual([]);
	});

	// ── THE FINDING THIS CONTROL EXISTS TO HOLD ──────────────────────────────────────────────────────────────
	// ⚠ PINNED DEFECTS. Each row is a DECLARED arrow whose trigger names a REAL command, and whose SOURCE STATE no
	// object can ever occupy — so the machine assigns a command an arrow the command cannot perform.
	//
	// ⚠ ORIGINALLY WRITTEN AS "canon assigns". IT DOES NOT: all three sit on machines whose transitions are
	// RECONSTRUCTED or merely drawn, never VERBATIM (see the provenance pins below). The dead arrow is REAL either
	// way — the source state is measurably unoccupiable — but WHO IS WRONG is undecided: the handler, or the
	// reconstruction that posited a state the handler never uses.
	//
	// The cause is REG-F-071, already known: `initialState` is a fiction on several machines because creation
	// births PAST the first state (DecompositionContract DRAFT->born UNDER_REVIEW, ExecutionPlan PROPOSED->born
	// UNDER_REVIEW, AssuranceAssessment REQUESTED->born EVIDENCE_PENDING|READY). What was NOT recorded is this
	// CONSEQUENCE: REG-F-071 said the declaration lies; nobody then asked which ratified arrows it kills.
	// Three, and each names a command in its own trigger. REG-F-089.
	it('PINNED DEFECT — ratified arrows whose command cannot reach the source state', () => {
		expect(AUDIT.deadFrom, AUDIT.deadFrom.join('\n')).toEqual([
			'ratified.trigger: CancelAssuranceAssessment -> (no event) : AssuranceAssessment.state REQUESTED -> CANCELLED  [from REQUESTED is never occupied]',
			'ratified.trigger: ProposeDecomposition -> (no event) : DecompositionContract.status DRAFT -> UNDER_REVIEW  [from DRAFT is never occupied]',
			'ratified.trigger: ProposeExecutionPlan -> (no event) : ExecutionPlan.status PROPOSED -> UNDER_REVIEW  [from PROPOSED is never occupied]'
		]);
	});

	// REG-F-085, derived here from the machine rather than from the handler. `CompleteRecomposition`'s declared
	// arrow lands in a contract state no command can produce — which is precisely why W-4.6's
	// `CompletePwuRecomposition` cannot cite "Recomposition contract satisfied" and stays blocked.
	it('PINNED DEFECT — ratified arrows landing in a state nothing can occupy', () => {
		expect(AUDIT.deadTo, AUDIT.deadTo.join('\n')).toEqual([
			'ratified.trigger: CompleteRecomposition -> (no event) : RecompositionContract.status COMPOSABLE -> SATISFIED  [to SATISFIED is never occupied]'
		]);
	});

	it('no ratified creation trigger lands where no handler declares a birth', () => {
		expect(AUDIT.notABirth, AUDIT.notABirth.join('\n')).toEqual([]);
	});

	// Inherited blindness, not new: PWU is invisible to both census readers (REG-F-086/087) and ExecutionStep is
	// not an aggregate. Pinned so this control's scope cannot widen or narrow unnoticed either.
	it('PINNED — which machines C-0d still cannot occupancy-check', () => {
		expect(AUDIT.unanalysed).toEqual([
			'ExecutionStep.stepState',
			'PWU.executionState',
			'PWU.workLifecycleState'
		]);
	});

	// ── PROVENANCE: THE CORRECTION THAT COST THIS CONTROL ITS AUTHORITY CLAIM ────────────────────────────────
	// Shipped asserting the trigger is "the corpus itself" and outranks the authored rows. `m2-transitions.json`
	// records provenance per machine, and for 18 of 27 the transitions are an author's RECONSTRUCTION — the states
	// verbatim, the arrows and triggers inferred from events + commands + invariants, with "NO explicit matrix".
	it('PINNED — how many machines carry VERBATIM transitions, and how many ARROWS do', () => {
		const byMachine: Record<string, number> = { VERBATIM: 0, RECONSTRUCTED: 0, OTHER: 0 };
		for (const m of Object.keys(STATE_MACHINES as Record<string, unknown>)) byMachine[provenanceOf(m)]! += 1;
		expect(byMachine, 'machine-level, from each machine sourceSection').toEqual({
			VERBATIM: 3,
			RECONSTRUCTED: 18,
			OTHER: 6
		});

		// ⚠ ARROW-LEVEL IS THE HONEST NUMBER, and it is finer than the machine-level one: a machine whose
		// sourceSection says RECONSTRUCTED can still carry individually-cited arrows, and vice versa. 60% of the
		// ratified arrow surface is an author's reconstruction.
		const M = STATE_MACHINES as unknown as Record<string, { transitions: { from: string; to: string }[] }>;
		const byArrow: Record<string, number> = { VERBATIM: 0, RECONSTRUCTED: 0, OTHER: 0 };
		for (const [name, m] of Object.entries(M))
			for (const t of m.transitions) byArrow[provenanceOfArrow(name, t.from, t.to)]! += 1;
		expect(byArrow, 'arrow-level, from each transition note').toEqual({
			VERBATIM: 97,
			RECONSTRUCTED: 182,
			OTHER: 25
		});
	});

	// ⚠ THE FINDING THAT MATTERS MORE THAN THE FOUR ROWS THEMSELVES: **not one of the divergences C-0d found sits
	// on a VERBATIM machine.** So none of them indicts canon. Each indicts either the handler or the reconstruction,
	// and a build agent cannot say which — which is a weaker claim than REG-F-088/089 originally made, and the
	// honest one. If a divergence EVER appears on a verbatim machine this reddens, and that one WOULD indict the
	// handler outright: it is the case worth waking someone for.
	it('PINNED — no current divergence sits on a machine whose transitions are VERBATIM', () => {
		const offending = [...AUDIT.deadFrom, ...AUDIT.deadTo]
			.map((row) => /: ([A-Za-z]+\.[A-Za-z]+) /.exec(row)?.[1])
			.filter((m): m is string => Boolean(m));
		expect(offending.length, 'if this is 0 the row-parse broke and the assertion below is vacuous').toBe(4);
		expect(
			offending.filter((m) => provenanceOf(m) === 'VERBATIM'),
			'a divergence on a VERBATIM machine indicts the handler outright — escalate it, do not just pin it'
		).toEqual([]);
	});

	// ── CONTROL: THE PROVENANCE READER WORKS ─────────────────────────────────────────────────────────────────
	// ⚠ ITS FIRST VERSION RETURNED 'OTHER' FOR ALL 27, because `machines` is an ARRAY and it read it as a map. A
	// uniform negative is indistinguishable from a real one; the ONLY thing that caught it was checking a machine
	// whose answer I already knew. Fourth instrument failure of the day — same remedy each time.
	it('CONTROL — provenanceOf returns VERBATIM for a machine known to be verbatim', () => {
		expect(provenanceOf('PWU.workLifecycleState'), 'source: "§8.1 primary (VERBATIM)"').toBe('VERBATIM');
		// The arrow-level reader needs its OWN control: it resolves a row by splitting `from` on '/', and a bug
		// there would silently fall back to the machine answer for every multi-source arrow.
		expect(
			provenanceOfArrow('PWU.workLifecycleState', 'SHAPING', 'READY'),
			'an individually-cited arrow'
		).toBe('VERBATIM');
		expect(
			provenanceOfArrow('PWU.shapeIntegrityState', 'AT_RISK', 'VIOLATED'),
			"a MULTI-SOURCE row ('PRESERVED/AT_RISK -> VIOLATED') must resolve, not fall through"
		).toBe('RECONSTRUCTED');
		expect(provenanceOf('ExecutionPlan.status'), 'source says transitions RECONSTRUCTED').toBe('RECONSTRUCTED');
	});

	// ── CONTROL 1: THE POPULATION IS REAL ────────────────────────────────────────────────────────────────────
	// Every assertion above passes if `triggerClaims()` returns nothing — the empty audit is clean by definition.
	// This fails in exactly that world, and asserts breadth rather than a bare count so a single surviving claim
	// cannot hold it up.
	it('CONTROL — the extractor actually resolved claims across many machines and commands', () => {
		const claims = triggerClaims();
		expect(claims.length, 'an empty claim set makes every assertion above vacuous').toBeGreaterThan(50);
		expect(new Set(claims.map((c) => c.machine)).size, 'claims span machines').toBeGreaterThan(5);
		expect(new Set(claims.map((c) => c.commandType)).size, 'claims span commands').toBeGreaterThan(25);
		expect(claims.every((c) => c.source === 'ratified.trigger')).toBe(true);
	});

	// ── CONTROL 2: THE NON-COMMAND EXCLUSION IS DERIVED, NOT LISTED ──────────────────────────────────────────
	// `policySemanticVersion` matches the lowerCamelCase shape and is a FIELD, not a command. It is excluded by
	// checking the command registry rather than by naming it — so a future false positive of the same kind is
	// excluded too, without anyone remembering. Asserted because a hand-written exclusion list is the artefact
	// this repository keeps having to retire, and because the derivation is invisible when it works.
	it('CONTROL — a command-shaped token that is not a command yields no claim', () => {
		const claims = triggerClaims();
		expect(claims.some((c) => /policySemanticVersion/i.test(c.commandType))).toBe(false);
		// And the positive half: a token that IS a command does yield one, so the filter is not simply rejecting
		// everything — the failure mode that would make the line above pass for the wrong reason.
		expect(claims.some((c) => c.commandType === 'ProposeExecutionPlan')).toBe(true);
	});
});
