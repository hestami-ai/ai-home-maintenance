// THE BINDING TABLE IS A SET OF CLAIMS ABOUT WHAT COMMANDS DO, AND UNTIL NOW NOTHING CHECKED ONE.
//
// ── WHAT THE EXISTING CONTROL CHECKS, AND WHY IT COULD NOT CATCH THIS ────────────────────────────────────────
// `rph-domain/src/binding.test.ts` already compares every binding row against the state machines: a concrete
// `from -> to` must classify LEGAL or NOOP. That is a check against the DIAGRAM. It passes for a row that names
// a machine the aggregate does not have, a source state nothing ever occupies, and an arrow no handler performs
// — because all three are perfectly legal edges of a drawing. Five such rows shipped (REG-F-068), and the one
// that survived longest was LEGAL by that test on every single run.
//
// ⚠ AND THE DIAGRAM IS THE WRONG WITNESS BY CONSTRUCTION. Both the binding rows and the machine tables are
// generated from the reconciled vocab; a control derived from the same artifact as the defect will agree with
// it. So this file's witness is the HANDLER SOURCE — `occupiable()` walks the arrows commands can actually
// perform outward from the `births` those handlers DECLARE and `createObject` CHECKS AT RUNTIME. Different
// artifact, different failure mode, and a declaration that drifts from behaviour fails a command, not just a
// census.
//
// ── AND IT AUDITS TWO COPIES, BECAUSE THE SECOND ONE WAS INVISIBLE ───────────────────────────────────────────
// The same claim is recorded twice in the vocab: once per binding row, and once as `drivesMachine`/`drivesFrom`/
// `drivesTo` on the command entry. **The generator emits only the first.** So the command-entry copy had never
// been read by any control at all, and it carried four of the five defects. A control that audited only the
// generated artifact would have declared the file clean while the source it is generated from stayed wrong.
import { readFileSync } from 'node:fs';
import { BINDINGS } from '@janumipwb/rph-contracts';
import { STATE_MACHINES, isExcludedMachine } from '@janumipwb/rph-domain';
import { arrowKey, birthStates, occupiable } from './arrow-command-census.js';

const VOCAB = new URL('../packages/rph-contracts/vocab/m3-commands-events.json', import.meta.url);

/** One recorded claim that a command drives a machine from one state to another. */
export interface TransitionClaim {
	/** Which of the two copies this came from — a failure must say which record to correct. */
	// 'ratified.trigger' is the THIRD source, added 2026-08-09 (C-0d). The first two are AUTHORED records of
	// what a command does; the trigger text on the ratified transition is the CORPUS saying so, and until C-0d
	// nothing compared it to anything. It is deliberately audited by its own control rather than folded into
	// C-0c's population, so the two record types keep separate pins and a failure names which record is wrong.
	readonly source: 'BINDINGS' | 'vocab.commands' | 'ratified.trigger';
	readonly commandType: string;
	readonly eventType: string;
	readonly machine: string;
	readonly from: string;
	readonly to: string;
}

interface VocabCommand {
	commandType: string;
	emitsEvent?: string;
	drivesMachine?: string;
	drivesFrom?: string;
	drivesTo?: string;
}

/** The generated binding rows. */
export function bindingClaims(): TransitionClaim[] {
	return BINDINGS.filter((b) => b.machine).map((b) => ({
		source: 'BINDINGS' as const,
		commandType: b.commandType,
		eventType: b.eventType ?? '',
		machine: b.machine ?? '',
		from: b.from ?? '',
		to: b.to ?? ''
	}));
}

/** The command-entry copy, read from the vocab because the generator never emits it. */
export function vocabDriveClaims(): TransitionClaim[] {
	const spec = JSON.parse(readFileSync(VOCAB, 'utf8')) as { commands: VocabCommand[] };
	if (!Array.isArray(spec.commands) || spec.commands.length === 0) {
		throw new Error('binding-row-truth: the vocab yielded no commands — the audit would be vacuous');
	}
	return spec.commands
		.filter((c) => c.drivesMachine)
		.map((c) => ({
			source: 'vocab.commands' as const,
			commandType: c.commandType,
			eventType: c.emitsEvent ?? '',
			machine: c.drivesMachine ?? '',
			from: c.drivesFrom ?? '',
			to: c.drivesTo ?? ''
		}));
}

export type TokenKind = 'marker' | 'state' | 'alternation' | 'unresolved';

/**
 * What a `from`/`to` token names.
 *
 * ⚠ `unresolved` IS THE POINT OF THIS FUNCTION. The existing control's `concreteBinding()` treats "not a state
 * of this machine" as NOT APPLICABLE and skips the row — so a token naming nothing at all is indistinguishable
 * from a deliberate `(any)` marker, and both pass in silence. Here the two are separated: a parenthetical is a
 * marker the author wrote on purpose, and anything else that does not resolve to declared states is a defect.
 */
export function resolveToken(machine: string, token: string): TokenKind {
	if (token.startsWith('(')) return 'marker';
	const def = STATE_MACHINES[machine];
	if (!def) return 'unresolved';
	if (def.states.includes(token)) return 'state';
	const parts = token.split('|').map((s) => s.trim());
	if (parts.length > 1 && parts.every((p) => def.states.includes(p))) return 'alternation';
	return 'unresolved';
}

/** The declared states a token names — empty for a marker. */
const statesOf = (machine: string, token: string): string[] => {
	const kind = resolveToken(machine, token);
	if (kind === 'state') return [token];
	if (kind === 'alternation') return token.split('|').map((s) => s.trim());
	return [];
};

const show = (c: TransitionClaim) =>
	`${c.source}: ${c.commandType} -> ${c.eventType || '(no event)'} : ${c.machine} ${c.from} -> ${c.to}`;

export interface Audit {
	/** Names a machine the controls have ruled is not a lifecycle at all (machine-exclusions.ts). */
	readonly excluded: string[];
	/** Names a machine `transitions.data.ts` does not declare. */
	readonly unknown: string[];
	/** A `from`/`to` token that resolves to neither declared states nor a deliberate `(marker)`. */
	readonly unresolved: string[];
	/** Claims to move OUT OF a state no object can ever be in. */
	readonly deadFrom: string[];
	/**
	 * The same set as `deadFrom`, keyed as C-0 keys an arrow, so the two censuses can be COMPARED rather than
	 * each keeping a baseline of the same fact.
	 *
	 * ⚠ THIS IS DELIBERATELY NOT PINNED TO A LIST OF ITS OWN. C-0's `deadCovered()` already owns "an arrow out of
	 * an unoccupiable source is dead", measured from the handlers. A second pinned copy here would mean fixing one
	 * dead arrow required editing two baselines, with neither being the authority — the split-population defect
	 * `machine-exclusions.ts` was created to end. What this control asks instead is a question C-0 cannot: does
	 * the VOCAB claim a dead transition the handlers do not even declare? That residue is the drift.
	 */
	readonly deadFromArrows: string[];
	/** Claims to move INTO a state no object can ever be in. */
	readonly deadTo: string[];
	/** A creation claim (`from: (initial)`) landing somewhere no handler declares a birth. */
	readonly notABirth: string[];
	/**
	 * Machines named by a claim that have NO declared birth, so occupancy is unknowable for them.
	 *
	 * ⚠ RETURNED, NEVER SILENTLY SKIPPED. Without a birth every state looks unoccupiable and every claim looks
	 * dead — a 100% false-positive rate dressed as a finding. Reporting the set is what stops this control from
	 * quietly narrowing its own population, which is the defect it exists to catch.
	 */
	readonly unanalysed: string[];
}

/** Mutable accumulator; `auditClaims` freezes and sorts it on the way out. */
interface Bag {
	excluded: string[];
	unknown: string[];
	unresolved: string[];
	deadFrom: string[];
	deadFromArrows: string[];
	deadTo: string[];
	notABirth: string[];
	unanalysed: Set<string>;
}

/** Every token of a claim must name declared states or be a deliberate `(marker)`. */
function auditTokens(c: TransitionClaim, bag: Bag): void {
	for (const [side, token] of [
		['from', c.from],
		['to', c.to]
	] as const) {
		if (token && resolveToken(c.machine, token) === 'unresolved') {
			bag.unresolved.push(`${show(c)}  [${side}="${token}" names nothing]`);
		}
	}
}

/** Occupancy, for a machine whose births are declared and therefore analysable. */
function auditOccupancy(c: TransitionClaim, occupied: ReadonlySet<string>, bag: Bag): void {
	for (const s of statesOf(c.machine, c.from)) {
		if (occupied.has(s)) continue;
		bag.deadFrom.push(`${show(c)}  [from ${s} is never occupied]`);
		for (const t of statesOf(c.machine, c.to)) bag.deadFromArrows.push(arrowKey(c.machine, s, t));
	}
	for (const s of statesOf(c.machine, c.to)) {
		if (!occupied.has(s)) bag.deadTo.push(`${show(c)}  [to ${s} is never occupied]`);
	}
}

/**
 * A CREATION CLAIM IS SHARPER THAN AN OCCUPANCY CLAIM, and it is the one that caught two of the five defects.
 *
 * `(initial) -> X` says this command brings the object into existence in X, so X must be a state some handler
 * DECLARES it births into — not merely a state reachable later by some other command. Both bad rows landed on
 * their machine's declared `initialState`, which REG-F-071 measured as a fiction on four machines: the author
 * read the diagram's entry point instead of the arrow the command actually takes. Occupancy alone would have
 * missed a landing state that some LATER command can reach; only the birth set answers "created where".
 */
function auditBirth(c: TransitionClaim, born: ReadonlySet<string>, bag: Bag): void {
	if (c.from !== '(initial)') return;
	for (const s of statesOf(c.machine, c.to)) {
		if (!born.has(s)) bag.notABirth.push(`${show(c)}  [no handler declares a birth into ${s}]`);
	}
}

export function auditClaims(claims: readonly TransitionClaim[]): Audit {
	const occ = occupiable();
	const births = birthStates();
	const bag: Bag = {
		excluded: [],
		unknown: [],
		unresolved: [],
		deadFrom: [],
		deadFromArrows: [],
		deadTo: [],
		notABirth: [],
		unanalysed: new Set<string>()
	};

	for (const c of claims) {
		if (isExcludedMachine(c.machine)) {
			bag.excluded.push(show(c));
			continue;
		}
		if (!STATE_MACHINES[c.machine]) {
			bag.unknown.push(show(c));
			continue;
		}
		auditTokens(c, bag);
		const occupied = occ.get(c.machine);
		if (!occupied) {
			bag.unanalysed.add(c.machine);
			continue;
		}
		auditOccupancy(c, occupied, bag);
		auditBirth(c, births.get(c.machine) ?? new Set<string>(), bag);
	}

	const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
	return {
		excluded: sorted(bag.excluded),
		unknown: sorted(bag.unknown),
		unresolved: sorted(bag.unresolved),
		deadFrom: sorted(bag.deadFrom),
		deadFromArrows: sorted(bag.deadFromArrows),
		deadTo: sorted(bag.deadTo),
		notABirth: sorted(bag.notABirth),
		unanalysed: sorted(bag.unanalysed)
	};
}
