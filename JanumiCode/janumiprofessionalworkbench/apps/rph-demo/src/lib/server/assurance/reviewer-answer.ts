// MXREAD-03 — the consumer, without which the resolution layer is a hollow one.
//
// ⭑ THIS MODULE EXISTS FOR A REASON THE DESIGN STATES BEFORE THE CODE. `verifyExchangeContent` and
// `readAnswerSpan` have exactly two natural callers: a diagnostic surface (blocked behind `REG-Q-077`) and a
// purge scheduler (`REG-F-245`, separate work). Shipped with neither, their only consumer would be their own
// gate — which is `project_jpwb_hollow_governed_layer`'s shape, and this repository found 74% of a kernel dead
// that way. So the read path lands WITH a reader or it does not land.
//
// ── WHAT IT SHOWS, AND THE LINE IT DOES NOT CROSS ───────────────────────────────────────────────────────────
// The ANSWER the reviewer returned — the material a recorded Assessment concluded from, classified
// `RETAINED_BY_PARTICIPATION` by `REG-D-050`, whose sponsor words are *"fully auditable and reconstructable"*.
// ⛔ NOT the volunteered reasoning, and NOT the reassembled reply: `PER-12` restricts that material, reads are
// authority-checked nowhere in this system (`rph-engine/src/engine.ts:195`), and a surface returning it would
// be the first read anyone needed permission for. That is `REG-Q-077`.
import { listByType } from '@janumipwb/rph-engine';
import {
	readAnswerSpan,
	verifyExchangeContent,
	type ResolvableExchange
} from '@janumipwb/rph-application';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';

export interface ReviewerAnswerView {
	readonly exchangeId: string;
	readonly attemptOrdinal: number;
	/** The reviewer's answer, when it is retained AND verified. Absent otherwise — never a partial claim. */
	readonly answer?: string;
	/** ⭑ ALWAYS POPULATED. When `answer` is absent this says why, in terms a reader can act on; when it is
	 *  present this says what was checked, so a verified read is distinguishable from an unchecked one. */
	readonly disclosure: string;
	/** The per-element verdicts, so the panel can show that a record's OWN claim about its bytes was tested. */
	readonly verdicts: readonly { readonly field: string; readonly verdict: string }[];
}

/**
 * The reviewer's retained answer for the most recent exchange on a subject, verified before it is shown.
 *
 * ⚠ MOST RECENT BY `attemptOrdinal`, NOT BY INSERTION ORDER. A run makes up to four bounded tries and the
 * repair is the one whose answer the assessment used; reading "the first row back" would show the try that
 * FAILED while labelling it the reviewer's answer.
 */
export async function loadReviewerAnswer(
	subjectId: string,
	engine: AuthedEngineHandle,
	store: ArtifactStore
): Promise<ReviewerAnswerView | undefined> {
	const rows = listByType(engine, 'MODEL_EXCHANGE')
		.filter((r) => (r.state as { subjectObjectId?: string }).subjectObjectId === subjectId)
		.sort(
			(a, b) =>
				Number((b.state as { attemptOrdinal?: number }).attemptOrdinal ?? 0) -
				Number((a.state as { attemptOrdinal?: number }).attemptOrdinal ?? 0)
		);
	if (rows.length === 0) return undefined;

	const state = rows[0]!.state as unknown as ResolvableExchange;
	const report = await verifyExchangeContent(state, store);
	const verdicts = report.refs.map((r) => ({ field: r.field, verdict: r.verdict }));
	const read = await readAnswerSpan(state, store);

	return {
		exchangeId: state.exchangeId,
		attemptOrdinal: Number((rows[0]!.state as { attemptOrdinal?: number }).attemptOrdinal ?? 0),
		...(read.available ? { answer: read.bytes } : {}),
		disclosure: read.available
			? `Retained and verified: the stored bytes were re-hashed and match what this record claims.`
			: read.refusedBecause,
		verdicts
	};
}
