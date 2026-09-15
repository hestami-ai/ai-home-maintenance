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
//             the HOST MINTED. It is the host's word about its own tool surface, and this file decides it by
//             asking the ADAPTER what it minted.
//   BOUNDED   the number of calls written. An UNTRUSTED party decides how many calls to make, and an unbounded
//             array on a permanent record is unbounded permanent storage under that party's control. The cap is
//             applied here and DECLARED in the record (`recordedLimit`, `observedCount`) — a truncated list that
//             did not say so would read exactly like a complete one, which is `REG-F-345`'s shape.
//   REFUSED   the ARGUMENTS, entirely, and an UNMINTED NAME's spelling. There is no field on `ObservedToolCall`
//             that can hold either, so the guarantee is STRUCTURAL rather than disciplinary — the same move
//             `ExchangeContentRef` makes by having no `bytes` field.
//
// ── ⛔ WHAT THIS FILE DOES **NOT** DO, CORRECTED BY THE R11 REVIEW (W1, W2) ──────────────────────────────────
//
// Two of the three lines above were written as though they described the RECORD. They described THIS FUNCTION.
//
//   · *"a minted name … cannot carry model-chosen content"* was FALSE OF THE BOUNDARY. `nameProvenance` is a
//     DECLARATION the dispatching caller makes, and the kernel checked only that it agreed with the presence of
//     `toolName`. A host absolute path, a credentials string, a NUL byte and a 200KB blob were DRIVEN in as
//     `MINTED_BY_HOST` and ACCEPTED. The name's SHAPE is now bounded by the contract itself
//     (`RecordPlaneNameSchema`), so the refusal survives a second producer — which this one cannot do.
//   · the CAP was likewise this function's, not the record's: 64 calls declaring a `recordedLimit` of 64 were
//     ACCEPTED. `OBSERVED_TOOL_CALL_LIMIT` now lives in `@janumipwb/rph-contracts` and is applied by the schema;
//     this module IMPORTS it rather than declaring a second 32 that could drift from the enforced one.
//
// ⭐ THE LESSON IS `B8`'s, ARRIVING IN A PERMANENT RECORD: a rule that runs only where its author happens to
// stand is not a control. What makes a guarantee a guarantee is that it holds for a caller who never read this
// file.
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
import {
	OBSERVED_TOOL_CALL_LIMIT,
	type ObservedToolCall,
	type ObservedToolCallReport
} from '@janumipwb/rph-contracts';
import type { AdapterToolObservation } from './backing-tool.js';

/**
 * How many observed calls one exchange record may name — RE-EXPORTED FROM THE CONTRACT, never re-declared.
 *
 * ⛔ IT USED TO BE A LOCAL `= 32` (R11 REVIEW, W1). Two numbers that must agree and are written in two places
 * are two numbers that will eventually disagree, and the disagreement here is invisible: this module would keep
 * truncating at its own figure while the record declared the contract's. Importing the ONE definition makes the
 * producer's bound and the enforced bound the same object, so a later ruling that moves the cap moves both.
 * ⚠ AUTHORED, NOT DERIVED, and argued as such where it is defined (`rph-contracts/src/record-plane-bounds.ts`).
 */
export { OBSERVED_TOOL_CALL_LIMIT };

/**
 * Turn one adapter's raw observation into the governed, permanent-record-safe report.
 *
 * ⛔ THERE IS NO ARM THAT FABRICATES. An adapter that cannot observe produces `NOT_OBSERVABLE` carrying its own
 * stated reason — never `NONE_OBSERVED`, which is a MEASUREMENT and would assert that a tool surface existed and
 * went unused. Those two are the pair `PER-9` is about: a disclosed absence is legal, a silent one is not, and
 * an absence that disguises itself as a measurement is the worst of the three.
 *
 * ⚠ DISCLOSED, AND OWED TO PHASE 3 RATHER THAN SETTLED HERE (`R11-W-R2`). This function now emits into a field
 * whose SHAPE is bounded: a `toolName` must be a name (`RecordPlaneNameSchema`), and a `reason` must be prose
 * under 4096 characters with no control character. Both hold trivially today — NO adapter at HEAD mints a tool
 * surface, so `mintedToolNames` has no producer and every live reason is a literal authored in this repository,
 * the longest 523 characters. ⛔ WHEN PHASE 3 MINTS A SURFACE, a host that mints a name the record plane cannot
 * hold (a space in it, say) makes the WHOLE exchange record unwritable, and the three candidate answers — drop
 * the spelling while keeping `MINTED_BY_HOST` (which the handler refuses), call it `NOT_MINTED` (which is
 * FALSE), or add a third provenance member (a contract change with no ratification and no producer) — are a
 * decision for the increment that first has one, not for this one. The same is true of `describeMinted`, whose
 * output is the only term in a reason that GROWS with the host's own minted set.
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
