// C-0c — THE BINDING TABLE'S CLAIMS MUST BE TRUE OF THE HANDLERS, NOT MERELY LEGAL ON THE DIAGRAM.
//
// Five rows shipped wrong (REG-F-068) and every existing control passed on all of them:
//
//   RequestAssuranceAssessment   AssuranceAssessment.disposition (initial) -> PENDING     machine has no such field
//   CompleteAssuranceAssessment  AssuranceAssessment.disposition ASSESSING  -> …          wrong axis, right states
//   RequestAssuranceAssessment   AssuranceAssessment.state       REQUESTED  -> EVIDENCE_PENDING   source unoccupiable
//   CreateBaseline               Baseline.status                 (initial)  -> DRAFT      births at CANDIDATE
//   ProposeDecomposition         DecompositionContract.status    (initial)  -> DRAFT      births at UNDER_REVIEW
//
// `rph-domain/src/binding.test.ts` classified each concrete one LEGAL, correctly — they ARE legal edges of the
// drawing. Legality is not truth. The last two are the plainest: both recorded their machine's declared
// `initialState` as the state the command produces, and in both cases the machine table AND the handler say
// otherwise and AGREE with each other — so no side had to be picked, the row had simply transcribed the arrow's
// source as its target.
//
// ⚠ AND THE AUDITED POPULATION IS BOTH COPIES. The same claim lives twice in the vocab — once as a binding row,
// once as `drivesMachine`/`drivesFrom`/`drivesTo` on the command entry — and THE GENERATOR EMITS ONLY THE FIRST.
// Four of the five defects were in the copy no control had ever read. Auditing only the generated artifact would
// have reported the file clean while the source it is generated from stayed wrong.
import { describe, expect, it } from 'vitest';
import { deadCovered } from './arrow-command-census.js';
import {
	auditClaims,
	bindingClaims,
	resolveToken,
	vocabDriveClaims,
	type TransitionClaim
} from './binding-row-truth.js';

const CLAIMS = [...bindingClaims(), ...vocabDriveClaims()];
const AUDIT = auditClaims(CLAIMS);

/**
 * Machines no claim can be occupancy-checked against, because no handler declares a birth for them.
 *
 * PINNED RATHER THAN SKIPPED. Thirteen of twenty-seven machines are in here — that is half the surface going
 * unchecked, and the number belongs in the open where it can be argued with. It shrinks as births are declared;
 * either direction is a deliberate edit.
 */
const UNANALYSED = [
	'AssuranceObservation.disposition',
	'Constraint.status',
	'Decision.status',
	'ExecutionPlan.status',
	'ExecutionStep.stepState',
	'Harness.status',
	'Intent.intentStatus',
	'Obligation.status',
	'PWA.publicationStatus',
	'PWU.workLifecycleState',
	'PwuType.status',
	'RuntimeBinding.authorizationStatus',
	'Undertaking.status'
];

describe('C-0c — every recorded command→transition claim is true of the handlers', () => {
	it('no claim names a machine the controls have ruled is not a lifecycle', () => {
		expect(AUDIT.excluded, AUDIT.excluded.join('\n')).toEqual([]);
	});

	it('no claim names a machine transitions.data.ts does not declare', () => {
		expect(AUDIT.unknown, AUDIT.unknown.join('\n')).toEqual([]);
	});

	// `binding.test.ts`'s `concreteBinding()` treats "not a state of this machine" as NOT APPLICABLE and skips the
	// row, so a token naming nothing is indistinguishable from a deliberate `(any)`. Here they are separated.
	it('every from/to token names declared states or is a deliberate (marker)', () => {
		expect(AUDIT.unresolved, AUDIT.unresolved.join('\n')).toEqual([]);
	});

	it('no claim moves INTO a state no object can ever be in', () => {
		expect(AUDIT.deadTo, AUDIT.deadTo.join('\n')).toEqual([]);
	});

	it('every creation claim lands where a handler actually declares a birth', () => {
		expect(AUDIT.notABirth, AUDIT.notABirth.join('\n')).toEqual([]);
	});

	// ── THE ONE CHECK THAT IS A COMPARISON, NOT A BASELINE ────────────────────────────────────────────────────
	// C-0's `deadCovered()` already owns "an arrow out of an unoccupiable source is dead", measured from the
	// handler sources, and it currently names five `Assumption.status` arrows (REG-F-071). Pinning those here too
	// would mean fixing one dead arrow required editing two baselines with neither being the authority — the
	// split-population defect `machine-exclusions.ts` exists to end. So this asks the question C-0 cannot: does
	// the VOCAB claim a dead transition the HANDLERS do not even declare? Residue is drift between the records.
	it('claims no dead transition beyond those C-0 already found in the handlers', () => {
		const known = new Set(deadCovered().dead);
		const residue = AUDIT.deadFromArrows.filter((k) => !known.has(k));
		expect(
			residue,
			`the vocab declares dead transitions the handler census does not:\n${residue.join('\n')}`
		).toEqual([]);
	});

	it('pins which machines are NOT occupancy-checkable, so the scope cannot quietly widen or narrow', () => {
		expect(AUDIT.unanalysed, AUDIT.unanalysed.join('\n')).toEqual(UNANALYSED);
	});

	// ── CONTROL 1: THE POPULATION IS REAL, AND BOTH COPIES ARE IN IT ─────────────────────────────────────────
	// Every assertion above passes if the readers return nothing. This one fails in exactly that world — and it
	// fails SPECIFICALLY if the vocab copy is dropped, which is the copy that carried four of the five defects.
	it('CONTROL — both records are read, and the vocab copy is not the generated one', () => {
		const rows = bindingClaims();
		const drives = vocabDriveClaims();
		expect(rows.length).toBeGreaterThan(50);
		expect(drives.length).toBeGreaterThan(50);
		// Not merely non-empty: the vocab copy must be a DIFFERENT set. A reader accidentally pointed at BINDINGS
		// twice would satisfy every count above.
		expect(drives.every((d) => d.source === 'vocab.commands')).toBe(true);
		expect(
			rows.some((r) => r.eventType === 'AssuranceEvidenceRequired'),
			'the second binding row for RequestAssuranceAssessment vanished — one command, two events'
		).toBe(true);
		expect(
			drives.some((d) => d.commandType === 'RequestAssuranceAssessment'),
			'the vocab command-entry copy is not being read'
		).toBe(true);
	});

	// ── CONTROL 2: THE TOKEN RESOLVER STILL REFUSES THINGS ───────────────────────────────────────────────────
	// `unresolved: []` is also what a resolver that accepts EVERYTHING produces. Loosening the marker rule (say,
	// to `includes('(')`) or the alternation rule (to `.some()` instead of `.every()`) would keep every real row
	// green and quietly disable the check. These synthetic inputs redden in that world and only in that world.
	it('CONTROL — resolveToken rejects tokens that name nothing', () => {
		expect(resolveToken('Assumption.status', 'PROPOSED')).toBe('state');
		expect(resolveToken('Assumption.status', 'PROPOSED|DISCLOSED')).toBe('alternation');
		expect(resolveToken('Assumption.status', '(any)')).toBe('marker');
		expect(resolveToken('Assumption.status', 'NOT_A_STATE')).toBe('unresolved');
		// One real part is not enough — the row claims BOTH are reachable sources.
		expect(resolveToken('Assumption.status', 'PROPOSED|NOT_A_STATE')).toBe('unresolved');
		expect(resolveToken('No.Such.Machine', 'PROPOSED')).toBe('unresolved');
	});

	// ── CONTROL 3: THE INSTRUMENT CATCHES THE FIVE DEFECTS IT WAS BUILT FOR ──────────────────────────────────
	// The sharpest control available: feed the five historical rows back in VERBATIM and require each to land in
	// the right bucket. This cannot be satisfied by an empty population, a permissive resolver, or an occupancy
	// map that says everything is reachable — and if a future edit relaxes any single check, exactly the row that
	// check was built for reappears here.
	it('CONTROL — the five REG-F-068 rows are each still detected, in the right bucket', () => {
		const claim = (o: Partial<TransitionClaim>): TransitionClaim => ({
			source: 'BINDINGS',
			commandType: 'X',
			eventType: 'Y',
			machine: '',
			from: '',
			to: '',
			...o
		});
		const a = auditClaims([
			claim({ machine: 'AssuranceAssessment.disposition', from: '(initial)', to: 'PENDING' }),
			claim({ machine: 'AssuranceAssessment.disposition', from: 'ASSESSING', to: 'SATISFIED' }),
			claim({ machine: 'AssuranceAssessment.state', from: 'REQUESTED', to: 'EVIDENCE_PENDING' }),
			claim({ machine: 'Baseline.status', from: '(initial)', to: 'DRAFT' }),
			claim({ machine: 'DecompositionContract.status', from: '(initial)', to: 'DRAFT' })
		]);
		expect(a.excluded.length, 'the retired disposition axis is no longer refused').toBe(2);
		expect(a.deadFrom.length, 'REQUESTED is no longer seen as unoccupiable').toBe(1);
		expect(a.deadTo.length, 'the two DRAFT landings are no longer seen as unoccupiable').toBe(2);
		expect(a.notABirth.length, 'the birth check no longer distinguishes initialState from a real birth').toBe(
			2
		);
		// And the arrow key really is the one C-0 would use, or the subset comparison above is comparing nothing.
		expect(a.deadFromArrows).toContain('AssuranceAssessment.state  REQUESTED -> EVIDENCE_PENDING');
	});
});
