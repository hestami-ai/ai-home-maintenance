// JAN-CMDPRE DWP-01b — the Precondition mechanism (DS-001 D1/D5/D8).
//
// A state-advancing command declares the PRECONDITION under which it may be issued, over (loadedState, payload).
// A source-state allowlist (FROM_STATES) is the common special case, NOT the general form: the Decision family
// discriminates on `decisionType` — a non-state field no state set can reach (DS §5) — and ChangePwuState's only
// correct state set is the machine's entire state list (DS D10), so its rule is a PREDICATE. ALL_OF composes,
// evaluated IN ORDER with the first refusal winning — order is semantic: `denyWaiver` refuses on KIND before
// STATE so a mis-aimed denial reads as the category error it is, preserving DWP-01a's refusal codes exactly.
//
// SIGNATURE RULING (roadmap DWP-01b, critique B4 — settled here, in writing). PREDICATE's `check` receives a
// narrow READ-ONLY reader, NOT HandlerContext: a precondition is a declaration about admissibility, and handing
// it the store's commit/transaction surface would let a declaration write. The reader exposes exactly the two
// read facets a precondition can need — an object's current state (cross-object rules, e.g. a policy lookup)
// and an aggregate's committed events (DWP-08's duplicate-evidence rule, undecidable from (state, payload)).
// It is UNUSED by every production predicate until DWP-08; the ruling fixes the signature NOW so DWP-08 cannot
// ripple back through the migrated call sites and the DWP-06 mandatory type flip.
//
// The no-write property is MECHANICAL, not conventional: the primitives hand `check` CLONES of the loaded state
// and the command payload (both are otherwise live references into the commit path / default event payload),
// and the reader is copy-on-read at the storage adapters — so a mutating predicate corrupts only its own copy.
//
// This module is a LEAF: it imports only contracts, returns refusal DESCRIPTORS ({code, message}), and the
// write primitives map them through their own `reject` — so the primitives depend on it, never the reverse.
import type { DomainCommand, DomainEvent, RphErrorCode } from '@janumipwb/rph-contracts';

/** The read-only surface a PREDICATE may consult (critique B4 ruling — never the full HandlerContext). */
export interface PreconditionReader {
	/** Another (or this) object's current committed state, if it exists. */
	readonly objectState: (id: string) => Record<string, unknown> | undefined;
	/** One aggregate's committed events in aggregateRevision order. */
	readonly aggregateEvents: (aggregateType: string, aggregateId: string) => readonly DomainEvent[];
}

/** What a PREDICATE sees: the loaded state, the command (payload included), and the read-only reader. */
export interface PredicateInput {
	readonly state: Record<string, unknown>;
	readonly payload: unknown;
	readonly command: DomainCommand;
	readonly read: PreconditionReader;
}

export type Precondition =
	| {
			/** The state-set special case: the command may be issued only FROM these states (JAN-NOOP-01). */
			readonly kind: 'FROM_STATES';
			readonly states: readonly [string, ...string[]];
	  }
	| {
			/** The general case: an arbitrary admissibility rule over (state, payload) — and, from DWP-08, the reader. */
			readonly kind: 'PREDICATE';
			/** What the rule requires, stated positively — surfaces in the census, never in a refusal. */
			readonly describe: string;
			/** null = admissible; a string = the refusal message (the variant's errorCode supplies the code). */
			readonly check: (input: PredicateInput) => string | null;
			/** Refusal code; defaults to RPH_VALIDATION_SEMANTIC_FAILED (the state arrow is legal — the command is
			 *  semantically inapplicable to this target). */
			readonly errorCode?: RphErrorCode;
	  }
	| {
			/** Ordered conjunction — first refusal wins. Order is part of the declaration's meaning. */
			readonly kind: 'ALL_OF';
			readonly all: readonly [Precondition, ...Precondition[]];
	  };

export const fromStates = (...states: [string, ...string[]]): Precondition => ({
	kind: 'FROM_STATES',
	states
});

export const predicate = (
	describe: string,
	check: (input: PredicateInput) => string | null,
	errorCode?: RphErrorCode
): Precondition => ({ kind: 'PREDICATE', describe, check, ...(errorCode ? { errorCode } : {}) });

export const allOf = (...all: [Precondition, ...Precondition[]]): Precondition => ({
	kind: 'ALL_OF',
	all
});

/** A refusal descriptor — the caller (a write primitive) maps it through its own `reject`. */
export interface PreconditionRefusal {
	readonly code: RphErrorCode;
	readonly message: string;
}

/** What the evaluator needs beyond the predicate input to phrase a FROM_STATES refusal exactly as
 *  DWP-00's requireFrom did (subject = 'intent' for advanceIntent, the objectType for advanceStatus). */
export interface PreconditionSite {
	readonly statusField: string;
	readonly subject: string;
	readonly eventType: string;
}

export function evaluatePrecondition(
	pre: Precondition,
	input: PredicateInput,
	site: PreconditionSite
): PreconditionRefusal | null {
	switch (pre.kind) {
		case 'FROM_STATES': {
			const from = String(input.state[site.statusField]);
			if (pre.states.includes(from)) return null;
			return {
				code: 'RPH_ILLEGAL_STATE_TRANSITION',
				message: `${input.command.commandType} requires ${site.subject} ${input.command.targetAggregateId} to be ${pre.states.join(' or ')}, but it is ${from}. Re-issuing it would append a second ${site.eventType} recording a change that did not happen.`
			};
		}
		case 'PREDICATE': {
			const failure = pre.check(input);
			if (failure === null) return null;
			return { code: pre.errorCode ?? 'RPH_VALIDATION_SEMANTIC_FAILED', message: failure };
		}
		case 'ALL_OF': {
			for (const p of pre.all) {
				const refusal = evaluatePrecondition(p, input, site);
				if (refusal) return refusal;
			}
			return null;
		}
	}
}
