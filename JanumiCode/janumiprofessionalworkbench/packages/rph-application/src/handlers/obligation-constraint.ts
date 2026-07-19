// Obligation / Constraint object-mint handlers — the first-class object plane master WP-1-005/006 mandate
// ("material obligations SHALL become first-class traceable objects"). Before this increment OBLIGATION and
// CONSTRAINT were declared object types (DOC-002 §10.1 / §11.1, generated ObligationObjectSchema /
// ConstraintObjectSchema) with NO minting command, so obligation conservation (Property P2 / RPH-DEC-002/007)
// and constraint propagation (Property P3 / RPH-CNS-001..004) could only ever decide over an empty runtime
// plane — a vacuous gate. These two handlers instantiate the plane: they create first-class objects carrying
// `strength`, which a PWU references (obligationIds / constraintIds) and ValidateDecomposition then loads to
// enforce §35.1 "no obligation disappears" / "no constraint silently drops" non-vacuously (see decomposition.ts).
//
// Both follow the DetectAssumption / AssertClaim mint pattern (assurance.ts): the object id is the command's
// target aggregate id, the object is created in the status machine's initial state (PROPOSED for both
// Obligation.status and Constraint.status), and the emitted event records the resulting object shape.
import type { AssertConstraintPayload, AssertObligationPayload } from '@janumipwb/rph-contracts';
import { createObject, newEnvelope, type CommandHandler } from './kit.js';

const OBLIGATION = 'OBLIGATION';
const CONSTRAINT = 'CONSTRAINT';

/** AssertObligation — create a first-class Obligation in PROPOSED (the obligation id is the command's target
 *  aggregate id). `sourceObjectId` is both an ObligationObject field (§10.1) and the provenance source link. */
export const assertObligation: CommandHandler = (ctx, command, payload) => {
	const p = payload as AssertObligationPayload;
	const id = command.targetAggregateId;
	const state: Record<string, unknown> = {
		...newEnvelope(command, OBLIGATION, id, {
			lifecycleStatus: 'PROPOSED',
			sourceObjectIds: [p.sourceObjectId]
		}),
		statement: p.statement,
		obligationType: p.obligationType,
		sourceObjectId: p.sourceObjectId,
		authority: p.authority,
		strength: p.strength,
		status: 'PROPOSED'
	};
	return createObject(ctx, command, {
		objectType: OBLIGATION,
		aggregateId: id,
		state,
		eventType: 'ObligationAsserted',
		eventPayload: {
			obligationId: id,
			statement: p.statement,
			obligationType: p.obligationType,
			sourceObjectId: p.sourceObjectId,
			authority: p.authority,
			strength: p.strength,
			status: 'PROPOSED'
		}
	});
};

/** AssertConstraint — create a first-class Constraint in PROPOSED. Unlike the Obligation object, the
 *  ConstraintObject (§11.1) has NO sourceObjectId field, so the command's `sourceObjectId` is recorded on
 *  provenance ONLY (putting it in the object state would fail the strictObject schema). */
export const assertConstraint: CommandHandler = (ctx, command, payload) => {
	const p = payload as AssertConstraintPayload;
	const id = command.targetAggregateId;
	const state: Record<string, unknown> = {
		...newEnvelope(command, CONSTRAINT, id, {
			lifecycleStatus: 'PROPOSED',
			sourceObjectIds: [p.sourceObjectId]
		}),
		statement: p.statement,
		constraintType: p.constraintType,
		authority: p.authority,
		applicability: p.applicability,
		strength: p.strength,
		status: 'PROPOSED'
	};
	return createObject(ctx, command, {
		objectType: CONSTRAINT,
		aggregateId: id,
		state,
		eventType: 'ConstraintAsserted',
		eventPayload: {
			constraintId: id,
			statement: p.statement,
			constraintType: p.constraintType,
			authority: p.authority,
			applicability: p.applicability,
			strength: p.strength,
			status: 'PROPOSED'
		}
	});
};
