// THE TEST CREDENTIAL DIRECTORY — reachable only as `@janumipwb/rph-ports/testing`, never from the barrel.
//
// ⚠ THIS FILE IS WHERE THE TRUST BOUNDARY WOULD GO VACUOUS. Read the four properties before changing it.
//
// When the gate landed, ~2,500 tests had to keep passing. The obvious move is a permissive test authenticator
// that accepts anything and returns whatever the caller declared as `issuedBy`. That would make the whole
// increment worthless AND INVISIBLY SO: dispatch would still stamp "the authenticated principal", which in
// tests would be the caller's own claim laundered through a port. This repository has shipped three controls
// green that proved nothing; this would have been the fourth and largest.
//
// (a) THE PORT NEVER SEES THE COMMAND. `authenticate(credential)` takes a credential and nothing else, so the
//     echo is INEXPRESSIBLE rather than discouraged.
//
// (b) THE CREDENTIAL KEYS ARE NOT THE IDENTITIES. A directory keyed by `actorId` is the permissive
//     authenticator wearing a hat: if `cred('alice')` yields Alice, the caller still chooses who it is and the
//     laundering is back with a lookup in the way. These tokens are unguessable from what they resolve to.
//
// (c) IT IS CLOSED, AND `?? null` IS THE REFUSAL PATH — never `?? SOME_DEFAULT`. An unknown credential must
//     fail, and `verif/trust-boundary.test.ts` is what exercises that branch.
//
// (d) FOUR PRINCIPALS ACROSS THREE ACTOR TYPES IS THE MINIMUM THAT CAN DISCRIMINATE. With one, "the engine
//     stamped the authenticated principal" is a tautology — there is nothing else it could have stamped.
import type { AuthenticationOutcome, AuthenticationPort, Credential, Principal } from './index.js';

/** The single-organization constants REG-D-026 requires: present and singular, never absent. */
const TENANT = 'tenant-test';
const ORG = 'org-test';

/**
 * Opaque test credentials. The strings are deliberately meaningless — a reader cannot tell WHO `TEST_CRED.human`
 * resolves to without consulting the directory, which is the property that keeps the fixture honest.
 */
export const TEST_CRED = {
	human: 'c7f1e2a4-h' as Credential,
	agent: '9b3d05c8-a' as Credential,
	reviewer: '2e64af11-r' as Credential,
	system: '5a08cd7e-s' as Credential
} as const;

/** A credential no directory resolves. The refusal path's only driver — keep it unregistered. */
export const UNKNOWN_CRED = 'ffffffff-x' as Credential;

const DIRECTORY: Readonly<Record<string, Principal>> = {
	[TEST_CRED.human]: {
		actorId: 'u1',
		actorType: 'HUMAN',
		displayName: 'Operator',
		tenantId: TENANT,
		organizationId: ORG
	},
	[TEST_CRED.agent]: {
		actorId: 'agent-1',
		actorType: 'AGENT',
		displayName: 'Test Agent',
		tenantId: TENANT,
		organizationId: ORG,
		modelId: 'test-model',
		providerId: 'test-provider'
	},
	[TEST_CRED.reviewer]: {
		actorId: 'user-2',
		actorType: 'HUMAN',
		displayName: 'Test Reviewer',
		tenantId: TENANT,
		organizationId: ORG
	},
	[TEST_CRED.system]: {
		actorId: 'system',
		actorType: 'SERVICE',
		displayName: 'Test System',
		tenantId: TENANT,
		organizationId: ORG
	}
};

/** The principal a credential resolves to, for tests that assert what the engine stamped. */
export function testPrincipal(credential: Credential): Principal {
	const p = DIRECTORY[credential];
	if (!p) throw new Error(`No test principal for credential ${String(credential)}`);
	return p;
}

/** A CLOSED directory authenticator. An unknown credential is REFUSED — that refusal is the point. */
export function testAuthenticator(): AuthenticationPort {
	return {
		authenticate(credential: Credential): AuthenticationOutcome {
			const principal = DIRECTORY[credential];
			return principal ? { ok: true, principal } : { ok: false, reason: 'UNKNOWN_CREDENTIAL' };
		}
	};
}

/**
 * A closed directory built from an explicit principal list, for the few tests that legitimately dispatch AS
 * MORE THAN ONE ACTOR — the REG-F-014 authority tests, the independence tests.
 *
 * ⚠ IT DOES NOT REOPEN THE LAUNDERING HOLE, and the distinction is worth stating because it looks close to it.
 * The caller may SELECT among principals the fixture registered up front; it cannot INVENT one at dispatch
 * time — `credentialFor` throws on an unregistered actor. What property (b) forbids is a caller choosing who
 * it is; what this allows is a fixture declaring, in advance, the cast of a scenario.
 */
export function testDirectory(principals: readonly Principal[]): {
	readonly authenticate: AuthenticationPort;
	credentialFor(actorId: string): Credential;
} {
	const byCredential: Record<string, Principal> = {};
	const byActor: Record<string, Credential> = {};
	principals.forEach((p, i) => {
		// Opaque and positional — deliberately not derived from the actorId it resolves to.
		const c = `d${i}-${'x'.repeat(3)}${i * 7 + 11}` as Credential;
		byCredential[c] = p;
		byActor[p.actorId] = c;
	});
	return {
		authenticate: {
			authenticate: (credential) => {
				const principal = byCredential[credential];
				return principal ? { ok: true, principal } : { ok: false, reason: 'UNKNOWN_CREDENTIAL' };
			}
		},
		credentialFor(actorId) {
			const c = byActor[actorId];
			if (!c) throw new Error(`No principal registered for ${actorId}; register it in the fixture.`);
			return c;
		}
	};
}
