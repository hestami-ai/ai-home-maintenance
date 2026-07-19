// RecursiveProfessionalHarness handler — JAN-IRP capability C7 (RPH Coordination and Adaptive Tactics), first
// increment. Before this, the RPH was realized only CONCEPTUALLY (a program coordinating PWUs via decomposition +
// execution plans) with no durable identity or state — so C7's headline proof obligation, "the RPH survives
// restart while waiting," was unprovable. ProposeHarness mints the DURABLE first-class harness object
// (identity/objective/scope/authority/state + coordinated PWUs + child harnesses) in FRAMING. Because every
// object persists through the same durable event-sourced store (rph-persistence), a minted harness survives a
// store close/reopen by construction (proven in the increment's restart test). The coordination transitions
// (allocation, durable waiting, tactic change, escalation, synthesis) are follow-on increments over the
// Harness.status machine authored in rph-domain/transitions.data.ts.
import type { ProposeHarnessPayload } from '@janumipwb/rph-contracts';
import { createObject, newEnvelope, type CommandHandler } from './kit.js';

const HARNESS = 'RECURSIVE_PROFESSIONAL_HARNESS';

/** ProposeHarness — mint a durable RecursiveProfessionalHarness in FRAMING (the harness id is the command's
 *  target aggregate id). Coordinated PWUs / child harnesses default to empty at framing. */
export const proposeHarness: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposeHarnessPayload;
	const id = command.targetAggregateId;
	const coordinatedPwuIds = p.coordinatedPwuIds ?? [];
	const childHarnessIds = p.childHarnessIds ?? [];
	const state: Record<string, unknown> = {
		...newEnvelope(command, HARNESS, id, {
			lifecycleStatus: 'FRAMING',
			sourceObjectIds: [...coordinatedPwuIds, ...childHarnessIds]
		}),
		objective: p.objective,
		scopeStatement: p.scopeStatement,
		authority: p.authority,
		coordinatedPwuIds,
		childHarnessIds,
		status: 'FRAMING'
	};
	return createObject(ctx, command, {
		objectType: HARNESS,
		aggregateId: id,
		state,
		eventType: 'HarnessProposed',
		eventPayload: {
			harnessId: id,
			objective: p.objective,
			scopeStatement: p.scopeStatement,
			authority: p.authority,
			coordinatedPwuIds,
			childHarnessIds,
			status: 'FRAMING'
		}
	});
};
