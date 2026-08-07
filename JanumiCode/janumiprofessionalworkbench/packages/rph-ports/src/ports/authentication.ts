// AuthenticationPort — the trust boundary's seam. JPWB does NOT authenticate; it CONSUMES a verified identity.
//
// JPWB-DOC-002 §1 (RATIFIED) allocates the machinery: Platform "supplies machinery — infrastructure, runtime,
// identity, services, controls — never domain semantics." Minting, issuing, refreshing and revoking a
// credential are outside this repository. What is inside is the obligation to DERIVE the acting principal from
// authenticated context — JPWB-DOC-004 §5: "derive tenant and principal context from authenticated context,
// never from a payload's claim about itself" — and JPWB-DOC-003 §9 PER-3's requirement that canonical state be
// mutated "only through authenticated, authorized, semantically named commands", whose SCOPE clause makes "the
// existence and completeness of the gate" the semantic requirement.
//
// ── WHY A CREDENTIAL AND NOT A PRINCIPAL (REG-D-027, REG-F-056) ──────────────────────────────────────────────
// A `Principal` parameter would let every call site author who is acting — the same self-assertion one layer
// out. A credential can be PRESENTED and cannot be AUTHORED; that asymmetry is the design, and it is why
// `Credential` is branded rather than a bare string.
//
// ── WHY NOT ON THE COMMAND ENVELOPE ──────────────────────────────────────────────────────────────────────────
// REG-Q-004's binding safe default (an OPEN register entry's safe default binds — REG-005 §1) locates principal
// scoping in "authenticated transport", and SPEC-001 §11.4.2 restates it as a ratified SHALL. `DomainCommand`
// is also a closed versioned wire contract, so an envelope credential would be the LARGER governed change —
// and it would put a bearer secret inside a replayable, permanently recorded object.
//
// ── WHY THE PORT IS SYNCHRONOUS, WHICH IS WHAT MAKES IT WORK IN ALL THREE TIERS ──────────────────────────────
// Engine dispatch is synchronous, so an IdP round-trip CANNOT happen behind this interface. That is not a
// limitation to work around — it is REG-Q-004's arrangement expressed in types. The ASYNC work (validating an
// OIDC token, consulting a directory, checking revocation) happens at the TRANSPORT, before dispatch; what
// reaches this port is a credential the host has already established, and resolving it is a local lookup.
//
//   standalone  — a local authenticated session; the credential is its session handle.
//   SaaS        — the request's IdP token is validated at the edge; the credential is the resulting session.
//   Enterprise  — the same, plus federation and directory-sourced roles.
//
// The ENGINE cannot tell which of the three it is in, and CON-000 AX-10 requires exactly that: "Deployment
// topology MUST NOT change professional meaning; a runtime is conformant only if it preserves the semantics,
// whatever its stack."
import type { ActorType } from '@janumipwb/rph-contracts';

declare const CredentialBrand: unique symbol;

/**
 * An opaque bearer of externally established identity.
 *
 * BRANDED ON PURPOSE. A caller can hold one and hand it back; it cannot conjure one from a string literal and
 * cannot read meaning out of it. `asCredential` is the single narrowing point, so every place a credential
 * enters the system is greppable.
 */
export type Credential = string & { readonly [CredentialBrand]: 'Credential' };

/** The ONE narrowing point from a host-supplied string to a `Credential`. Call it at the trust boundary. */
export function asCredential(raw: string): Credential {
	return raw as Credential;
}

/**
 * The resolved acting principal — who the engine records as having acted.
 *
 * Fields are what JPWB-DOC-003 §3's common object contract demands of `createdBy`/`updatedBy`, plus the two
 * scope axes REG-D-026 rules must be carried, plus the identity dimensions ASR-13's independence ladder
 * compares.
 */
export interface Principal {
	readonly actorId: string;
	readonly actorType: ActorType;
	readonly displayName: string;
	/** The role held for this act, from the host's directory. Never synthesized from a label. */
	readonly roleId?: string;
	/**
	 * REG-D-026: CARRIED, not governed. In a standalone deployment these take a well-known constant and are
	 * PRESENT AND SINGULAR — never absent. "One organization" and "no notion of organization" must stay
	 * distinguishable in the record, because no backfill can invent which organization a past act belonged to.
	 *
	 * ⚠ They are NOT yet written onto the object envelope — that is D-3, and it trips SPEC-001 FORK-2's
	 * ratified reopening trigger (REG-F-058). Carried on the Principal here so the transport can supply them
	 * from the start.
	 */
	readonly tenantId: string;
	readonly organizationId: string;
	/**
	 * ASR-13 independence dimensions, for AGENT/MODEL principals; absent for a human.
	 * ⚠ Omitting these does not make the ladder permissive — `checkIndependence`'s `differs()` requires BOTH
	 * sides present and unequal, so an absent id FAILS CLOSED. They exist so the rungs can compare rather than
	 * refuse everything.
	 */
	readonly modelId?: string;
	readonly providerId?: string;
	readonly executionInstanceId?: string;
}

/**
 * The outcome of resolving a credential.
 *
 * ⚠ A DISCRIMINATED UNION, NOT `Principal | null`. A bare null discards the reason, and the reason is owed:
 * JPWB-DOC-004 §5 requires typed errors with the feature, and §7.2 requires a denied transition to be logged
 * "with actor, guard result". A refusal this engine cannot explain is a refusal it cannot audit.
 */
export type AuthenticationOutcome =
	| { readonly ok: true; readonly principal: Principal }
	| {
			readonly ok: false;
			readonly reason: 'UNKNOWN_CREDENTIAL' | 'EXPIRED' | 'REVOKED' | 'MALFORMED';
	  };

/**
 * Resolve an already-established credential to the principal it names.
 *
 * ⚠ IT MUST NOT SEE THE COMMAND, and the signature is what enforces that. Taking a credential and nothing else
 * makes the degenerate implementation — echoing back whatever the caller declared as `issuedBy` — literally
 * INEXPRESSIBLE rather than merely discouraged. Widening this signature is the one change that would quietly
 * restore laundering, so it must be argued rather than made.
 */
export interface AuthenticationPort {
	authenticate(credential: Credential): AuthenticationOutcome;
}
