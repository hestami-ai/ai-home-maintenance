// driveReferenceUndertaking — the Field Service Management SaaS Reference Undertaking (RPH-DOC-006 / RPH-DOC-010
// §27) driven LIVE through the command pipeline: it dispatches an intent lifecycle, proposes the Product
// Realization root + its Intent/Behavior/Architecture children + the architecture concerns, records the
// decomposition contracts, and advances each PWU's four axes with the controller lever (ChangePwuState) to its
// terminal condition. This REPLACES the hand-authored terminal graph — the resulting Professional Work Graph is a
// projection of real events produced by real handlers, so it demonstrably upholds INV-5 (no green without
// assurance): the Mobile & Offline concern ends CONDITIONALLY_SATISFIED (not qualified-green) with an open
// residual, while the assured concerns end SATISFIED and the Architecture PWU is BASELINED.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { EngineHandle } from './engine.js';

const ACTOR: ActorReference = {
	actorId: 'owner-1',
	actorType: 'HUMAN',
	displayName: 'Undertaking Owner'
};

/** Stable ids for the Reference Undertaking objects (valid Crockford-base32 ULIDs). */
export const REFERENCE_UNDERTAKING = {
	intentId: 'int_01ARZ3NDEKTSV4RRFFQ69G5AAA',
	root: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A00',
	intentDef: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A10',
	behavior: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A20',
	architecture: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A30',
	systemContext: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A40',
	multiTenancy: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A50',
	dataArch: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A60',
	integrations: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A70',
	mobileOffline: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A80',
	// The downstream work areas (§7) — NOT STARTED in the reference terminal state (§27).
	planning: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A90',
	implementation: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5AB0',
	validation: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5AC0',
	promotion: 'pwu_01ARZ3NDEKTSV4RRFFQ69G5AD0'
} as const;

export const REFERENCE_OPEN_RESIDUALS = [
	'Offline behavior deferred from the first implementation increment'
] as const;

const LABELS: Record<string, { title: string; kind: string }> = {
	[REFERENCE_UNDERTAKING.root]: { title: 'Product Realization', kind: 'PRODUCT_REALIZATION' },
	[REFERENCE_UNDERTAKING.intentDef]: {
		title: 'Intent & Product Definition',
		kind: 'INTENT_DEFINITION'
	},
	[REFERENCE_UNDERTAKING.behavior]: {
		title: 'Product Behavior Definition',
		kind: 'PRODUCT_BEHAVIOR'
	},
	[REFERENCE_UNDERTAKING.architecture]: { title: 'Architecture Definition', kind: 'ARCHITECTURE' },
	[REFERENCE_UNDERTAKING.systemContext]: { title: 'System Context', kind: 'ARCHITECTURE_CONCERN' },
	[REFERENCE_UNDERTAKING.multiTenancy]: {
		title: 'Multi-Tenancy Architecture',
		kind: 'ARCHITECTURE_CONCERN'
	},
	[REFERENCE_UNDERTAKING.dataArch]: { title: 'Data Architecture', kind: 'ARCHITECTURE_CONCERN' },
	[REFERENCE_UNDERTAKING.integrations]: {
		title: 'Integration Architecture',
		kind: 'ARCHITECTURE_CONCERN'
	},
	[REFERENCE_UNDERTAKING.mobileOffline]: {
		title: 'Mobile & Offline Architecture',
		kind: 'ARCHITECTURE_CONCERN'
	},
	[REFERENCE_UNDERTAKING.planning]: {
		title: 'Implementation Planning',
		kind: 'IMPLEMENTATION_PLANNING'
	},
	[REFERENCE_UNDERTAKING.implementation]: {
		title: 'Product Implementation',
		kind: 'PRODUCT_IMPLEMENTATION'
	},
	[REFERENCE_UNDERTAKING.validation]: {
		title: 'Integrated Product Validation',
		kind: 'INTEGRATED_VALIDATION'
	},
	[REFERENCE_UNDERTAKING.promotion]: {
		title: 'Product Baseline Promotion',
		kind: 'BASELINE_PROMOTION'
	}
};

/** Drive the Reference Undertaking end to end via live commands. Throws if any command is rejected (fail-loud).
 * Pass `undertakingId` to stamp each proposed PWU with its owning Undertaking (CON-009 ownership binding). */
export function driveReferenceUndertaking(
	handle: EngineHandle,
	opts: {
		readonly undertakingId?: string;
		readonly pwuTypeByKind?: Readonly<Record<string, string>>;
	} = {}
): void {
	let n = 0;
	const send = (
		commandType: string,
		targetAggregateType: string,
		targetAggregateId: string,
		payload: unknown
	) => {
		n += 1;
		const command: DomainCommand = {
			commandId: `ru-cmd-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType,
			targetAggregateId,
			issuedAt: '2026-07-12T00:00:00Z',
			issuedBy: ACTOR,
			correlationId: 'reference-undertaking',
			idempotencyKey: `ru-idem-${n}`,
			payload
		};
		const result = handle.dispatch(command);
		if (result.status !== 'ACCEPTED' && result.status !== 'DUPLICATE') {
			throw new Error(
				`Reference Undertaking drive failed at #${n} ${commandType} (${targetAggregateId}): ${result.status} ${JSON.stringify(result.error)}`
			);
		}
	};

	const R = REFERENCE_UNDERTAKING;

	// --- Intent lifecycle: RAW -> ... -> APPROVED ---
	send('CaptureIntent', 'INTENT', R.intentId, {
		intentId: R.intentId,
		originatingExpression: 'Enable trades businesses to manage work from request through invoice',
		ontologyId: 'product-realization-pwa',
		ontologyVersion: '1.3.0'
	});
	send('BeginIntentDiscovery', 'INTENT', R.intentId, {});
	send('ProvisionIntent', 'INTENT', R.intentId, { ambiguityIds: [] });
	send('FormalizeIntent', 'INTENT', R.intentId, {
		formalizedObjective: 'A multi-tenant field service management SaaS for trades businesses',
		desiredOutcomes: [{ description: 'Dispatch a job to a technician' }],
		successConditions: [{ statement: 'A customer request becomes an invoiced job' }],
		nonGoals: ['payroll'],
		ambiguityIds: [],
		constraintIds: [],
		stakeholderIds: []
	});
	send('ApproveIntent', 'INTENT', R.intentId, {
		decisionId: 'dec_intent',
		approvedSemanticVersion: 1,
		approvalScope: 'full'
	});

	// --- Propose the Professional Work Graph nodes ---
	const propose = (pwuId: string, parentWorkUnitId?: string): void => {
		const meta = LABELS[pwuId] ?? { title: pwuId, kind: 'PWU' };
		send('ProposePwu', 'PROFESSIONAL_WORK_UNIT', pwuId, {
			pwuId,
			pwuKind: meta.kind,
			title: meta.title,
			description: meta.title,
			intentId: R.intentId,
			...(parentWorkUnitId ? { parentWorkUnitId } : {}),
			...(opts.undertakingId ? { undertakingId: opts.undertakingId, isLocalExtension: false } : {}),
			...(opts.pwuTypeByKind?.[meta.kind] ? { pwuTypeId: opts.pwuTypeByKind[meta.kind] } : {}),
			boundaries: { inScope: [], outOfScope: [], permittedChanges: [], prohibitedChanges: [] },
			obligationIds: [],
			constraintIds: [],
			assumptionIds: [],
			expectedOutputs: [],
			assurancePolicyIds: [],
			riskProfile: {
				consequence: 'HIGH',
				uncertainty: 'MEDIUM',
				irreversibility: 'MEDIUM',
				securitySensitivity: 'HIGH',
				regulatoryExposure: 'MEDIUM'
			}
		});
	};

	propose(R.root);
	propose(R.intentDef, R.root);
	propose(R.behavior, R.root);
	propose(R.architecture, R.root);
	for (const concern of [
		R.systemContext,
		R.multiTenancy,
		R.dataArch,
		R.integrations,
		R.mobileOffline
	]) {
		propose(concern, R.architecture);
	}
	// The downstream work areas — proposed but NOT STARTED in the reference terminal state (§27).
	propose(R.planning, R.root);
	propose(R.implementation, R.root);
	propose(R.validation, R.root);
	propose(R.promotion, R.root);

	// --- Decomposition contracts (root -> areas, architecture -> concerns) ---
	const decompose = (dcpId: string, parentWorkUnitId: string, childWorkUnitIds: string[]): void => {
		send('ProposeDecomposition', 'DECOMPOSITION_CONTRACT', dcpId, {
			parentWorkUnitId,
			childWorkUnitIds,
			rationale: 'Product Realization decomposition'
		});
		send('ValidateDecomposition', 'DECOMPOSITION_CONTRACT', dcpId, { disposition: 'VALID' });
	};
	decompose('dcp_01ARZ3NDEKTSV4RRFFQ69G5B00', R.root, [
		R.intentDef,
		R.behavior,
		R.architecture,
		R.planning,
		R.implementation,
		R.validation,
		R.promotion
	]);
	decompose('dcp_01ARZ3NDEKTSV4RRFFQ69G5B10', R.architecture, [
		R.systemContext,
		R.multiTenancy,
		R.dataArch,
		R.integrations,
		R.mobileOffline
	]);

	// One Execution Plan for the Architecture PWU. An Execution Plan is a DISTINCT object that PERFORMS a PWU
	// Instance through temporal steps — it is NOT the Professional Work Graph (§35.3 / criterion 16).
	const archPlan = 'plan_01ARZ3NDEKTSV4RRFFQ69G5C00';
	send('ProposeExecutionPlan', 'EXECUTION_PLAN', archPlan, {
		executionPlanId: archPlan,
		workUnitId: R.architecture,
		steps: [
			{
				id: 'step_01ARZ3NDEKTSV4RRFFQ69G5C10',
				executionPlanId: archPlan,
				stepType: 'MODEL_INVOCATION',
				purpose: 'Generate the architecture description',
				inputBindings: [],
				outputBindings: [],
				preconditions: [],
				postconditions: [],
				stepState: 'QUEUED'
			}
		],
		transitions: [],
		retryPolicy: {},
		tacticalChangePolicy: {},
		escalationPolicy: {},
		terminationPolicy: {}
	});
	send('ApproveExecutionPlan', 'EXECUTION_PLAN', archPlan, {});
	send('ActivateExecutionPlan', 'EXECUTION_PLAN', archPlan, { authorizedRuntimeBindingIds: [] });

	// --- Advance each PWU's four axes via the controller lever (ChangePwuState) ---
	const chg = (
		pwuId: string,
		previousState: string,
		newState: string,
		executionState: string,
		assuranceState: string,
		shapeIntegrityState: string
	): void =>
		send('ChangePwuState', 'PROFESSIONAL_WORK_UNIT', pwuId, {
			previousState,
			newState,
			executionState,
			assuranceState,
			shapeIntegrityState,
			reasonCode: 'CONTROLLER',
			supportingObjectIds: []
		});

	const shapeToExecutedSuccess = (pwuId: string): void => {
		send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', pwuId, {});
		send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', pwuId, {
			shapeReadinessAssessmentId: 'assess_shape',
			expectedSemanticVersion: 1
		});
		chg(pwuId, 'READY', 'PLANNED', 'PLANNED', 'UNASSESSED', 'PRESERVED');
		chg(pwuId, 'PLANNED', 'EXECUTING', 'QUEUED', 'UNASSESSED', 'PRESERVED');
		chg(pwuId, 'EXECUTING', 'EXECUTING', 'RUNNING', 'UNASSESSED', 'PRESERVED');
		chg(pwuId, 'EXECUTING', 'EXECUTING', 'SUCCEEDED', 'UNASSESSED', 'PRESERVED');
	};

	const toUnderAssurance = (pwuId: string): void => {
		chg(pwuId, 'EXECUTING', 'EVIDENCE_PENDING', 'SUCCEEDED', 'EVIDENCE_REQUIRED', 'PRESERVED');
		chg(
			pwuId,
			'EVIDENCE_PENDING',
			'UNDER_ASSURANCE',
			'SUCCEEDED',
			'READY_FOR_ASSESSMENT',
			'PRESERVED'
		);
		chg(pwuId, 'UNDER_ASSURANCE', 'UNDER_ASSURANCE', 'SUCCEEDED', 'ASSESSING', 'PRESERVED');
	};

	const driveToSatisfied = (pwuId: string): void => {
		shapeToExecutedSuccess(pwuId);
		toUnderAssurance(pwuId);
		chg(pwuId, 'UNDER_ASSURANCE', 'SATISFIED', 'SUCCEEDED', 'SATISFIED', 'PRESERVED');
	};

	const driveToConditional = (pwuId: string): void => {
		shapeToExecutedSuccess(pwuId);
		toUnderAssurance(pwuId);
		chg(
			pwuId,
			'UNDER_ASSURANCE',
			'CONDITIONALLY_SATISFIED',
			'SUCCEEDED',
			'CONDITIONALLY_SATISFIED',
			'AT_RISK'
		);
	};

	// Root stays in progress (EXECUTING) while its children complete.
	send('BeginPwuShaping', 'PROFESSIONAL_WORK_UNIT', R.root, {});
	send('MarkPwuReady', 'PROFESSIONAL_WORK_UNIT', R.root, {
		shapeReadinessAssessmentId: 'assess_shape',
		expectedSemanticVersion: 1
	});
	chg(R.root, 'READY', 'PLANNED', 'PLANNED', 'UNASSESSED', 'PRESERVED');
	chg(R.root, 'PLANNED', 'EXECUTING', 'QUEUED', 'UNASSESSED', 'PRESERVED');

	driveToSatisfied(R.intentDef);
	driveToSatisfied(R.behavior);

	// Architecture: satisfied, then BASELINED (an authoritative Architecture Baseline).
	driveToSatisfied(R.architecture);
	chg(R.architecture, 'SATISFIED', 'BASELINED', 'SUCCEEDED', 'SATISFIED', 'PRESERVED');

	// Architecture concerns: all satisfied except Mobile & Offline, which is only CONDITIONALLY satisfied
	// (the offline residual is deferred) — so it is NOT qualified-green (INV-5 made visible).
	driveToSatisfied(R.systemContext);
	driveToSatisfied(R.multiTenancy);
	driveToSatisfied(R.dataArch);
	driveToSatisfied(R.integrations);
	driveToConditional(R.mobileOffline);
}
