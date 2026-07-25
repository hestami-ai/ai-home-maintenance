// Test fixture for putting a RUNTIME_BINDING into a given `authorizationStatus` (JAN-EXEBIND WP-B1).
//
// WHY THIS EXISTS — AND IT IS A FINDING, NOT A CONVENIENCE. `RuntimeBinding.authorizationStatus` ratifies five
// states, and the machine declares `REQUESTED -> PARTIALLY_AUTHORIZED` with the trigger "partial grant". **No
// command drives it.** `registry.ts` wires RequestRuntimeBinding, AuthorizeRuntimeBinding, DenyRuntimeBinding and
// RevokeRuntimeCapability; there is no partial-grant command anywhere in the repo.
//
// That matters here because `bindingPermitsExecution` — the ratified kernel this work package finally wires —
// PERMITS execution on a PARTIALLY_AUTHORIZED binding. So the rule has an acceptance limb that the command bus
// cannot reach, and without a seam the positive case would go untested while looking covered. The alternative was
// to write the acceptance as a pure-function assertion, which is precisely the substitution (a predicate call
// accepted as evidence for a command-layer rule) that JAN-EXECREM WP-16's register exists to stop.
//
// SO: the ARRANGEMENT is seeded, the ACCEPTANCE is driven through `Engine.dispatch`. Same discipline, and same
// stated reason, as `plan-fixtures.ts` (SM-7) and `pwu-fixtures.ts`.
//
// The dead arrow itself is recorded as a finding (N-6) in `JAN-EXECREM-RESIDUALS.md` — a ratified state that no
// command can produce is the same shape as the `* -> SUPERSEDED` step arrows F-26's rider named, and it is not
// this work package's to fix.
//
// Not in `kit.ts`: that is production. `__tests__/` is excluded from tsconfig.build and does not match vitest's
// `*.test.ts` include, so nothing here ships or runs as a suite.
import { RuntimeBindingSchema } from '@janumipwb/rph-contracts';
import { getMachine } from '@janumipwb/rph-domain';
import type { StorageAdapter } from '@janumipwb/rph-ports';

let seq = 0;

/**
 * Put `bindingId` into `authorizationStatus`, committing one revision with no events.
 *
 * The status is checked against the RATIFIED machine's own state list and the patched aggregate is re-parsed
 * against `RuntimeBindingSchema` before it is written — `store.commit` bypasses the handler kit's
 * `validateAgainst`, and a fixture able to write a shape the contract forbids lets a suite rehearse against an
 * aggregate the engine cannot produce.
 */
export function seedRuntimeBindingStatus_FIXTURE(
	store: StorageAdapter,
	bindingId: string,
	authorizationStatus: string
): void {
	const states = getMachine('RuntimeBinding.authorizationStatus').states;
	if (!states.includes(authorizationStatus))
		throw new Error(
			`seedRuntimeBindingStatus_FIXTURE: '${authorizationStatus}' is not a state of ` +
				`RuntimeBinding.authorizationStatus — seeding it would rehearse against an aggregate the machine ` +
				`cannot represent.`
		);

	const stored = store.loadObject(bindingId);
	if (!stored)
		throw new Error(`seedRuntimeBindingStatus_FIXTURE: no stored object for binding ${bindingId}`);
	const nextState = RuntimeBindingSchema.parse({
		...RuntimeBindingSchema.parse(stored.state),
		authorizationStatus
	});

	seq += 1;
	const result = store.commit({
		aggregateType: 'RUNTIME_BINDING',
		aggregateId: bindingId,
		objectType: 'RUNTIME_BINDING',
		expectedRevision: stored.revision,
		newRevision: stored.revision + 1,
		newSemanticVersion: stored.semanticVersion,
		currentState: nextState,
		events: [],
		receipt: {
			commandId: `fixture-seedBindingStatus-${seq}`,
			idempotencyKey: `fixture-seedBindingStatus-${seq}`,
			commandType: 'FixtureSeedBindingStatus',
			targetAggregateId: bindingId,
			status: 'ACCEPTED',
			producedEventIds: []
		}
	});
	if (!result.ok)
		throw new Error(
			`seedRuntimeBindingStatus_FIXTURE: commit refused for ${bindingId} (${result.reason}, actual revision ${String(result.actualRevision)})`
		);
}
