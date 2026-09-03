// ICP-02 — the PER-9 exchange record.
//
// ── ADOPTED, NOT DERIVED ────────────────────────────────────────────────────────────────────────────────────
// The shape comes from `JAN-CSAA-007`'s `ModelExchangeRecord`, field by field, with every taken and refused
// field reasoned in `docs/Instruction and Context Plane/ICP-02 adoption decision.md`. CSAA is another agent's
// subsystem: this adopts the SHAPE and imports NOTHING from it. The reason to start there rather than from
// PER-9 alone is REG-F-314 — a design that re-derives a ratified obligation unaided produces a weaker set, and
// this repository has the receipt.
//
// ── WHY THIS RECORD HOLDS REFERENCES AND NOT CONTENT ────────────────────────────────────────────────────────
// `ModelExchangeRecord` stores the input and output BY REFERENCE (`materializedInputArtifactRef`,
// `rawOutputBeforeCoercionRef`). That is the two-plane architecture PER-12 + PER-8 require, arrived at
// independently: the RECORD is permanent (PER-8, no hard delete after participation) and the CONTENT is
// purgeable at retention expiry (PER-12), so they cannot share a store.
//
// ⚠ THE REFERENTS DO NOT EXIST YET, AND THAT IS DISCLOSED RATHER THAN HIDDEN. There is no content store
// (`REG-F-315`; specified at Single-Node Runtime Profile §31, deferred as `DEF-W2-001`) and no redaction
// anywhere (finding #60). So the content refs are born `PENDING_CONTENT_PLANE` with a reason. A record that
// SAYS its bytes are unretained is the disclosed omission PER-9 permits; today's code performs the silent one
// PER-9 forbids ("record-plane omission is not").

import type { ContentDurability, Purgeability } from '@janumipwb/rph-ports';

/** PER-9-a's unit. Taken VERBATIM from `ModelExchangeRecord` — a narrower set would silently re-merge cases
 *  the corpus separates, which is the defect at `reasoning-review-validator.ts:180`. */
export type ExchangeRole = 'initial' | 'retry' | 'reformat' | 'repair';

/** E-4. `unknown` is the member that must never be dropped: it states an unobtained answer instead of guessing
 *  one. Finding #61 is what happens without it — truncation declared only inside a discarded prompt string. */
export type TruncationState = 'none-declared' | 'declared' | 'detected' | 'unknown';

/** E-5. `accepted-for-normalization` is renamed `accepted` (CSAA's normalization pipeline has no JPWB
 *  counterpart); the rest are verbatim. `repair-requested` is what a repair's PREDECESSOR records — the fact
 *  finding #62's bare `catch` currently drops. */
export type ExchangeDisposition = 'accepted' | 'rejected' | 'quarantined' | 'repair-requested';

/** The identity that actually served the try (E-3).
 *
 *  ⭑ THE SECOND AND THIRD ARMS ARE LOAD-BEARING. PER-12: availability is "provider- and configuration-
 *  dependent". An optional field cannot distinguish "the provider reported nothing" from "nobody looked" —
 *  and conflating those two is this repository's single most-recorded defect. Stating it costs one union. */
export type ResolvedModelIdentity =
	| { readonly kind: 'resolved'; readonly modelId: string; readonly providerId: string }
	| { readonly kind: 'unreported'; readonly rationale: string }
	| { readonly kind: 'unresolvable'; readonly rationale: string };

/** A pointer to content that lives outside the record. `PENDING_CONTENT_PLANE` is not a placeholder for a
 *  missing value — it is a positive statement that the bytes were obtainable and are not yet retainable. */
export interface ContentRef {
	/** REG-D-050: which side of PER-8 this content falls on. Absent while PENDING — nothing is classified
	 *  until it is actually retained, because a classification on absent bytes asserts a fact about nothing. */
	readonly purgeability?: Purgeability;
	readonly status: 'PENDING_CONTENT_PLANE' | 'STORED';
	/**
	 * Set only when STORED — whether the referenced bytes survive a restart.
	 *
	 * ⭑ THE RECORD DISCLOSES THIS BECAUSE THE INVERSE ORPHAN IS OTHERWISE INVISIBLE. This record plane can be
	 * durable while the content plane is not; after one restart the reference then names bytes that are gone,
	 * and the store's answer is indistinguishable from a key never written — so the record still LOOKS intact.
	 * Carrying the content store's declared durability turns that from an undetectable hazard into a disclosed
	 * one, which is the posture `PER-9` requires: *"record-plane omission is not legal."*
	 */
	readonly contentDurability?: ContentDurability;
	/** Set only when STORED — the `ARTIFACT.storageKey` the bytes live under. */
	readonly storageKey?: string;
	/** Set only when PENDING — why, in terms a reader can act on. */
	readonly reason?: string;
}

export interface OmittedRegion {
	readonly role: string;
	readonly reason: string;
}

export interface ExchangeRecord {
	readonly exchangeId: string;
	readonly exchangeRole: ExchangeRole;
	/** Required unless `initial`. Names the try this one succeeds, which is what makes CSAA-007's rule —
	 *  "Repair never rewrites predecessor raw output" — checkable rather than aspirational. */
	readonly predecessorExchangeId?: string;
	readonly resolvedModelIdentity: ResolvedModelIdentity;
	/** E-1 — the exact materialized input, by reference. */
	readonly materializedInputRef: ContentRef;
	/** E-2 — the returned output before schema coercion or repair, by reference. */
	readonly rawOutputBeforeCoercionRef: ContentRef;
	/** E-6 — what was redacted from the input, by reference. */
	readonly inputRedactionManifestRef: ContentRef;
	/** INDEX, NEVER SUBSTITUTE (PER-9). Present or not, it does not satisfy E-1 — see `unsatisfiedElements`. */
	readonly promptTemplateFingerprint?: string;
	readonly truncationState: TruncationState;
	readonly omittedRegions: readonly OmittedRegion[];
	readonly disposition?: ExchangeDisposition;
}

/** Either a resolved model, or a stated reason there is none. */
export type ModelInput =
	| { readonly modelId: string; readonly providerId: string }
	| { readonly unavailable: 'unreported' | 'unresolvable'; readonly rationale: string };

export interface BeginExchangeInput {
	readonly exchangeId: string;
	readonly role: ExchangeRole;
	/** The PREDECESSOR RECORD, not its id.
	 *  ⭑ TAKING THE RECORD IS THE POINT. CSAA-007's rule is "Repair never rewrites predecessor raw output",
	 *  and a function handed only an id cannot violate it — so a test asserting non-mutation would be a
	 *  control that cannot fail. Passing the record makes the rule breakable, therefore assertable. */
	readonly predecessor?: ExchangeRecord;
	readonly model: ModelInput;
	readonly promptTemplateFingerprint?: string;
}

const PENDING_CONTENT: ContentRef = {
	status: 'PENDING_CONTENT_PLANE',
	reason:
		'No content store exists (REG-F-315; specified at Single-Node Runtime Profile §31, deferred as DEF-W2-001) ' +
		'and no redaction exists (finding #60). Retaining bytes in the permanent event store would violate PER-12’s ' +
		'purge-at-expiry requirement. Blocked on ICP-03.'
};

function toIdentity(model: ModelInput): ResolvedModelIdentity {
	return 'unavailable' in model
		? { kind: model.unavailable, rationale: model.rationale }
		: { kind: 'resolved', modelId: model.modelId, providerId: model.providerId };
}

/**
 * Open the record for one bounded try.
 *
 * FAILS CLOSED ON THE ROLE/PREDECESSOR RELATION. A `retry` with no predecessor is an orphaned try, and an
 * `initial` with one is a mislabelled chain; both would make PER-9-a's "each retry, reformat, and repair"
 * uncountable. Refusing here is cheaper than discovering it in a record nobody can reconstruct.
 */
export function beginExchange(input: BeginExchangeInput): ExchangeRecord {
	if (input.role !== 'initial' && !input.predecessor)
		throw new Error(
			`ExchangeRecord ${input.exchangeId}: role '${input.role}' requires a predecessor — a non-initial try that names no predecessor cannot be reconstructed as part of its chain (PER-9-a).`
		);
	if (input.role === 'initial' && input.predecessor)
		throw new Error(
			`ExchangeRecord ${input.exchangeId}: role 'initial' must not carry a predecessor — an initial try by definition succeeds nothing.`
		);
	return {
		exchangeId: input.exchangeId,
		exchangeRole: input.role,
		...(input.predecessor ? { predecessorExchangeId: input.predecessor.exchangeId } : {}),
		resolvedModelIdentity: toIdentity(input.model),
		materializedInputRef: PENDING_CONTENT,
		rawOutputBeforeCoercionRef: PENDING_CONTENT,
		inputRedactionManifestRef: PENDING_CONTENT,
		...(input.promptTemplateFingerprint
			? { promptTemplateFingerprint: input.promptTemplateFingerprint }
			: {}),
		// NEVER 'none-declared' by default: that would assert a fact nobody established (finding #61).
		truncationState: 'unknown',
		omittedRegions: []
	};
}

/**
 * Which of PER-9's six elements this record does NOT yet satisfy.
 *
 * ⭑ THIS IS THE ANTI-SUBSTITUTION PREDICATE. A present `promptTemplateFingerprint` does not remove `E-1`,
 * because PER-9 says a fingerprint "identifies that record; it never substitutes for it" — and a byte-count
 * summary standing in for the input is precisely the design REG-F-314 records as wrong. Making the shortfall
 * ENUMERABLE is what converts today's silent omission into the disclosed one PER-9 permits.
 */
export function unsatisfiedElements(rec: ExchangeRecord): readonly string[] {
	const missing: string[] = [];
	if (rec.materializedInputRef.status !== 'STORED') missing.push('E-1');
	if (rec.rawOutputBeforeCoercionRef.status !== 'STORED') missing.push('E-2');
	if (rec.resolvedModelIdentity.kind === 'unresolvable') missing.push('E-3');
	if (rec.truncationState === 'unknown') missing.push('E-4');
	if (!rec.disposition) missing.push('E-5');
	if (rec.inputRedactionManifestRef.status !== 'STORED') missing.push('E-6');
	return missing;
}
