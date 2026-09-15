// ⭐⭐ R11 — THE ONE PLACE THE TOOL-CALL RETENTION RULING IS APPLIED.
//
// An adapter reports what it SAW (`AdapterToolObservation`). This turns that into what a PERMANENT governed
// record is allowed to hold. The two are deliberately different shapes, and every difference between them is a
// ruling with a reason.
//
// ── ⛔ THE RULING, AND WHY IT IS NOT "RECORD THE ARGS" ───────────────────────────────────────────────────────
//
// `R10` (sponsor, 2026-09-15) confirmed that a contracted rationale on a `MODEL_EXCHANGE` is `PER-8`
// participating material and therefore **PERMANENT — nothing deletes it, ever**. `R11` puts a second class of
// content into that same permanent record, and tool-call ARGUMENTS are MODEL-CHOSEN STRINGS: §22.1 classifies
// model output as UNTRUSTED EXTERNAL INPUT, and this programme has twice found a host absolute path and an
// operating username reaching a governed refusal (`B5`; `W1`, disclosed and gated as `P2B-ar`). Its standing
// rule for such a field is that it carries the **errno CODE and a directory NAME, never a path**.
//
//   RECORDED  the ORDINAL, the OUTCOME the adapter observed, and the tool NAME — but only when that name is one
//             the HOST MINTED. A minted name is drawn from a closed set the host itself authored, so it cannot
//             carry model-chosen content; it is the host's word about its own tool surface.
//   BOUNDED   the number of calls written. An UNTRUSTED party decides how many calls to make, and an unbounded
//             array on a permanent record is unbounded permanent storage under that party's control. The cap is
//             applied here and DECLARED in the record (`recordedLimit`, `observedCount`) — a truncated list that
//             did not say so would read exactly like a complete one, which is `REG-F-345`'s shape.
//   REFUSED   the ARGUMENTS, entirely, and an UNMINTED NAME's spelling. There is no field on `ObservedToolCall`
//             that can hold either, so the guarantee is STRUCTURAL rather than disciplinary — the same move
//             `ExchangeContentRef` makes by having no `bytes` field.
//
// ⭐ THE ARGUMENT FOR REFUSING, STATED AS AN ASYMMETRY BETWEEN THE PLANES RATHER THAN AS A PREFERENCE. `PER-9`
// says retention is *"subject to recorded redaction"* and, in the same sentence, that *"record-plane omission is
// not [legal]"*. So the CONTENT plane has a lawful way to remove bytes later (E-6, the redaction manifest) and
// the RECORD plane has none, by design. Untrusted free text is therefore admissible to one and inadmissible to
// the other, and "record the args verbatim" is not a smaller version of the same decision — it is the decision
// taken on the plane that cannot undo it.
//
// ⚠ AND THE COMMAND A STEP RAN IS NOT LOST. It remains observable through `materializedInputRef` and
// `answerSpanRef`, which are content-plane references. What this refuses is putting it somewhere nothing can
// ever take it out of.
import type { ObservedToolCall, ObservedToolCallReport } from '@janumipwb/rph-contracts';
import type { AdapterToolObservation } from './backing-tool.js';

/**
 * How many observed calls one exchange record may name.
 *
 * ⚠ AUTHORED, NOT DERIVED, AND SAID SO RATHER THAN DRESSED AS A MEASUREMENT. Nothing measured says 32 is the
 * right number; the design's own open questions already record the spike's 64KB capture cap as *"arbitrary and
 * unratified"*, and inventing a justification for this one would be worse than admitting it has none. What IS
 * argued is that SOME bound must exist (see the header) and that the bound must be visible in the record.
 */
export const OBSERVED_TOOL_CALL_LIMIT = 32;

/**
 * Turn one adapter's raw observation into the governed, permanent-record-safe report.
 *
 * ⛔ THERE IS NO ARM THAT FABRICATES. An adapter that cannot observe produces `NOT_OBSERVABLE` carrying its own
 * stated reason — never `NONE_OBSERVED`, which is a MEASUREMENT and would assert that a tool surface existed and
 * went unused. Those two are the pair `PER-9` is about: a disclosed absence is legal, a silent one is not, and
 * an absence that disguises itself as a measurement is the worst of the three.
 */
export function governedToolCallReport(observation: AdapterToolObservation): ObservedToolCallReport {
	if (!observation.canObserve)
		return { observation: 'NOT_OBSERVABLE', reason: observation.reason };

	if (observation.calls.length === 0)
		return {
			observation: 'NONE_OBSERVED',
			reason:
				'This adapter observes tool calls and observed none on this try. ⭑ That is a MEASUREMENT a reader ' +
				'may rely on, and it is a different fact from NOT_OBSERVABLE: the tool surface this adapter minted ' +
				`was ${describeMinted(observation.mintedToolNames)}, and the model called nothing on it.`
		};

	// ⚠ THE CHECK IS AGAINST THE SET THE ADAPTER SAYS IT MINTED, not against any catalog here. A name this file
	// recognised on its own authority would be this file's claim about somebody else's tool surface.
	const minted = new Set(observation.mintedToolNames);
	const calls: ObservedToolCall[] = observation.calls
		.slice(0, OBSERVED_TOOL_CALL_LIMIT)
		.map((call, index) =>
			minted.has(call.name)
				? {
						ordinal: index + 1,
						nameProvenance: 'MINTED_BY_HOST' as const,
						toolName: call.name,
						outcome: call.outcome
					}
				: // ⛔ THE NAME IS DROPPED AND THE FACT IS KEPT. An unminted name is an arbitrary model-chosen
					// string heading for a record nothing can ever redact. That an unminted call was ATTEMPTED is
					// the security-relevant fact and it survives; the model's spelling of it does not.
					{
						ordinal: index + 1,
						nameProvenance: 'NOT_MINTED' as const,
						outcome: call.outcome
					}
		);

	return {
		observation: 'OBSERVED',
		calls,
		// ⭑ THE TOTAL, NOT THE KEPT COUNT. `calls.length` and this number differ exactly when the bound bit, and
		// a reader comparing them is the only way to know that it did.
		observedCount: observation.calls.length,
		recordedLimit: OBSERVED_TOOL_CALL_LIMIT
	};
}

/** Name the minted surface without ever spelling a model-chosen string — the set is the HOST's own. */
function describeMinted(mintedToolNames: readonly string[]): string {
	return mintedToolNames.length === 0
		? 'EMPTY (no tool was minted for this step)'
		: `[${[...mintedToolNames].sort((a, b) => Number(a > b) - Number(a < b)).join(', ')}]`;
}
