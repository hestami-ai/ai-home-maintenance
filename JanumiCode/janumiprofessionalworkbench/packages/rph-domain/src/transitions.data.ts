// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:transitions`.
// Source: vocab/m2-transitions.json (grounded from DOC-002 + DOC-004, reconciled). See gen/gen-transitions.ts.

export interface TransitionSpec {
	readonly from: string;
	readonly to: string;
	readonly trigger?: string;
	readonly guard?: string;
}
export interface IllegalSpec {
	readonly from: string;
	readonly to: string;
	readonly reason?: string;
}
export interface StateMachineSpec {
	readonly name: string;
	readonly states: readonly string[];
	readonly initialState: string | undefined;
	readonly terminalStates: readonly string[];
	readonly transitions: readonly TransitionSpec[];
	readonly illegal: readonly IllegalSpec[];
	/** Legal edges carrying a guard condition; the guard is enforced by the owning subsystem (e.g. M7 assurance). */
	readonly guarded: readonly IllegalSpec[];
}

/** A cross-axis rule the generic same-axis engine cannot represent (e.g. property P1 / INV-5). */
export interface CrossAxisRule {
	readonly machine: string;
	readonly from: string;
	readonly to: string;
	readonly reason?: string;
}

export const STATE_MACHINES: Record<string, StateMachineSpec> = {
	'Intent.intentStatus': {
		name: 'Intent.intentStatus',
		states: [
			'RAW',
			'UNDER_DISCOVERY',
			'PROVISIONAL',
			'FORMALIZED',
			'APPROVED',
			'REVISED',
			'SUPERSEDED',
			'WITHDRAWN'
		],
		initialState: 'RAW',
		terminalStates: ['SUPERSEDED', 'WITHDRAWN'],
		transitions: [
			{
				from: 'RAW',
				to: 'UNDER_DISCOVERY',
				trigger: 'Begin discovery',
				guard: 'Originating expression exists'
			},
			{
				from: 'UNDER_DISCOVERY',
				to: 'PROVISIONAL',
				trigger: 'Create provisional intent',
				guard: 'Objective and known ambiguities recorded'
			},
			{
				from: 'PROVISIONAL',
				to: 'FORMALIZED',
				trigger: 'Formalize',
				guard: 'Outcomes, non-goals, and constraints defined'
			},
			{
				from: 'FORMALIZED',
				to: 'APPROVED',
				trigger: 'Approve',
				guard: 'Authorized decision exists'
			},
			{
				from: 'APPROVED',
				to: 'REVISED',
				trigger: 'Revise',
				guard: 'Change rationale and impact analysis initiated'
			},
			{
				from: 'REVISED',
				to: 'APPROVED',
				trigger: 'Approve revision',
				guard: 'Revised intent receives authorization'
			},
			{
				from: 'RAW',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified'
			},
			{
				from: 'UNDER_DISCOVERY',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified'
			},
			{
				from: 'PROVISIONAL',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified'
			},
			{
				from: 'FORMALIZED',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified'
			},
			{
				from: 'APPROVED',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified'
			},
			{
				from: 'REVISED',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified'
			},
			{ from: 'RAW', to: 'WITHDRAWN', trigger: 'Withdraw', guard: 'Authorized actor' },
			{ from: 'UNDER_DISCOVERY', to: 'WITHDRAWN', trigger: 'Withdraw', guard: 'Authorized actor' },
			{ from: 'PROVISIONAL', to: 'WITHDRAWN', trigger: 'Withdraw', guard: 'Authorized actor' }
		],
		illegal: [],
		guarded: []
	},
	'PWU.workLifecycleState': {
		name: 'PWU.workLifecycleState',
		states: [
			'PROPOSED',
			'SHAPING',
			'READY',
			'PLANNED',
			'EXECUTING',
			'EVIDENCE_PENDING',
			'UNDER_ASSURANCE',
			'CONDITIONALLY_SATISFIED',
			'SATISFIED',
			'RECOMPOSING',
			'RECOMPOSED',
			'BASELINED',
			'BLOCKED',
			'CHALLENGED',
			'RESHAPING',
			'ESCALATED',
			'INVALIDATED',
			'REJECTED',
			'ABANDONED',
			'SUPERSEDED'
		],
		initialState: 'PROPOSED',
		terminalStates: ['BASELINED', 'ABANDONED', 'SUPERSEDED'],
		transitions: [
			{
				from: 'PROPOSED',
				to: 'SHAPING',
				trigger: 'Begin shaping (PwuShapingStarted)',
				guard: 'Intent exists'
			},
			{
				from: 'SHAPING',
				to: 'READY',
				trigger: 'Mark ready (markPwuReady; PwuMarkedReady)',
				guard: 'Shape readiness policy satisfied (§9 Shape Readiness Profile)'
			},
			{
				from: 'READY',
				to: 'PLANNED',
				trigger: 'Approve plan',
				guard: 'Active execution plan approved'
			},
			{
				from: 'PLANNED',
				to: 'EXECUTING',
				trigger: 'Start execution',
				guard: 'Runtime bindings authorized'
			},
			{
				from: 'EXECUTING',
				to: 'EVIDENCE_PENDING',
				trigger: 'Record execution success',
				guard:
					'CROSS-AXIS guard: executionState=SUCCEEDED. Success does NOT auto-satisfy assurance (P1/INV-5).'
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'UNDER_ASSURANCE',
				trigger: 'Begin assurance',
				guard: 'Required evidence available or deficit explicitly recorded'
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'CONDITIONALLY_SATISFIED',
				trigger: 'Conditionally satisfy',
				guard: 'Conditional disposition exists'
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'SATISFIED',
				trigger: 'Satisfy',
				guard:
					'CROSS-AXIS guard: assuranceState=SATISFIED. This is the ONLY legal path into workLifecycle SATISFIED (P1/INV-5).'
			},
			{
				from: 'SATISFIED',
				to: 'RECOMPOSING',
				trigger: 'Begin recomposition (beginRecomposition; RecompositionStarted)',
				guard: 'Parent exists and recomposition is required'
			},
			{
				from: 'RECOMPOSING',
				to: 'RECOMPOSED',
				trigger: 'Complete recomposition (completeRecomposition; RecompositionCompleted)',
				guard: 'Recomposition contract satisfied'
			},
			{
				from: 'SATISFIED',
				to: 'BASELINED',
				trigger: 'Promote baseline (promoteBaseline; BaselinePromoted)',
				guard: 'Authorized promotion decision'
			},
			{
				from: 'RECOMPOSED',
				to: 'BASELINED',
				trigger: 'Promote baseline (promoteBaseline; BaselinePromoted)',
				guard: 'Authorized promotion decision'
			},
			{ from: 'SHAPING', to: 'BLOCKED', trigger: 'Missing information' },
			{ from: 'READY', to: 'CHALLENGED', trigger: 'Shape challenge (challengePwu; PwuChallenged)' },
			{ from: 'PLANNED', to: 'BLOCKED', trigger: 'Runtime dependency unavailable' },
			{ from: 'EXECUTING', to: 'BLOCKED', trigger: 'Runtime dependency unavailable' },
			{
				from: 'EXECUTING',
				to: 'RESHAPING',
				trigger: 'Material assumption falsified (reshapePwu; PwuReshapingStarted)'
			},
			{ from: 'EVIDENCE_PENDING', to: 'ESCALATED', trigger: 'Evidence impossible to obtain' },
			{ from: 'UNDER_ASSURANCE', to: 'REJECTED', trigger: 'Blocking finding' },
			{ from: 'UNDER_ASSURANCE', to: 'RESHAPING', trigger: 'Blocking finding' },
			{ from: 'CONDITIONALLY_SATISFIED', to: 'INVALIDATED', trigger: 'Condition violated' },
			{
				from: 'SATISFIED',
				to: 'INVALIDATED',
				trigger: 'Upstream change (invalidatePwu; PwuInvalidated — §29 triggers)'
			},
			{ from: 'RECOMPOSED', to: 'INVALIDATED', trigger: 'Sibling conflict discovered' },
			{
				from: 'PROPOSED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'SHAPING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'READY',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'PLANNED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'EXECUTING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'SATISFIED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'RECOMPOSING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'RECOMPOSED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'BLOCKED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'CHALLENGED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'RESHAPING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'ESCALATED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'INVALIDATED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'REJECTED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)'
			},
			{
				from: 'PROPOSED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'SHAPING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'READY',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'PLANNED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'EXECUTING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'SATISFIED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'RECOMPOSING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'RECOMPOSED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'BLOCKED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'CHALLENGED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'RESHAPING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'ESCALATED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'INVALIDATED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			},
			{
				from: 'REJECTED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED'
			}
		],
		illegal: [
			{
				from: 'PROPOSED',
				to: 'EXECUTING',
				reason: '§8.3 — must be rejected; skips SHAPING→READY→PLANNED gating.'
			},
			{ from: 'SHAPING', to: 'SATISFIED', reason: '§8.3 — must be rejected.' },
			{ from: 'READY', to: 'BASELINED', reason: '§8.3 — must be rejected.' },
			{
				from: 'EXECUTING',
				to: 'SATISFIED',
				reason:
					"§8.3 'EXECUTING → SATISFIED without assurance' — encodes P1/INV-5 (§35.1 'No execution implies assurance'). Execution success alone can NEVER produce SATISFIED; only UNDER_ASSURANCE→SATISFIED with assuranceState=SATISFIED is legal."
			},
			{ from: 'INVALIDATED', to: 'BASELINED', reason: '§8.3 — must be rejected.' },
			{ from: 'SUPERSEDED', to: 'EXECUTING', reason: '§8.3 — must be rejected.' },
			{ from: 'ABANDONED', to: 'READY', reason: '§8.3 — must be rejected.' },
			{
				from: 'BASELINED',
				to: 'EXECUTING',
				reason:
					"§8.3 — must be rejected 'without creating a new revision or successor PWU'. An authoritative baseline is immutable (§24.2); re-execution requires a new revision/successor."
			}
		],
		guarded: []
	},
	'PWU.executionState': {
		name: 'PWU.executionState',
		states: [
			'NOT_PLANNED',
			'PLANNED',
			'QUEUED',
			'RUNNING',
			'WAITING',
			'RETRYING',
			'SUCCEEDED',
			'FAILED',
			'CANCELLED',
			'SUPERSEDED'
		],
		initialState: 'NOT_PLANNED',
		terminalStates: ['SUCCEEDED', 'FAILED', 'CANCELLED', 'SUPERSEDED'],
		transitions: [
			{ from: 'NOT_PLANNED', to: 'PLANNED', trigger: 'ExecutionPlanApproved / plan approved' },
			{ from: 'PLANNED', to: 'QUEUED', trigger: 'ExecutionPlanActivated / step scheduled' },
			{ from: 'QUEUED', to: 'RUNNING', trigger: 'ExecutionStepStarted' },
			{ from: 'RUNNING', to: 'WAITING', trigger: 'ExecutionStepWaiting' },
			{ from: 'WAITING', to: 'RUNNING', trigger: 'wait resolved' },
			{ from: 'RUNNING', to: 'RETRYING', trigger: 'ExecutionStepRetried / recoverable failure' },
			{ from: 'RETRYING', to: 'RUNNING', trigger: 'retry attempt started' },
			{
				from: 'RUNNING',
				to: 'SUCCEEDED',
				trigger: 'ExecutionStepSucceeded (all steps)',
				guard: 'step outputs recorded or explicit no-output'
			},
			{
				from: 'RUNNING',
				to: 'FAILED',
				trigger: 'ExecutionStepFailed / retry exhaustion / ExecutionTerminated'
			},
			{
				from: 'RETRYING',
				to: 'FAILED',
				trigger: 'ExecutionStepFailed / retry exhaustion / ExecutionTerminated'
			},
			{ from: 'PLANNED', to: 'CANCELLED', trigger: 'cancelExecutionPlan / ExecutionStepCancelled' },
			{ from: 'QUEUED', to: 'CANCELLED', trigger: 'cancelExecutionPlan / ExecutionStepCancelled' },
			{ from: 'RUNNING', to: 'CANCELLED', trigger: 'cancelExecutionPlan / ExecutionStepCancelled' },
			{ from: 'WAITING', to: 'CANCELLED', trigger: 'cancelExecutionPlan / ExecutionStepCancelled' },
			{ from: 'NOT_PLANNED', to: 'SUPERSEDED', trigger: 'ExecutionPlanSuperseded' },
			{ from: 'PLANNED', to: 'SUPERSEDED', trigger: 'ExecutionPlanSuperseded' },
			{ from: 'QUEUED', to: 'SUPERSEDED', trigger: 'ExecutionPlanSuperseded' },
			{ from: 'RUNNING', to: 'SUPERSEDED', trigger: 'ExecutionPlanSuperseded' },
			{ from: 'WAITING', to: 'SUPERSEDED', trigger: 'ExecutionPlanSuperseded' },
			{ from: 'RETRYING', to: 'SUPERSEDED', trigger: 'ExecutionPlanSuperseded' }
		],
		illegal: [],
		guarded: []
	},
	'PWU.assuranceState': {
		name: 'PWU.assuranceState',
		states: [
			'NOT_REQUIRED',
			'UNASSESSED',
			'EVIDENCE_REQUIRED',
			'READY_FOR_ASSESSMENT',
			'ASSESSING',
			'CONDITIONALLY_SATISFIED',
			'SATISFIED',
			'REJECTED',
			'WAIVED',
			'INVALIDATED',
			'ESCALATED'
		],
		initialState: 'NOT_REQUIRED',
		terminalStates: ['NOT_REQUIRED', 'SATISFIED', 'REJECTED', 'WAIVED', 'INVALIDATED'],
		transitions: [
			{ from: 'UNASSESSED', to: 'EVIDENCE_REQUIRED', trigger: 'policy requires evidence' },
			{
				from: 'EVIDENCE_REQUIRED',
				to: 'READY_FOR_ASSESSMENT',
				trigger: 'EvidenceAdmitted / required evidence available'
			},
			{
				from: 'READY_FOR_ASSESSMENT',
				to: 'ASSESSING',
				trigger: 'AssuranceAssessmentStarted',
				guard: 'independence requirements checked before evaluation (§18.1)'
			},
			{
				from: 'ASSESSING',
				to: 'SATISFIED',
				trigger: 'AssuranceAssessmentSatisfied',
				guard:
					'criteria met identified; evidence considered identified (§18.1) — NOT forced by executionState=SUCCEEDED (P1/INV-5)'
			},
			{
				from: 'ASSESSING',
				to: 'CONDITIONALLY_SATISFIED',
				trigger: 'AssuranceAssessmentConditionallySatisfied'
			},
			{
				from: 'ASSESSING',
				to: 'REJECTED',
				trigger: 'AssuranceAssessmentRejected / blocking finding'
			},
			{ from: 'ASSESSING', to: 'ESCALATED', trigger: 'AssuranceAssessmentEscalated' },
			{
				from: 'ASSESSING',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard: 'waiver authority separately defined (§18.1)'
			},
			{
				from: 'EVIDENCE_REQUIRED',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard: 'waiver authority separately defined (§18.1)'
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard: 'waiver authority separately defined (§18.1)'
			},
			{
				from: 'SATISFIED',
				to: 'INVALIDATED',
				trigger: 'EvidenceInvalidated / upstream change (§29.1)'
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'INVALIDATED',
				trigger: 'EvidenceInvalidated / upstream change (§29.1)'
			}
		],
		illegal: [],
		guarded: []
	},
	'PWU.shapeIntegrityState': {
		name: 'PWU.shapeIntegrityState',
		states: [
			'UNKNOWN',
			'PRESERVED',
			'AT_RISK',
			'VIOLATED',
			'RESHAPING_REQUIRED',
			'RESHAPING_IN_PROGRESS',
			'RESTORED'
		],
		initialState: 'UNKNOWN',
		terminalStates: [],
		transitions: [
			{ from: 'UNKNOWN', to: 'PRESERVED', trigger: 'shape validated / shape readiness satisfied' },
			{
				from: 'PRESERVED',
				to: 'AT_RISK',
				trigger: 'material assumption falsified / drift detected (SHAPE_RISK observation)'
			},
			{
				from: 'PRESERVED',
				to: 'VIOLATED',
				trigger: 'shape-integrity violation / obligation loss / constraint erosion'
			},
			{
				from: 'AT_RISK',
				to: 'VIOLATED',
				trigger: 'shape-integrity violation / obligation loss / constraint erosion'
			},
			{ from: 'AT_RISK', to: 'PRESERVED', trigger: 'risk cleared' },
			{ from: 'VIOLATED', to: 'RESHAPING_REQUIRED', trigger: 'controller selects RESHAPE (§37)' },
			{ from: 'RESHAPING_REQUIRED', to: 'RESHAPING_IN_PROGRESS', trigger: 'PwuReshapingStarted' },
			{ from: 'RESHAPING_IN_PROGRESS', to: 'RESTORED', trigger: 'reshape complete' },
			{ from: 'RESTORED', to: 'PRESERVED', trigger: 're-validated' }
		],
		illegal: [],
		guarded: []
	},
	'Obligation.status': {
		name: 'Obligation.status',
		states: ['PROPOSED', 'ACTIVE', 'ALLOCATED', 'SATISFIED', 'WAIVED', 'VIOLATED', 'SUPERSEDED'],
		initialState: 'PROPOSED',
		terminalStates: ['SATISFIED', 'WAIVED', 'VIOLATED', 'SUPERSEDED'],
		transitions: [
			{ from: 'PROPOSED', to: 'ACTIVE', trigger: 'obligation activated/accepted' },
			{
				from: 'ACTIVE',
				to: 'ALLOCATED',
				trigger: 'ObligationAllocated',
				guard:
					'explicit allocation to a child PWU — a child may satisfy a parent obligation only through explicit allocation (§10.2)'
			},
			{
				from: 'ACTIVE',
				to: 'SATISFIED',
				trigger: 'ObligationSatisfied',
				guard: 'requires a supported claim — NOT merely because a related PWU is completed (§10.2)'
			},
			{
				from: 'ALLOCATED',
				to: 'SATISFIED',
				trigger: 'ObligationSatisfied',
				guard: 'requires a supported claim — NOT merely because a related PWU is completed (§10.2)'
			},
			{
				from: 'ACTIVE',
				to: 'WAIVED',
				trigger: 'ObligationWaived',
				guard: 'a waived mandatory obligation requires an authorized waiver (§10.2)'
			},
			{
				from: 'ALLOCATED',
				to: 'WAIVED',
				trigger: 'ObligationWaived',
				guard: 'a waived mandatory obligation requires an authorized waiver (§10.2)'
			},
			{
				from: 'ACTIVE',
				to: 'VIOLATED',
				trigger: 'ObligationViolated',
				guard: 'a violated obligation must affect assurance disposition (§10.2)'
			},
			{
				from: 'ALLOCATED',
				to: 'VIOLATED',
				trigger: 'ObligationViolated',
				guard: 'a violated obligation must affect assurance disposition (§10.2)'
			},
			{ from: 'ACTIVE', to: 'SUPERSEDED', trigger: 'obligation superseded' },
			{ from: 'ALLOCATED', to: 'SUPERSEDED', trigger: 'obligation superseded' }
		],
		illegal: [],
		guarded: [
			{
				from: 'ACTIVE',
				to: 'SATISFIED',
				reason:
					'§10.2: an obligation cannot become SATISFIED solely because a related PWU is completed; satisfaction requires a supported claim (conditional guard on the legal ACTIVE→SATISFIED edge, not an unconditional prohibition).'
			}
		]
	},
	'Constraint.status': {
		name: 'Constraint.status',
		states: [
			'PROPOSED',
			'ACTIVE',
			'WAIVED',
			'INAPPLICABLE',
			'VIOLATED',
			'SUPERSEDED',
			'INVALIDATED'
		],
		initialState: 'PROPOSED',
		terminalStates: ['WAIVED', 'INAPPLICABLE', 'VIOLATED', 'SUPERSEDED', 'INVALIDATED'],
		transitions: [
			{ from: 'PROPOSED', to: 'ACTIVE', trigger: 'ConstraintAdded / activated' },
			{
				from: 'ACTIVE',
				to: 'WAIVED',
				trigger: 'ConstraintWaived',
				guard: 'waived through authority (§11.2)'
			},
			{
				from: 'ACTIVE',
				to: 'INAPPLICABLE',
				trigger: 'ConstraintDeclaredInapplicable',
				guard: 'marked inapplicable with rationale (§11.2)'
			},
			{ from: 'ACTIVE', to: 'VIOLATED', trigger: 'ConstraintViolated' },
			{
				from: 'ACTIVE',
				to: 'SUPERSEDED',
				trigger: 'ConstraintSuperseded',
				guard: 'superseded by a stronger constraint (§11.2)'
			},
			{
				from: 'ACTIVE',
				to: 'INVALIDATED',
				trigger: 'mandatory constraint change / invalidation (§29.1)'
			}
		],
		illegal: [],
		guarded: []
	},
	'Assumption.status': {
		name: 'Assumption.status',
		states: [
			'PROPOSED',
			'DISCLOSED',
			'UNDER_VERIFICATION',
			'ACCEPTED',
			'VERIFIED',
			'FALSIFIED',
			'EXPIRED',
			'SUPERSEDED'
		],
		initialState: 'PROPOSED',
		terminalStates: ['VERIFIED', 'FALSIFIED', 'EXPIRED', 'SUPERSEDED'],
		transitions: [
			{
				from: 'PROPOSED',
				to: 'DISCLOSED',
				trigger: 'AssumptionDisclosed (from AssumptionDetected)',
				guard: 'no material assumption may remain embedded only in model prose (§12.2)'
			},
			{ from: 'DISCLOSED', to: 'UNDER_VERIFICATION', trigger: 'AssumptionVerificationStarted' },
			{
				from: 'DISCLOSED',
				to: 'ACCEPTED',
				trigger: 'AssumptionAccepted',
				guard:
					'a critical assumption must be explicitly accepted by authority before dependent irreversible work; ACCEPTED is NOT equivalent to VERIFIED (§12.2)'
			},
			{
				from: 'UNDER_VERIFICATION',
				to: 'ACCEPTED',
				trigger: 'AssumptionAccepted',
				guard:
					'a critical assumption must be explicitly accepted by authority before dependent irreversible work; ACCEPTED is NOT equivalent to VERIFIED (§12.2)'
			},
			{ from: 'UNDER_VERIFICATION', to: 'VERIFIED', trigger: 'AssumptionVerified' },
			{
				from: 'DISCLOSED',
				to: 'FALSIFIED',
				trigger: 'AssumptionFalsified',
				guard:
					'falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2)'
			},
			{
				from: 'UNDER_VERIFICATION',
				to: 'FALSIFIED',
				trigger: 'AssumptionFalsified',
				guard:
					'falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2)'
			},
			{
				from: 'ACCEPTED',
				to: 'FALSIFIED',
				trigger: 'AssumptionFalsified',
				guard:
					'falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2)'
			},
			{
				from: 'VERIFIED',
				to: 'FALSIFIED',
				trigger: 'AssumptionFalsified',
				guard:
					'falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2)'
			},
			{
				from: 'PROPOSED',
				to: 'EXPIRED',
				trigger: 'AssumptionExpired',
				guard:
					'expirationCondition met; expired assumptions cannot continue authorizing work (§12.2)'
			},
			{
				from: 'DISCLOSED',
				to: 'EXPIRED',
				trigger: 'AssumptionExpired',
				guard:
					'expirationCondition met; expired assumptions cannot continue authorizing work (§12.2)'
			},
			{
				from: 'UNDER_VERIFICATION',
				to: 'EXPIRED',
				trigger: 'AssumptionExpired',
				guard:
					'expirationCondition met; expired assumptions cannot continue authorizing work (§12.2)'
			},
			{
				from: 'ACCEPTED',
				to: 'EXPIRED',
				trigger: 'AssumptionExpired',
				guard:
					'expirationCondition met; expired assumptions cannot continue authorizing work (§12.2)'
			},
			{ from: 'PROPOSED', to: 'SUPERSEDED', trigger: 'assumption superseded' },
			{ from: 'DISCLOSED', to: 'SUPERSEDED', trigger: 'assumption superseded' },
			{ from: 'UNDER_VERIFICATION', to: 'SUPERSEDED', trigger: 'assumption superseded' },
			{ from: 'ACCEPTED', to: 'SUPERSEDED', trigger: 'assumption superseded' }
		],
		illegal: [],
		guarded: []
	},
	'DecompositionContract.status': {
		name: 'DecompositionContract.status',
		states: ['DRAFT', 'UNDER_REVIEW', 'VALID', 'CONDITIONALLY_VALID', 'INVALID', 'SUPERSEDED'],
		initialState: 'DRAFT',
		terminalStates: ['SUPERSEDED'],
		transitions: [
			{
				from: 'DRAFT',
				to: 'UNDER_REVIEW',
				trigger: 'proposeDecomposition / DecompositionProposed'
			},
			{
				from: 'UNDER_REVIEW',
				to: 'VALID',
				trigger: 'validateDecomposition / DecompositionValidated',
				guard:
					'obligations allocated/retained, mandatory constraints propagated, siblings explicit; independent validation for high-risk work (§13.2)'
			},
			{
				from: 'UNDER_REVIEW',
				to: 'CONDITIONALLY_VALID',
				trigger: 'validateDecomposition (conditional)'
			},
			{ from: 'UNDER_REVIEW', to: 'INVALID', trigger: 'DecompositionRejected' },
			{
				from: 'VALID',
				to: 'SUPERSEDED',
				trigger: 'reviseDecomposition / DecompositionRevised',
				guard: 'revision preserves parent identity but increments semantic version (§13.2)'
			},
			{
				from: 'CONDITIONALLY_VALID',
				to: 'SUPERSEDED',
				trigger: 'reviseDecomposition / DecompositionRevised',
				guard: 'revision preserves parent identity but increments semantic version (§13.2)'
			},
			{
				from: 'INVALID',
				to: 'SUPERSEDED',
				trigger: 'reviseDecomposition / DecompositionRevised',
				guard: 'revision preserves parent identity but increments semantic version (§13.2)'
			}
		],
		illegal: [],
		guarded: []
	},
	'RecompositionContract.status': {
		name: 'RecompositionContract.status',
		states: [
			'DRAFT',
			'READY',
			'EVALUATING',
			'COMPOSABLE',
			'CONFLICTED',
			'INSUFFICIENT',
			'SATISFIED',
			'SUPERSEDED'
		],
		initialState: 'DRAFT',
		terminalStates: ['SATISFIED', 'SUPERSEDED'],
		transitions: [
			{
				from: 'DRAFT',
				to: 'READY',
				trigger: 'required children reach acceptable states',
				guard:
					'all required children satisfied/conditionally-satisfied/waived/superseded via authorized decision (§14.1)'
			},
			{ from: 'READY', to: 'EVALUATING', trigger: 'beginRecomposition / RecompositionStarted' },
			{
				from: 'EVALUATING',
				to: 'COMPOSABLE',
				trigger: 'no contradiction found; parent constraints hold against recomposed result'
			},
			{
				from: 'EVALUATING',
				to: 'CONFLICTED',
				trigger: 'RecompositionConflictDetected',
				guard: 'recomposition may fail even when all children individually satisfied (§14.1)'
			},
			{
				from: 'EVALUATING',
				to: 'INSUFFICIENT',
				trigger: 'RecompositionFailed (child evidence does not support the parent claim)'
			},
			{
				from: 'COMPOSABLE',
				to: 'SATISFIED',
				trigger: 'completeRecomposition / RecompositionCompleted',
				guard: 'a recomposed result requires an explicit assessment (§14.1)'
			},
			{ from: 'CONFLICTED', to: 'EVALUATING', trigger: 're-evaluation after remediation' },
			{ from: 'INSUFFICIENT', to: 'EVALUATING', trigger: 're-evaluation after remediation' },
			{ from: 'DRAFT', to: 'SUPERSEDED', trigger: 'contract superseded' },
			{ from: 'READY', to: 'SUPERSEDED', trigger: 'contract superseded' },
			{ from: 'EVALUATING', to: 'SUPERSEDED', trigger: 'contract superseded' },
			{ from: 'COMPOSABLE', to: 'SUPERSEDED', trigger: 'contract superseded' },
			{ from: 'CONFLICTED', to: 'SUPERSEDED', trigger: 'contract superseded' },
			{ from: 'INSUFFICIENT', to: 'SUPERSEDED', trigger: 'contract superseded' }
		],
		illegal: [],
		guarded: []
	},
	'Claim.status': {
		name: 'Claim.status',
		states: [
			'OPEN',
			'UNDER_ASSESSMENT',
			'SUPPORTED',
			'CONDITIONALLY_SUPPORTED',
			'CONTESTED',
			'REJECTED',
			'WAIVED',
			'SUPERSEDED'
		],
		initialState: 'OPEN',
		terminalStates: ['REJECTED', 'WAIVED', 'SUPERSEDED'],
		transitions: [
			{
				from: 'OPEN',
				to: 'UNDER_ASSESSMENT',
				trigger: 'assertClaim then requestAssuranceAssessment / assessment begins',
				guard: 'a claim must have a subject (§15.2)'
			},
			{
				from: 'UNDER_ASSESSMENT',
				to: 'SUPPORTED',
				trigger: 'ClaimSupported',
				guard:
					'must reference admissible evidence; confidence values must not replace evidence (§15.2)'
			},
			{
				from: 'UNDER_ASSESSMENT',
				to: 'CONDITIONALLY_SUPPORTED',
				trigger: 'conditional assessment disposition'
			},
			{
				from: 'UNDER_ASSESSMENT',
				to: 'CONTESTED',
				trigger: 'ClaimContested / EvidenceInvalidated (dependent supported claim)',
				guard: 'contradicting evidence must remain visible (§15.2)'
			},
			{
				from: 'SUPPORTED',
				to: 'CONTESTED',
				trigger: 'ClaimContested / EvidenceInvalidated (dependent supported claim)',
				guard: 'contradicting evidence must remain visible (§15.2)'
			},
			{
				from: 'CONDITIONALLY_SUPPORTED',
				to: 'CONTESTED',
				trigger: 'ClaimContested / EvidenceInvalidated (dependent supported claim)',
				guard: 'contradicting evidence must remain visible (§15.2)'
			},
			{ from: 'UNDER_ASSESSMENT', to: 'REJECTED', trigger: 'ClaimRejected' },
			{ from: 'CONTESTED', to: 'REJECTED', trigger: 'ClaimRejected' },
			{ from: 'CONTESTED', to: 'WAIVED', trigger: 'WaiverGranted' },
			{ from: 'UNDER_ASSESSMENT', to: 'WAIVED', trigger: 'WaiverGranted' },
			{ from: 'OPEN', to: 'SUPERSEDED', trigger: 'claim superseded' },
			{ from: 'UNDER_ASSESSMENT', to: 'SUPERSEDED', trigger: 'claim superseded' },
			{ from: 'SUPPORTED', to: 'SUPERSEDED', trigger: 'claim superseded' },
			{ from: 'CONDITIONALLY_SUPPORTED', to: 'SUPERSEDED', trigger: 'claim superseded' },
			{ from: 'CONTESTED', to: 'SUPERSEDED', trigger: 'claim superseded' }
		],
		illegal: [],
		guarded: []
	},
	'Evidence.status': {
		name: 'Evidence.status',
		states: ['PROPOSED', 'ADMISSIBLE', 'REJECTED', 'SUPERSEDED', 'INVALIDATED'],
		initialState: 'PROPOSED',
		terminalStates: ['REJECTED', 'SUPERSEDED', 'INVALIDATED'],
		transitions: [
			{
				from: 'PROPOSED',
				to: 'ADMISSIBLE',
				trigger: 'admitEvidence / EvidenceAdmitted',
				guard: 'evidence must have provenance and state scope + limitations (§16.2)'
			},
			{ from: 'PROPOSED', to: 'REJECTED', trigger: 'EvidenceRejected' },
			{
				from: 'ADMISSIBLE',
				to: 'INVALIDATED',
				trigger: 'invalidateEvidence / EvidenceInvalidated / EvidenceExpired',
				guard:
					'invalidated evidence cannot support an active claim; expiration triggers reassessment of dependent claims (§16.2)'
			},
			{
				from: 'ADMISSIBLE',
				to: 'SUPERSEDED',
				trigger: 'correction creates a new version (evidence immutability preferred, §16.2)'
			}
		],
		illegal: [],
		guarded: []
	},
	'AssurancePolicy.status': {
		name: 'AssurancePolicy.status',
		states: ['DRAFT', 'ACTIVE', 'SUSPENDED', 'SUPERSEDED'],
		initialState: 'DRAFT',
		terminalStates: ['SUPERSEDED'],
		transitions: [
			{ from: 'DRAFT', to: 'ACTIVE', trigger: 'policy activated' },
			{ from: 'ACTIVE', to: 'SUSPENDED', trigger: 'policy suspended' },
			{ from: 'SUSPENDED', to: 'ACTIVE', trigger: 'policy resumed' },
			{
				from: 'ACTIVE',
				to: 'SUPERSEDED',
				trigger: 'new policy version supersedes (assessments pin policySemanticVersion, §18)'
			},
			{
				from: 'SUSPENDED',
				to: 'SUPERSEDED',
				trigger: 'new policy version supersedes (assessments pin policySemanticVersion, §18)'
			}
		],
		illegal: [],
		guarded: []
	},
	'AssuranceAssessment.disposition': {
		name: 'AssuranceAssessment.disposition',
		states: [
			'PENDING',
			'ASSESSING',
			'SATISFIED',
			'CONDITIONALLY_SATISFIED',
			'REJECTED',
			'INCONCLUSIVE',
			'WAIVED',
			'ESCALATED'
		],
		initialState: 'PENDING',
		terminalStates: ['SATISFIED', 'REJECTED', 'WAIVED'],
		transitions: [
			{
				from: 'PENDING',
				to: 'ASSESSING',
				trigger: 'requestAssuranceAssessment then AssuranceAssessmentStarted',
				guard: 'independence requirements must be checked BEFORE evaluation begins (§18.1)'
			},
			{
				from: 'ASSESSING',
				to: 'SATISFIED',
				trigger: 'completeAssuranceAssessment / AssuranceAssessmentSatisfied',
				guard:
					'must identify policy version used, evidence considered, and criteria met (§18.1) — must NOT be forced by executionState=SUCCEEDED (P1/INV-5)'
			},
			{
				from: 'ASSESSING',
				to: 'CONDITIONALLY_SATISFIED',
				trigger: 'AssuranceAssessmentConditionallySatisfied'
			},
			{ from: 'ASSESSING', to: 'REJECTED', trigger: 'AssuranceAssessmentRejected' },
			{
				from: 'ASSESSING',
				to: 'INCONCLUSIVE',
				trigger: 'AssuranceAssessmentInconclusive',
				guard: 'an inconclusive disposition cannot be treated as satisfied (§18.1)'
			},
			{ from: 'ASSESSING', to: 'ESCALATED', trigger: 'AssuranceAssessmentEscalated' },
			{
				from: 'ASSESSING',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard:
					'a policy cannot waive its own blocking finding unless waiver authority is separately defined (§18.1)'
			},
			{
				from: 'INCONCLUSIVE',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard:
					'a policy cannot waive its own blocking finding unless waiver authority is separately defined (§18.1)'
			},
			{
				from: 'ESCALATED',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard:
					'a policy cannot waive its own blocking finding unless waiver authority is separately defined (§18.1)'
			}
		],
		illegal: [
			{
				from: 'INCONCLUSIVE',
				to: 'SATISFIED',
				reason: '§18.1: an inconclusive disposition cannot be treated as satisfied.'
			}
		],
		guarded: []
	},
	'AssuranceAssessment.state': {
		name: 'AssuranceAssessment.state',
		states: [
			'REQUESTED',
			'EVIDENCE_PENDING',
			'READY',
			'ASSESSING',
			'SATISFIED',
			'CONDITIONALLY_SATISFIED',
			'REJECTED',
			'INCONCLUSIVE',
			'ESCALATED',
			'WAIVED',
			'VALIDATOR_FAILED',
			'INDEPENDENCE_VIOLATION',
			'INVALIDATED',
			'WAIVER_EXPIRED',
			'CANCELLED'
		],
		initialState: 'REQUESTED',
		terminalStates: [
			'REJECTED',
			'INCONCLUSIVE',
			'ESCALATED',
			'VALIDATOR_FAILED',
			'INDEPENDENCE_VIOLATION',
			'INVALIDATED',
			'WAIVER_EXPIRED',
			'CANCELLED'
		],
		transitions: [
			{
				from: 'REQUESTED',
				to: 'EVIDENCE_PENDING',
				trigger:
					'AssuranceAssessmentRequested; claims instantiated, evidence requirements evaluated, missing evidence requested (AssuranceEvidenceRequired)',
				guard: 'one or more required EvidenceRequirements not yet satisfied'
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'READY',
				trigger: 'submitEvidenceForAssessment (AssuranceEvidenceReceived)',
				guard:
					'all required evidence present and admissible per §6.2 (identity stable, provenance present, in-scope, not invalidated, sufficiently current, relevant)'
			},
			{
				from: 'READY',
				to: 'ASSESSING',
				trigger:
					'selectAssuranceEvaluator (AssuranceEvaluatorSelected) then beginAssuranceAssessment (AssuranceAssessmentStarted)',
				guard:
					'validator selected AND required independence verified (AssuranceIndependenceVerified) AND context assembled'
			},
			{
				from: 'ASSESSING',
				to: 'SATISFIED',
				trigger: 'completeAssuranceAssessment (AssuranceAssessmentSatisfied)',
				guard:
					'all mandatory criteria MET; no open BLOCKING/CRITICAL finding; required independence verified (§8.4, INV-8); every satisfied claim references admissible evidence (INV-3); required evidence admissible (§10.3, §15.9)'
			},
			{
				from: 'ASSESSING',
				to: 'CONDITIONALLY_SATISFIED',
				trigger: 'completeAssuranceAssessment (AssuranceAssessmentConditionallySatisfied)',
				guard:
					'claims supportable only if explicit conditions remain true or required follow-up occurs; typically an open MATERIAL finding (§10.1, §10.3)'
			},
			{
				from: 'ASSESSING',
				to: 'REJECTED',
				trigger: 'completeAssuranceAssessment (AssuranceAssessmentRejected)',
				guard:
					'open CRITICAL finding (→REJECTED or ESCALATED) OR open BLOCKING finding OR a material claim unsupported/contradicted/violates a blocking criterion (§10.1, §10.3, INV-11)'
			},
			{
				from: 'ASSESSING',
				to: 'INCONCLUSIVE',
				trigger: 'completeAssuranceAssessment (AssuranceAssessmentInconclusive)',
				guard:
					'available admissible evidence insufficient to support or reject the claim; evidence deficit (§10.1, §10.3); also on evidence access failure (§34.3)'
			},
			{
				from: 'ASSESSING',
				to: 'ESCALATED',
				trigger:
					'completeAssuranceAssessment (AssuranceAssessmentEscalated); EscalationRule.trigger fires (§13)',
				guard:
					'validator or policy cannot resolve the issue within its authority/competence (§10.1); may also be the disposition for an open CRITICAL finding (§10.3)'
			},
			{
				from: 'ASSESSING',
				to: 'WAIVED',
				trigger: 'requestAssuranceWaiver (WaiverRequested) → grantAssuranceWaiver (WaiverGranted)',
				guard:
					'WaiverRule.waiverAllowed; criterion ∈ eligibleCriteriaIds; finding severity ∉ prohibitedFindingSeverities; required authority present; rationale/compensating controls recorded (§12). NOT waivable: unauthorized intent alteration (§15.11), critical baseline-integrity failures by ordinary authority (§26.7)'
			},
			{
				from: 'ASSESSING',
				to: 'VALIDATOR_FAILED',
				trigger: 'validator execution failure (§34.1)',
				guard: 'validator crashed / timed out / errored during execution'
			},
			{
				from: 'ASSESSING',
				to: 'INDEPENDENCE_VIOLATION',
				trigger:
					'AssuranceIndependenceViolated — required IndependenceRequirement not satisfied (§8.4)',
				guard:
					"producer and evaluator share invocation/agent/model/provider/hidden-context/prompt-lineage/authority in violation of policy's IndependenceRequirement (§8.2)"
			},
			{
				from: 'ASSESSING',
				to: 'EVIDENCE_PENDING',
				trigger: 'evidence access failure — required evidence cannot be retrieved (§34.3)',
				guard: 'required evidence becomes unavailable during assessment'
			},
			{
				from: 'SATISFIED',
				to: 'INVALIDATED',
				trigger: 'invalidateAssuranceAssessment (AssuranceAssessmentInvalidated)',
				guard:
					'subject semantic version changed (INV-16) OR supporting evidence invalidated (INV-15)'
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'INVALIDATED',
				trigger: 'invalidateAssuranceAssessment (AssuranceAssessmentInvalidated)',
				guard:
					'subject semantic version changed (INV-16) OR supporting evidence invalidated (INV-15) OR a required condition ceased to hold'
			},
			{
				from: 'WAIVED',
				to: 'WAIVER_EXPIRED',
				trigger: 'expireAssuranceWaiver (WaiverExpired)',
				guard:
					'WaiverRule.maximumDuration / recorded expiration reached, OR revalidationTrigger fired, OR a new subject semantic version (waiver does not apply to future semantic versions unless explicitly renewed — §12.2, INV-14)'
			}
		],
		illegal: [
			{
				from: 'VALIDATOR_FAILED',
				to: 'REJECTED',
				reason:
					'A validator failure is NOT an assurance rejection (§34.1; INV-9). It yields VALIDATOR_FAILED + retry/alternate-validator/escalation, never an authoritative REJECTED.'
			},
			{
				from: 'INDEPENDENCE_VIOLATION',
				to: 'SATISFIED',
				reason:
					'If required independence is not satisfied, the assessment cannot receive SATISFIED (§8.4; INV-8). Another independent evaluator must be invoked or a waiver obtained first.'
			}
		],
		guarded: [
			{
				from: 'ASSESSING',
				to: 'SATISFIED',
				reason:
					"Forbidden when a mandatory criterion is NOT met even if the validator recommends SATISFIED — the Assurance Service must reject the recommendation (§4.2, Test 3, §10.3). 'Unable to determine' cannot be treated as 'met' (INV-6). Confidence cannot substitute for evidence (INV-7)."
			},
			{
				from: 'ASSESSING',
				to: 'SATISFIED',
				reason:
					'CROSS-AXIS (P1/INV-5): executionState=SUCCEEDED must NEVER force assuranceState=SATISFIED. Execution success leaves assurance UNASSESSED until required policies complete (Test 9); a baseline cannot be promoted solely because all execution steps completed (INV-20); execution and assurance must use different visual indicators (§38). A successful execution trace proves execution occurred, not that the outcome satisfies intent (§6.3).'
			},
			{
				from: 'ASSESSING',
				to: 'SATISFIED',
				reason:
					'Malformed/incomplete (invalid) validator output cannot mutate authoritative state (INV-10; §34.2). Invalid output must be rejected at the boundary; no authoritative disposition may be created from unparsed prose.'
			}
		]
	},
	'AssuranceObservation.disposition': {
		name: 'AssuranceObservation.disposition',
		states: ['OPEN', 'ACCEPTED', 'REMEDIATED', 'WAIVED', 'REJECTED', 'SUPERSEDED'],
		initialState: 'OPEN',
		terminalStates: ['ACCEPTED', 'REMEDIATED', 'WAIVED', 'REJECTED', 'SUPERSEDED'],
		transitions: [
			{
				from: 'OPEN',
				to: 'ACCEPTED',
				trigger: 'observation accepted (residual risk acknowledged)'
			},
			{
				from: 'OPEN',
				to: 'REMEDIATED',
				trigger: 'remediation applied',
				guard:
					'assurance observations must REMAIN VISIBLE after remediation — the observation is not deleted (§18.1)'
			},
			{
				from: 'OPEN',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard:
					'waiver includes scope, rationale, authority, duration; human override must not erase prior findings (§23.2, Scenario 4)'
			},
			{ from: 'OPEN', to: 'REJECTED', trigger: 'observation dismissed/rejected' },
			{ from: 'OPEN', to: 'SUPERSEDED', trigger: 'observation superseded' }
		],
		illegal: [],
		guarded: []
	},
	'ExecutionPlan.status': {
		name: 'ExecutionPlan.status',
		states: [
			'PROPOSED',
			'UNDER_REVIEW',
			'APPROVED',
			'ACTIVE',
			'COMPLETED',
			'FAILED',
			'SUPERSEDED',
			'CANCELLED'
		],
		initialState: 'PROPOSED',
		terminalStates: ['COMPLETED', 'FAILED', 'SUPERSEDED', 'CANCELLED'],
		transitions: [
			{
				from: 'PROPOSED',
				to: 'UNDER_REVIEW',
				trigger: 'proposeExecutionPlan / ExecutionPlanProposed then submitted for review'
			},
			{
				from: 'UNDER_REVIEW',
				to: 'APPROVED',
				trigger: 'approveExecutionPlan / ExecutionPlanApproved',
				guard:
					'plan approval required before irreversible execution for high-risk work; approval grants NO runtime privileges (§20.2)'
			},
			{
				from: 'APPROVED',
				to: 'ACTIVE',
				trigger: 'activateExecutionPlan / ExecutionPlanActivated',
				guard:
					'a PWU may have only ONE active plan at a time; an active plan references exactly one PWU (§20.2)'
			},
			{ from: 'ACTIVE', to: 'COMPLETED', trigger: 'all steps succeeded' },
			{ from: 'ACTIVE', to: 'FAILED', trigger: 'ExecutionTerminated / unrecoverable failure' },
			{ from: 'APPROVED', to: 'CANCELLED', trigger: 'cancelExecutionPlan' },
			{ from: 'ACTIVE', to: 'CANCELLED', trigger: 'cancelExecutionPlan' },
			{
				from: 'PROPOSED',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded (plan revision)',
				guard: 'plan revision preserves prior attempt history (§20.2)'
			},
			{
				from: 'UNDER_REVIEW',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded (plan revision)',
				guard: 'plan revision preserves prior attempt history (§20.2)'
			},
			{
				from: 'APPROVED',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded (plan revision)',
				guard: 'plan revision preserves prior attempt history (§20.2)'
			},
			{
				from: 'ACTIVE',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded (plan revision)',
				guard: 'plan revision preserves prior attempt history (§20.2)'
			}
		],
		illegal: [],
		guarded: []
	},
	'ExecutionStep.stepState': {
		name: 'ExecutionStep.stepState',
		states: [
			'NOT_READY',
			'READY',
			'QUEUED',
			'RUNNING',
			'WAITING',
			'SUCCEEDED',
			'FAILED',
			'SKIPPED',
			'CANCELLED',
			'SUPERSEDED'
		],
		initialState: 'NOT_READY',
		terminalStates: ['SUCCEEDED', 'FAILED', 'SKIPPED', 'CANCELLED', 'SUPERSEDED'],
		transitions: [
			{
				from: 'NOT_READY',
				to: 'READY',
				trigger: 'ExecutionStepReady',
				guard: 'a step cannot run until preconditions are satisfied (§21.1)'
			},
			{ from: 'READY', to: 'QUEUED', trigger: 'step scheduled' },
			{ from: 'QUEUED', to: 'RUNNING', trigger: 'startExecutionStep / ExecutionStepStarted' },
			{ from: 'RUNNING', to: 'WAITING', trigger: 'ExecutionStepWaiting' },
			{ from: 'WAITING', to: 'RUNNING', trigger: 'wait resolved' },
			{
				from: 'RUNNING',
				to: 'SUCCEEDED',
				trigger: 'completeExecutionStep / ExecutionStepSucceeded',
				guard:
					'must record outputs or an explicit no-output result; step success does NOT imply PWU success (§21.1)'
			},
			{ from: 'RUNNING', to: 'FAILED', trigger: 'failExecutionStep / ExecutionStepFailed' },
			{ from: 'FAILED', to: 'QUEUED', trigger: 'retryExecutionStep / ExecutionStepRetried' },
			{
				from: 'READY',
				to: 'SKIPPED',
				trigger: 'ExecutionStepSkipped',
				guard: 'a skipped MANDATORY step requires an authorized plan revision or waiver (§21.1)'
			},
			{
				from: 'QUEUED',
				to: 'SKIPPED',
				trigger: 'ExecutionStepSkipped',
				guard: 'a skipped MANDATORY step requires an authorized plan revision or waiver (§21.1)'
			},
			{ from: 'READY', to: 'CANCELLED', trigger: 'ExecutionStepCancelled' },
			{ from: 'QUEUED', to: 'CANCELLED', trigger: 'ExecutionStepCancelled' },
			{ from: 'RUNNING', to: 'CANCELLED', trigger: 'ExecutionStepCancelled' },
			{ from: 'WAITING', to: 'CANCELLED', trigger: 'ExecutionStepCancelled' },
			{ from: 'NOT_READY', to: 'SUPERSEDED', trigger: 'plan revised/superseded' },
			{ from: 'READY', to: 'SUPERSEDED', trigger: 'plan revised/superseded' },
			{ from: 'QUEUED', to: 'SUPERSEDED', trigger: 'plan revised/superseded' },
			{ from: 'RUNNING', to: 'SUPERSEDED', trigger: 'plan revised/superseded' },
			{ from: 'WAITING', to: 'SUPERSEDED', trigger: 'plan revised/superseded' }
		],
		illegal: [
			{
				from: 'NOT_READY',
				to: 'RUNNING',
				reason:
					'§21.1: a step cannot run until preconditions are satisfied — must pass through READY.'
			}
		],
		guarded: []
	},
	'RuntimeBinding.authorizationStatus': {
		name: 'RuntimeBinding.authorizationStatus',
		states: ['REQUESTED', 'AUTHORIZED', 'PARTIALLY_AUTHORIZED', 'DENIED', 'REVOKED'],
		initialState: 'REQUESTED',
		terminalStates: ['DENIED', 'REVOKED'],
		transitions: [
			{
				from: 'REQUESTED',
				to: 'AUTHORIZED',
				trigger: 'RuntimeBindingAuthorized',
				guard:
					'requested capability is NOT granted capability; capability scope must be explicit (§22.1)'
			},
			{ from: 'REQUESTED', to: 'PARTIALLY_AUTHORIZED', trigger: 'partial grant' },
			{ from: 'REQUESTED', to: 'DENIED', trigger: 'RuntimeBindingDenied' },
			{
				from: 'PARTIALLY_AUTHORIZED',
				to: 'AUTHORIZED',
				trigger: 'new authorization event (privilege expansion)',
				guard: 'privilege expansion requires a NEW authorization event (§22.1)'
			},
			{ from: 'AUTHORIZED', to: 'REVOKED', trigger: 'RuntimeCapabilityRevoked' },
			{ from: 'PARTIALLY_AUTHORIZED', to: 'REVOKED', trigger: 'RuntimeCapabilityRevoked' }
		],
		illegal: [],
		guarded: []
	},
	'Decision.status': {
		name: 'Decision.status',
		states: ['PROPOSED', 'EFFECTIVE', 'REVOKED', 'SUPERSEDED'],
		initialState: 'PROPOSED',
		terminalStates: ['REVOKED', 'SUPERSEDED'],
		transitions: [
			{
				from: 'PROPOSED',
				to: 'EFFECTIVE',
				trigger: 'approveDecision / DecisionApproved → DecisionEffective',
				guard:
					'approval requires authority; an agent may recommend but cannot exercise authority unless delegated (§23.2)'
			},
			{
				from: 'EFFECTIVE',
				to: 'REVOKED',
				trigger: 'revokeDecision / DecisionRevoked',
				guard:
					'revocation triggers impact analysis; a decision cannot retroactively change evidence (§23.2)'
			},
			{ from: 'PROPOSED', to: 'SUPERSEDED', trigger: 'DecisionRejected / decision superseded' },
			{ from: 'EFFECTIVE', to: 'SUPERSEDED', trigger: 'decision superseded' }
		],
		illegal: [],
		guarded: []
	},
	'Baseline.status': {
		name: 'Baseline.status',
		states: [
			'DRAFT',
			'CANDIDATE',
			'UNDER_REVIEW',
			'APPROVED',
			'AUTHORITATIVE',
			'SUPERSEDED',
			'REVOKED'
		],
		initialState: 'DRAFT',
		terminalStates: ['SUPERSEDED', 'REVOKED'],
		transitions: [
			{ from: 'DRAFT', to: 'CANDIDATE', trigger: 'BaselineCreated / nominated as candidate' },
			{ from: 'CANDIDATE', to: 'UNDER_REVIEW', trigger: 'BaselineSubmittedForReview' },
			{
				from: 'UNDER_REVIEW',
				to: 'APPROVED',
				trigger: 'BaselineApproved',
				guard: 'open BLOCKING observations prevent promotion unless waived (§24.2)'
			},
			{
				from: 'APPROVED',
				to: 'AUTHORITATIVE',
				trigger: 'promoteBaseline / BaselinePromoted',
				guard:
					'requires an explicit EFFECTIVE promotion decision (§23.2, §24.2); promotion evidence must be retained; promotion is a governance event, not an execution step (§24.2)'
			},
			{
				from: 'AUTHORITATIVE',
				to: 'SUPERSEDED',
				trigger: 'supersedeBaseline / BaselineSuperseded',
				guard:
					'an authoritative baseline is immutable — changes create a SUCCESSOR baseline; supersession preserves traceability (§24.2)'
			},
			{ from: 'APPROVED', to: 'REVOKED', trigger: 'BaselineRevoked' },
			{ from: 'AUTHORITATIVE', to: 'REVOKED', trigger: 'BaselineRevoked' }
		],
		illegal: [
			{
				from: 'UNDER_REVIEW',
				to: 'AUTHORITATIVE',
				reason:
					"§24.2 + §35.1 'No unauthorized baseline': a baseline cannot become AUTHORITATIVE without an effective promotion decision (must be APPROVED + carry a promotion decision); open blocking observations block promotion unless waived."
			}
		],
		guarded: []
	},
	AggregateAssuranceDisposition: {
		name: 'AggregateAssuranceDisposition',
		states: [
			'REJECTED',
			'EVIDENCE_REQUIRED',
			'UNASSESSED',
			'INCONCLUSIVE',
			'CONDITIONALLY_SATISFIED',
			'SATISFIED'
		],
		initialState: undefined,
		terminalStates: [],
		transitions: [],
		illegal: [],
		guarded: []
	},
	'ValidatorRegistryEntry.status': {
		name: 'ValidatorRegistryEntry.status',
		states: ['ACTIVE', 'DEGRADED', 'DISABLED'],
		initialState: undefined,
		terminalStates: [],
		transitions: [],
		illegal: [],
		guarded: []
	},
	'PWA.publicationStatus': {
		name: 'PWA.publicationStatus',
		states: ['DRAFT', 'UNDER_REVIEW', 'VALIDATED', 'PUBLISHED', 'DEPRECATED', 'RETIRED'],
		initialState: 'DRAFT',
		terminalStates: ['RETIRED'],
		transitions: [
			{ from: 'DRAFT', to: 'UNDER_REVIEW', trigger: 'submit for review' },
			{ from: 'UNDER_REVIEW', to: 'VALIDATED', trigger: 'validate' },
			{ from: 'VALIDATED', to: 'PUBLISHED', trigger: 'publish' },
			{ from: 'PUBLISHED', to: 'DEPRECATED', trigger: 'deprecate' },
			{ from: 'DEPRECATED', to: 'RETIRED', trigger: 'retire' }
		],
		illegal: [],
		guarded: []
	},
	'PwuType.status': {
		name: 'PwuType.status',
		states: ['DRAFT', 'PUBLISHED', 'DEPRECATED'],
		initialState: 'DRAFT',
		terminalStates: ['DEPRECATED'],
		transitions: [
			{ from: 'DRAFT', to: 'PUBLISHED', trigger: 'publish via PWA' },
			{ from: 'PUBLISHED', to: 'DEPRECATED', trigger: 'deprecate via PWA' }
		],
		illegal: [],
		guarded: []
	},
	'Undertaking.status': {
		name: 'Undertaking.status',
		states: ['ACTIVE', 'MIGRATING', 'ARCHIVED'],
		initialState: 'ACTIVE',
		terminalStates: ['ARCHIVED'],
		transitions: [
			{ from: 'ACTIVE', to: 'MIGRATING', trigger: 'begin migration' },
			{ from: 'MIGRATING', to: 'ACTIVE', trigger: 'complete migration' },
			{ from: 'ACTIVE', to: 'ARCHIVED', trigger: 'archive' }
		],
		illegal: [],
		guarded: []
	},
	'Harness.status': {
		name: 'Harness.status',
		states: [
			'FRAMING',
			'PLANNING',
			'COORDINATING',
			'WAITING',
			'SYNTHESIZING',
			'COMPLETED',
			'ESCALATED',
			'SUSPENDED',
			'SUPERSEDED'
		],
		initialState: 'FRAMING',
		terminalStates: ['COMPLETED', 'SUPERSEDED'],
		transitions: [
			{ from: 'FRAMING', to: 'PLANNING', trigger: 'objective + scope + authority framed' },
			{ from: 'PLANNING', to: 'COORDINATING', trigger: 'plan approved; allocation begins' },
			{ from: 'COORDINATING', to: 'WAITING', trigger: 'durable wait on a dependency/callback' },
			{ from: 'WAITING', to: 'COORDINATING', trigger: 'wait resolved / restart recovery resumes' },
			{ from: 'COORDINATING', to: 'SYNTHESIZING', trigger: 'child results ready for synthesis' },
			{ from: 'SYNTHESIZING', to: 'COORDINATING', trigger: 'synthesis reveals more work' },
			{ from: 'SYNTHESIZING', to: 'COMPLETED', trigger: 'parent coherence synthesized + accepted' },
			{ from: 'COORDINATING', to: 'ESCALATED', trigger: 'insufficient authority / no-progress' },
			{ from: 'WAITING', to: 'ESCALATED', trigger: 'timeout / stuck' },
			{ from: 'ESCALATED', to: 'COORDINATING', trigger: 'escalation resolved by authority' },
			{ from: 'COORDINATING', to: 'SUSPENDED', trigger: 'suspend' },
			{ from: 'SUSPENDED', to: 'COORDINATING', trigger: 'resume' },
			{ from: 'FRAMING', to: 'SUPERSEDED', trigger: 'harness superseded' },
			{ from: 'PLANNING', to: 'SUPERSEDED', trigger: 'harness superseded' },
			{ from: 'COORDINATING', to: 'SUPERSEDED', trigger: 'harness superseded' }
		],
		illegal: [],
		guarded: []
	}
};

export const CROSS_AXIS_RULES: readonly CrossAxisRule[] = [
	{
		machine: 'Intent.intentStatus',
		from: 'SUPERSEDED',
		to: '(authorizes new PWU)',
		reason:
			'§6.3: a superseded intent cannot authorize new PWUs. Prohibition on a terminal state, not an intra-machine transition.'
	},
	{
		machine: 'PWU.workLifecycleState',
		from: 'FAILED',
		to: 'SATISFIED',
		reason:
			'§8.3 — must be rejected. NOTE: FAILED is an executionState value (§7.3), NOT a workLifecycleState; the doc lists this cross-axis rule here — a failed execution can never yield a SATISFIED PWU.'
	},
	{
		machine: 'PWU.assuranceState',
		from: 'executionState=SUCCEEDED',
		to: 'SATISFIED',
		reason:
			"CRITICAL — property P1 / INV-5 / §35.1 'No execution implies assurance'. ExecutionState=SUCCEEDED must NEVER automatically imply/force assuranceState=SATISFIED. The two axes are independent (§7.1, §38, §42 litmus #3). Corroborated by §39 Scenario 3 (execution SUCCEEDED while assurance REJECTED; PWU NOT SATISFIED) and §8.3 'EXECUTING→SATISFIED without assurance'. Assurance SATISFIED requires evaluated claims + admissible evidence + criteria met, independent of execution outcome. (Cross-axis coupling stated as a forbidden edge; the from-token names the executionState axis, not a state within this machine.)"
	},
	{
		machine: 'DecompositionContract.status',
		from: 'INVALID',
		to: '(parent PWU becomes PLANNED)',
		reason:
			'§13.2: the parent cannot become PLANNED through child execution unless the decomposition contract is VALID or CONDITIONALLY_VALID (guard on the parent PWU, not an intra-machine transition).'
	},
	{
		machine: 'Claim.status',
		from: 'CONTESTED',
		to: '(authorizes BaselinePromoted)',
		reason:
			'§15.2: a contested claim cannot authorize baseline promotion unless resolved or waived (guard on baseline promotion, not an intra-machine transition).'
	},
	{
		machine: 'Evidence.status',
		from: 'INVALIDATED',
		to: '(supports active claim)',
		reason:
			"§16.2: invalidated evidence cannot support an active claim; §35.1 property 'Invalid evidence cannot support satisfaction' (guard on claim support, not an intra-machine transition)."
	},
	{
		machine: 'AssuranceAssessment.disposition',
		from: 'executionState=SUCCEEDED',
		to: 'SATISFIED',
		reason:
			'PROPERTY P1 / INV-5 (§35.1): execution success must never automatically imply a satisfied assessment. Cross-axis forbidden edge; the from-token names the executionState axis, not a state in this machine.'
	},
	{
		machine: 'AssuranceObservation.disposition',
		from: 'OPEN',
		to: '(authorizes BaselinePromoted)',
		reason:
			'§24.2: open BLOCKING observations prevent baseline promotion unless waived (guard on promotion, not an intra-machine transition).'
	},
	{
		machine: 'ExecutionPlan.status',
		from: 'SUPERSEDED',
		to: '(creates new ExecutionAttempt/step)',
		reason:
			"§20.2 + §35.1 'No superseded execution': a superseded plan cannot create new execution attempts; no new step may begin under a superseded Execution Plan."
	},
	{
		machine: 'RuntimeBinding.authorizationStatus',
		from: 'REVOKED',
		to: '(used for a new attempt)',
		reason: '§22.1: revoked bindings cannot be used for new attempts.'
	},
	{
		machine: 'AggregateAssuranceDisposition',
		from: '(aggregate evaluation)',
		to: 'SATISFIED',
		reason:
			'Aggregate must preserve the strictest unresolved disposition (§28.1); it must NOT be reduced to a numerical average of policy results (§28.2). Conflicting assessments must remain visible, not silently averaged (INV-17, §34.4). I.e. SATISFIED is forbidden whenever any higher-precedence unresolved condition holds.'
	}
];
