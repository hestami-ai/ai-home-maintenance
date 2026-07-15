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

/** The producer's OBSERVABLE narration — the only thing the independent reviewer may be shown about how the
 *  subject was produced. Never the producer's interior (§9.7). */
export function narrationOf(transcript: readonly TranscriptEntry[]): string {
	return transcript
		.filter((e) => e.role === 'AGENT' && e.kind === 'message')
		.map((e) => e.text)
		.join('\n');
}
