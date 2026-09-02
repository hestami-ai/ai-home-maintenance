// The durable authoring transcript for one turn, and the §9.7 boundary it enforces.
//
// Two rules meet here. (1) Private chain-of-thought never supplies another agent's context — putting the producer's
// interior into the reviewer's prompt is a hidden-context independence violation under §8.12. (2) It never reaches a
// durable store as a side effect: Events are immutable and permanent (§9.4), so anything admitted to the transcript
// could never be purged, which is exactly the trap the pre-amendment code fell into.
//
// This lives in its own module so both boundaries are reachable by the §14.3 conformance scenario. As an inline
// closure in the SSE route they were untestable, and the regression that reintroduces them would be silent.

/** A mutable transcript entry (text is accumulated as deltas stream); assignable to the readonly ConversationEntry. */
export type TranscriptEntry = { role: string; kind: string; text: string; success?: boolean };

/** The transcript kind each streamed agent event maps to. `thinking` maps to a kind that is NOT recordable, so it
 *  is dropped by rule rather than by omission — an omission is silently undone by the next person who adds a case. */
export const TRANSCRIPT_KIND: Record<string, string> = {
	text: 'message',
	thinking: 'thinking',
	tool_start: 'tool_call',
	tool_end: 'tool_result',
	error: 'error'
};

/** Kinds that may enter the durable transcript. `thinking` is absent by design — see the module note. */
const RECORDABLE = new Set(['message', 'tool_call', 'tool_result', 'error']);

/** True iff an entry of this kind may be persisted. Reasoning material is dropped at the write boundary. */
export function isRecordable(kind: string): boolean {
	return RECORDABLE.has(kind);
}

/** One declared omission — PER-9's "declared truncation or omission" (E-4), in the shape `ExchangeRecord`
 *  carries as `omittedRegions`. */
export interface OmittedRegion {
	readonly role: string;
	readonly reason: string;
}

/** The kinds whose DROP is a governed-content omission, mapped to the role the record names them by.
 *  ⚠ DELIBERATELY NOT "everything non-recordable". `status` lines are display chrome the corpus never asks
 *  anyone to retain; recording them here would bury the one real disclosure in noise. An over-broad disclosure
 *  is its own defect — it makes the finding unfindable, which is the failure it was meant to prevent. */
const OMISSION_ROLE: Readonly<Record<string, string>> = { thinking: 'VOLUNTEERED_REASONING' };

const OMISSION_REASON =
	'Volunteered reasoning was produced and DROPPED at the write boundary. PER-12 requires it retained where ' +
	'available as a typed Artifact and purgeable at retention expiry (PER-8); domain_events is immutable and ' +
	'permanent (§9.4) and no purgeable content plane exists (DEF-W2-001), so admitting it here would create an ' +
	'unpurgeable artifact. Retention is blocked on ICP-03; this record discharges PER-9’s "record-plane omission ' +
	'is not [legal]" by DECLARING the omission rather than performing it silently.';

/**
 * The declared omission for a dropped entry kind, or `undefined` when nothing governed was lost.
 *
 * ⭑ WHY THIS EXISTS AND WHY IT IS NOT BLOCKED BY THE MISSING CONTENT STORE. Recording THAT content was
 * omitted, and why, is METADATA; only the omitted bytes are content. So the disclosed half of PER-9 is
 * available today even though the retained half is not — and the difference between a silent drop and a
 * declared one is exactly the difference PER-9 draws between an illegal omission and a legal one.
 */
export function omissionFor(kind: string): OmittedRegion | undefined {
	const role = OMISSION_ROLE[kind];
	return role ? { role, reason: OMISSION_REASON } : undefined;
}

/** The producer's OBSERVABLE narration — the only thing the independent reviewer may be shown about how the
 *  subject was produced. Never the producer's interior (§9.7). */
export function narrationOf(transcript: readonly TranscriptEntry[]): string {
	return transcript
		.filter((e) => e.role === 'AGENT' && e.kind === 'message')
		.map((e) => e.text)
		.join('\n');
}
