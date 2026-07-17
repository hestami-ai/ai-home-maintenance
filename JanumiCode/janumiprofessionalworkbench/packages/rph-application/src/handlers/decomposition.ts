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
		eventType: 'DecompositionProposed',
		// The event records the RESULTING state. DecompositionProposed declares the decomposition + the created
		// `status` (UNDER_REVIEW); the raw command payload omits `status` (a required field). Emit the declared
		// shape — the required decomposition fields + status, plus any optional propagation fields the command
		// actually supplied (absent = not specified, never a fabricated empty). (Pinned defect; now conforms.)
		eventPayload: {
			parentWorkUnitId: p.parentWorkUnitId,
			childWorkUnitIds: p.childWorkUnitIds,
			rationale: p.rationale,
			status: 'UNDER_REVIEW',
			...(p.intentMappings?.length ? { intentMappings: p.intentMappings } : {}),
			...(p.obligationAllocations?.length
				? { obligationAllocations: p.obligationAllocations }
				: {}),
			...(p.constraintPropagations?.length
				? { constraintPropagations: p.constraintPropagations }
				: {}),
			...(p.assumptionPropagations?.length
				? { assumptionPropagations: p.assumptionPropagations }
				: {}),
			...(p.retainedParentObligationIds?.length
				? { retainedParentObligationIds: p.retainedParentObligationIds }
				: {}),
			...(p.coverageClaims?.length ? { coverageClaims: p.coverageClaims } : {}),
			...(p.siblingDependencyIds?.length ? { siblingDependencyIds: p.siblingDependencyIds } : {}),
			...(p.recompositionContractId ? { recompositionContractId: p.recompositionContractId } : {})
		}
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
		eventType: mapping.event,
		// The event records the RESULTING status. DecompositionValidated declares `status` (the VALID /
		// CONDITIONALLY_VALID it transitioned to), which `command.payload` carries as `disposition` (a field the
		// event does not declare — a strict schema rejects it) while omitting `status` entirely. Emit the declared
		// shape: the target status, plus the optional validatorRole when the command supplied it. (`observationIds`
		// is on the command but not this event's declared shape — a contract-drift note for the §32 pass, not fixed
		// here; folding it in would put an undeclared key on the governed stream.)
		eventPayload: () => ({
			status: mapping.target,
			...(p.validatorRole ? { validatorRole: p.validatorRole } : {})
		})
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
