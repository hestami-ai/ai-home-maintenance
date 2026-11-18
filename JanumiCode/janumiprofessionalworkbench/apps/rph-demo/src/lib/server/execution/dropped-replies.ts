// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D92 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.46; `REG-F-651`; the lead's ruling 4 on
// Stage 0) — A REPLY PI DROPPED TO GO ON, RECORDED BESIDE ITS EXCHANGE, NEVER IN ITS ANSWER.
//
// ⭑ ONE CONTENT-PLANE OBJECT PER EXCHANGE THAT DROPPED ANY REPLY (`jpwb.dropped-replies/1`): the exchange's id and each dropped reply — its text, its
// stop, Pi's error message, how Pi went on and its place among the try's replies — bound to `<tenant>/dropped-replies/<exchange id>`, and
// `RETAINED_BY_PARTICIPATION`, as the materialized input it belongs beside is (D89 shows it to a replacement and the roles). The exchange's
// `parseOutcome.detail` names its key, its hash and its size (`droppedRepliesSentence`), so the record points at it without a canon change.
// ⭑ A try with no dropped reply records nothing here, and its exchange byte for byte what it recorded before this package (D92's control).
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { describedThrow } from '../described-throw.js';
import type { DroppedReply } from '../tools/backing-tool.js';

/** The schema of the record of an exchange's dropped replies. */
export const DROPPED_REPLIES_SCHEMA = 'jpwb.dropped-replies/1';

/** The name an exchange's dropped replies are bound to: `<tenant>/dropped-replies/<exchange id>`. */
export function droppedRepliesNameOf(tenantPrefix: string, exchangeId: string): string {
	return `${tenantPrefix}/dropped-replies/${exchangeId}`;
}

/** Where an exchange's dropped replies were kept — or why they could not be. */
export type DroppedRepliesRecorded =
	| { readonly recorded: true; readonly storageKey: string; readonly contentHash: string; readonly byteSize: number }
	| { readonly recorded: false; readonly refusedBecause: string };

/**
 * Record `replies` beside the exchange `exchangeId`: put on the content plane and bound to its name. ⛔ It does not throw: a store that refuses or
 * throws is answered as a record not made, its reason described by the one describer, and the caller says so in the exchange's detail.
 */
export async function recordDroppedReplies(
	store: ArtifactStore,
	tenantPrefix: string,
	exchangeId: string,
	replies: readonly DroppedReply[]
): Promise<DroppedRepliesRecorded> {
	try {
		const ref = await store.put({
			tenantPrefix,
			bytes: JSON.stringify({ schema: DROPPED_REPLIES_SCHEMA, exchangeId, replies }),
			mediaType: 'application/json',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		const bound = await store.bindName(droppedRepliesNameOf(tenantPrefix, exchangeId), ref.storageKey);
		if (!bound.bound) return { recorded: false, refusedBecause: bound.refusedBecause };
		return { recorded: true, storageKey: ref.storageKey, contentHash: ref.contentHash, byteSize: ref.byteSize };
	} catch (e) {
		return { recorded: false, refusedBecause: describedThrow(e) };
	}
}

/** The sentence an exchange's `parseOutcome.detail` gains for its dropped replies: where they are kept, their hash and size, or why they are not. */
export function droppedRepliesSentence(count: number, recorded: DroppedRepliesRecorded): string {
	const replies = count === 1 ? 'a reply Pi dropped to go on' : `${count} replies Pi dropped to go on`;
	return recorded.recorded
		? `This try held ${replies}, which the model's conversation does not hold and which is not part of the work product: recorded beside this exchange at '${recorded.storageKey}' (${recorded.contentHash}, ${recorded.byteSize} bytes) (design D92).`
		: `This try held ${replies}, which the model's conversation does not hold and which is not part of the work product; recording it beside this exchange failed: ${recorded.refusedBecause} (design D92).`;
}

/**
 * ⭐ Package L17b3 (D92) — an exchange's dropped replies recorded beside it, under an aggregate id minted for the exchange now (`newId('mex')`, so the
 * record names it before the exchange is dispatched — `firstMexIs`), and the sentence its detail gains; `undefined` where the try dropped none, so a
 * try with none records byte for byte as before. ⭐ The lead's ruling 11 (§16) — ONE WRITER for an executor try's and an assurance-stage helper's.
 */
export async function droppedRepliesBesideExchange(
	store: ArtifactStore,
	tenantPrefix: string,
	newId: (prefix: string) => string,
	dropped: readonly DroppedReply[]
): Promise<{ readonly aggregateId: string; readonly sentence: string } | undefined> {
	if (dropped.length === 0) return undefined;
	const aggregateId = newId('mex');
	const kept = await recordDroppedReplies(store, tenantPrefix, aggregateId, dropped);
	return { aggregateId, sentence: droppedRepliesSentence(dropped.length, kept) };
}

/** ⭐ Package L17b3 (D92) — an id minter whose first `mex` is `id`, every other id the minter's own: the exchange recorded under the id its record names. */
export function firstMexIs(id: string, newId: (prefix: string) => string): (prefix: string) => string {
	let used = false;
	return (prefix) => {
		if (prefix === 'mex' && !used) {
			used = true;
			return id;
		}
		return newId(prefix);
	};
}
