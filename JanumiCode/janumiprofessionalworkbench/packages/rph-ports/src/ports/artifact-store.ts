// ArtifactStore port — the seam where an Artifact's BYTES live, as distinct from the Artifact record itself.
//
// ── WHY THIS PORT, AND WHY IT IS NOT A NEW STORE ────────────────────────────────────────────────────────────
// `REG-D-049` (authored under grant, operative pending confirmation) settles `REG-Q-B`. The corpus forbids a
// second, reasoning-keyed store — Guide §9.7: "It adds no dedicated reasoning store; Section 10's typed
// persistence remains authoritative", and §10.1: "These are information requirements, not permission to add
// tables, fields, objects, or Events." A PORT is none of those: it is a seam, and this one is named in three
// independent places already — `rph-ports/src/index.ts`'s own header, `DEF-W2-001` ("→ ArtifactStore /
// CapabilityAuthorizer ports"), and finding #8, which files a documented seam WITHOUT its port as CRITICAL.
//
// The record stays where it is: `ARTIFACT` already carries DOC-009 §18.1 column-for-column — `storageProvider`,
// `storageKey`, `contentHash`, `byteSize`, `securityClassification`, `retentionClass`,
// `producingExecutionAttemptId`. Only the bytes had nowhere to live. DOC-009 §3.6: "Large or file-based
// artifacts are stored outside core semantic rows."
//
// ── ⭑ PURGE IS THE CLAUSE THAT MAKES THE REST LAWFUL ────────────────────────────────────────────────────────
// Retention of model content today is ILLEGAL rather than merely unbuilt: anything admitted to `domain_events`
// is permanent (§9.4), and `PER-12` requires retained reasoning "purgeable at retention expiry (PER-8)". A
// store with `put` and no `purge` would not make retention lawful — it would move the unlawfulness behind an
// interface. So `purge` is the port's reason for existing, and `put` is what it enables.
//
// ── AND PURGE MUST REFUSE, OR IT BECOMES THE VIOLATION ──────────────────────────────────────────────────────
// `PER-8`: a canonical object that "has participated in execution, assurance, governance, a baseline, or
// traceability is never hard-deleted." Reasoning traces are purgeable PRECISELY BECAUSE they never participate
// (`PER-12` bars them from Evidence, projection and every assurance tier). So purgeability is not a property
// of a retention schedule — it is a property of PARTICIPATION, and a store that purges on demand is a
// hard-delete vector wearing a retention label.

/**
 * Whether this content may ever be purged.
 *
 * ⚠ DELIBERATELY NOT A RETENTION CLASS. `retentionClass`'s value domain is `REG-Q-056`, OPEN, with three
 * candidate domains recorded and none ratified — inventing one here would be exactly the fabrication this
 * programme keeps recording. This binary is not a taxonomy: it is `PER-8`'s participation predicate, which the
 * corpus states outright, and it is the only distinction `purge` needs to be lawful.
 */
export type Purgeability = 'PURGEABLE_AT_EXPIRY' | 'RETAINED_BY_PARTICIPATION';

export interface ArtifactContentInput {
	/** §31.2: "Object keys SHALL include opaque tenant-scoped prefixes." Supplied by the host, never derived
	 *  from a tenant NAME — §31.2 also says tenant names "SHOULD not be directly exposed in object paths". */
	readonly tenantPrefix: string;
	readonly bytes: string;
	readonly mediaType: string;
	readonly purgeability: Purgeability;
}

/** What the caller writes onto `ARTIFACT`. Field-for-field the subset of §18.1 that addresses the bytes. */
export interface StoredArtifactRef {
	readonly storageProvider: string;
	readonly storageKey: string;
	/** §31.3: "Artifacts SHALL use cryptographic content hashes." Over the BYTES — see the adapter note. */
	readonly contentHash: string;
	readonly byteSize: number;
}

export interface StoredArtifactMeta {
	readonly storageKey: string;
	readonly contentHash: string;
	readonly byteSize: number;
	readonly mediaType: string;
	readonly purgeability: Purgeability;
	/** True once the bytes have been purged. The entry SURVIVES — see `purge`. */
	readonly purged: boolean;
}

/**
 * A purge either happened or it did not, and a refusal always says why.
 *
 * ⚠ THERE IS NO SILENT ARM. A purge log that cannot distinguish "removed" from "was not there" from "refused"
 * cannot evidence that a retention policy was executed, which is the only reason to keep such a log.
 */
export type PurgeOutcome =
	| { readonly purged: true }
	| { readonly purged: false; readonly refusedBecause: string };

export interface ArtifactStore {
	put(input: ArtifactContentInput): Promise<StoredArtifactRef>;
	get(storageKey: string): Promise<string | undefined>;
	stat(storageKey: string): Promise<StoredArtifactMeta | undefined>;
	/**
	 * Remove the BYTES and keep the ENTRY.
	 *
	 * ⭑ THE TOMBSTONE IS NOT AN IMPLEMENTATION CHOICE. An `ARTIFACT` record referencing a purged key must stay
	 * EXPLICABLE: deleting the entry outright leaves a reference pointing at nothing, and a reader cannot then
	 * tell "purged on schedule" from "never stored" from "lost" — which is the silent-omission defect one layer
	 * down. `JAN-CSAA-009 §20` names this action `tombstone-or-unavailable-record`.
	 */
	purge(storageKey: string): Promise<PurgeOutcome>;
}
