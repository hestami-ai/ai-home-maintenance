// The NORMALIZED agent seam. The UI + SSE route speak this vocabulary, never Pi's — so the whole loop (chat ->
// tool calls -> graph re-render) is exercised by a deterministic MockAuthoringAgent in the gate, and the live Pi
// implementation just maps its richer event stream onto these same events. Swapping mock <-> Pi changes nothing
// downstream.
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';
import type { MaterializedInput } from './materialized-input.js';

/** The ACTUAL producer of this run — the resolved model/provider, not a role label. §8.12 checks independence
 *  against actual model/provider identity, so the floor cannot use a compile-time placeholder here. */
export interface ProducerIdentity {
	readonly agentId: string;
	readonly modelId: string;
	readonly providerId: string;
}

/** A normalized event streamed from an authoring agent run (mapped from Pi's event stream, or emitted by the mock). */
export type AuthoringAgentEvent =
	| { readonly kind: 'status'; readonly text: string }
	| { readonly kind: 'producer'; readonly producer: ProducerIdentity }
	| { readonly kind: 'text'; readonly text: string }
	| { readonly kind: 'thinking'; readonly text: string }
	| { readonly kind: 'tool_start'; readonly tool: string; readonly args: Record<string, unknown> }
	| {
			readonly kind: 'tool_end';
			readonly tool: string;
			readonly ok: boolean;
			readonly summary: string;
	  }
	| { readonly kind: 'error'; readonly message: string }
	| { readonly kind: 'done' };

/**
 * Every streamed event kind, as a VALUE so it can be iterated at runtime.
 *
 * ⭑ THIS EXISTS BECAUSE A HAND-LISTED SET SHIPPED A DEFECT. The write-boundary omission map was authored by
 * hand as {thinking: …} and never checked against this union; `status`, `producer` and `done` fell through
 * and were dropped with nothing declared — and `producer` carries PER-9's E-3. The two checks below make that
 * drift a COMPILE error in BOTH directions: a new event kind not listed here fails, and a stale entry here that
 * no longer exists in the union fails too. One-directional exhaustiveness is how a list rots while still
 * type-checking.
 */
export const AUTHORING_EVENT_KINDS = [
	'status',
	'producer',
	'text',
	'thinking',
	'tool_start',
	'tool_end',
	'error',
	'done'
] as const;

export type AuthoringEventKind = (typeof AUTHORING_EVENT_KINDS)[number];

/** Compile-time proof that the list and the union are the SAME set. Neither assignment may be removed: each
 *  catches drift the other cannot see. */
const _everyUnionMemberIsListed: AuthoringAgentEvent['kind'] extends AuthoringEventKind ? true : never = true;
const _everyListedMemberIsInUnion: AuthoringEventKind extends AuthoringAgentEvent['kind'] ? true : never = true;
void _everyUnionMemberIsListed;
void _everyListedMemberIsInUnion;

export type EmitFn = (event: AuthoringAgentEvent) => void;

/** An authoring agent: given a natural-language instruction, drive the tools and stream normalized events. */
export interface AuthoringAgent {
	run(instruction: string, emit: EmitFn, signal?: AbortSignal): Promise<void>;
	/** The §9.7 professional rationale summary this run RETURNED — the producer's own account of its work, which
	 *  the execution contract requires alongside its proposals. Undefined when the producer never declared one;
	 *  that is a contract shortfall to record, never an absence to infer from (§9.7). */
	rationale(): ProfessionalRationaleSummary | undefined;
	/** ICP-01 — the exact materialized inputs presented to the model this run, one per bounded try (PER-9 E-1 +
	 *  E-3). REQUIRED rather than optional so every agent must STATE its position: an implementation that makes
	 *  no provider request returns `[]` because there was nothing to present, which is a different fact from
	 *  "not captured" and should be readable as such.
	 *  ⚠ IN-MEMORY FOR THE TURN. Persisting these is ICP-02 and is blocked behind ICP-03 — see
	 *  `materialized-input.ts`. */
	materializedInputs(): readonly MaterializedInput[];
}

// ---- Pi-agnostic tool parameter DSL ----------------------------------------------------------------
// A tiny finite param vocabulary the tools declare once. The mock reads args straight; the Pi adapter maps it to
// TypeBox. Keeping it flat (string / boolean / string[]) means a single source of truth for every tool's schema
// (concern 1: the field descriptions come from the shared @janumipwb/rph-authoring help), with no runtime schema
// translation risk.

export type ParamType = 'string' | 'boolean' | 'string[]' | 'object[]';

export interface ParamDef {
	readonly type: ParamType;
	readonly description: string;
	readonly required?: boolean;
	/** For type 'object[]': the per-item field schema (mapped to an array-of-objects for the model). */
	readonly items?: ParamSpec;
}

export type ParamSpec = Record<string, ParamDef>;

/** The outcome of running a tool — a human summary the agent (and the log) reads, plus optional machine data. */
export interface ToolRunResult {
	readonly ok: boolean;
	readonly summary: string;
	readonly data?: unknown;
}

/** A Pi-agnostic authoring tool: name + description + flat param spec + an execute that calls the broker. */
export interface AuthoringToolDescriptor {
	readonly name: string;
	readonly description: string;
	readonly parameters: ParamSpec;
	/** Whether this tool mutates governed workbench state (usually the DRAFT; see shared policy creation). */
	readonly mutates: boolean;
	run(args: Record<string, unknown>): ToolRunResult;
}
