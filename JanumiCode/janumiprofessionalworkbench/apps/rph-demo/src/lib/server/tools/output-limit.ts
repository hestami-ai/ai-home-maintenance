// ⭐⭐ `JAN-EXEC` Phase 7 P5, package A (F1) — A REVIEWER'S REPLY THE TOOL ENDED AT THE MODEL'S OUTPUT-TOKEN LIMIT, AS ITS OWN
// CLASS: never a call with no reply, never a transport failure.
//
// ⛔ WHAT WAS WRONG (P5's analysis of run-5). Every reviewer no-response P5 recorded, 7 of 44 calls, was one cause: the
// reviewing model spent devin's output-token cap and devin exited non-zero, saying *"Response truncated: model hit max
// output token limit"*. `devinPrint` kept only the rejection's message and deleted the export devin wrote; the validator
// recorded the call NO_RESPONSE, *"with no reply"* — false of a call whose reply devin had cut, one of them a whole
// verdict short of its last field.
// ⭐ WHAT THIS MODULE HOLDS, so the adapter that throws the class, the validator that records it and every reader of the
// record agree on it: the error (`OutputLimitReached`), the marker E-5's detail opens with (`OUTPUT_LIMIT`), the detail
// itself (`outputLimitDetail`), and the one reading of a stored record (`outputLimitOf`).
// ⚠ PURE, AND IMPORTING NOTHING AT RUNTIME: the run report and the recorder read records with it, and load no reviewer.
import type { AdapterToolObservation, ToolInvocationResult } from './backing-tool.js';

/**
 * The marker E-5's detail OPENS WITH on a try whose reply the tool ended at the model's output-token limit — the class's
 * name on the record, beside E-4's `outputTruncation: DECLARED` (`outputLimitOf` reads the two together).
 */
export const OUTPUT_LIMIT = 'OUTPUT_LIMIT: the reply ended at the model’s output-token limit.';

/** How a finish reason may look to be carried onto the record: a tool-written token, bounded, never free text. */
export const FINISH_REASON_SHAPE = /^[A-Za-z_]{1,40}$/;

/** What E-5's detail writes for a fact the tool's export did not report. */
const NOT_REPORTED = 'not reported';

/** What the tool reported of the cut: each fact only when it reported it. */
export interface OutputLimitFacts {
	/** The finish reason the tool gave the last step, in `FINISH_REASON_SHAPE`. */
	readonly finishReason?: string;
	/** The output tokens the tool counted for the last step. */
	readonly outputTokens?: number;
}

/**
 * ⭐ THE CLASS, AS THE ADAPTER THROWS IT: a call that failed — the tool exited non-zero — whose reply the tool ended at
 * the model's output-token limit. ⛔ `message` is the adapter's diagnostic, exactly what it throws for every other failure
 * (the prompt measured out of it, `diagnosticCarriesPrompt`): the validator's seam sanitises it as it sanitises every
 * throw. The partial reply rides BESIDE it, never in it, and is kept on the content plane only.
 */
export class OutputLimitReached extends Error {
	readonly facts: OutputLimitFacts;
	/** What the tool printed of the reply before it cut it — possibly nothing. */
	readonly partialReply: string;
	/** Who answered, when the tool's export named the model; absent, the host's configured identity stands. */
	readonly producer?: ToolInvocationResult['producer'];
	/** What the tool could see of tool calls, in its own words. */
	readonly observedToolCalls: AdapterToolObservation;
	/** The tool's own record of the session, when it wrote one (`ToolInvocationResult.sessionExport`). */
	readonly sessionExport?: string;

	constructor(
		message: string,
		cut: {
			readonly facts: OutputLimitFacts;
			readonly partialReply: string;
			readonly producer?: ToolInvocationResult['producer'];
			readonly observedToolCalls: AdapterToolObservation;
			readonly sessionExport?: string;
		}
	) {
		super(message);
		this.name = 'OutputLimitReached';
		this.facts = cut.facts;
		this.partialReply = cut.partialReply;
		if (cut.producer !== undefined) this.producer = cut.producer;
		this.observedToolCalls = cut.observedToolCalls;
		if (cut.sessionExport !== undefined) this.sessionExport = cut.sessionExport;
	}
}

/**
 * E-5's detail for such a try: the marker, when it was cut and what the tool reported of the cut, that its partial reply
 * is kept and judged from nothing, what became of the call (`clause`, the thrown call's rule), and the tool's own words,
 * SANITISED (`reported`, the seam's form). ⛔ No byte of the partial reply: it is model-written, and lives on the content
 * plane alone.
 */
export function outputLimitDetail(o: {
	readonly facts: OutputLimitFacts;
	readonly partialChars: number;
	readonly elapsedMs: number;
	readonly clause: string;
	readonly reported: string;
}): string {
	const when = Number.isFinite(o.elapsedMs) && o.elapsedMs >= 0 ? ` after ${o.elapsedMs} ms` : '';
	return (
		`${OUTPUT_LIMIT} The reviewing tool ended the model’s reply${when}: finish_reason ` +
		`${o.facts.finishReason ?? NOT_REPORTED}, output_tokens ${o.facts.outputTokens ?? NOT_REPORTED}. Its partial reply, ` +
		`${o.partialChars} characters, is kept unparsed for diagnosis, and nothing is judged from it; ${o.clause}. ` +
		`What the tool reported, sanitised: ${o.reported}`
	);
}

/** The facts `outputLimitDetail` writes, read back. */
const WRITTEN_FACTS = /: finish_reason (not reported|[A-Za-z_]{1,40}), output_tokens (not reported|\d+)\. /;

/** A stored try of the class, as `outputLimitOf` reads it. */
export interface RecordedOutputLimit {
	readonly finishReason: string | null;
	readonly outputTokens: number | null;
}

/**
 * ⭐ THE ONE READING OF THE CLASS FROM A STORED `MODEL_EXCHANGE`'s state: what the tool reported of the cut, or `undefined`
 * for any other try. Told by the pair the validator writes together — E-4's `outputTruncation: DECLARED` and the marker
 * opening E-5's detail — never by the disposition, which a refused substitute and a failed repair share (`REJECTED`).
 */
export function outputLimitOf(state: unknown): RecordedOutputLimit | undefined {
	const s = (state ?? {}) as { readonly outputTruncation?: unknown; readonly parseOutcome?: { readonly detail?: unknown } };
	const detail = typeof s.parseOutcome?.detail === 'string' ? s.parseOutcome.detail : '';
	if (s.outputTruncation !== 'DECLARED' || !detail.startsWith(OUTPUT_LIMIT)) return undefined;
	const facts = WRITTEN_FACTS.exec(detail);
	const reason = facts?.[1];
	const tokens = facts?.[2];
	return {
		finishReason: reason === undefined || reason === NOT_REPORTED ? null : reason,
		outputTokens: tokens === undefined || tokens === NOT_REPORTED ? null : Number(tokens)
	};
}
