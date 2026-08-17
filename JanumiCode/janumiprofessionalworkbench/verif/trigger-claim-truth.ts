// C-0d — the TRANSITION TRIGGER TEXT is a third record of what each command does, and nothing had ever audited it.
//
// ⚠⚠ CORRECTED HOURS AFTER SHIPPING. THIS FILE CLAIMED THE TRIGGER IS "THE CORPUS ITSELF" AND THEREFORE OUTRANKS
// THE AUTHORED ROWS. THAT HOLDS FOR 3 MACHINES OUT OF 27.
//
// `m2-transitions.json` records provenance per machine in its own `sourceSection`, and for EIGHTEEN of the
// twenty-seven it reads like `ExecutionPlan.status`'s, byte-exact:
//     "core-model doc §20.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.4 events + §34.3 commands +
//      §20.2 invariants. NO explicit matrix."
// The STATES are verbatim; THE ARROWS AND THEIR TRIGGERS ARE AN AUTHOR'S RECONSTRUCTION. For those machines a
// trigger is exactly as authored as a `BINDINGS` row, and "the trigger wins" is unfounded. Only
// `PWU.workLifecycleState` ("§8.1 primary (VERBATIM)"), `Intent.intentStatus` and `ValidatorRegistryEntry.status`
// carry verbatim transitions; `AssuranceAssessment.state` is a third case, "the ONLY object with a drawn FSM in
// that doc" — drawn, not reconstructed, and not claimed verbatim either.
//
// ⚠ AND THE PROVENANCE WAS SITTING IN THE VOCAB THE WHOLE TIME. I asserted an authority without reading the
// field that records it, in a control whose entire purpose is to stop records being trusted unchecked.
//
// SO THE CONTROL NOW PARTITIONS BY PROVENANCE INSTEAD OF ASSERTING AUTHORITY. A divergence on a VERBATIM machine
// indicts the handler. A divergence on a RECONSTRUCTED machine indicts the handler OR the reconstruction, and a
// build agent may not say which — which is a WEAKER but honest finding, and changes what is owed to Governance.
//
// WHY IT IS STILL WORTH AUDITING: three records disagreeing is evidence even when none of them is authoritative.
//
// THIS IS THE DERIVED GENERAL FORM OF THREE FINDINGS IN ONE WEEK. REG-F-082 (recomposition rows attribute PWU
// arrows to commands that only move the contract), REG-F-085 (the PWU `-> RECOMPOSED` guard names a contract state
// no command can reach) and REG-F-088 (`ProposeExecutionPlan` skips the ratified `PROPOSED` state and emits the
// event of the hop it did not perform) are all ONE SHAPE: **an implementation performing a different arrow from the
// one the ratified trigger names for it.** Each was found by tripping over it. This finds them by derivation.
//
// ⚠ COVERAGE IS PARTIAL AND SAYS SO. Only 74 of 304 ratified transitions carry a trigger naming a command-shaped
// token; the rest are prose ("Begin discovery", "Missing information") and yield no claim. That is stated as a
// pinned number rather than left implicit, because a claim-extractor that silently thins its own population is the
// exact failure REG-F-087 measured in the arrow census — 115 of 304 arrows read, with a control that could only
// detect total death.
import { COMMANDS } from '@janumipwb/rph-contracts';
import { STATE_MACHINES } from '@janumipwb/rph-domain';
import { readFileSync } from 'node:fs';
import type { TransitionClaim } from './binding-row-truth.js';

const M2_VOCAB = new URL('../packages/rph-domain/vocab/m2-transitions.json', import.meta.url);

/**
 * The transition vocab, READ AND PARSED ONCE.
 *
 * ⚠ THIS WAS RE-READ AND RE-PARSED PER ARROW, AND IT IS THE SAME DEFECT AS V-4a IN A DIFFERENT FILE.
 * `provenanceOfArrow` is called once per arrow — **304 of them** — and each call did a full `readFileSync` plus
 * `JSON.parse` of this vocab; a row with no note then falls through to `provenanceOf`, which parsed it AGAIN. So a
 * single test performed on the order of 400 parses of the same file. Measured at **3813ms against the 5000ms
 * DEFAULT timeout — 76% of its budget** — which made it the closest non-CSAA test in the repository to tipping.
 *
 * WHY THAT IS A GATE DEFECT AND NOT A SLOW TEST. A declared CONTROL in the mutation ledger runs the WHOLE suite,
 * so any test that tips its timeout under load becomes a verdict about an unrelated mutation (REG-F-116). This one
 * was next in line, and it was found by MEASURING which tests sit closest to their budget rather than by guessing
 * which look expensive — the derivation is in the register entry, and it named exactly one file.
 *
 * ⚠ FOUND BY DERIVING THE POPULATION, WHICH IS THE PART THAT GENERALISES. The instinct was to audit the 24 verif
 * files that call `readFileSync` for the same pattern; that is enumeration, and it would have "fixed" files that
 * cost nothing while missing the criterion. The criterion is duration against declared budget, and it is a
 * measurement the suite already emits.
 */
let m2Spec: M2Spec | undefined;
interface M2Spec {
	readonly machines: readonly {
		readonly name: string;
		readonly sourceSection?: string;
		readonly transitions?: readonly { from?: string; to?: string; note?: string }[];
	}[];
}
function m2Once(): M2Spec {
	m2Spec ??= JSON.parse(readFileSync(M2_VOCAB, 'utf8')) as M2Spec;
	return m2Spec;
}

type Machine = { transitions: readonly { from: string; to: string; trigger?: string }[] };

const MACHINES = STATE_MACHINES as unknown as Record<string, Machine>;

/**
 * A trigger names a command when it contains a lowerCamelCase token — an internal capital is what separates
 * `beginRecomposition` from ordinary prose like `discovery` or `shaping`.
 *
 * ⚠ AND THE TOKEN MUST RESOLVE TO A REAL COMMAND. `policySemanticVersion` matches the shape and is a FIELD, not a
 * command. It is excluded by checking the registry rather than by naming it here: a hand-written exclusion list is
 * the thing that rots, and deriving the exclusion means a future false positive of the same kind is also excluded
 * without anyone remembering to.
 */
function commandsNamedIn(trigger: string): string[] {
	const registry = COMMANDS as Record<string, unknown>;
	const out = new Set<string>();
	for (const [, token] of trigger.matchAll(/\b([a-z]+[A-Z][a-zA-Z]*)\b/g)) {
		const commandType = token!.charAt(0).toUpperCase() + token!.slice(1);
		if (Object.prototype.hasOwnProperty.call(registry, commandType)) out.add(commandType);
	}
	return [...out];
}

/**
 * Per-machine transition provenance, read from the vocab's own `sourceSection` — DERIVED, never listed. A
 * hand-written table of which machines are verbatim would rot the moment a sourceSection is edited, and the
 * reason this correction was needed is precisely that I asserted provenance instead of reading it.
 */
export type TriggerProvenance = 'VERBATIM' | 'RECONSTRUCTED' | 'OTHER';

/**
 * ARROW-LEVEL provenance, which is finer and more accurate than the machine-level answer below.
 *
 * ⚠ THE VOCAB CARRIES A `note` ON EVERY TRANSITION, and I missed it twice. First I asserted provenance without
 * reading any; then, correcting that, I read only the machine's `sourceSection` and reported the agent who
 * pointed at a per-transition `note` as having cited something that did not exist. It does exist — in the VOCAB.
 * The GENERATED `transitions.data.ts` drops the field, which is why grepping there found zero.
 *
 * MULTI-SOURCE ROWS USE `/`, NOT `|` (e.g. `PRESERVED/AT_RISK -> VIOLATED`), and the generator expands them —
 * which is why the vocab has 211 rows and the machines expose 304 arrows. Expanded here so an arrow resolves to
 * the row it came from. My first scan for multi-source rows checked `|`, `(` and `,` and missed every one.
 */
export function provenanceOfArrow(machine: string, from: string, to: string): TriggerProvenance {
	const rows = m2Once().machines.find((m) => m.name === machine)?.transitions ?? [];
	const row = rows.find(
		(t) => (t.from ?? '').split('/').includes(from) && t.to === to
	);
	// A row with no note falls back to the machine's own sourceSection rather than being called OTHER — absence of
	// a per-arrow note is not evidence the arrow is unsourced.
	if (!row) return provenanceOf(machine);
	const note = row.note ?? '';
	if (/RECONSTRUCT/i.test(note)) return 'RECONSTRUCTED';
	if (/§\s*\d/.test(note)) return 'VERBATIM';
	return provenanceOf(machine);
}

export function provenanceOf(machine: string): TriggerProvenance {
	// `machines` is an ARRAY of { name, sourceSection, … }, not a map. The first version of this read it as a map
	// and returned 'OTHER' for EVERY machine — including `PWU.workLifecycleState`, which is known VERBATIM. That
	// uniform negative is the tell, and it is the fourth instrument failure of the day; the control case is the
	// only thing that distinguishes it from a real answer.
	const src = m2Once().machines.find((m) => m.name === machine)?.sourceSection ?? '';
	// Order matters: a source can say BOTH ("enum (VERBATIM). Transitions RECONSTRUCTED…"), and it is the
	// TRANSITIONS whose provenance this control depends on, so RECONSTRUCTED wins the tie.
	if (/RECONSTRUCT/i.test(src)) return 'RECONSTRUCTED';
	if (/VERBATIM/i.test(src)) return 'VERBATIM';
	return 'OTHER';
}

/** Every (command, machine, from, to) the RATIFIED trigger text asserts. */
export function triggerClaims(): TransitionClaim[] {
	const claims: TransitionClaim[] = [];
	for (const [machine, m] of Object.entries(MACHINES)) {
		for (const t of m.transitions) {
			if (!t.trigger) continue;
			for (const commandType of commandsNamedIn(t.trigger)) {
				claims.push({
					source: 'ratified.trigger',
					commandType,
					// The trigger sometimes names the event too, but the EVENT is not what this control checks and
					// parsing it would add a second guess to every row. The arrow is the claim.
					eventType: '',
					machine,
					from: t.from,
					to: t.to
				});
			}
		}
	}
	return claims;
}

/** How much of the ratified trigger surface yielded a claim — reported so the scope cannot be assumed. */
export function triggerCoverage(): {
	transitions: number;
	withTrigger: number;
	namingAKnownCommand: number;
	claims: number;
} {
	let transitions = 0;
	let withTrigger = 0;
	let namingAKnownCommand = 0;
	for (const m of Object.values(MACHINES)) {
		for (const t of m.transitions) {
			transitions += 1;
			if (!t.trigger) continue;
			withTrigger += 1;
			if (commandsNamedIn(t.trigger).length > 0) namingAKnownCommand += 1;
		}
	}
	return { transitions, withTrigger, namingAKnownCommand, claims: triggerClaims().length };
}
