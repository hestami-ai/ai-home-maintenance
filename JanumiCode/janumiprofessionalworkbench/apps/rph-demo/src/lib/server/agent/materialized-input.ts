// ICP-01 — make PER-9's "exact materialized input" OBTAINABLE.
//
// ── WHAT WAS MISSING, AND WHY IT WAS NOT A RECORDING BUG ────────────────────────────────────────────────────
// `PER-9` requires every bounded model try to capture "the exact materialized input presented to the model".
// `pi-agent.ts` hands Pi a `systemPromptOverride` and an `instruction`; Pi's `DefaultResourceLoader` composes
// the system prompt, context files, skills, tool schemas and history INSIDE the SDK. **JPWB never held the
// composite it sent.** So E-1 was UNAVAILABLE rather than unrecorded, and no amount of persistence work could
// have reached it — which is why ICP-01 is a build step and precedes the record (ICP-02).
//
// This is also the sponsor's originating complaint in its structural form: the party that must diagnose an
// oversized prompt could not perceive it.
//
// ── THE SEAM IS PI'S OWN DOCUMENTED HOOK, NOT AN INTERNAL ───────────────────────────────────────────────────
// `onPayload` (pi-ai `types.d.ts`): "Optional callback for inspecting or replacing provider payloads before
// sending. Return undefined to keep the payload unchanged." It fires once per provider request, which is
// exactly PER-9's unit — "each retry, reformat, and repair request included". `Agent.onPayload` is a public,
// writable property and `AgentSession.agent` is public, so this installs through the supported surface.
//
// ⚠ NO PI IMPORT HERE, DELIBERATELY. `pi-agent.ts` is the ONLY module that may import Pi (the factory
// dynamic-imports it so the mock path and the whole gate never load Pi's heavy Node deps). This module is
// therefore STRUCTURALLY typed against the two properties it touches.
//
// ── ⚠⚠ IN-MEMORY ONLY, AND THAT IS A CONTRACT, NOT AN OVERSIGHT ─────────────────────────────────────────────
// Captured bytes are held for the life of the turn and never written anywhere. Persisting them is ICP-02, and
// it is BLOCKED behind ICP-03 (`REG-Q-B`) for a reason that is already a filed finding: no redaction exists
// anywhere in this codebase (finding #60), and `domain_events` is immutable and permanent (§9.4). Writing an
// unredacted provider payload into the event store would create exactly the unpurgeable artifact that
// `transcript.ts` drops `thinking` to avoid — and PER-12 requires retained content to be purgeable at
// retention expiry. **Do not wire this to durable storage until the purgeable plane exists.**

/** The two fields this module reads off Pi's resolved `Model`. Structural so Pi is never imported here. */
export interface ResolvedModelRef {
	readonly id: string;
	readonly provider: string;
}

/** Pi's payload hook, structurally. Returning `undefined` keeps the payload unchanged. */
export type PayloadHook = (
	payload: unknown,
	model: ResolvedModelRef
) => unknown | undefined | Promise<unknown | undefined>;

/** Anything carrying Pi's `onPayload` seam — in production, `AgentSession.agent`. */
export interface PayloadHookHost {
	onPayload?: PayloadHook;
}

/** One bounded try's materialized input, plus the identity that received it (PER-9 E-1 + E-3). */
export interface MaterializedInput {
	/** The provider payload EXACTLY as sent — after Pi's composition and after any prior hook's replacement. */
	readonly payload: unknown;
	/** The resolved model actually invoked, never a configured default (PER-9 E-3). */
	readonly modelId: string;
	readonly providerId: string;
}

export interface MaterializedInputRecorder {
	/** Install the observer on a host, preserving and chaining any hook already present. */
	install(host: PayloadHookHost): void;
	/** The captured inputs, in dispatch order — one per provider request. */
	captured(): readonly MaterializedInput[];
}

function isThenable(v: unknown): v is Promise<unknown> {
	return typeof (v as { then?: unknown } | null | undefined)?.then === 'function';
}

/**
 * A recorder for the inputs actually presented to the model.
 *
 * CHAINING IS PART OF THE CONTRACT. A prior `onPayload` may legitimately REPLACE the payload; this observer
 * must neither drop that replacement (which would silently change what the model receives — a behaviour change
 * smuggled in by an observability feature) nor record its own argument in preference to it. What is recorded is
 * what is actually sent: the prior hook's replacement when it returns one, otherwise the payload unchanged.
 */
export function createMaterializedInputRecorder(): MaterializedInputRecorder {
	const inputs: MaterializedInput[] = [];
	const record = (payload: unknown, model: ResolvedModelRef): void => {
		inputs.push({ payload, modelId: model.id, providerId: model.provider });
	};

	return {
		install(host: PayloadHookHost): void {
			const prior = host.onPayload;
			host.onPayload = (payload, model) => {
				if (!prior) {
					record(payload, model);
					// Pi's documented "unchanged" signal. Returning `payload` here would exercise the REPLACE
					// half of a hook this module only means to observe.
					return undefined;
				}
				const out = prior(payload, model);
				if (isThenable(out))
					return out.then((v) => {
						record(v === undefined ? payload : v, model);
						return v;
					});
				record(out === undefined ? payload : out, model);
				return out;
			};
		},
		captured(): readonly MaterializedInput[] {
			return inputs;
		}
	};
}
