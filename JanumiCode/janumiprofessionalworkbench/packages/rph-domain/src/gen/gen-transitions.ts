// GENERATOR — emits src/transitions.data.ts (the 23 state-machine transition tables) from the grounded
// extraction vocab/m2-transitions.json (DOC-002 + DOC-004, reconciled). Run via `bun run gen:transitions`.
//
// Transforms that make the raw catalog machine-usable:
//   1. Umbrella `from` states ("Any active", "Any non-baselined") are EXPANDED to concrete non-terminal states.
//   2. CROSS-AXIS rules (from/to naming a different axis, e.g. executionState=SUCCEEDED -> SATISFIED) are
//      LIFTED OUT into CROSS_AXIS_RULES — the generic same-axis engine cannot represent them (enforced by P1 guards).
//   3. Self-loop "illegal" entries (from === to) are RETAINED (JAN-CMDPRE DWP-07 / D6): a DECLARED illegal self-edge
//      is a forbidden IN-PLACE mutation (§24.2: an AUTHORITATIVE baseline is immutable), NOT a NOOP. classifyTransition
//      (stateMachine.ts) consults `illegal` BEFORE the from===to shortcut, so the row classifies ILLEGAL_EXPLICIT.
//   4. An "illegal" entry that also appears as a LEGAL edge is a GUARDED-legal transition (the note is a guard
//      condition, enforced by the owning subsystem, e.g. M7 assurance) and is recorded under `guarded`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface RawTransition {
	from: string;
	to: string;
	trigger?: string;
	guard?: string;
	note?: string;
	/**
	 * Set ONLY on a row that is not an arrow at all (a computed reduction, e.g. AggregateAssuranceDisposition's
	 * `condition → aggregate state` rows); the value is the ruling that says so. See the fail-loud check below.
	 */
	unrepresentable?: string;
}
interface RawIllegal {
	from: string;
	to: string;
	reason?: string;
}
interface RawMachine {
	name: string;
	appliesTo?: string;
	states: string[];
	initialState?: string;
	terminalStates?: string[];
	transitions: RawTransition[];
	illegal?: RawIllegal[];
	sourceSection?: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(HERE, '..', '..', 'vocab', 'm2-transitions.json');
const OUT_PATH = join(HERE, '..', 'transitions.data.ts');

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as { machines: RawMachine[] };
const crossAxis: Array<{ machine: string; from: string; to: string; reason?: string }> = [];

const j = (v: unknown): string => JSON.stringify(v);

/** Serialize an object literal from [key, alreadySerializedValue] pairs, skipping undefined values. */
function objLit(pairs: Array<[string, string | undefined]>): string {
	const parts = pairs.filter((p) => p[1] !== undefined).map((p) => `${p[0]}: ${p[1]}`);
	return `{ ${parts.join(', ')} }`;
}

function transitionLit(t: RawTransition): string {
	return objLit([
		['from', j(t.from)],
		['to', j(t.to)],
		['trigger', t.trigger ? j(t.trigger) : undefined],
		['guard', t.guard ? j(t.guard) : undefined],
		// REG-F-045's remedy. The vocab annotates 120 of 211 rows `RECONSTRUCTED`, and this generator
		// DROPPED the annotation — so 120 authored arrows shipped wearing the same face as ratified ones,
		// and every downstream consumer read a file whose header calls itself *grounded* and *reconciled*.
		['note', t.note ? j(t.note) : undefined]
	]);
}
function illegalLit(i: RawIllegal): string {
	return objLit([
		['from', j(i.from)],
		['to', j(i.to)],
		['reason', i.reason ? j(i.reason) : undefined]
	]);
}
function crossAxisLit(c: { machine: string; from: string; to: string; reason?: string }): string {
	return objLit([
		['machine', j(c.machine)],
		['from', j(c.from)],
		['to', j(c.to)],
		['reason', c.reason ? j(c.reason) : undefined]
	]);
}

/**
 * THE QUANTIFIER VOCABULARY IS A CLOSED SET OF FOUR SPELLINGS, AND THAT IS DELIBERATE.
 *
 * Anything else falls through to the literal branch, fails the caller's state-set test, and — until 2026-08-05 —
 * was dropped in silence. That is exactly how §30's `ANY ACTIVE → CANCELLED` went missing for the lifetime of the
 * repository: the vocab spelled it `ANY_ACTIVE`, this matcher wanted `Any active`, and one underscore cost a
 * ratified arrow (REG-F-025). The row is no longer silent — `buildLegalTransitions` now THROWS — so the fix for a
 * new spelling is to write the row literally or add the spelling here, on purpose, with the reading below in mind.
 *
 * READ THE NEXT SENTENCE BEFORE ADDING A SPELLING. This function implements "any active" as `states MINUS
 * terminalStates` — an ACTIVE state is assumed to be a NON-TERMINAL one. Those are different claims: "active"
 * says work is still under way, "non-terminal" says the machine can still leave. They coincide in every machine
 * where this quantifier currently lands, and they DIVERGE in AssuranceAssessment.state, whose SATISFIED,
 * CONDITIONALLY_SATISFIED and WAIVED are non-terminal verdicts — reachable onward via INVALIDATED and
 * WAIVER_EXPIRED, and not active by any reading. Widening the matcher to catch `ANY_ACTIVE` there would have
 * minted `SATISFIED → CANCELLED`: cancelling an assessment that has already concluded. That machine therefore
 * states its four cancel arrows LITERALLY, and this comment is why.
 */
function expandFrom(from: string, states: string[], terminal: string[]): string[] {
	const f = from.trim().toLowerCase();
	// "Any active" / "Any non-baselined" / "Any non-terminal" all mean: transition FROM a non-terminal state
	// (terminal = BASELINED/ABANDONED/SUPERSEDED). A terminal PWU is not abandonable/supersedable again.
	if (
		f === 'any active' ||
		f.startsWith('any non-baselined') ||
		f.startsWith('any non-terminal') ||
		f === 'any'
	) {
		return states.filter((s) => !terminal.includes(s));
	}
	// Slash-compound source, e.g. "DISCLOSED/UNDER_VERIFICATION" or "ACTIVE/ALLOCATED" — one legal transition
	// per component state (the caller filters each against the machine's state set).
	if (from.includes('/')) return from.split('/').map((s) => s.trim());
	return [from];
}

/**
 * Expand + filter the raw transitions to concrete same-axis legal edges, then dedupe by `from->to`.
 *
 * FAILS LOUD ON A ROW THAT LANDS NOTHING (REG-F-025). Both filters below used to be silent `continue`s, and a row
 * that survived neither left no trace anywhere: not an error, not a warning, not a line in the output. §30's
 * `ANY ACTIVE → CANCELLED` was ratified in the corpus, transcribed into the vocab, and disappeared here for the
 * lifetime of the repository — reviewing either artifact alone showed the arrow present. The Constitution's rule
 * applies to build steps too: fail loud, never silently repair. A row that genuinely is not an arrow says so IN
 * THE ROW, via `unrepresentable`, and the reason is read next to the thing it exempts.
 */
function buildLegalTransitions(
	m: RawMachine,
	stateSet: Set<string>,
	terminal: string[]
): RawTransition[] {
	const legal: RawTransition[] = [];
	for (const t of m.transitions) {
		const before = legal.length;
		if (stateSet.has(t.to))
			for (const f of expandFrom(t.from, m.states, terminal)) {
				if (stateSet.has(f)) legal.push({ ...t, from: f });
			}
		const landed = legal.length > before;
		if (landed && t.unrepresentable)
			throw new Error(
				`${m.name}: row "${t.from}" -> ${t.to} is marked unrepresentable and produced ${legal.length - before} ` +
					`edge(s). One of the two is now wrong — resolve it rather than leaving the row claiming both.`
			);
		if (!landed && !t.unrepresentable)
			throw new Error(
				`${m.name}: row "${t.from}" -> ${t.to} [${t.trigger ?? 'no trigger'}] produced NO edge and would ` +
					`have been dropped silently. Either its from-state names something this machine declares (check ` +
					`the quantifier spellings expandFrom accepts, and read why widening them is usually the wrong ` +
					`fix), or the row is not an arrow at all — in which case give it an "unrepresentable" reason.`
			);
	}
	const seen = new Set<string>();
	return legal.filter((t) => {
		const k = `${t.from}->${t.to}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
}

/**
 * Partition the raw illegal entries: cross-axis ones are lifted out into the module-level `crossAxis`
 * accumulator, self-loops are dropped, edges that also appear legal become `guarded`, the rest `illegal`.
 */
function classifyIllegal(
	m: RawMachine,
	stateSet: Set<string>,
	legalKeys: Set<string>
): { illegal: RawIllegal[]; guarded: RawIllegal[] } {
	const illegal: RawIllegal[] = [];
	const guarded: RawIllegal[] = [];
	for (const i of m.illegal ?? []) {
		if (!stateSet.has(i.from) || !stateSet.has(i.to)) {
			crossAxis.push({ machine: m.name, from: i.from, to: i.to, reason: i.reason });
			continue;
		}
		// JAN-CMDPRE DWP-07 (D6): a DECLARED illegal self-edge (from === to) is RETAINED, not dropped — the corpus can
		// forbid mutating an aggregate in place (§24.2: an AUTHORITATIVE baseline is immutable, so AUTHORITATIVE ->
		// AUTHORITATIVE is ILLEGAL, not a NOOP). classifyTransition consults `illegal` before the from===to shortcut.
		if (legalKeys.has(`${i.from}->${i.to}`)) guarded.push(i);
		else illegal.push(i);
	}
	return { illegal, guarded };
}

function emitMachine(m: RawMachine): string {
	const stateSet = new Set(m.states);
	const terminal = m.terminalStates ?? [];

	const dedupedLegal = buildLegalTransitions(m, stateSet, terminal);
	const legalKeys = new Set(dedupedLegal.map((t) => `${t.from}->${t.to}`));
	const { illegal, guarded } = classifyIllegal(m, stateSet, legalKeys);

	return [
		`\t${j(m.name)}: {`,
		`\t\tname: ${j(m.name)},`,
		`\t\tstates: [${m.states.map(j).join(', ')}],`,
		`\t\tinitialState: ${m.initialState ? j(m.initialState) : 'undefined'},`,
		`\t\tterminalStates: [${terminal.map(j).join(', ')}],`,
		`\t\ttransitions: [${dedupedLegal.map(transitionLit).join(', ')}],`,
		`\t\tillegal: [${illegal.map(illegalLit).join(', ')}],`,
		`\t\tguarded: [${guarded.map(illegalLit).join(', ')}],`,
		`\t\tsourceSection: ${m.sourceSection ? j(m.sourceSection) : 'undefined'}`,
		`\t}`
	].join('\n');
}

const machineEntries = spec.machines.map(emitMachine).join(',\n');
const crossAxisEntries = crossAxis.map((c) => `\t${crossAxisLit(c)}`).join(',\n');

const out = `// GENERATED FILE — do not edit by hand. Regenerate with \`bun run gen:transitions\`.
// Source: vocab/m2-transitions.json (grounded from DOC-002 + DOC-004, reconciled). See gen/gen-transitions.ts.

export interface TransitionSpec {
	readonly from: string;
	readonly to: string;
	readonly trigger?: string;
	readonly guard?: string;
	/**
	 * The vocab's own provenance note for THIS arrow — typically \`RECONSTRUCTED\`, or a §-citation.
	 *
	 * ⚠ ADDED 2026-08-09 (REG-F-045's recorded remedy, filed 2026-08-06). Without it, an arrow the
	 * vocab marks as an author's reconstruction was INDISTINGUISHABLE from a verbatim one downstream.
	 * CON-000 B3, as amended by REG-D-034, now turns on exactly that distinction: canon governs a
	 * principle only where a divergence carries a ratifying act, and whether a trigger is corpus text
	 * or an inference decides what a divergence even means.
	 */
	readonly note?: string;
}
export interface IllegalSpec {
	readonly from: string;
	readonly to: string;
	readonly reason?: string;
}
export interface StateMachineSpec {
	readonly name: string;
	readonly states: readonly string[];
	readonly initialState: string | undefined;
	readonly terminalStates: readonly string[];
	readonly transitions: readonly TransitionSpec[];
	readonly illegal: readonly IllegalSpec[];
	/** Legal edges carrying a guard condition; the guard is enforced by the owning subsystem (e.g. M7 assurance). */
	readonly guarded: readonly IllegalSpec[];
	/**
	 * The vocab's machine-level provenance, e.g. *"core-model doc §20.1 enum (VERBATIM). Transitions
	 * RECONSTRUCTED from §26.4 events + §34.1 commands. NO explicit matrix."* Same remedy, same reason:
	 * the states can be verbatim while the arrows are inferred, and only this string says which.
	 */
	readonly sourceSection?: string;
}

/** A cross-axis rule the generic same-axis engine cannot represent (e.g. property P1 / INV-5). */
export interface CrossAxisRule {
	readonly machine: string;
	readonly from: string;
	readonly to: string;
	readonly reason?: string;
}

export const STATE_MACHINES: Record<string, StateMachineSpec> = {
${machineEntries}
};

export const CROSS_AXIS_RULES: readonly CrossAxisRule[] = [
${crossAxisEntries}
];
`;

writeFileSync(OUT_PATH, out);
console.log(
	`generated ${OUT_PATH}: ${spec.machines.length} machines, ${crossAxis.length} cross-axis rules lifted out`
);
