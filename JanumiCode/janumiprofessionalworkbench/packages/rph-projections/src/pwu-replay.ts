// RPH-PER-006 — Aggregate replay equivalence, for the PWU.
//
//   Given an event stream for an Intent or PWU.
//   When the aggregate is reconstructed.
//   Then its state matches the materialized current state.
//
// This is the property that makes the event log AUTHORITATIVE rather than decorative: if state cannot be rebuilt
// from events, then the events are a diary the system keeps beside the truth, not the truth itself — and every
// audit claim about "the governed stream" is a claim about the diary.
//
// It was ratified and UNTESTED. The one test that claimed it — "is reproducible from the event log (rebuild
// equivalence)" — called the projection twice on the same live engine and compared the results, never touching a
// rebuild (corrected in Increment 24). The conformance manifest was honest about the gap; only the test name lied.
//
// THIS IS AN AGGREGATE REDUCER, NOT A PROJECTOR. `Projector` folds the global stream into a read-model VIEW.
// RPH-PER-006 is a different claim: fold ONE aggregate's own stream and get back the object. Views are
// disposable; this is the durability promise.
//
// WHAT THE REDUCER HAD TO BE TOLD THAT THE LOG DOES NOT SAY: nothing. That is the point, and it was not free —
// all five authored lifecycle events (PwuShapingStarted, PwuChallenged, PwuReshapingStarted, PwuInvalidated,
// PwuSuperseded) DECLARED `workLifecycleState` and emitted `command.payload` instead, so the log genuinely could
// not rebuild the aggregate until Increment 29 conformed them. A reducer that hardcoded "PwuShapingStarted means
// SHAPING" would have passed this test while hiding that — encoding in code what the stream failed to record,
// which is exactly how a replay test comes to prove nothing.
import type { DomainEvent } from '@janumipwb/rph-contracts';

/** The four orthogonal axes that constitute a PWU's state (DOC-002 §5, §7). */
export interface ReplayedPwuAxes {
	readonly workLifecycleState: string;
	readonly executionState: string;
	readonly assuranceState: string;
	readonly shapeIntegrityState: string;
}

type Payload = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/**
 * Fold one PWU's own event stream (in aggregateRevision order) back into its four axes. Returns undefined if the
 * stream never proposes the PWU — an aggregate with no creation event has no state, and inventing one would be
 * the fabrication this whole exercise exists to prevent.
 *
 * Every value below is READ FROM THE EVENT. Where an event does not carry an axis, that axis is CARRIED FORWARD
 * unchanged — never inferred from the event's name. If an event should move an axis and does not say so, this
 * reducer will produce the wrong answer and RPH-PER-006 will fail, which is the correct outcome: the defect is
 * in the event, not here.
 */
export function replayPwuAxes(events: readonly DomainEvent[]): ReplayedPwuAxes | undefined {
	let axes: ReplayedPwuAxes | undefined;
	for (const event of events) axes = applyPwuAxisEvent(axes, event);
	return axes;
}

/**
 * ONE PWU event -> the next axes. THE single place that knows how a PWU event moves the four axes.
 *
 * It is exported and shared because the alternative is what this codebase actually had: the aggregate reducer and
 * the Work view projector each folding PWU events their own way, and drifting. `workProjector` handled exactly
 * `IntentCaptured` and `PwuProposed`, defaulted on everything else, and HARDCODED the seeded axes instead of
 * reading them — so folded over the reference undertaking's 251 events it reported every PWU as
 * PROPOSED/NOT_PLANNED/UNASSESSED while the objects were BASELINED/SUCCEEDED/SATISFIED. Its comment said
 * "Further events (state changes, observations) update the axes / counts here as later milestones add their
 * commands". The milestones came; the fold never followed. Two folds is one fold too many.
 *
 * Returns `undefined` until the aggregate is CREATED — an event stream that never proposed the PWU yields no
 * state, and defaulting one into existence would fabricate an object out of nothing.
 */
export function applyPwuAxisEvent(
	axes: ReplayedPwuAxes | undefined,
	event: DomainEvent
): ReplayedPwuAxes | undefined {
	const p = (event.payload ?? {}) as Payload;
	switch (event.eventType) {
		case 'PwuProposed': {
			// The only event that CREATES state; §11.3 carries all four seeded axes. Read them — do not assume
			// them. The seeded values are a fact of the event, not of this function.
			const w = str(p.workLifecycleState);
			const e = str(p.executionState);
			const a = str(p.assuranceState);
			const s = str(p.shapeIntegrityState);
			if (!(w && e && a && s)) return axes;
			return {
				workLifecycleState: w,
				executionState: e,
				assuranceState: a,
				shapeIntegrityState: s
			};
		}
		case 'PwuStateChanged': {
			// The generic multi-axis event (§11.5): every axis, every time.
			if (!axes) return axes;
			return {
				workLifecycleState: str(p.newState) ?? axes.workLifecycleState,
				executionState: str(p.executionState) ?? axes.executionState,
				assuranceState: str(p.assuranceState) ?? axes.assuranceState,
				shapeIntegrityState: str(p.shapeIntegrityState) ?? axes.shapeIntegrityState
			};
		}
		case 'PwuMarkedReady':
		case 'PwuShapingStarted':
		case 'PwuChallenged':
		case 'PwuReshapingStarted':
		case 'PwuInvalidated':
		case 'PwuSuperseded': {
			// The named single-axis events. Each declares `workLifecycleState`; two also carry
			// shapeIntegrityState. Absent axes carry forward — they were not part of this transition.
			if (!axes) return axes;
			return {
				...axes,
				workLifecycleState: str(p.workLifecycleState) ?? axes.workLifecycleState,
				shapeIntegrityState: str(p.shapeIntegrityState) ?? axes.shapeIntegrityState
			};
		}
		default:
			return axes; // Events of other aggregates, or PWU events that carry no axis.
	}
}
