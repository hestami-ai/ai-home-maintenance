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
