// ⭐⭐ THE RECORD PLANE'S STRUCTURAL BOUNDS — what a PERMANENT, UNREDACTABLE record may hold, expressed as a
// property of the SHAPE rather than as a promise about the caller.
//
// ── ⛔ WHY THIS FILE EXISTS, AND THE EXACT ERROR IT REPAIRS ──────────────────────────────────────────────────
//
// `R11` landed `ObservedToolCall` and `WorkProductDerivation` on `MODEL_EXCHANGE`, and said of the tool name:
// *"a minted name is drawn from a closed set the HOST authored and cannot carry model-chosen content."* ⛔ THAT
// SENTENCE WAS FALSE OF THE BOUNDARY. The boundary checked the DISCRIMINATOR'S CONSISTENCY — that a
// `MINTED_BY_HOST` call names something and a `NOT_MINTED` call names nothing — and never the name's CONTENT. An
// independent review DROVE a host absolute path, a username-bearing path, a credentials-shaped string, a NUL
// byte and a 200KB blob into `toolName` with `nameProvenance: MINTED_BY_HOST`, and all five were ACCEPTED.
//
// ⭐ THAT IS THE `B8` VERDICT THIS PROGRAMME ALREADY EARNED, one field over: *a convention with zero production
// call sites is not a control.* Enforcing at the PRODUCER (`governedToolCallReport`) and calling it enforced at
// the BOUNDARY is the same error — the producer's honesty is not the record's shape, and a second producer, or
// a direct dispatch, is one commit away.
//
// ── ⭐ WHY A STRUCTURAL BOUND AND NOT THE HOST'S ACTUAL MINTED SET ───────────────────────────────────────────
//
// The stronger repair would validate a recorded name against the set the host really minted. ⛔ IT IS NOT
// AVAILABLE AT THIS BOUNDARY, and the reason is a ruling this repository already made rather than a
// convenience. The minted set is SESSION-SCOPED and known only to the adapter that opened the session
// (`AdapterToolObservation.mintedToolNames`); the kernel is host-agnostic and cannot reach into an app adapter.
// Minting the set into the wire vocabulary instead is refused by `backing-tool.ts`'s own recorded position —
// *"of the 100 closed enums in the ratified contracts NOT ONE names a tool, agent, provider, CLI or vendor, and
// `PER-2` would make a deployment fact permanent"*. And carrying the set in the PAYLOAD beside the name would
// re-create the very defect: the caller would declare both halves, and the check would be self-consistency
// again — `W1`'s shape, where 64 calls declaring a limit of 64 were accepted.
//
// ⚠ SO THE BOUND IS WEAKER THAN A MEMBERSHIP TEST AND IS SAID TO BE. What it buys is that the refusal is a
// property of the SHAPE rather than of a caller's honesty: a path, a NUL byte, a credentials string and a
// captured blob cannot land whatever the caller declares about them.
//
// ── ⛔ THE ASYMMETRY THAT MAKES ANY OF THIS NECESSARY ────────────────────────────────────────────────────────
//
// `PER-9` makes content-plane retention *"subject to recorded redaction"* (E-6) and, in the same breath, says
// record-plane omission is NOT legal. So the CONTENT plane has a lawful way to remove bytes later and the
// RECORD plane has none — and `R10` (2026-09-15) confirmed this record is PERMANENT under `PER-8`. Untrusted
// free text is therefore admissible to one plane and inadmissible to the other.
import { z } from 'zod';

/**
 * How long a recorded NAME may be. ⚠ AUTHORED, AND SAID TO BE AUTHORED rather than dressed as a measurement —
 * the same posture `OBSERVED_TOOL_CALL_LIMIT` takes below. What is ARGUED is not that 64 is the right number
 * but that a NAME IS SHORT: the longest name anything in this repository mints or records is `workProduct`
 * (11 characters). Nothing measured says 64.
 */
const RECORD_PLANE_NAME_MAX_LENGTH = 64;

/**
 * What a recorded NAME may be spelled with.
 *
 * ⛔ THE CHARACTER CLASS IS THE WHOLE CONTROL, and it is chosen for what it EXCLUDES rather than for what it
 * admits: no backslash, forward slash or colon (so no path), no `=` (so no `KEY=value` credential), no space,
 * no control character (so no NUL). A leading letter is required because a name that begins with a separator
 * is a fragment of something else.
 */
const RECORD_PLANE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;

/**
 * A NAME on the record plane: a host-authored identifier, bounded in length and in character class.
 *
 * ⚠ WHAT THIS DOES **NOT** ESTABLISH, stated because an inaccurate disclosure is worse than none: it does not
 * establish that the name was minted, that the tool exists, or that the host and not the model chose it. Only
 * that the value has the SHAPE of a name. The provenance claim is the caller's and stays the caller's; this is
 * the floor under it.
 */
export const RecordPlaneNameSchema = z
	.string()
	.max(
		RECORD_PLANE_NAME_MAX_LENGTH,
		`a name recorded on the permanent record plane is bounded at ${RECORD_PLANE_NAME_MAX_LENGTH} characters. PER-8 makes this record permanent and PER-9 forbids record-plane omission, so nothing can ever take an oversized value back out again.`
	)
	.regex(
		RECORD_PLANE_NAME_PATTERN,
		'a name recorded on the permanent record plane must be spelled as a name: a letter, then letters, digits, underscore, dot or hyphen. A host path, a credentials string, a NUL byte and a captured blob are none of them names, and this record is permanent and unredactable, so the boundary bounds the SHAPE rather than trusting the caller.'
	);

/**
 * How long a recorded REASON may be. ⚠ AUTHORED. The longest reason any producer in this repository writes is
 * 523 characters (`pi-executor`'s `NOT_OBSERVABLE` disclosure, measured), so this is roughly eight times the
 * live maximum — headroom for prose, and far below a captured blob.
 */
const RECORD_PLANE_PROSE_MAX_LENGTH = 4096;

/**
 * ⛔ NO UNICODE CONTROL CHARACTER, NUL AMONG THEM — and tab, newline and carriage return deliberately
 * permitted, because a reason is prose a reader acts on and prose has line breaks. A control character in a
 * permanent record is not prose.
 *
 * ⭐ `\p{Cc}` RATHER THAN A HAND-WRITTEN `\u0000-\u001F` RANGE, AND THE REASON IS NOT STYLE. The range form is
 * narrower (it misses DEL and the C1 block), and it puts literal control-character escapes in the source,
 * which `no-control-regex` refuses — the escape hatch being an inline disable, and a lint rule disabled for a
 * predicate is exactly where a predicate stops being read. The property escape is wider, needs no disable,
 * and survives emission: `z.toJSONSchema` carries it into `schemas/objects/ModelExchange.json` as `pattern`,
 * where ajv compiles it with the `u` flag it needs.
 */
const RECORD_PLANE_PROSE_PATTERN = /^(?:[^\p{Cc}]|[\t\n\r])*$/u;

/**
 * HOST-AUTHORED PROSE on the record plane — the disclosed absence `PER-9` permits, bounded.
 *
 * ⭐ THE ARGUMENT FOR ADMITTING FREE TEXT AT ALL, because `ObservedToolCall` has no `arguments` field precisely
 * so that untrusted content cannot reach a plane with no lawful way to remove it. A `reason` is different in
 * KIND, and the difference is checkable: every producer of one in this repository writes a STRING LITERAL
 * authored here — `run-model-step` (two), `reasoning-review-validator`, `pi-executor`, `devin-reviewer`,
 * `governedToolCallReport` — and not one interpolates model output. ⚠ THE BOUNDARY CANNOT VERIFY THAT, which
 * is the whole lesson of `W2`: the producer's honesty is not the record's shape. So the prose is BOUNDED too.
 *
 * ⚠ AND WHAT IS **NOT** ENFORCED IS SAID PLAINLY: this does not establish that a reason contains no host path
 * and no secret. A path is indistinguishable from prose that mentions one, and a predicate that tried to tell
 * them apart would be a normaliser over an arbitrary string — the shape this programme refused in `W1`. What
 * is enforced is a bounded length and the absence of control characters; what warrants the CONTENT is that its
 * author is the host, and that warrant is a producer property this boundary does not check.
 */
export const RecordPlaneProseSchema = z
	.string()
	.max(
		RECORD_PLANE_PROSE_MAX_LENGTH,
		`a reason recorded on the permanent record plane is bounded at ${RECORD_PLANE_PROSE_MAX_LENGTH} characters. An unbounded string on a PER-8 permanent record is unbounded permanent storage, and PER-9 forbids record-plane omission, so nothing can ever take it back out.`
	)
	.regex(
		RECORD_PLANE_PROSE_PATTERN,
		'a reason recorded on the permanent record plane may not carry a control character — a NUL byte among them. It is prose a reader acts on; a control character in it is not prose, and this record is permanent and unredactable.'
	);

/**
 * How many observed tool calls ONE exchange record may name.
 *
 * ⛔ THE BOUND LIVES HERE, IN THE CONTRACT, AND THAT IS THE `W1` REPAIR. `R11` said *"BOUNDED: `calls` is capped
 * at 32"*, and the cap was applied only by `governedToolCallReport`: 64 calls declaring a `recordedLimit` of 64
 * were ACCEPTED, because the boundary compared the list against the limit THE CALLER DECLARED. So the cap was a
 * producer guarantee wearing a contract's words. It is now `.max()` on the field itself, which means it is
 * enforced on the command payload, on the materialized object state and on the event payload alike — and the
 * producer imports THIS number rather than declaring a second one that could drift from it.
 *
 * ⚠ AUTHORED, NOT DERIVED, AND SAID SO RATHER THAN DRESSED AS A MEASUREMENT. Nothing measured says 32 is the
 * right number; the design's own open questions already record the spike's 64KB capture cap as *"arbitrary and
 * unratified"*, and inventing a justification for this one would be worse than admitting it has none. What IS
 * argued is that SOME bound must exist — an UNTRUSTED party decides how many calls to make, and an unbounded
 * array on a permanent record is unbounded permanent storage under that party's control — and that the bound
 * must be VISIBLE in the record, which is what `recordedLimit` and `observedCount` are for.
 */
export const OBSERVED_TOOL_CALL_LIMIT = 32;

/**
 * The observed-tool-call list, bounded — the form the generated contract composes.
 *
 * ⭑ A FUNCTION RATHER THAN A LOOSE MESSAGE CONSTANT, SO THE BOUND AND THE WORDS THAT EXPLAIN IT CANNOT COME
 * APART. The alternative was to export the limit and its refusal text separately and let the generator write the
 * `.max(…)` itself — which makes the message an export whose only guard would be a test asserting on prose, and
 * this ledger treats a test that reddens on a prose change as a defect in the test. Here the export carries the
 * BEHAVIOUR: remove the `.max` and the record plane is unbounded again, which a driven case reddens on.
 */
export function boundedObservedToolCallList<T extends z.ZodType>(item: T): z.ZodArray<T> {
	return z
		.array(item)
		.max(
			OBSERVED_TOOL_CALL_LIMIT,
			`observedToolCalls.calls is bounded at ${OBSERVED_TOOL_CALL_LIMIT} entries by the CONTRACT, not by the producer. An untrusted party decides how many tool calls to make, and this record is permanent under PER-8 with no redaction path under PER-9 — so the bound belongs to the shape, and a self-declared recordedLimit cannot raise it.`
		);
}
