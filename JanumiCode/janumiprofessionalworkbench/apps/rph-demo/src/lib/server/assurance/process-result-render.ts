// ⭐⭐ `JAN-PRQUAL` `PQ-1` (design D1, D2; `REG-F-476`, `REG-D-094`) — ONE PURE RENDERER OF A COMMAND'S RESULT, TWO VIEWS OF ONE
// RUN. It moved here from `execution/process-result-floor.ts`, which imports `floor-over-subject` and so could not be
// reached from reviewer qualification (`verif/review-input-imports.test.ts` refuses that module anywhere in the
// review-input closure): a change to what the reviewer of a process result reads moved no reviewer fingerprint (D17).
//
//   · the EVIDENCE view (`renderProcessResultEvidence`) — the bytes `evidence-join.ts` MINTS as the participating copy.
//     Byte for byte what `renderProcessResult` rendered, except that the command line is `argv` as a JSON array
//     (`REG-F-482`: `["node","a b"]` and `["node","a","b"]` rendered the same `command: node a b`).
//   · the REVIEW view (`renderProcessResultReview`) — what the reviewer READS, built by `processResultReviewInput`
//     (`review-input.ts`) within the content budget the validator itself computes (`processResultContentBudget`). The
//     exit line FIRST, then the capture layer's facts, then three budgeted slices — the command line, stdout, stderr —
//     each between fence lines (`review-fence.ts`), and a cut slice keeping its HEAD and its TAIL, declared before both.
//
// ⛔ WHY TWO VIEWS AND NOT ONE. The evidence is a record a reader re-hashes, and it holds the run as captured; the review
// view is a declared PROJECTION of that same run into a bounded prompt. One renderer rendering both is what keeps them
// one run: the exit line, the capture facts and the command line are the same functions in both (`exitLine`,
// `captureFacts`, `commandLine`), so the reviewer cannot be shown a verdict the evidence does not hold.
//
// ── ⛔⛔ THE RETENTION DISPOSITION THIS FILE OWES, BECAUSE IT BINDS `stderr` (`REG-Q-066`) ──────────────────────────
// (moved here from `process-result-floor.ts`'s header with the renderer, and restated for the two views)
//
// Both views put both streams somewhere new — the third destination for them after Phase 2b's capture and Phase 3's
// producing model:
//   · THE EVIDENCE VIEW becomes an ADDRESSABLE participating copy: `evidence-join.ts` puts it with
//     `ArtifactStore.put(bytes, 'RETAINED_BY_PARTICIPATION')` (`R16`). The class follows `REG-D-050` — participation is a
//     property of USE — because a floor run JUDGES these bytes; declaring them purgeable would leave an assessment
//     resting on bytes the system says it may destroy.
//   · THE REVIEW VIEW becomes the subject of a REVIEWING MODEL's prompt, and the reviewing call is itself recorded: its
//     prompt is captured by `captureTry` into a `MODEL_EXCHANGE`'s E-1 composite, `RETAINED_BY_PARTICIPATION` — `PER-9`
//     working as designed (a review that left no record would be the record-plane omission it calls illegal). ⚠ So a
//     build's stderr lands in TWO participating content objects, not one. The review view holds AT MOST what the
//     evidence holds — the same run, cut and declared, never added to — so it creates no class of byte the evidence
//     view did not already create.
//   · ⛔ BOTH ARE THE CONTENT PLANE, which `PER-9` gives a removal path (E-6), and NO BYTE OF EITHER STREAM REACHES THE
//     RECORD PLANE: `ObservedToolCall` has no field that could hold one (`R11`).
//   · ⛔ NO REDACTION COVERS EITHER, AND THAT IS RECORDED RATHER THAN SMOOTHED. `inputRedactionManifestRef` is
//     `PENDING_CONTENT` on every path and `REG-005` records E-6 as unimplemented, so the removal path both views rely on
//     has no producer: a known gap, made larger because a build prints far more than a model writes.
//   · ⛔ FILTERING IS NOT THE ANSWER AND HAS BEEN REFUSED FOUR TIMES ON THIS SEAM: a predicate deciding whether a line
//     of build output "looks like a secret" is a normaliser over arbitrary bytes. The cuts that ARE applied are the
//     runner's own bound and its declared `omittedRegions`, carried in both views — and, in the review view only, the
//     review's own budgeted cut, DECLARED before the bytes it removes.
//
// ⛔ PURE, AND IMPORTING ONLY TYPES AND THE FENCE MODULE: it is inside the review-input closure.
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import {
	captureCutDeclaration,
	chooseFence,
	codePoints,
	fenceCandidate,
	fenced,
	headAndTailCutDeclaration,
	headOf,
	jsonLine,
	tailOf
} from './review-fence.js';

/**
 * The exit line: the exit code, or `null (terminated by a signal)`, ` TIMED OUT`, and the duration — all HOST-observed.
 *
 * ⚠ `null` IS REPORTED AS WHAT THE PORT SAYS IT MEANS — terminated by a signal — rather than as the word `null`, which a
 * reader would take for "no information". It is never folded into 0.
 */
function exitLine(run: ObservedProcessRun): string {
	return `exit ${run.exitCode ?? 'null (terminated by a signal)'}${run.timedOut ? ' TIMED OUT' : ''} in ${run.durationMs}ms`;
}

/**
 * The capture layer's facts, in UTF-8 bytes as captured: an incomplete capture, then each declared cut.
 *
 * ⛔ THE CUTS ARE RENDERED BEFORE THE BYTES, NOT AFTER, in both views, so a reader that reads no further than the first
 * lines has still seen that a stream is a prefix. A declaration below the content it qualifies is one the reader
 * reaches only if the content did not already convince them.
 */
function captureFacts(run: ObservedProcessRun): string[] {
	return [
		...(run.outputComplete
			? []
			: [
					'[OUTPUT INCOMPLETE: a descendant still held the streams when the child exited, so more may have been coming]'
				]),
		...run.omittedRegions.map(
			(r) =>
				`[${r.stream} TRUNCATED: ${r.byteSize} UTF-8 bytes removed from byte offset ${r.byteOffset}]`
		)
	];
}

/**
 * ⭐ `REG-F-482` — THE COMMAND LINE IS `argv` AS A JSON ARRAY, in both views and in the evidence's limitations line
 * (`processResultLimitations`). Joined by spaces, `["node","a b"]` and `["node","a","b"]` were one command to every
 * reader; as JSON each argument is its own quoted string.
 *
 * ⛔ AND NO ARGUMENT CAN BREAK THE LINE IT SITS ON — which `JSON.stringify` alone did not make true: it leaves U+0085,
 * U+2028 and U+2029 raw, so an argument carrying one put a forged heading on a line of its own in the minted evidence
 * and in the operator's refusal (driven). `jsonLine` escapes the three; the array's parse is unchanged (`REG-F-481`).
 */
export function commandLine(argv: readonly string[]): string {
	return jsonLine(argv);
}

/**
 * ⭐ THE EVIDENCE VIEW — the bytes the evidence join MINTS (`evidence-join.ts`). Today's bytes exactly, save `argv`.
 */
export function renderProcessResultEvidence(run: ObservedProcessRun): string {
	return [
		`command: ${commandLine(run.argv)}`,
		exitLine(run),
		...captureFacts(run),
		`--- stdout ---\n${run.stdout}`,
		`--- stderr ---\n${run.stderr}`
	].join('\n');
}

/**
 * One of the three budgeted slices of the review view: what it is called, its heading line, its bytes — and, for a
 * stream the capture cut, how many UTF-8 bytes the capture removed (`captureCutDeclaration`).
 */
interface ReviewSlice {
	readonly name: string;
	readonly heading: string;
	readonly text: string;
	readonly captureRemoved?: number;
}

/** A slice as the review view shows it: whole, or its HEAD and TAIL with the declaration that goes before both. */
type ShownSlice =
	| { readonly whole: string }
	| { readonly declaration: string; readonly head: string; readonly tail: string };

/** The labels between a cut slice's two fenced parts — HOST lines, outside every fence, so HEAD and TAIL cannot be confused. */
const HEAD_LABEL = 'HEAD:';
const TAIL_LABEL = 'TAIL:';

/** The capture layer's stream for each of the view's stream slices — the port's own names (`REG-F-487`). */
const CAPTURED_STREAM: Readonly<Record<string, 'STDOUT' | 'STDERR'>> = { stdout: 'STDOUT', stderr: 'STDERR' };

/**
 * `slice` with the UTF-8 bytes the capture removed from its stream, when it removed any. ⚠ Summed over the stream's
 * declared regions: the capture declares at most one per stream, at the end of what it kept (`captureCutDeclaration`).
 */
function withCaptureCut(run: ObservedProcessRun): (slice: ReviewSlice) => ReviewSlice {
	return (slice) => {
		const regions = run.omittedRegions.filter((r) => r.stream === CAPTURED_STREAM[slice.name]);
		if (regions.length === 0) return slice;
		return { ...slice, captureRemoved: regions.reduce((n, r) => n + r.byteSize, 0) };
	};
}

/**
 * The lines of a slice's block after its heading and before anything shown of it: the capture's declaration, for a
 * stream the capture cut (`REG-F-480`; design D2) — saying that its TAIL, or its end when it is shown whole, is the end
 * of what was CAPTURED.
 */
function captureLines(slice: ReviewSlice, shown: ShownSlice): string[] {
	if (slice.captureRemoved === undefined) return [];
	return [captureCutDeclaration(slice.name, codePoints(slice.text), slice.captureRemoved, !('whole' in shown))];
}

/** A slice's block, rendered with `fence` — the one place a block's layout is written, for measuring and for rendering. */
function sliceBlock(slice: ReviewSlice, shown: ShownSlice, fence: string): string {
	if ('whole' in shown)
		return [slice.heading, ...captureLines(slice, shown), fenced(fence, shown.whole)].join('\n');
	return [
		slice.heading,
		...captureLines(slice, shown),
		shown.declaration,
		HEAD_LABEL,
		fenced(fence, shown.head),
		TAIL_LABEL,
		fenced(fence, shown.tail)
	].join('\n');
}

/** A slice's block with no fence at all — only for a run whose kept bytes contain every candidate (see the view). */
function unfencedBlock(slice: ReviewSlice, shown: ShownSlice): string {
	if ('whole' in shown) return [slice.heading, ...captureLines(slice, shown), shown.whole].join('\n');
	return [
		slice.heading,
		...captureLines(slice, shown),
		shown.declaration,
		HEAD_LABEL,
		shown.head,
		TAIL_LABEL,
		shown.tail
	].join('\n');
}

/**
 * ⭐ THE ALLOCATION RULE — MAX-MIN FAIR, so a slice that needs less than its share leaves the rest to the others.
 *
 * The slices are taken from the smallest NEED (its whole block's length) to the largest; each is given its need or an
 * equal share of what is left, whichever is smaller, and what it does not take stays in the pool for the slices after
 * it. So a one-line command and an empty stderr cost a 64 KiB stdout nothing but their own bytes, and two large streams
 * split the room evenly. ⚠ Ties keep the slices' own order, so the allocation is a function of the run alone.
 * ⭐ The validator shares the agent's account among its fields by the same rule (`REG-F-481`): one rule for every
 * budget the review splits, never a second copy of it.
 */
export function allocate(needs: readonly number[], pool: number): number[] {
	const order = needs
		.map((need, index) => ({ need, index }))
		.sort((a, b) => a.need - b.need || a.index - b.index);
	const out = needs.map(() => 0);
	let remaining = pool;
	order.forEach(({ need, index }, i) => {
		const share = Math.floor(remaining / (order.length - i));
		out[index] = Math.min(need, share);
		remaining -= out[index]!;
	});
	return out;
}

/**
 * The length of a slice's CUT layout with nothing kept: its heading, its declarations with the review cut's at the
 * WIDEST numbers it could state (every count at most the slice's total code points), the labels and the fence lines.
 */
function cutOverhead(slice: ReviewSlice): number {
	const total = codePoints(slice.text);
	const widest = headAndTailCutDeclaration(slice.name, total, total, total, total);
	return sliceBlock(
		slice,
		{ declaration: widest, head: '', tail: '' },
		fenceOfLength()
	).length;
}

/**
 * A slice shown within `room` UTF-16 units of block: whole when it fits, else its HEAD and TAIL, each cut on a code-point
 * boundary, with the declaration (naming the slice, stating the code points kept at each end and removed) before both.
 *
 * ⭐ THE DECLARATION AND THE LABELS COUNT IN THE ROOM: the block's own layout is measured with empty parts and the
 * declaration at the WIDEST numbers this cut could state (`cutOverhead`), and only what remains is kept. The kept units
 * are split evenly — the HEAD rounds up — and a unit the HEAD gives back at a surrogate pair goes to the TAIL.
 */
function shownWithin(slice: ReviewSlice, room: number): ShownSlice {
	const whole: ShownSlice = { whole: slice.text };
	if (sliceBlock(slice, whole, fenceOfLength()).length <= room) return whole;
	const total = codePoints(slice.text);
	const kept = Math.max(0, room - cutOverhead(slice));
	const head = headOf(slice.text, Math.ceil(kept / 2));
	const tail = tailOf(slice.text, kept - head.length);
	const headPoints = codePoints(head);
	const tailPoints = codePoints(tail);
	return {
		declaration: headAndTailCutDeclaration(
			slice.name,
			headPoints,
			tailPoints,
			total,
			total - headPoints - tailPoints
		),
		head,
		tail
	};
}

/** A placeholder of a fence's length, for measuring: every candidate has the same length (`review-fence.ts`). */
function fenceOfLength(): string {
	return fenceCandidate(0);
}

/** The view's host lines and three slices for `run` — the one place they are listed, for measuring and for rendering. */
function layoutOf(run: ObservedProcessRun) {
	const hostLines = [exitLine(run), ...captureFacts(run)];
	const slices: readonly ReviewSlice[] = [
		{
			name: 'the command line',
			heading: 'the command line, as a JSON array of its arguments:',
			text: commandLine(run.argv)
		},
		{ name: 'stdout', heading: 'stdout:', text: run.stdout },
		{ name: 'stderr', heading: 'stderr:', text: run.stderr }
	].map(withCaptureCut(run));
	// Every line of the view is joined by one newline: the host lines' own length and those joins come off the top.
	const fixed = hostLines.reduce((n, l) => n + l.length + 1, 0) + (slices.length - 1);
	const needs = slices.map((s) => sliceBlock(s, { whole: s.text }, fenceOfLength()).length);
	return { hostLines, slices, fixed, needs };
}

/**
 * ⭐ THE LEAST `contentBudget` THE REVIEW VIEW OF `run` ACCEPTS: its host lines, plus the least pool at which the
 * allocation (`allocate`) gives EVERY slice at least the smallest block it can be shown in — its whole block, or its cut
 * layout with nothing kept (`cutOverhead`), whichever is shorter. Below it some slice could only overrun its room.
 *
 * ⚠ The allocation is monotone in the pool, and a pool of three times the largest of those smallest blocks always
 * suffices (every share is then at least that), so the least such pool is found by counting up from their sum.
 */
export function minimumReviewBudget(run: ObservedProcessRun): number {
	const { slices, fixed, needs } = layoutOf(run);
	const smallest = slices.map((s, i) => Math.min(needs[i]!, cutOverhead(s)));
	const enough = (pool: number) => allocate(needs, pool).every((room, i) => room >= smallest[i]!);
	let pool = smallest.reduce((n, m) => n + m, 0);
	while (!enough(pool)) pool += 1;
	return fixed + pool;
}

/**
 * What the renderer says when it is handed a budget below `minimumReviewBudget`: the view is not rendered.
 *
 * ⛔ FAIL CLOSED, NEVER OVER BUDGET: a view longer than its budget is one the validator refuses (`REG-F-480`), so it is
 * refused here first, by name. Host-authored and fixed apart from two numbers.
 */
export function reviewBudgetBelowMinimum(contentBudget: number, minimum: number): string {
	return (
		`This command result's review view was not rendered: it was given ${contentBudget} characters, and its three ` +
		`slices' headings, declarations and fence lines need at least ${minimum} (REG-F-480). Nothing was rendered over ` +
		'its budget, and no model was called.'
	);
}

/**
 * ⭐⭐ THE REVIEW VIEW — what the reviewer of a process result reads, within `contentBudget` UTF-16 units.
 *
 *   1. The exit line FIRST (host-observed).
 *   2. The capture layer's facts: an incomplete capture; each capture cut in UTF-8 bytes as captured.
 *   3. Three budgeted slices, each under its own heading: the command line (`argv` as JSON), stdout, stderr. A stream
 *      the capture cut says so on the line after its heading (`captureCutDeclaration`).
 *
 * ⛔ A 64 KiB STDOUT NO LONGER REMOVES THE STDERR SECTION (`REG-F-480`; design D2, G6 (i), driven). The validator cut
 * the content's tail, and the content was stdout then stderr, so the decisive line on stderr was the first thing lost
 * and the cut was declared after the bytes, naming no stream. Now each slice is budgeted on its own (`allocate`), and a
 * cut slice keeps its HEAD and its TAIL — pytest's counts, skip reasons and failures are at the tail — declared before
 * both.
 *
 * ⛔ THE MINIMUM BUDGET (`minimumReviewBudget`): below it some slice's heading, declarations and fence lines alone would
 * overrun its room, so the view is REFUSED (`reviewBudgetBelowMinimum`), never rendered over its budget. ⚠ It is
 * unreachable through `processResultReviewInput`, whose budget is at least `CONTENT_MIN` (4,000): a run's minimum is
 * its host lines plus three such layouts, a few hundred characters each.
 *
 * ⛔ THE HOST'S LINES ARE NEVER INSIDE A FENCE, AND EVERY BYTE THE COMMAND OR THE MODEL CHOSE IS (`REG-F-481`). The exit
 * line, the capture facts, the headings, the declarations and the HEAD/TAIL labels are this host's; the command line,
 * stdout and stderr are between fence lines of ONE token.
 *
 * ⭐ THAT TOKEN OCCURS NOWHERE IN THE PROMPT BUT ON ITS OWN FENCE LINES (design D2, under the sponsor's (a)). It is chosen
 * over the bytes its fences enclose AND over `otherUntrusted` — every other untrusted slice of the prompt this view is
 * sent in, as that prompt carries them: the instruction, each field of the account, the narration, the prior findings and
 * every call name the host did not mint, JSON-encoded (`processResultUntrustedSlices`, handed in by
 * `processResultReviewInput`). ⛔ Chosen over its own slices alone it was almost always `<<<UNTRUSTED-00>>>`, and an
 * instruction carrying a line of it put a seventh line of the view's token in the prompt, inside the validator's region:
 * a reader pairing the view's lines in order found the host's exit line quoted and stdout outside every pair (driven).
 * The validator fences those other slices with a token of its OWN, chosen over them AND this whole view
 * (`reasoning-review-validator.ts`), so the two tokens differ and neither occurs in any region's text.
 *
 * ⛔ AND WHEN EVERY CANDIDATE OCCURS IN THE KEPT BYTES, NO FENCE IS FAKED. The view is rendered UNFENCED — the bytes
 * unaltered, after a host line saying so — and the validator, whose chooser reads this whole view and therefore finds
 * every candidate too, refuses to send it (`NO_FENCE_STATEMENT`). The view is never a prompt; it is refused one step
 * before it could become one, by the same rule.
 */
export function renderProcessResultReview(
	run: ObservedProcessRun,
	contentBudget: number,
	otherUntrusted: readonly string[]
): string {
	const { hostLines, slices, fixed, needs } = layoutOf(run);
	const minimum = minimumReviewBudget(run);
	if (contentBudget < minimum) throw new Error(reviewBudgetBelowMinimum(contentBudget, minimum));
	const rooms = allocate(needs, Math.max(0, contentBudget - fixed));
	const shown = slices.map((s, i) => shownWithin(s, rooms[i]!));
	const fence = chooseFence([
		...shown.flatMap((p) => ('whole' in p ? [p.whole] : [p.head, p.tail])),
		...otherUntrusted
	]);
	if (fence === undefined)
		return [
			...hostLines,
			'[NO FENCE: every fence candidate occurs in the bytes below, so they are shown unfenced — and this review is not sent.]',
			...slices.map((s, i) => unfencedBlock(s, shown[i]!))
		].join('\n');
	return [...hostLines, ...slices.map((s, i) => sliceBlock(s, shown[i]!, fence))].join('\n');
}
