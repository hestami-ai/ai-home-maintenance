// THE HOST'S SIDE OF THE TRUST BOUNDARY — the standalone tier's adapter (REG-D-027, REG-D-028).
//
// JPWB does not authenticate; Platform supplies identity machinery (DOC-002 §1) and the engine CONSUMES a
// verified principal. This module is the standalone adapter: it establishes a local authenticated identity and
// resolves credentials to principals synchronously, which is what `AuthenticationPort` requires.
//
// ⚠ WHAT CHANGES PER TIER IS THIS FILE AND NOTHING BELOW IT. In SaaS and Enterprise the async work — validating
// an IdP token, consulting a directory, checking revocation — happens at the edge, and the resulting session
// becomes the credential this table would resolve. The ENGINE cannot tell the difference, which is what CON-000
// AX-10 requires: "Deployment topology MUST NOT change professional meaning."
//
// ── THREE PRINCIPALS, AND THE SEPARATION IS THE POINT ────────────────────────────────────────────────────────
// The workbench user, the authoring agent, and the seeder are DIFFERENT ACTORS and must resolve to different
// principals. Before this, every one of them was the same hardcoded `ui-user` (REG-F-054), which is why the
// record could not answer "who did what". Giving the agent its own credential is also what stops D-1 from
// making forgeability LIVE: without it the broker's AGENT identity would fall dead the moment the engine began
// stamping, and every agent-authored command would silently acquire the human's identity (REG-F-056).
import type { ActorReference } from '@janumipwb/rph-contracts';
import { asCredential, type AuthenticationPort, type Principal } from '@janumipwb/rph-ports';

/**
 * REG-D-026: carried, not governed. Standalone takes a well-known constant and it is PRESENT AND SINGULAR —
 * never absent, because "one organization" and "no notion of organization" must stay distinguishable in the
 * record and no backfill can invent which organization a past act belonged to.
 */
const STANDALONE_TENANT = 'tenant-local';
const STANDALONE_ORG = 'org-local';

/** The workbench's local authenticated human session. */
export const SESSION_CREDENTIAL = asCredential('jpwb.session.local');
/** The authoring agent. A DISTINCT credential — see the note above on why this is load-bearing. */
export const AGENT_CREDENTIAL = asCredential('jpwb.session.agent');
/** Seeding and recovery, which run at construction before any user session exists. */
export const SYSTEM_CREDENTIAL = asCredential('jpwb.session.system');
/**
 * The reference Undertaking's owner. The seeded workbench REPLAYS WORK A PROFESSIONAL DID — it proposes and
 * approves governance Decisions, and `makeDecisionEffective` grants EFFECTIVE only on a HUMAN authority. A
 * SERVICE seeder therefore cannot produce that fixture at all, and authenticating one as HUMAN to get past the
 * guard would put back exactly the fiction SYSTEM_CREDENTIAL exists to avoid.
 *
 * So the demonstration data is seeded AS ITS OWNER, and the record says so. `owner-1` is not invented here: it
 * is the identity `reference-undertaking.ts` has always named as the actor of that work.
 */
export const REFERENCE_OWNER_CREDENTIAL = asCredential('jpwb.session.reference-owner');

const PRINCIPALS: Readonly<Record<string, Principal>> = {
	[SESSION_CREDENTIAL]: {
		actorId: 'local-professional',
		actorType: 'HUMAN',
		displayName: 'Workbench User',
		tenantId: STANDALONE_TENANT,
		organizationId: STANDALONE_ORG
	},
	[AGENT_CREDENTIAL]: {
		actorId: 'jpwb-authoring-agent',
		actorType: 'AGENT',
		displayName: 'JPWB Authoring Agent',
		tenantId: STANDALONE_TENANT,
		organizationId: STANDALONE_ORG
	},
	[REFERENCE_OWNER_CREDENTIAL]: {
		actorId: 'owner-1',
		actorType: 'HUMAN',
		displayName: 'Undertaking Owner',
		tenantId: STANDALONE_TENANT,
		organizationId: STANDALONE_ORG
	},
	[SYSTEM_CREDENTIAL]: {
		// SERVICE, not HUMAN and not AGENT. The seeder is neither a professional nor a model, and calling it
		// either would put a fiction into every seeded object's `createdBy`.
		actorId: 'jpwb-seed',
		actorType: 'SERVICE',
		displayName: 'Workbench Seed',
		tenantId: STANDALONE_TENANT,
		organizationId: STANDALONE_ORG
	}
};

/**
 * The acting identity FOR A PAYLOAD THAT MUST NAME ONE — derived from authenticated context, never authored.
 *
 * Stamping covers the envelope (`issuedBy`); it does not reach the ratified payload fields that name an actor
 * in their own right — a Decision's `authority` (ASR-15), an ExecutionAttempt's `executedBy`, an assessment's
 * `evaluator`. Those surfaces filled them with the literal `{ actorId: 'ui-user', actorType: 'HUMAN' }`
 * (REG-F-061): an identity no authenticator issues, no credential resolves to, and nothing could ever hold to
 * account. `proposeDecision` compares its payload authority to the stamped issuer, so the fiction did not merely
 * sit in the record — it refused every governance Decision the workbench tried to propose.
 *
 * ⚠ THROWS RATHER THAN DEFAULTS. An unresolved session has no true actor to name, and the two wrong answers
 * are equally available: invent one, or reuse the last one. §13.3 names this case — "Fail closed on missing
 * identity, tenant, POLICY, schema, or authority context" — and a surface that cannot say who is acting has
 * nothing it is entitled to write.
 */
export function actingActor(session: { readonly principal: Principal | undefined }): ActorReference {
	const p = session.principal;
	if (!p) {
		throw new Error(
			'Fail-closed (§13.3): this action must name its acting professional in the command payload, and the ' +
				'session credential did not resolve to a principal. No identity is substituted (DOC-004 §5).'
		);
	}
	// A projection of the resolved principal onto the ratified wire shape — never a widening. `tenantId` /
	// `organizationId` have no home on `ActorReference`; carrying them onto the record is D-3's work (REG-D-026)
	// and is not smuggled through here.
	return {
		actorId: p.actorId,
		actorType: p.actorType,
		displayName: p.displayName,
		...(p.roleId === undefined ? {} : { roleId: p.roleId }),
		...(p.modelId === undefined ? {} : { modelId: p.modelId }),
		...(p.providerId === undefined ? {} : { providerId: p.providerId }),
		...(p.executionInstanceId === undefined
			? {}
			: { executionInstanceId: p.executionInstanceId })
	};
}

/**
 * The standalone authenticator. CLOSED: an unrecognised credential is refused, never defaulted.
 *
 * `?? { ok: false }` rather than `?? SOME_PRINCIPAL` is the whole of the gate on this side. A default here
 * would make every refusal path in the engine unreachable from the app, and the increment would be decorative.
 */
export function standaloneAuthenticator(): AuthenticationPort {
	return {
		authenticate(credential) {
			const principal = PRINCIPALS[credential];
			return principal ? { ok: true, principal } : { ok: false, reason: 'UNKNOWN_CREDENTIAL' };
		}
	};
}
