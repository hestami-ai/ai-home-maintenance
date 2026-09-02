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
import type { AuthoringEventKind } from './types.js';

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

/** What happens to each streamed event kind at the durable write boundary.
 *
 *  ⚠⚠ TOTAL OVER `AUTHORING_EVENT_KINDS`, AND THAT TOTALITY IS THE WHOLE POINT. The previous version of this
 *  was a hand-written one-entry map; `status`, `producer` and `done` were not in it, fell through, and were
 *  dropped with nothing declared. `producer` carries the resolved model/provider — PER-9's E-3, and the
 *  surviving half of finding #10 — so the omission the disclosure existed to prevent was being performed by
 *  the disclosure's own gap. `Record<AuthoringEventKind, …>` makes a missing kind a COMPILE error. */
const DISPOSITION: Readonly<Record<AuthoringEventKind, WriteDisposition>> = {
	text: 'RECORDED',
	tool_start: 'RECORDED',
	tool_end: 'RECORDED',
	error: 'RECORDED',
	// Governed content that PER-9/PER-12 name and this system cannot yet retain.
	thinking: 'DROPPED_GOVERNED',
	producer: 'DROPPED_GOVERNED',
	// Display and stream control. The corpus asks nobody to retain these, and declaring them as governed
	// losses would bury the two real ones — an over-broad disclosure is its own defect.
	status: 'DROPPED_CHROME',
	done: 'DROPPED_CHROME'
};

/** The role each governed omission is named by in the record. */
const OMISSION_ROLE: Readonly<Partial<Record<AuthoringEventKind, string>>> = {
	thinking: 'VOLUNTEERED_REASONING',
	producer: 'RESOLVED_MODEL_IDENTITY'
};

/** Why each governed omission happened, in terms naming the invariants that force it. */
const OMISSION_REASON =
	'Volunteered reasoning was produced and DROPPED at the write boundary. PER-12 requires it retained where ' +
	'available as a typed Artifact and purgeable at retention expiry (PER-8); domain_events is immutable and ' +
	'permanent (§9.4) and no purgeable content plane exists (DEF-W2-001), so admitting it here would create an ' +
	'unpurgeable artifact. Retention is blocked on ICP-03; this record discharges PER-9’s "record-plane omission ' +
	'is not [legal]" by DECLARING the omission rather than performing it silently.';

const OMISSION_REASON_BY_ROLE: Readonly<Record<string, string>> = {
	VOLUNTEERED_REASONING: OMISSION_REASON,
	RESOLVED_MODEL_IDENTITY:
		'The resolved provider/model/version that served this turn was computed and used to decide independence, ' +
		'then dropped — PER-9 E-3 ("the resolved provider, model, and version actually invoked"). It is METADATA, ' +
		'not content, so nothing about the content plane blocks retaining it; what blocks it is that the authoring ' +
		'plane’s record (ConversationEntry) is UNRATIFIED-AUTHORED and carries no field for a structured actor. ' +
		'Flattening it into the text field would reproduce finding #63. Owed: ICP-02 deliverable 3.'
};

export type WriteDisposition = 'RECORDED' | 'DROPPED_GOVERNED' | 'DROPPED_CHROME';

/** What the write boundary does with this event kind. Total over the union; `undefined` only for a string
 *  that is not an event kind at all. */
export function dispositionOf(kind: string): WriteDisposition | undefined {
	return DISPOSITION[kind as AuthoringEventKind];
}


/**
 * The declared omission for a dropped entry kind, or `undefined` when nothing governed was lost.
 *
 * ⭑ WHY THIS EXISTS AND WHY IT IS NOT BLOCKED BY THE MISSING CONTENT STORE. Recording THAT content was
 * omitted, and why, is METADATA; only the omitted bytes are content. So the disclosed half of PER-9 is
 * available today even though the retained half is not — and the difference between a silent drop and a
 * declared one is exactly the difference PER-9 draws between an illegal omission and a legal one.
 */
export function omissionFor(kind: string): OmittedRegion | undefined {
	if (dispositionOf(kind) !== 'DROPPED_GOVERNED') return undefined;
	const role = OMISSION_ROLE[kind as AuthoringEventKind];
	return role ? { role, reason: OMISSION_REASON_BY_ROLE[role] } : undefined;
}

/** The producer's OBSERVABLE narration — the only thing the independent reviewer may be shown about how the
 *  subject was produced. Never the producer's interior (§9.7). */
export function narrationOf(transcript: readonly TranscriptEntry[]): string {
	return transcript
		.filter((e) => e.role === 'AGENT' && e.kind === 'message')
		.map((e) => e.text)
		.join('\n');
}
