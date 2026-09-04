// JAN-MXREAD — resolving what a `MODEL_EXCHANGE` claims, and reading back the half that may be read.
//
// ── ⭑ WHY THIS EXISTS AT ALL ─────────────────────────────────────────────────────────────────────────────────
// As of `REG-D-057` a `MODEL_EXCHANGE` asserts, per content ref: *bytes live at this key, hashing to this, this
// many, in a store of this declared durability.* Nothing had ever checked any part of that.
// `REG-F-245` (b′) states it: *"The system records WHERE an artifact's content lives and never once resolves
// it."* And the hazard is not that the claim might be wrong — it is that a wrong claim and a right one are
// **byte-identical to a reader**, which `agent/exchange-record.ts` already names: *"the record still LOOKS
// intact."*
//
// ── ⛔ WHAT THIS DELIBERATELY DOES NOT DO ────────────────────────────────────────────────────────────────────
// It does not return volunteered reasoning, and it does not reassemble the reply. `PER-12` restricts that
// material, and `DESIGN-exchange-resolution.md` §2 records the measurement that makes the block substantive
// rather than procedural: **reads are not authority-checked anywhere in this system** — `rph-engine`'s handle
// exposes `loadObject: (id) => store.loadObject(id)` and threads the credential through `dispatch` only. A
// surface returning reasoning would be the FIRST read anyone needed permission for, with no mechanism to hang
// it on. That question is `REG-Q-077`; until it is answered this module stops at the participating half.
import type { Purgeability, ArtifactStore } from '@janumipwb/rph-ports';

/** One ref's answer. Every arm is reachable and none of them is silence. */
export type RetentionVerdict =
	/** The record never claimed bytes for this element — it disclosed an absence, which `PER-9` permits. */
	| 'NOT_CLAIMED'
	/** Present, and the RECOMPUTED hash and byte length match what the record claims. */
	| 'VERIFIED'
	/** Present and different. ⭑ The record's promise is falsified — the strongest thing this module can say. */
	| 'HASH_MISMATCH'
	/** A tombstone: the lawful, disclosed removal of `PURGEABLE_AT_EXPIRY` content under `PER-12`. */
	| 'PURGED'
	/** No row. See `distinguishable` before reading this as "never written". */
	| 'UNRESOLVABLE';

export interface RefResolution {
	readonly field: string;
	readonly verdict: RetentionVerdict;
	/**
	 * ⚠ FALSE MEANS THIS MODULE CANNOT TELL "NEVER WRITTEN" FROM "HELD AND LOST AT RESTART".
	 *
	 * On a `DURABLE` store an absent row really does mean the key was never written — rows survive purging as
	 * tombstones, so absence is informative. On `PROCESS_LOCAL` it is not: a key that held bytes minutes ago is
	 * indistinguishable from one that never existed. The in-memory store already refuses to assert the
	 * difference in its own purge message; a report that flattened the two here would assert an absence it
	 * cannot observe, which this repository has recorded as a defect twice.
	 */
	readonly distinguishable: boolean;
	/** Always populated: a verdict a reader cannot act on is the silent omission `PER-9` forbids. */
	readonly detail: string;
}

export interface RetentionReport {
	readonly exchangeId: string;
	readonly refs: readonly RefResolution[];
	/** True only if every ref is `VERIFIED` or honestly `NOT_CLAIMED`. */
	readonly intact: boolean;
}

/** The shape this module needs off a `MODEL_EXCHANGE`, structural rather than nominal so a fixture can drive it. */
export interface ResolvableRef {
	readonly status: 'PENDING_CONTENT_PLANE' | 'STORED';
	readonly reason?: string;
	readonly storageKey?: string;
	readonly contentHash?: string;
	readonly byteSize?: number;
	readonly purgeability?: Purgeability;
	readonly contentDurability?: 'DURABLE' | 'PROCESS_LOCAL';
}

export interface ResolvableExchange {
	readonly exchangeId: string;
	readonly materializedInputRef: ResolvableRef;
	readonly rawOutputBeforeCoercionRef: ResolvableRef;
	readonly answerSpanRef: ResolvableRef;
	readonly volunteeredReasoningRef: ResolvableRef;
}

/** The four elements that can carry bytes. E-3/E-4/E-5 are metadata and have nothing to resolve. */
const CONTENT_FIELDS = [
	'materializedInputRef',
	'rawOutputBeforeCoercionRef',
	'answerSpanRef',
	'volunteeredReasoningRef'
] as const;

/**
 * SHA-256 over the BYTES, matching how the stores compute it.
 *
 * ⭑ RECOMPUTED, NOT READ OFF `stat`. `stat().contentHash` is the hash recorded AT PUT TIME; comparing it to the
 * record's copy compares two transcriptions of one claim and cannot fail if the bytes later changed. Reading
 * the bytes and hashing them again is the only version that is a check rather than a ceremony — and it is the
 * mutant the gate names first.
 */
async function recompute(bytes: string): Promise<string> {
	const { createHash } = await import('node:crypto');
	return `sha256:${createHash('sha256').update(bytes, 'utf8').digest('hex')}`;
}

async function resolveOne(
	field: string,
	ref: ResolvableRef,
	store: ArtifactStore
): Promise<RefResolution> {
	// A store's OWN durability is the fact; the ref's copy is what the record claimed at write time. They can
	// disagree — a record written against an in-memory store and reopened against a durable one — and when they
	// do, the STORE answering now is the one that decides what an absent row means.
	const distinguishable = store.durability === 'DURABLE';

	if (ref.status !== 'STORED')
		return {
			field,
			verdict: 'NOT_CLAIMED',
			distinguishable: true,
			detail:
				ref.reason?.trim() ||
				'The record disclosed no bytes for this element and stated no reason, which the handler should have refused.'
		};

	const key = ref.storageKey;
	if (!key)
		return {
			field,
			verdict: 'UNRESOLVABLE',
			distinguishable: true,
			detail: 'The ref is STORED and carries no storageKey, so there is nothing to resolve.'
		};

	const meta = await store.stat(key);
	if (!meta)
		return {
			field,
			verdict: 'UNRESOLVABLE',
			distinguishable,
			detail: distinguishable
				? `No entry exists for '${key}'. This store is DURABLE and its rows survive purging as tombstones, so the key was never written.`
				: `No entry exists for '${key}', and this store is PROCESS_LOCAL — a key that held bytes before a restart is indistinguishable here from one that never existed. This does NOT establish that the bytes were never stored.`
		};

	if (meta.purged)
		return {
			field,
			verdict: 'PURGED',
			distinguishable: true,
			detail: `The entry for '${key}' is a tombstone: its bytes were purged and its identity survives. Purgeability recorded as ${meta.purgeability}.`
		};

	const bytes = await store.get(key);
	if (bytes === undefined)
		return {
			field,
			verdict: 'UNRESOLVABLE',
			distinguishable: true,
			detail: `'${key}' has metadata but no readable bytes, and is not marked purged. The store is internally inconsistent for this key.`
		};

	const actual = await recompute(bytes);
	const size = Buffer.byteLength(bytes, 'utf8');
	if (actual !== ref.contentHash || (ref.byteSize !== undefined && size !== ref.byteSize))
		return {
			field,
			verdict: 'HASH_MISMATCH',
			distinguishable: true,
			detail: `The record claims ${ref.contentHash} (${ref.byteSize} bytes) and the stored bytes hash to ${actual} (${size} bytes). The record's promise about this element is false.`
		};

	return {
		field,
		verdict: 'VERIFIED',
		distinguishable: true,
		detail: `${size} bytes at '${key}' hash to the value the record claims.`
	};
}

/**
 * Resolve every content ref on an exchange and report. ⭑ BYTES ARE READ INTERNALLY AND NEVER RETURNED, which
 * is what lets this run with no access model at all: it discloses nothing about content beyond whether the
 * record told the truth about it.
 */
export async function verifyExchangeContent(
	exchange: ResolvableExchange,
	store: ArtifactStore
): Promise<RetentionReport> {
	const refs: RefResolution[] = [];
	for (const f of CONTENT_FIELDS) refs.push(await resolveOne(f, exchange[f], store));
	return {
		exchangeId: exchange.exchangeId,
		refs,
		intact: refs.every((r) => r.verdict === 'VERIFIED' || r.verdict === 'NOT_CLAIMED')
	};
}

export type AnswerSpanRead =
	| { readonly available: true; readonly bytes: string }
	| { readonly available: false; readonly refusedBecause: string };

/**
 * Read back the half of the reply that a recorded judgement rested on.
 *
 * ⭑ THIS IS `REG-D-050` PERFORMED, NOT A NEW PERMISSION. The sponsor's words are *"the governed stream is
 * fully auditable and reconstructable"*; the answer span is the material an Assessment concluded from, and
 * `REG-D-050` classified it `RETAINED_BY_PARTICIPATION` in the same breath. **No value is invented here** —
 * `Purgeability` is an existing generated enum, and `REG-Q-056`'s four unratified columns are untouched.
 *
 * ⚠ AND IT IS NOT A RECONSTRUCTION OF THE REPLY. The whole reply is answer + reasoning; the reasoning half is
 * behind `REG-Q-077`. Conflating the two is how this programme over-claimed `ASR-11` limb 3 once already
 * (`REG-F-346`), so the boundary is in the type: this returns ONE span and says so in its name.
 */
export async function readAnswerSpan(
	exchange: ResolvableExchange,
	store: ArtifactStore
): Promise<AnswerSpanRead> {
	const ref = exchange.answerSpanRef;
	if (ref.status !== 'STORED')
		return {
			available: false,
			refusedBecause: `The answer span was not retained for ${exchange.exchangeId}: ${ref.reason?.trim() || 'no reason recorded'}`
		};

	const meta = ref.storageKey ? await store.stat(ref.storageKey) : undefined;
	// ⭑ THE CLASS IS READ OFF THE STORED METADATA, NOT OFF THE FIELD NAME. A guard keyed on "it is called
	// answerSpanRef" would pass purgeable reasoning straight through the moment anything mis-wired the fields,
	// and this module's whole job is to be the thing that does not take the record's word for it.
	if (meta?.purgeability !== 'RETAINED_BY_PARTICIPATION')
		return {
			available: false,
			refusedBecause: `The bytes at '${ref.storageKey}' are classified ${meta?.purgeability ?? 'unknown'}, not RETAINED_BY_PARTICIPATION. Only participating material is readable here; PER-12 material is behind REG-Q-077.`
		};

	// Returning bytes that failed verification would be worse than returning none — a reader cannot tell an
	// unverified span from a verified one, which is the whole defect this module exists to remove.
	const check = await resolveOne('answerSpanRef', ref, store);
	if (check.verdict !== 'VERIFIED')
		return {
			available: false,
			refusedBecause: `The answer span did not verify (${check.verdict}): ${check.detail}`
		};

	return { available: true, bytes: (await store.get(ref.storageKey!))! };
}
