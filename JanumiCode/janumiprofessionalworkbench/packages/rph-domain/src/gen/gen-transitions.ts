// GENERATOR — emits src/transitions.data.ts (the 23 state-machine transition tables) from the grounded
// extraction vocab/m2-transitions.json (DOC-002 + DOC-004, reconciled). Run via `bun run gen:transitions`.
//
// Transforms that make the raw catalog machine-usable:
//   1. Umbrella `from` states ("Any active", "Any non-baselined") are EXPANDED to concrete non-terminal states.
//   2. CROSS-AXIS rules (from/to naming a different axis, e.g. executionState=SUCCEEDED -> SATISFIED) are
//      LIFTED OUT into CROSS_AXIS_RULES — the generic same-axis engine cannot represent them (enforced by P1 guards).
//   3. Self-loop "illegal" entries (from === to) are DROPPED (a NOOP is not a forbidden transition).
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
		['guard', t.guard ? j(t.guard) : undefined]
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

function emitMachine(m: RawMachine): string {
	const stateSet = new Set(m.states);
	const terminal = m.terminalStates ?? [];

	const legal: RawTransition[] = [];
	for (const t of m.transitions) {
		if (!stateSet.has(t.to)) continue; // cross-axis / malformed target
		for (const f of expandFrom(t.from, m.states, terminal)) {
			if (stateSet.has(f)) legal.push({ ...t, from: f });
		}
	}
	const seen = new Set<string>();
	const dedupedLegal = legal.filter((t) => {
		const k = `${t.from}->${t.to}`;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
	const legalKeys = new Set(dedupedLegal.map((t) => `${t.from}->${t.to}`));

	const illegal: RawIllegal[] = [];
	const guarded: RawIllegal[] = [];
	for (const i of m.illegal ?? []) {
		if (!stateSet.has(i.from) || !stateSet.has(i.to)) {
			crossAxis.push({ machine: m.name, from: i.from, to: i.to, reason: i.reason });
			continue;
		}
		if (i.from === i.to) continue; // self-loop "illegal" is a NOOP
		if (legalKeys.has(`${i.from}->${i.to}`)) guarded.push(i);
		else illegal.push(i);
	}

	return [
		`\t${j(m.name)}: {`,
		`\t\tname: ${j(m.name)},`,
		`\t\tstates: [${m.states.map(j).join(', ')}],`,
		`\t\tinitialState: ${m.initialState ? j(m.initialState) : 'undefined'},`,
		`\t\tterminalStates: [${terminal.map(j).join(', ')}],`,
		`\t\ttransitions: [${dedupedLegal.map(transitionLit).join(', ')}],`,
		`\t\tillegal: [${illegal.map(illegalLit).join(', ')}],`,
		`\t\tguarded: [${guarded.map(illegalLit).join(', ')}]`,
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
