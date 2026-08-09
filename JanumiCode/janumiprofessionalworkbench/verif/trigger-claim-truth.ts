// C-0d — the RATIFIED TRIGGER TEXT is a third record of what each command does, and nothing has ever audited it.
//
// ⚠ WHY THIS SOURCE IS DIFFERENT FROM THE OTHER TWO, AND WHY IT IS THE AUTHORITATIVE ONE. C-0c audits `BINDINGS`
// and the vocab `commands[].drives*` copy. Both are AUTHORED records of what a command does — written by someone
// reading the corpus. The `trigger` string on a ratified transition is the CORPUS ITSELF naming the command that
// performs that arrow, e.g. `"Begin recomposition (beginRecomposition; RecompositionStarted)"`. When an authored
// row and the ratified trigger disagree, the trigger wins.
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
import type { TransitionClaim } from './binding-row-truth.js';

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
