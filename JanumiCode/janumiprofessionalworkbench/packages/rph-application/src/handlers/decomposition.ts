// Decomposition / Recomposition handlers. ProposeDecomposition creates a DecompositionContract already submitted
// for review (UNDER_REVIEW; the DRAFT→UNDER_REVIEW hop has no command — see OPEN-QUESTIONS). ValidateDecomposition
// carries the validator's disposition (VALID | CONDITIONALLY_VALID | INVALID) to the matching terminal state; the
// deeper obligation-conservation / constraint-propagation checks (P2/P3) live in @janumipwb/rph-domain and are a
// further wiring increment. Recomposition begin/complete advance the RecompositionContract.status machine.
import type {
	ProposeDecompositionPayload,
	ValidateDecompositionPayload
} from '@janumipwb/rph-contracts';
import { advanceStatus, createObject, newEnvelope, reject, type CommandHandler } from './kit.js';

const DECOMP = 'DECOMPOSITION_CONTRACT';
const RECOMP = 'RECOMPOSITION_CONTRACT';

/** ProposeDecomposition — create a DecompositionContract (submitted for review, UNDER_REVIEW). */
export const proposeDecomposition: CommandHandler = (ctx, command, payload) => {
	const p = payload as ProposeDecompositionPayload;
	const id = command.targetAggregateId;
	if (!ctx.store.loadObject(p.parentWorkUnitId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ProposeDecomposition requires an existing parent work unit ${p.parentWorkUnitId}`,
			[id]
		);
	}
	const state: Record<string, unknown> = {
		...newEnvelope(command, DECOMP, id, {
			lifecycleStatus: 'UNDER_REVIEW',
			sourceObjectIds: [p.parentWorkUnitId, ...p.childWorkUnitIds]
		}),
		parentWorkUnitId: p.parentWorkUnitId,
		childWorkUnitIds: p.childWorkUnitIds,
		rationale: p.rationale,
		intentMappings: p.intentMappings ?? [],
		obligationAllocations: p.obligationAllocations ?? [],
		constraintPropagations: p.constraintPropagations ?? [],
		assumptionPropagations: p.assumptionPropagations ?? [],
		retainedParentObligationIds: p.retainedParentObligationIds ?? [],
		coverageClaims: p.coverageClaims ?? [],
		siblingDependencyIds: p.siblingDependencyIds ?? [],
		recompositionContractId: p.recompositionContractId ?? '',
		status: 'UNDER_REVIEW'
	};
	return createObject(ctx, command, {
		objectType: DECOMP,
		aggregateId: id,
		state,
		eventType: 'DecompositionProposed'
	});
};

const DECOMP_DISPOSITIONS: Record<string, { target: string; event: string }> = {
	VALID: { target: 'VALID', event: 'DecompositionValidated' },
	CONDITIONALLY_VALID: { target: 'CONDITIONALLY_VALID', event: 'DecompositionValidated' },
	INVALID: { target: 'INVALID', event: 'DecompositionRejected' }
};

/** ValidateDecomposition — UNDER_REVIEW -> VALID|CONDITIONALLY_VALID|INVALID per the validator disposition. */
export const validateDecomposition: CommandHandler = (ctx, command, payload) => {
	const p = payload as ValidateDecompositionPayload;
	const mapping = DECOMP_DISPOSITIONS[p.disposition];
	if (!mapping) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`ValidateDecomposition disposition must be VALID|CONDITIONALLY_VALID|INVALID (got ${p.disposition})`
		);
	}
	return advanceStatus(ctx, command, {
		objectType: DECOMP,
		statusField: 'status',
		machine: 'DecompositionContract.status',
		target: mapping.target,
		eventType: mapping.event
	});
};

/** ReviseDecomposition — supersede the prior contract (a revision creates a successor, DOC-002 §13.2). */
export const reviseDecomposition: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: DECOMP,
		statusField: 'status',
		machine: 'DecompositionContract.status',
		target: 'SUPERSEDED',
		eventType: 'DecompositionRevised',
		bumpSemanticVersion: true
	});

/** BeginRecomposition — RecompositionContract.status READY -> EVALUATING. */
export const beginRecomposition: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: RECOMP,
		statusField: 'status',
		machine: 'RecompositionContract.status',
		target: 'EVALUATING',
		eventType: 'RecompositionStarted'
	});

/** CompleteRecomposition — RecompositionContract.status EVALUATING -> COMPOSABLE (then SATISFIED on assessment). */
export const completeRecomposition: CommandHandler = (ctx, command) =>
	advanceStatus(ctx, command, {
		objectType: RECOMP,
		statusField: 'status',
		machine: 'RecompositionContract.status',
		target: 'COMPOSABLE',
		eventType: 'RecompositionCompleted'
	});
