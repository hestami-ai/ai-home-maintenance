// Test fixtures for putting a PROFESSIONAL_WORK_UNIT into a given `workLifecycleState` (JAN-EXECREM WP-16).
//
// WHY THIS EXISTS. The enforcement register's RPH-PWU-010 row must OBSERVE the BASELINED refusal through
// `Engine.dispatch`, and BASELINED has exactly two in-arrows in the ratified machine — from SATISFIED and from
// RECOMPOSED (`READY -> BASELINED` is listed as explicitly ILLEGAL). Reaching SATISFIED means driving the whole
// assurance chain: evidence admitted, every mandatory assessment satisfied, the P1/INV-5 cross-axis guard cleared.
//
// Driving that chain here would not make the probe stronger — it would make it WEAKER. A probe whose arrangement
// is eight governance commands long fails for eight reasons that have nothing to do with the rule under test, and
// each of those failures would present as "RPH-PWU-010 is not enforced". The rule being probed is about what
// happens to an EXECUTION command when the unit of work is closed; the route by which it closed is not part of it.
//
// SO THE SPLIT IS DELIBERATE AND NARROW: the ARRANGEMENT is seeded, the REFUSAL is driven. Same discipline as
// `plan-fixtures.ts` (SM-7), for the same stated reason — and unlike that seam's `_LEGACY_ONLY` escapes, the states
// reachable here are ones the machine genuinely admits, so nothing rehearses against an impossible aggregate.
//
// Not in `kit.ts`: that is production. `__tests__/` is excluded from tsconfig.build and does not match vitest's
// `*.test.ts` include, so nothing here ships or runs as a suite.
import { ProfessionalWorkUnitSchema } from '@janumipwb/rph-contracts';
import { getMachine } from '@janumipwb/rph-domain';
import type { StorageAdapter } from '@janumipwb/rph-ports';

let seq = 0;

/**
 * Put `pwuId` into `workLifecycleState`, committing one revision with no events.
 *
 * The state is checked against the RATIFIED machine's own state list and the patched aggregate is re-parsed
 * against `ProfessionalWorkUnitSchema` before it is written — `store.commit` bypasses the handler kit's
 * `validateAgainst`, and a fixture able to write a shape the contract forbids is how `floor-fixtures.ts`'s own
 * defect arose.
 */
export function seedPwuWorkLifecycleState_FIXTURE(
	store: StorageAdapter,
	pwuId: string,
	workLifecycleState: string
): void {
	const states = getMachine('PWU.workLifecycleState').states;
	if (!states.includes(workLifecycleState))
		throw new Error(
			`seedPwuWorkLifecycleState_FIXTURE: '${workLifecycleState}' is not a state of PWU.workLifecycleState — ` +
				`seeding it would rehearse against an aggregate the machine cannot represent.`
		);

	const stored = store.loadObject(pwuId);
	if (!stored)
		throw new Error(`seedPwuWorkLifecycleState_FIXTURE: no stored object for PWU ${pwuId}`);
	const nextState = ProfessionalWorkUnitSchema.parse({
		...ProfessionalWorkUnitSchema.parse(stored.state),
		workLifecycleState
	});

	seq += 1;
	const result = store.commit({
		aggregateType: 'PROFESSIONAL_WORK_UNIT',
		aggregateId: pwuId,
		objectType: 'PROFESSIONAL_WORK_UNIT',
		expectedRevision: stored.revision,
		newRevision: stored.revision + 1,
		newSemanticVersion: stored.semanticVersion,
		currentState: nextState,
		events: [],
		receipt: {
			commandId: `fixture-seedPwuLifecycle-${seq}`,
			idempotencyKey: `fixture-seedPwuLifecycle-${seq}`,
			commandType: 'FixtureSeedPwuLifecycle',
			targetAggregateId: pwuId,
			status: 'ACCEPTED',
			producedEventIds: []
		}
	});
	if (!result.ok)
		throw new Error(
			`seedPwuWorkLifecycleState_FIXTURE: commit refused for ${pwuId} (${result.reason}, actual revision ${String(result.actualRevision)})`
		);
}
