// The NORMALIZED agent seam. The UI + SSE route speak this vocabulary, never Pi's — so the whole loop (chat ->
// tool calls -> graph re-render) is exercised by a deterministic MockAuthoringAgent in the gate, and the live Pi
// implementation just maps its richer event stream onto these same events. Swapping mock <-> Pi changes nothing
// downstream.
import type { ProfessionalRationaleSummary } from '@janumipwb/rph-assurance';

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

export type EmitFn = (event: AuthoringAgentEvent) => void;

/** An authoring agent: given a natural-language instruction, drive the tools and stream normalized events. */
export interface AuthoringAgent {
	run(instruction: string, emit: EmitFn, signal?: AbortSignal): Promise<void>;
	/** The §9.7 professional rationale summary this run RETURNED — the producer's own account of its work, which
	 *  the execution contract requires alongside its proposals. Undefined when the producer never declared one;
	 *  that is a contract shortfall to record, never an absence to infer from (§9.7). */
	rationale(): ProfessionalRationaleSummary | undefined;
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
	/** Whether this tool mutates the DRAFT (PROPOSE) or only reads it (READ) — surfaced to the log/UI. */
	readonly mutates: boolean;
	run(args: Record<string, unknown>): ToolRunResult;
}
