// C-0d — audit the RATIFIED TRIGGER TEXT, the third record of what each command does and the only authoritative one.
//
// C-0c audits two AUTHORED records (`BINDINGS` and the vocab `commands[].drives*` copy). This audits the corpus
// itself: the `trigger` string on a ratified transition, which names the command that performs that arrow. When an
// authored row and a ratified trigger disagree, the trigger wins — so this source outranks both of C-0c's and had
// never been compared to anything.
//
// ⚠ IT REDISCOVERED TWO KNOWN FINDINGS ON ITS FIRST RUN, FROM THE OTHER DIRECTION. REG-F-085 (`CompleteRecomposition`
// COMPOSABLE -> SATISFIED, a target nothing can reach) and REG-F-088 (`ProposeExecutionPlan` skipping PROPOSED) were
// both found by hand, by tripping over them, from the HANDLER side. C-0d derives both from the CORPUS side without
// being told they exist — which is the strongest available evidence that the control measures what it claims to.
import { describe, expect, it } from 'vitest';
import { auditClaims } from './binding-row-truth.js';
import { triggerClaims, triggerCoverage } from './trigger-claim-truth.js';

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
	// ⚠ PINNED DEFECTS. Each row is a ratified arrow whose trigger names a REAL command, and whose SOURCE STATE
	// no object can ever occupy — so canon assigns a command an arrow the command cannot perform.
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

	// REG-F-085, derived here from the corpus rather than from the handler. `CompleteRecomposition`'s ratified
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
