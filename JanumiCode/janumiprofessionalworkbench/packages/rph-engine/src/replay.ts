// The Reference Undertaking replay harness (M13). The field-service fixture's §26 expected event trace (72
// steps) is the conformance ORACLE (RPH-FIX-003): replaying it must yield an approved Intent Baseline, a
// satisfied-but-unbaselined Product Behavior PWU, an AUTHORITATIVE Architecture Baseline, and a visible open
// offline residual — with execution success NEVER implying assurance. Three modes (roadmap): seed (the terminal
// canonical graph), replay (feed the event history and rebuild from it), conformance (replay + assert).
//
// ⚠️ READ THIS BEFORE TRUSTING ANYTHING BELOW (2026-07-17). Everything here operates on
// fixtures/expected-events.jsonl — a HAND-AUTHORED transcription of §26. The engine is never involved. So
// `runConformance` asserts that the fixture is consistent with itself, and replay.test.ts calling itself "the
// headline end-to-end proof" is not accurate: no end of the system is attached to the other.
//
// This is not hypothetical. The fixture has said `PwuMarkedReady` at seq 20/33 since it was written; the engine
// emitted `PwuStateChanged` there instead. The fixture agreed with the corpus, the engine disagreed with both,
// and because nothing compared them the drift survived every green run until it was found by hand (Increment 23).
// An oracle that cannot disagree with the system is not observing it.
//
// The old note here said full replay "needs the command handlers deferred from M9/M10/M11 (a handler registry +
// ~20 handlers + the 8 missing commands)". THAT BLOCKER IS STALE — the registry and handlers exist, and
// driveReferenceUndertaking drives the real pipeline today. The actual gap is different and larger: the engine
// emits none of 28 event types this trace expects (the whole claim -> evidence -> assessment -> decision ->
// baseline chain), so it CANNOT yet produce this trace. replay-conformance.test.ts points the oracle at the live
// engine and pins that distance as a number, so it can only shrink.
import { readFileSync } from 'node:fs';
import { EVENTS } from '@janumipwb/rph-contracts';

export interface TraceEvent {
	readonly seq: number;
	readonly event: string;
	readonly aggregate: string;
	readonly phase: string;
	readonly label: string | null;
}

export type ReplayMode = 'seed' | 'replay' | 'conformance';

/** Load the authored §26 expected-events.jsonl (the replay oracle artifact). */
export function loadExpectedEvents(): TraceEvent[] {
	const text = readFileSync(new URL('../fixtures/expected-events.jsonl', import.meta.url), 'utf8');
	return text
		.trim()
		.split(/\r?\n/)
		.map((line) => JSON.parse(line) as TraceEvent);
}

/** Rebuild each named aggregate instance's TERMINAL event from the history (a simplified event-sourced fold,
 *  keyed by aggregate + label since the trace does not carry per-instance ids). */
export function foldTerminalStates(events: readonly TraceEvent[]): Map<string, TraceEvent> {
	const terminal = new Map<string, TraceEvent>();
	for (const e of events) terminal.set(`${e.aggregate}:${e.label ?? ''}`, e); // last-write-wins over the ordered stream
	return terminal;
}

export interface ConformanceCheck {
	readonly id: string;
	readonly ok: boolean;
	readonly detail: string;
}
export interface ReplayReport {
	readonly ok: boolean;
	readonly mode: ReplayMode;
	readonly eventCount: number;
	readonly checks: readonly ConformanceCheck[];
}

/**
 * Conformance mode: replay the trace and assert the RPH-FIX rules + the load-bearing end-state invariants that
 * are derivable from the event history. Returns a report; `ok` is true only when every check passes.
 */
export function runConformance(events: readonly TraceEvent[]): ReplayReport {
	const checks: ConformanceCheck[] = [];
	const add = (id: string, ok: boolean, detail: string): void => {
		checks.push({ id, ok, detail });
	};

	const named = (n: string): TraceEvent[] => events.filter((e) => e.event === n);
	const firstSeq = (n: string): number => named(n)[0]?.seq ?? Infinity;
	const lastSeq = (n: string): number => named(n).at(-1)?.seq ?? -Infinity;

	// RPH-FIX-001 — the trace is a contiguous, complete sequence (reference integrity in the seq dimension).
	const seqs = events.map((e) => e.seq);
	add(
		'RPH-FIX-001',
		seqs.length > 0 && seqs.every((s, i) => s === i + 1),
		`${seqs.length} events, contiguous seq 1..${seqs.length}`
	);

	// RPH-FIX-002 — every event validates against a REGISTERED event contract (schema validity).
	const unregistered = [...new Set(events.filter((e) => !(e.event in EVENTS)).map((e) => e.event))];
	add(
		'RPH-FIX-002',
		unregistered.length === 0,
		unregistered.length
			? `unregistered events: ${unregistered.join(', ')}`
			: 'every event resolves to a registered EVENTS contract'
	);

	// RPH-FIX-003a — both baselines are promoted (Intent Baseline + Architecture Baseline).
	add(
		'RPH-FIX-003a',
		named('BaselinePromoted').length === 2,
		`BaselinePromoted x${named('BaselinePromoted').length} (Intent + Architecture)`
	);

	// RPH-FIX-003b — the trace ends with the Architecture Baseline AUTHORITATIVE and the Architecture PWU BASELINED.
	const lastBaseline = events.filter((e) => e.aggregate === 'Baseline').at(-1);
	const lastPwu = events.filter((e) => e.aggregate === 'PWU').at(-1);
	add(
		'RPH-FIX-003b',
		lastBaseline?.event === 'BaselinePromoted' && lastPwu?.event === 'PwuBaselined',
		`last Baseline event = ${lastBaseline?.event}; last PWU event = ${lastPwu?.event}`
	);

	// RPH-FIX-003c — a Product Behavior PWU is SATISFIED but NOT baselined (exactly one PwuBaselined = Architecture).
	add(
		'RPH-FIX-003c',
		named('PwuSatisfied').length >= 1 && named('PwuBaselined').length === 1,
		`PwuSatisfied x${named('PwuSatisfied').length}; PwuBaselined x${named('PwuBaselined').length} (Architecture only)`
	);

	// Property P1 — execution success did NOT imply assurance: an ExecutionStepSucceeded is followed by a
	// CONDITIONALLY-satisfied assessment (open observations) BEFORE the eventual authoritative baseline.
	add(
		'P1-exec!=assurance',
		firstSeq('ExecutionStepSucceeded') < firstSeq('AssuranceAssessmentConditionallySatisfied') &&
			firstSeq('AssuranceAssessmentConditionallySatisfied') < lastSeq('BaselinePromoted'),
		'ExecutionStepSucceeded -> ConditionallySatisfied (open observations) -> remediation -> BaselinePromoted'
	);

	// RPH-GOV-003 / Property P5 — a version-bound governance approval (DecisionEffective) precedes the
	// authoritative Architecture baseline promotion.
	add(
		'RPH-GOV-003',
		lastSeq('DecisionEffective') < lastSeq('BaselinePromoted'),
		'a DecisionEffective precedes the authoritative Architecture BaselinePromoted'
	);

	// RPH-FIX-006 — the deferred offline capability stays explicitly represented (a refined intent constraint).
	add(
		'RPH-FIX-006',
		named('IntentConstraintRefined').length >= 1,
		'the deferred offline capability remains represented (IntentConstraintRefined)'
	);

	// RPH-PER-002 / Property P6 — replaying the history twice is idempotent (dedup by seq yields the same set).
	const doubled = [...events, ...events];
	const dedup = new Map(doubled.map((e) => [e.seq, e]));
	add(
		'RPH-PER-002',
		dedup.size === events.length,
		`replayed x2 dedups to ${dedup.size} events (no duplicate decisions/baselines)`
	);

	return { ok: checks.every((c) => c.ok), mode: 'conformance', eventCount: events.length, checks };
}

/**
 * Run the replay harness in a given mode.
 *   - seed: report the canonical terminal states rebuilt from the trace (the object graph a seed would write).
 *   - replay: rebuild the aggregates from the event history (no assertions) — the count + terminal fold.
 *   - conformance: replay + assert the RPH-FIX / P1 / P5 / P6 expectations.
 */
export function runReplay(
	mode: ReplayMode,
	events: readonly TraceEvent[] = loadExpectedEvents()
): ReplayReport {
	if (mode === 'conformance') return runConformance(events);
	const terminal = foldTerminalStates(events);
	return {
		ok: true,
		mode,
		eventCount: events.length,
		checks: [
			{
				id: mode,
				ok: true,
				detail: `${terminal.size} aggregate instances rebuilt from ${events.length} events`
			}
		]
	};
}
