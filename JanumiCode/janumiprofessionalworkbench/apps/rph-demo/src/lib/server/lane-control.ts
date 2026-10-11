// ⭐⭐ THE LANE CONTROL — what the gate's green lane may and may not be green ON (`JAN-CRITREAD` J1-3;
// `DESIGN-what-the-tests-prove.md` §4.8; `REG-D-072` D8).
//
// In test engines the declared stand-in answers the reasoning review with the checker's real judgements plus a
// remainder the TEST stipulates. That is the one permission the lane has (`REG-D-071` Q5), and this module checks
// that it is the only one used. It judges every POSITIVE `floor.reasoning-review` completion on the lane:
//
// · LIMB 1 — one completed under the declared stand-in rests on at least one STIPULATED and at least one
//   EVALUATED mandatory row, and on a REGISTRATION for its PWA and arm, read from the server's registry (which a
//   reset discards). So a stipulation over a subject nobody read, a completion with no real judgement, and a
//   stand-in that stipulates for a PWA nobody registered each redden.
// · LIMB 2 — no other positive `floor.reasoning-review` exists on the lane. The reference seed's hand-written one is
//   excluded BY POSITION — a mark taken after every seed — never by a name a writer could copy.
// · ⭐ LIMB 3 (`JAN-EXEC` Phase 7 completion E2; `REG-F-523`; `REG-D-110` (3)) — a POSITIVE declared-policy completion under
//   the declared stand-in rests on a `DECLARED_POLICY` registration for its unit's PWA, and every mandatory row it records
//   is STIPULATED: that stand-in has no checker, so a row it recorded other than as a stipulation is a judgement nobody
//   made. ⚠ It asks no EVALUATED row, as limb 1 does: nothing in this lane judges a declared policy, and the record says so.
// · ⭐ LIMB 4 (`E12F` F11, the E12 package review's eleventh finding) — LIMB 2's DECLARED COUNTERPART: no other positive
//   verdict of a DECLARED policy exists on the lane. A positive completion of a policy its subject work unit declares (the
//   kernel's one reading of a declaration, `declaredAssurancePolicyIds`) under any validator but the declared stand-in's —
//   the model reviewer, which this lane never runs, or the pre-E2 sign-off, which judged nothing — is an undisclosed pass.
//   ⛔ Limb 3 asked only of the stand-in's completions, so such a pass went unseen.
//
// ── WHY THE SERVER COMPUTES IT (`REG-D-072` D8) ─────────────────────────────────────────────────────────────────
// The design put this in a per-test fixture teardown. Three things refute that: `retries: 1` turns a violation that
// passes on retry into exit 0; a server action can finish after the teardown's read; and no mark existed after the
// boot seed, so a run whose first spec never resets had no baseline at all. So the SERVER checks each SEGMENT of the
// event log between reset marks — at every reset, and at a final call from `globalTeardown` — and KEEPS what it
// finds, across resets and retries. `globalTeardown` fails the run if anything was kept. The fixture still checks
// the open segment after each test, so a violation is attributed to the test that produced it.
//
// ── WHAT IT READS ───────────────────────────────────────────────────────────────────────────────────────────────
// The canonical log after the segment's mark, and each STAGED authoring candidate's own events (a candidate is a
// fork: its log is canonical's at the fork plus its own, and only its own are new). ⚠ A candidate DISCARDED inside a
// test is gone before any check can read it — the population is canonical and staged, as the design names it.
//
// ⛔ THE THREAT MODEL: an undisclosed pass arising from a regression in the product, the stand-in or the lane's
// configuration. A spec author deliberately forging records is a code-review matter.
import { BLOCKING_SEVERITIES, FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import { declaredAssurancePolicyIds } from '@janumipwb/rph-domain';
import type { DomainEvent } from '@janumipwb/rph-contracts';
import type { StoredObject } from '@janumipwb/rph-ports';
import { STANDIN_VALIDATOR_ID } from './assurance/standin-reasoning-review-validator.js';
import { STANDIN_DECLARED_REVIEW_VALIDATOR_ID } from './assurance/declared-policy-review.js';
import {
	workProductPwaOf,
	workUnitPwaOf,
	type StipulableFraming,
	type StipulationRegistration
} from './stipulations.js';

/** A disposition Gate E reads as positive — the ones that could pass as a verdict. */
const POSITIVE = new Set(['SATISFIED', 'CONDITIONALLY_SATISFIED']);

/** One place the lane's records live during a segment: canonical, or one staged candidate. */
export interface LaneSource {
	/** `canonical`, or `candidate of <pwaId>`. */
	readonly where: string;
	/** This segment's events there, in log order: canonical's after the mark; a candidate's OWN. */
	readonly events: readonly DomainEvent[];
	/** Reads an object on that source's engine — the policy, the subject and the subject's chain. */
	readonly loadObject: (id: string) => StoredObject | undefined;
}

/** What the lane control found wrong with one positive reasoning-review completion. */
export interface LaneFinding {
	readonly limb: 1 | 2 | 3 | 4;
	readonly where: string;
	readonly assessmentId: string;
	readonly validatorId: string;
	readonly disposition: string;
	readonly subjectId: string;
	readonly reason: string;
}

interface Completion {
	readonly assessmentId: string;
	readonly assurancePolicyId?: string;
	readonly disposition?: string;
	readonly validatorId?: string;
	readonly subjectObjectIds?: readonly string[];
}

/** The PWA and arm a completion's subject answers to, or `undefined` when no registration could name it. */
function armOf(
	source: LaneSource,
	subjectId: string
): { pwaId: string; framing: StipulableFraming } | undefined {
	const subject = source.loadObject(subjectId);
	if (subject?.objectType === 'PROFESSIONAL_WORK_ARCHITECTURE')
		return { pwaId: subjectId, framing: 'PWA_GRAPH' };
	if (subject?.objectType !== 'ARTIFACT') return undefined;
	const pwaId = workProductPwaOf(source, subjectId);
	return pwaId === undefined ? undefined : { pwaId, framing: 'WORK_PRODUCT' };
}

/** The policy's mandatory criteria, derived as the kernel derives them — from `severityIfNotMet`, never the row. */
function mandatoryOf(source: LaneSource, policyId: string): ReadonlySet<string> {
	const rows = (source.loadObject(policyId)?.state as { criteria?: unknown } | undefined)?.criteria;
	return new Set(
		(Array.isArray(rows) ? (rows as { id?: unknown; severityIfNotMet?: unknown }[]) : [])
			.filter(
				(c) => BLOCKING_SEVERITIES.has(c.severityIfNotMet as never) && typeof c.id === 'string'
			)
			.map((c) => c.id as string)
	);
}

/**
 * How a stand-in completion's mandatory rows were answered: EVALUATED by a reviewer, or STIPULATED by the test. The
 * LATEST recording of each criterion counts, as in Gate E's fold.
 */
function tallyOf(source: LaneSource, assessmentId: string, mandatory: ReadonlySet<string>) {
	const latest = new Map<string, { result?: unknown; claim?: unknown }>();
	for (const e of source.events) {
		if (e.eventType !== 'AssuranceCriterionEvaluated') continue;
		const p = e.payload as {
			assessmentId?: unknown;
			criterionId?: unknown;
			result?: unknown;
			stipulated?: unknown;
		};
		if (p.assessmentId === assessmentId && typeof p.criterionId === 'string')
			latest.set(p.criterionId, { result: p.result, claim: p.stipulated });
	}
	let evaluated = 0;
	let stipulatedRows = 0;
	for (const [criterionId, row] of latest) {
		if (!mandatory.has(criterionId)) continue;
		if (row.result !== 'UNABLE_TO_DETERMINE') evaluated += 1;
		else if (row.claim === 'MET') stipulatedRows += 1;
	}
	return { evaluated, stipulatedRows };
}

/** Limb 1's three questions of one stand-in completion; an empty list is a completion the lane may rest on. */
function limbOneReasons(
	source: LaneSource,
	c: Completion,
	subjectId: string,
	registrations: readonly StipulationRegistration[]
): string[] {
	const { evaluated, stipulatedRows } = tallyOf(
		source,
		c.assessmentId,
		mandatoryOf(source, String(c.assurancePolicyId))
	);
	const reasons: string[] = [];
	if (stipulatedRows === 0)
		reasons.push(
			'it rests on NO stipulated mandatory row — a stand-in pass the test did not stipulate'
		);
	if (evaluated === 0)
		reasons.push('it rests on NO evaluated mandatory row — nobody read the subject');
	const arm = armOf(source, subjectId);
	if (arm === undefined)
		reasons.push(`its subject ${subjectId} is neither a PWA nor a work product with a PWA`);
	else if (!registrations.some((r) => r.pwaId === arm.pwaId && r.framing === arm.framing))
		reasons.push(`no test registered a stipulation for ${arm.pwaId} on ${arm.framing}`);
	return reasons;
}

/**
 * ⭐ E2 — LIMB 3's questions of one declared stand-in completion: a registration for its unit's PWA on `DECLARED_POLICY`,
 * and every mandatory row it recorded (the LATEST per criterion, as Gate E folds them) a stipulation. Empty: clean.
 */
function limbThreeReasons(
	source: LaneSource,
	c: Completion,
	subjectId: string,
	registrations: readonly StipulationRegistration[]
): string[] {
	const mandatory = mandatoryOf(source, String(c.assurancePolicyId));
	const latest = new Map<string, { result?: unknown; claim?: unknown }>();
	for (const e of source.events) {
		if (e.eventType !== 'AssuranceCriterionEvaluated') continue;
		const p = e.payload as { assessmentId?: unknown; criterionId?: unknown; result?: unknown; stipulated?: unknown };
		if (p.assessmentId === c.assessmentId && typeof p.criterionId === 'string')
			latest.set(p.criterionId, { result: p.result, claim: p.stipulated });
	}
	const judged = [...latest.entries()]
		.filter(([id, r]) => mandatory.has(id) && !(r.result === 'UNABLE_TO_DETERMINE' && r.claim === 'MET'))
		.map(([id]) => id);
	const reasons: string[] = [];
	if (judged.length > 0)
		reasons.push(`it records a mandatory row NOT stipulated (${judged.join(', ')}) — the declared stand-in judges nothing`);
	const pwaId = workUnitPwaOf(source, subjectId);
	if (pwaId === undefined) reasons.push(`its subject ${subjectId} is not a work unit with a PWA`);
	else if (!registrations.some((r) => r.pwaId === pwaId && r.framing === 'DECLARED_POLICY'))
		reasons.push(`no test registered a stipulation for ${pwaId} on DECLARED_POLICY`);
	return reasons;
}

/**
 * ⭐ `E12F` F11 — WHETHER A COMPLETION'S SUBJECT IS A WORK UNIT THAT DECLARES ITS POLICY: on itself or through its type — the
 * kernel's one reading (`declaredAssurancePolicyIds`, the set `RPH-PWU-007` folds and Gate E reads). A subject that is not a
 * work unit declares nothing.
 */
function subjectDeclares(source: LaneSource, subjectId: string, policyId: string | undefined): boolean {
	const unit = source.loadObject(subjectId);
	if (unit?.objectType !== 'PROFESSIONAL_WORK_UNIT' || policyId === undefined) return false;
	const pwu = unit.state as { assurancePolicyIds?: string[]; pwuTypeId?: string };
	const pwuType = pwu.pwuTypeId
		? (source.loadObject(pwu.pwuTypeId)?.state as { requiredAssurancePolicyIds?: string[] } | undefined)
		: undefined;
	return declaredAssurancePolicyIds(pwu, pwuType).includes(policyId);
}

/**
 * ⭐ THE CHECK ITSELF — pure: ~~both~~ ~~the three~~ the four limbs over one segment's sources and the registrations in force.
 */
export function laneFindings(
	sources: readonly LaneSource[],
	registrations: readonly StipulationRegistration[]
): LaneFinding[] {
	const found: LaneFinding[] = [];
	for (const source of sources)
		for (const e of source.events) {
			if (e.eventType !== 'AssuranceAssessmentCompleted') continue;
			const c = e.payload as Completion;
			// ⭐ E2 — LIMB 3: a positive declared-policy completion the declared stand-in answered.
			if (c.validatorId === STANDIN_DECLARED_REVIEW_VALIDATOR_ID && POSITIVE.has(String(c.disposition))) {
				const subjectId = c.subjectObjectIds?.[0] ?? '';
				const reasons = limbThreeReasons(source, c, subjectId, registrations);
				if (reasons.length > 0)
					found.push({
						where: source.where,
						assessmentId: c.assessmentId,
						validatorId: String(c.validatorId),
						disposition: String(c.disposition),
						subjectId,
						limb: 3,
						reason: reasons.join('; ')
					});
				continue;
			}
			// ⭐ `E12F` F11 — LIMB 4, limb 2's declared counterpart: a positive verdict of a policy its subject DECLARES, under any
			// validator but the declared stand-in (whose completions are limb 3's, above). ⚠ The floor's reasoning review is
			// limbs 1 and 2's, whoever declares it.
			if (c.assurancePolicyId !== FLOOR_POLICY_IDS.REASONING_REVIEW && POSITIVE.has(String(c.disposition))) {
				const subjectId = c.subjectObjectIds?.[0] ?? '';
				if (subjectDeclares(source, subjectId, c.assurancePolicyId))
					found.push({
						where: source.where,
						assessmentId: c.assessmentId,
						validatorId: String(c.validatorId),
						disposition: String(c.disposition),
						subjectId,
						limb: 4,
						reason: `a ${String(c.disposition)} verdict of ${String(c.assurancePolicyId)}, which its work unit declares, completed under ${String(c.validatorId)} — on this lane only the declared stand-in may pass a declared policy, and only on a stipulation`
					});
				continue;
			}
			if (
				c.assurancePolicyId !== FLOOR_POLICY_IDS.REASONING_REVIEW ||
				!POSITIVE.has(String(c.disposition))
			)
				continue;
			const subjectId = c.subjectObjectIds?.[0] ?? '';
			const base = {
				where: source.where,
				assessmentId: c.assessmentId,
				validatorId: String(c.validatorId),
				disposition: String(c.disposition),
				subjectId
			};
			if (c.validatorId !== STANDIN_VALIDATOR_ID) {
				found.push({
					...base,
					limb: 2,
					reason: `a ${base.disposition} reasoning review completed under ${base.validatorId} — on this lane only the declared stand-in may pass one, and only on a stipulation`
				});
				continue;
			}
			const reasons = limbOneReasons(source, c, subjectId, registrations);
			if (reasons.length > 0) found.push({ ...base, limb: 1, reason: reasons.join('; ') });
		}
	return found;
}

// ── THE SEGMENTS, AND WHAT IS KEPT ACROSS THEM ────────────────────────────────────────────────────────────────────

/** One stretch of the event log between two reset marks. */
export interface LaneSegment {
	readonly id: number;
	/** `boot` — the mark after the boot seed; `reset` — the mark after a reset's seed. */
	readonly openedBy: 'boot' | 'reset';
	/** The canonical event count when the segment opened: everything before it is the seed's, or another segment's. */
	readonly mark: number;
	/** Every test announced while the segment was open, in order. */
	readonly tests: readonly string[];
}

/** A finding the server KEPT, with the segment it arose in and the test(s) it is attributed to. */
export interface LaneViolation extends LaneFinding {
	readonly segment: number;
	/** The test whose after-test check first saw it, or — if only a reset or the final call did — every test
	 *  announced while its segment was open. */
	readonly attributedTo: readonly string[];
	readonly seenAt: 'after-test check' | 'reset' | 'final';
}

let sequence = 0;
let open: { id: number; openedBy: 'boot' | 'reset'; mark: number; tests: string[] } | undefined;
/** The test named last — still running when its own reset opens the next segment, since it is named BEFORE it resets. */
let running: string | undefined;
const marks: LaneSegment[] = [];
/** ⛔ KEPT ACROSS SEGMENTS, RESETS AND RETRIES — the whole point of computing this on the server. */
const kept = new Map<string, LaneViolation>();
/** Which test's after-test check first saw each finding of the OPEN segment. */
const firstSeenBy = new Map<string, string>();

const keyOf = (segment: number, f: LaneFinding) =>
	`${segment}\u0000${f.where}\u0000${f.assessmentId}`;

/**
 * ⭐ TAKE A MARK — after the boot seed, and at the END of every reset, after its seed. Both limbs consider only what
 * follows it, so the seed's own records are excluded by position.
 */
export function markLaneSegment(
	engine: { readAllEvents(): readonly DomainEvent[] },
	openedBy: 'boot' | 'reset'
): void {
	sequence += 1;
	open = {
		id: sequence,
		openedBy,
		mark: engine.readAllEvents().length,
		tests: running === undefined ? [] : [running]
	};
	marks.push(open);
	firstSeenBy.clear();
}

/** The test now running — named at its fixture's setup, before its own reset. */
export function announceLaneTest(test: string): void {
	openSegment().tests.push(test);
	running = test;
}

function openSegment() {
	// ⛔ FAIL CLOSED: a check with no mark would have to guess where the seed ends.
	if (open === undefined)
		throw new Error(
			'The lane control has no mark: the engine was never booted or reset in test mode.'
		);
	return open;
}

/** The sources of the OPEN segment: canonical after its mark, and each staged candidate's own events. */
export function laneSources(
	canonical: {
		readAllEvents(): readonly DomainEvent[];
		loadObject(id: string): StoredObject | undefined;
	},
	candidates: readonly {
		readonly pwaId: string;
		readonly engine: {
			readAllEvents(): readonly DomainEvent[];
			loadObject(id: string): StoredObject | undefined;
		};
	}[]
): LaneSource[] {
	const all = canonical.readAllEvents();
	const known = new Set(all.map((e) => e.eventId));
	return [
		{
			where: 'canonical',
			events: all.slice(openSegment().mark),
			loadObject: (id) => canonical.loadObject(id)
		},
		...candidates.map((c) => ({
			where: `candidate of ${c.pwaId}`,
			events: c.engine.readAllEvents().filter((e) => !known.has(e.eventId)),
			loadObject: (id: string) => c.engine.loadObject(id)
		}))
	];
}

function keep(
	findings: readonly LaneFinding[],
	seenAt: LaneViolation['seenAt'],
	by?: string
): LaneViolation[] {
	const segment = openSegment();
	return findings.map((f) => {
		const key = keyOf(segment.id, f);
		if (by !== undefined && !firstSeenBy.has(key)) firstSeenBy.set(key, by);
		const who = firstSeenBy.get(key);
		const violation: LaneViolation = {
			...f,
			segment: segment.id,
			attributedTo: who === undefined ? [...segment.tests] : [who],
			seenAt: kept.get(key)?.seenAt ?? seenAt
		};
		kept.set(key, violation);
		return violation;
	});
}

/**
 * ⭐ AFTER EACH TEST (the fixture's teardown): check the OPEN segment now, KEEP what it finds, and return the findings
 * this test is the first to see — its per-test attribution. A test that never resets shares its segment with the
 * test before it; a finding that test already owned is not charged to this one.
 */
export function checkLaneAfterTest(
	sources: readonly LaneSource[],
	registrations: readonly StipulationRegistration[],
	test: string
): LaneViolation[] {
	const segment = openSegment();
	const fresh = laneFindings(sources, registrations).filter(
		(f) => !firstSeenBy.has(keyOf(segment.id, f))
	);
	return keep(fresh, 'after-test check', test);
}

/**
 * ⭐ AT EVERY RESET (before anything is discarded) AND AT THE FINAL CALL: check the whole open segment and KEEP what it
 * finds — a floor that completed after its test's own check is caught here.
 */
export function closeLaneSegment(
	sources: readonly LaneSource[],
	registrations: readonly StipulationRegistration[],
	closedBy: 'reset' | 'final'
): LaneViolation[] {
	return keep(laneFindings(sources, registrations), closedBy);
}

/** Everything the server has kept, and every mark it has taken — what `/test-api/introspect` and the final call read. */
export function laneControlReport(): {
	readonly marks: readonly LaneSegment[];
	readonly violations: readonly LaneViolation[];
} {
	return {
		marks: marks.map((m) => ({ ...m, tests: [...m.tests] })),
		violations: [...kept.values()]
	};
}
