// GENERATED FILE — do not edit by hand. Regenerate with `bun run gen:transitions`.
// Source: vocab/m2-transitions.json (grounded from DOC-002 + DOC-004, reconciled). See gen/gen-transitions.ts.

export interface TransitionSpec {
	readonly from: string;
	readonly to: string;
	readonly trigger?: string;
	readonly guard?: string;
	/**
	 * The vocab's own provenance note for THIS arrow — typically `RECONSTRUCTED`, or a §-citation.
	 *
	 * ⚠ ADDED 2026-08-09 (REG-F-045's recorded remedy, filed 2026-08-06). Without it, an arrow the
	 * vocab marks as an author's reconstruction was INDISTINGUISHABLE from a verbatim one downstream.
	 * CON-000 B3, as amended by REG-D-034, now turns on exactly that distinction: canon governs a
	 * principle only where a divergence carries a ratifying act, and whether a trigger is corpus text
	 * or an inference decides what a divergence even means.
	 */
	readonly note?: string;
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
	/**
	 * The vocab's machine-level provenance, e.g. *"core-model doc §20.1 enum (VERBATIM). Transitions
	 * RECONSTRUCTED from §26.4 events + §34.1 commands. NO explicit matrix."* Same remedy, same reason:
	 * the states can be verbatim while the arrows are inferred, and only this string says which.
	 */
	readonly sourceSection?: string;
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
				guard: 'Replacement intent identified',
				note: "VERBATIM §6.2. 'Any active' = any non-terminal state (RAW, UNDER_DISCOVERY, PROVISIONAL, FORMALIZED, APPROVED, REVISED)."
			},
			{
				from: 'UNDER_DISCOVERY',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified',
				note: "VERBATIM §6.2. 'Any active' = any non-terminal state (RAW, UNDER_DISCOVERY, PROVISIONAL, FORMALIZED, APPROVED, REVISED)."
			},
			{
				from: 'PROVISIONAL',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified',
				note: "VERBATIM §6.2. 'Any active' = any non-terminal state (RAW, UNDER_DISCOVERY, PROVISIONAL, FORMALIZED, APPROVED, REVISED)."
			},
			{
				from: 'FORMALIZED',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified',
				note: "VERBATIM §6.2. 'Any active' = any non-terminal state (RAW, UNDER_DISCOVERY, PROVISIONAL, FORMALIZED, APPROVED, REVISED)."
			},
			{
				from: 'APPROVED',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified',
				note: "VERBATIM §6.2. 'Any active' = any non-terminal state (RAW, UNDER_DISCOVERY, PROVISIONAL, FORMALIZED, APPROVED, REVISED)."
			},
			{
				from: 'REVISED',
				to: 'SUPERSEDED',
				trigger: 'Supersede',
				guard: 'Replacement intent identified',
				note: "VERBATIM §6.2. 'Any active' = any non-terminal state (RAW, UNDER_DISCOVERY, PROVISIONAL, FORMALIZED, APPROVED, REVISED)."
			},
			{
				from: 'RAW',
				to: 'WITHDRAWN',
				trigger: 'Withdraw',
				guard: 'Authorized actor',
				note: 'VERBATIM §6.2. Withdraw permitted only from these three early states.'
			},
			{
				from: 'UNDER_DISCOVERY',
				to: 'WITHDRAWN',
				trigger: 'Withdraw',
				guard: 'Authorized actor',
				note: 'VERBATIM §6.2. Withdraw permitted only from these three early states.'
			},
			{
				from: 'PROVISIONAL',
				to: 'WITHDRAWN',
				trigger: 'Withdraw',
				guard: 'Authorized actor',
				note: 'VERBATIM §6.2. Withdraw permitted only from these three early states.'
			}
		],
		illegal: [],
		guarded: [],
		sourceSection: 'core-model doc §6.1 enum / §6.2 transition matrix (VERBATIM) / §6.3 invariants'
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
				guard: 'Intent exists',
				note: '§8.1 primary chain'
			},
			{
				from: 'SHAPING',
				to: 'READY',
				trigger: 'Mark ready (markPwuReady; PwuMarkedReady)',
				guard: 'Shape readiness policy satisfied (§9 Shape Readiness Profile)',
				note: '§8.1'
			},
			{
				from: 'READY',
				to: 'PLANNED',
				trigger: 'Approve plan',
				guard: 'Active execution plan approved',
				note: '§8.1'
			},
			{
				from: 'PLANNED',
				to: 'EXECUTING',
				trigger: 'Start execution',
				guard: 'Runtime bindings authorized',
				note: '§8.1'
			},
			{
				from: 'EXECUTING',
				to: 'EVIDENCE_PENDING',
				trigger: 'Record execution success',
				guard:
					'CROSS-AXIS guard: executionState=SUCCEEDED. Success does NOT auto-satisfy assurance (P1/INV-5).',
				note: '§8.1 — doc-explicit coupling of workLifecycle to the executionState axis.'
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'UNDER_ASSURANCE',
				trigger: 'Begin assurance',
				guard: 'Required evidence available or deficit explicitly recorded',
				note: '§8.1'
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'CONDITIONALLY_SATISFIED',
				trigger: 'Conditionally satisfy',
				guard: 'Conditional disposition exists',
				note: '§8.1'
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'SATISFIED',
				trigger: 'Satisfy',
				guard:
					'CROSS-AXIS guard: assuranceState=SATISFIED. This is the ONLY legal path into workLifecycle SATISFIED (P1/INV-5).',
				note: '§8.1 — SATISFIED requires assuranceState=SATISFIED, NOT executionState=SUCCEEDED.'
			},
			{
				from: 'SATISFIED',
				to: 'RECOMPOSING',
				trigger: 'Begin recomposition (beginRecomposition; RecompositionStarted)',
				guard: 'Parent exists and recomposition is required',
				note: '§8.1'
			},
			{
				from: 'RECOMPOSING',
				to: 'RECOMPOSED',
				trigger: 'Complete recomposition (completeRecomposition; RecompositionCompleted)',
				guard: 'Recomposition contract satisfied',
				note: '§8.1'
			},
			{
				from: 'SATISFIED',
				to: 'BASELINED',
				trigger: 'Promote baseline (promoteBaseline; BaselinePromoted)',
				guard: 'Authorized promotion decision',
				note: "§8.1 row 'SATISFIED/RECOMPOSED → BASELINED' split: from SATISFIED."
			},
			{
				from: 'RECOMPOSED',
				to: 'BASELINED',
				trigger: 'Promote baseline (promoteBaseline; BaselinePromoted)',
				guard: 'Authorized promotion decision',
				note: "§8.1 row 'SATISFIED/RECOMPOSED → BASELINED' split: from RECOMPOSED."
			},
			{ from: 'SHAPING', to: 'BLOCKED', trigger: 'Missing information', note: '§8.2 exception' },
			{
				from: 'READY',
				to: 'CHALLENGED',
				trigger: 'Shape challenge (challengePwu; PwuChallenged)',
				note: '§8.2 exception'
			},
			{
				from: 'PLANNED',
				to: 'BLOCKED',
				trigger: 'Runtime dependency unavailable',
				note: "§8.2 row 'PLANNED/EXECUTING → BLOCKED' split: from PLANNED."
			},
			{
				from: 'EXECUTING',
				to: 'BLOCKED',
				trigger: 'Runtime dependency unavailable',
				note: "§8.2 row 'PLANNED/EXECUTING → BLOCKED' split: from EXECUTING."
			},
			{
				from: 'EXECUTING',
				to: 'RESHAPING',
				trigger: 'Material assumption falsified (reshapePwu; PwuReshapingStarted)',
				note: '§8.2 exception'
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'ESCALATED',
				trigger: 'Evidence impossible to obtain',
				note: '§8.2 exception'
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'REJECTED',
				trigger: 'Blocking finding',
				note: "§8.2 row 'UNDER_ASSURANCE → REJECTED or RESHAPING' — one trigger, two legal targets (branch: REJECTED)."
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'RESHAPING',
				trigger: 'Blocking finding',
				note: "§8.2 row 'UNDER_ASSURANCE → REJECTED or RESHAPING' — one trigger, two legal targets (branch: RESHAPING)."
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'INVALIDATED',
				trigger: 'Condition violated',
				note: '§8.2 exception'
			},
			{
				from: 'SATISFIED',
				to: 'INVALIDATED',
				trigger: 'Upstream change (invalidatePwu; PwuInvalidated — §29 triggers)',
				note: '§8.2 exception'
			},
			{
				from: 'RECOMPOSED',
				to: 'INVALIDATED',
				trigger: 'Sibling conflict discovered',
				note: '§8.2 exception'
			},
			{
				from: 'PROPOSED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'SHAPING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'READY',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'PLANNED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'EXECUTING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'SATISFIED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'RECOMPOSING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'RECOMPOSED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'BLOCKED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'CHALLENGED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'RESHAPING',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'ESCALATED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'INVALIDATED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'REJECTED',
				to: 'ABANDONED',
				trigger: 'Authorized abandonment (PwuAbandoned)',
				guard: 'Authorized decision (Decision.decisionType=ABANDON)',
				note: "§8.2 umbrella source — 'Any active' = any non-terminal state; kept verbatim, not enumerated per-state."
			},
			{
				from: 'PROPOSED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'SHAPING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'READY',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'PLANNED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'EXECUTING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'UNDER_ASSURANCE',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'SATISFIED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'RECOMPOSING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'RECOMPOSED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'BLOCKED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'CHALLENGED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'RESHAPING',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'ESCALATED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'INVALIDATED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
			},
			{
				from: 'REJECTED',
				to: 'SUPERSEDED',
				trigger: 'Replacement PWU created (supersedePwu; PwuSuperseded)',
				guard: 'Not already BASELINED',
				note: "§8.2 umbrella source — 'Any non-baselined' = every state except BASELINED; kept verbatim."
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
		guarded: [],
		sourceSection:
			'core-model doc §7.2 (enum) / §8.1 primary (VERBATIM) / §8.2 exception (VERBATIM) / §8.3 illegal (VERBATIM)'
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
			{
				from: 'NOT_PLANNED',
				to: 'PLANNED',
				trigger: 'ExecutionPlanApproved / plan approved',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'PLANNED',
				to: 'QUEUED',
				trigger: 'ExecutionPlanActivated / step scheduled',
				note: 'RECONSTRUCTED'
			},
			{ from: 'QUEUED', to: 'RUNNING', trigger: 'ExecutionStepStarted', note: 'RECONSTRUCTED' },
			{ from: 'RUNNING', to: 'WAITING', trigger: 'ExecutionStepWaiting', note: 'RECONSTRUCTED' },
			{ from: 'WAITING', to: 'RUNNING', trigger: 'wait resolved', note: 'RECONSTRUCTED' },
			{
				from: 'RUNNING',
				to: 'RETRYING',
				trigger: 'ExecutionStepRetried / recoverable failure',
				note: 'RECONSTRUCTED'
			},
			{ from: 'RETRYING', to: 'RUNNING', trigger: 'retry attempt started', note: 'RECONSTRUCTED' },
			{
				from: 'RUNNING',
				to: 'SUCCEEDED',
				trigger: 'ExecutionStepSucceeded (all steps)',
				guard: 'step outputs recorded or explicit no-output',
				note: 'RECONSTRUCTED. SUCCEEDED is the guard for workLifecycle EXECUTING→EVIDENCE_PENDING (§8.1). MUST NOT auto-imply assuranceState=SATISFIED (P1/INV-5).'
			},
			{
				from: 'RUNNING',
				to: 'FAILED',
				trigger: 'ExecutionStepFailed / retry exhaustion / ExecutionTerminated',
				note: 'RECONSTRUCTED. Both RUNNING and RETRYING are valid from-states.'
			},
			{
				from: 'RETRYING',
				to: 'FAILED',
				trigger: 'ExecutionStepFailed / retry exhaustion / ExecutionTerminated',
				note: 'RECONSTRUCTED. Both RUNNING and RETRYING are valid from-states.'
			},
			{
				from: 'PLANNED',
				to: 'CANCELLED',
				trigger: 'cancelExecutionPlan / ExecutionStepCancelled',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'QUEUED',
				to: 'CANCELLED',
				trigger: 'cancelExecutionPlan / ExecutionStepCancelled',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'RUNNING',
				to: 'CANCELLED',
				trigger: 'cancelExecutionPlan / ExecutionStepCancelled',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'WAITING',
				to: 'CANCELLED',
				trigger: 'cancelExecutionPlan / ExecutionStepCancelled',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'NOT_PLANNED',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded',
				note: "RECONSTRUCTED; superseded plan cannot create new attempts (§20.2). 'Any active' = any non-terminal state."
			},
			{
				from: 'PLANNED',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded',
				note: "RECONSTRUCTED; superseded plan cannot create new attempts (§20.2). 'Any active' = any non-terminal state."
			},
			{
				from: 'QUEUED',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded',
				note: "RECONSTRUCTED; superseded plan cannot create new attempts (§20.2). 'Any active' = any non-terminal state."
			},
			{
				from: 'RUNNING',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded',
				note: "RECONSTRUCTED; superseded plan cannot create new attempts (§20.2). 'Any active' = any non-terminal state."
			},
			{
				from: 'WAITING',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded',
				note: "RECONSTRUCTED; superseded plan cannot create new attempts (§20.2). 'Any active' = any non-terminal state."
			},
			{
				from: 'RETRYING',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded',
				note: "RECONSTRUCTED; superseded plan cannot create new attempts (§20.2). 'Any active' = any non-terminal state."
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §7.3 enum (VERBATIM). NO from→to matrix in doc; transitions RECONSTRUCTED from §26.4 events + enum semantics.'
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
		initialState: 'UNASSESSED',
		terminalStates: ['NOT_REQUIRED', 'SATISFIED', 'REJECTED', 'WAIVED', 'INVALIDATED'],
		transitions: [
			{
				from: 'UNASSESSED',
				to: 'EVIDENCE_REQUIRED',
				trigger: 'policy requires evidence',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'EVIDENCE_REQUIRED',
				to: 'READY_FOR_ASSESSMENT',
				trigger: 'EvidenceAdmitted / required evidence available',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'READY_FOR_ASSESSMENT',
				to: 'ASSESSING',
				trigger: 'AssuranceAssessmentStarted',
				guard: 'independence requirements checked before evaluation (§18.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'SATISFIED',
				trigger: 'AssuranceAssessmentSatisfied',
				guard:
					'criteria met identified; evidence considered identified (§18.1) — NOT forced by executionState=SUCCEEDED (P1/INV-5)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'CONDITIONALLY_SATISFIED',
				trigger: 'AssuranceAssessmentConditionallySatisfied',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'REJECTED',
				trigger: 'AssuranceAssessmentRejected / blocking finding',
				note: 'RECONSTRUCTED; Scenario 3 (§39): execution SUCCEEDED + assurance REJECTED ⇒ PWU NOT SATISFIED.'
			},
			{
				from: 'ASSESSING',
				to: 'ESCALATED',
				trigger: 'AssuranceAssessmentEscalated',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard: 'waiver authority separately defined (§18.1)',
				note: 'RECONSTRUCTED. All three named from-states are in the states list.'
			},
			{
				from: 'EVIDENCE_REQUIRED',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard: 'waiver authority separately defined (§18.1)',
				note: 'RECONSTRUCTED. All three named from-states are in the states list.'
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard: 'waiver authority separately defined (§18.1)',
				note: 'RECONSTRUCTED. All three named from-states are in the states list.'
			},
			{
				from: 'SATISFIED',
				to: 'INVALIDATED',
				trigger: 'EvidenceInvalidated / upstream change (§29.1)',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'INVALIDATED',
				trigger: 'EvidenceInvalidated / upstream change (§29.1)',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'UNASSESSED',
				to: 'NOT_REQUIRED',
				trigger:
					'applicability determination returns NOT_APPLICABLE for every candidate policy (§5.2 ApplicabilityOutcome)',
				guard: 'no assurance policy applies to this PWU',
				note: "AUTHORED 2026-08-05 under the delegated authoring grant, on ratified ground. DOC-004 §5.2 ratifies ApplicabilityOutcome = REQUIRED | RECOMMENDED | OPTIONAL | NOT_APPLICABLE | REQUIRES_HUMAN_DETERMINATION, and §7.4 ratifies NOT_REQUIRED as a state meaning assurance does not apply. The corpus defines both and never connects them, leaving NOT_REQUIRED with no way in. THE AUTHORED PART is that a §5.2 determination should drive this axis at all — the outcome vocabulary and the state vocabulary are joined here, not in the corpus. Direction is deliberate: a PWU begins UNASSESSED (assurance is presumed to apply) and moves to NOT_REQUIRED only on a determination that nothing applies. The reverse default — begin NOT_REQUIRED and opt in — would make silence mean 'no assurance needed', which is the fail-open reading."
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			"core-model doc §7.4 enum (VERBATIM). NO from→to matrix; transitions RECONSTRUCTED from §18 dispositions + §26.5 events + Scenario 3 (§39). initialState CORRECTED 2026-08-05 (REG-F-023 / connectivity): it was NOT_REQUIRED, which is the FIRST MEMBER OF THE §7.4 ENUM and not a ratified starting state — an enum declares no initial state. Measured: `ProposePwu` creates every PWU with assuranceState 'UNASSESSED' (pwu.ts), and UNASSESSED is the source of this machine's first arrow (UNASSESSED -> EVIDENCE_REQUIRED) with every other state descending from it. With NOT_REQUIRED declared initial, TEN OF ELEVEN states were unreachable from the machine's own start and NOT_REQUIRED was isolated (no in-arrow, no out-arrow) — read literally, a PWU could never become assured. The declaration was wrong and the engine was right; this makes them agree."
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
			{
				from: 'UNKNOWN',
				to: 'PRESERVED',
				trigger: 'shape validated / shape readiness satisfied',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'PRESERVED',
				to: 'AT_RISK',
				trigger: 'material assumption falsified / drift detected (SHAPE_RISK observation)',
				note: 'RECONSTRUCTED; §39 Scenario 2: falsified assumption → AT_RISK or VIOLATED.'
			},
			{
				from: 'PRESERVED',
				to: 'VIOLATED',
				trigger: 'shape-integrity violation / obligation loss / constraint erosion',
				note: 'RECONSTRUCTED; §39 Scenario 2. Both named from-states are in the states list.'
			},
			{
				from: 'AT_RISK',
				to: 'VIOLATED',
				trigger: 'shape-integrity violation / obligation loss / constraint erosion',
				note: 'RECONSTRUCTED; §39 Scenario 2. Both named from-states are in the states list.'
			},
			{ from: 'AT_RISK', to: 'PRESERVED', trigger: 'risk cleared', note: 'RECONSTRUCTED' },
			{
				from: 'VIOLATED',
				to: 'RESHAPING_REQUIRED',
				trigger: 'controller selects RESHAPE (§37)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'RESHAPING_REQUIRED',
				to: 'RESHAPING_IN_PROGRESS',
				trigger: 'PwuReshapingStarted',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'RESHAPING_IN_PROGRESS',
				to: 'RESTORED',
				trigger: 'reshape complete',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'RESTORED',
				to: 'PRESERVED',
				trigger: 're-validated',
				note: 'RECONSTRUCTED. Makes RESTORED non-terminal (conflicts with PWU-AXES extraction which marked RESTORED terminal — see conflicts).'
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §7.5 enum (VERBATIM). NO from→to matrix; transitions RECONSTRUCTED from enum semantics + §39 Scenario 2 + §29 + failure taxonomy §36.1.'
	},
	'Obligation.status': {
		name: 'Obligation.status',
		states: ['PROPOSED', 'ACTIVE', 'ALLOCATED', 'SATISFIED', 'WAIVED', 'VIOLATED', 'SUPERSEDED'],
		initialState: 'PROPOSED',
		terminalStates: ['SATISFIED', 'WAIVED', 'VIOLATED', 'SUPERSEDED'],
		transitions: [
			{
				from: 'PROPOSED',
				to: 'ACTIVE',
				trigger: 'obligation activated/accepted',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ACTIVE',
				to: 'ALLOCATED',
				trigger: 'ObligationAllocated',
				guard:
					'explicit allocation to a child PWU — a child may satisfy a parent obligation only through explicit allocation (§10.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ACTIVE',
				to: 'SATISFIED',
				trigger: 'ObligationSatisfied',
				guard: 'requires a supported claim — NOT merely because a related PWU is completed (§10.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ALLOCATED',
				to: 'SATISFIED',
				trigger: 'ObligationSatisfied',
				guard: 'requires a supported claim — NOT merely because a related PWU is completed (§10.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ACTIVE',
				to: 'WAIVED',
				trigger: 'ObligationWaived',
				guard: 'a waived mandatory obligation requires an authorized waiver (§10.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ALLOCATED',
				to: 'WAIVED',
				trigger: 'ObligationWaived',
				guard: 'a waived mandatory obligation requires an authorized waiver (§10.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ACTIVE',
				to: 'VIOLATED',
				trigger: 'ObligationViolated',
				guard: 'a violated obligation must affect assurance disposition (§10.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ALLOCATED',
				to: 'VIOLATED',
				trigger: 'ObligationViolated',
				guard: 'a violated obligation must affect assurance disposition (§10.2)',
				note: 'RECONSTRUCTED'
			},
			{ from: 'ACTIVE', to: 'SUPERSEDED', trigger: 'obligation superseded', note: 'RECONSTRUCTED' },
			{
				from: 'ALLOCATED',
				to: 'SUPERSEDED',
				trigger: 'obligation superseded',
				note: 'RECONSTRUCTED'
			}
		],
		illegal: [],
		guarded: [
			{
				from: 'ACTIVE',
				to: 'SATISFIED',
				reason:
					'§10.2: an obligation cannot become SATISFIED solely because a related PWU is completed; satisfaction requires a supported claim (conditional guard on the legal ACTIVE→SATISFIED edge, not an unconditional prohibition).'
			}
		],
		sourceSection:
			'core-model doc §10.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.3 events + §10.2 invariants. NO explicit matrix.'
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
			{
				from: 'PROPOSED',
				to: 'ACTIVE',
				trigger: 'ConstraintAdded / activated',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ACTIVE',
				to: 'WAIVED',
				trigger: 'ConstraintWaived',
				guard: 'waived through authority (§11.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ACTIVE',
				to: 'INAPPLICABLE',
				trigger: 'ConstraintDeclaredInapplicable',
				guard: 'marked inapplicable with rationale (§11.2)',
				note: 'RECONSTRUCTED'
			},
			{ from: 'ACTIVE', to: 'VIOLATED', trigger: 'ConstraintViolated', note: 'RECONSTRUCTED' },
			{
				from: 'ACTIVE',
				to: 'SUPERSEDED',
				trigger: 'ConstraintSuperseded',
				guard: 'superseded by a stronger constraint (§11.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ACTIVE',
				to: 'INVALIDATED',
				trigger: 'mandatory constraint change / invalidation (§29.1)',
				note: 'RECONSTRUCTED'
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §11.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.3 events + §11.2 propagation rule. NO explicit matrix.'
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
				guard: 'no material assumption may remain embedded only in model prose (§12.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'DISCLOSED',
				to: 'UNDER_VERIFICATION',
				trigger: 'AssumptionVerificationStarted',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'DISCLOSED',
				to: 'ACCEPTED',
				trigger: 'AssumptionAccepted',
				guard:
					'a critical assumption must be explicitly accepted by authority before dependent irreversible work; ACCEPTED is NOT equivalent to VERIFIED (§12.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_VERIFICATION',
				to: 'ACCEPTED',
				trigger: 'AssumptionAccepted',
				guard:
					'a critical assumption must be explicitly accepted by authority before dependent irreversible work; ACCEPTED is NOT equivalent to VERIFIED (§12.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_VERIFICATION',
				to: 'VERIFIED',
				trigger: 'AssumptionVerified',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'DISCLOSED',
				to: 'FALSIFIED',
				trigger: 'AssumptionFalsified',
				guard:
					'falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2)',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'UNDER_VERIFICATION',
				to: 'FALSIFIED',
				trigger: 'AssumptionFalsified',
				guard:
					'falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2)',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'ACCEPTED',
				to: 'FALSIFIED',
				trigger: 'AssumptionFalsified',
				guard:
					'falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2)',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'VERIFIED',
				to: 'FALSIFIED',
				trigger: 'AssumptionFalsified',
				guard:
					'falsification triggers impact analysis (§12.2); drives PWU.shapeIntegrityState to AT_RISK/VIOLATED (§39 Scenario 2)',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'PROPOSED',
				to: 'EXPIRED',
				trigger: 'AssumptionExpired',
				guard:
					'expirationCondition met; expired assumptions cannot continue authorizing work (§12.2)',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'DISCLOSED',
				to: 'EXPIRED',
				trigger: 'AssumptionExpired',
				guard:
					'expirationCondition met; expired assumptions cannot continue authorizing work (§12.2)',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'UNDER_VERIFICATION',
				to: 'EXPIRED',
				trigger: 'AssumptionExpired',
				guard:
					'expirationCondition met; expired assumptions cannot continue authorizing work (§12.2)',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'ACCEPTED',
				to: 'EXPIRED',
				trigger: 'AssumptionExpired',
				guard:
					'expirationCondition met; expired assumptions cannot continue authorizing work (§12.2)',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'PROPOSED',
				to: 'SUPERSEDED',
				trigger: 'assumption superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'DISCLOSED',
				to: 'SUPERSEDED',
				trigger: 'assumption superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'UNDER_VERIFICATION',
				to: 'SUPERSEDED',
				trigger: 'assumption superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'ACCEPTED',
				to: 'SUPERSEDED',
				trigger: 'assumption superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §12.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.3 events + §12.2 invariants. NO explicit matrix.'
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
				trigger: 'proposeDecomposition / DecompositionProposed',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_REVIEW',
				to: 'VALID',
				trigger: 'validateDecomposition / DecompositionValidated',
				guard:
					'obligations allocated/retained, mandatory constraints propagated, siblings explicit; independent validation for high-risk work (§13.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_REVIEW',
				to: 'CONDITIONALLY_VALID',
				trigger: 'validateDecomposition (conditional)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_REVIEW',
				to: 'INVALID',
				trigger: 'DecompositionRejected',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'VALID',
				to: 'SUPERSEDED',
				trigger: 'reviseDecomposition / DecompositionRevised',
				guard: 'revision preserves parent identity but increments semantic version (§13.2)',
				note: 'RECONSTRUCTED; a revision supersedes the prior contract. All three named from-states are in the states list.'
			},
			{
				from: 'CONDITIONALLY_VALID',
				to: 'SUPERSEDED',
				trigger: 'reviseDecomposition / DecompositionRevised',
				guard: 'revision preserves parent identity but increments semantic version (§13.2)',
				note: 'RECONSTRUCTED; a revision supersedes the prior contract. All three named from-states are in the states list.'
			},
			{
				from: 'INVALID',
				to: 'SUPERSEDED',
				trigger: 'reviseDecomposition / DecompositionRevised',
				guard: 'revision preserves parent identity but increments semantic version (§13.2)',
				note: 'RECONSTRUCTED; a revision supersedes the prior contract. All three named from-states are in the states list.'
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §13.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.2 events + §34.1 commands + §13.2 invariants. NO explicit matrix.'
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
					'all required children satisfied/conditionally-satisfied/waived/superseded via authorized decision (§14.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'READY',
				to: 'EVALUATING',
				trigger: 'beginRecomposition / RecompositionStarted',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'EVALUATING',
				to: 'COMPOSABLE',
				trigger: 'no contradiction found; parent constraints hold against recomposed result',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'EVALUATING',
				to: 'CONFLICTED',
				trigger: 'RecompositionConflictDetected',
				guard: 'recomposition may fail even when all children individually satisfied (§14.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'EVALUATING',
				to: 'INSUFFICIENT',
				trigger: 'RecompositionFailed (child evidence does not support the parent claim)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'COMPOSABLE',
				to: 'SATISFIED',
				trigger: 'completeRecomposition / RecompositionCompleted',
				guard: 'a recomposed result requires an explicit assessment (§14.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'CONFLICTED',
				to: 'EVALUATING',
				trigger: 're-evaluation after remediation',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'INSUFFICIENT',
				to: 'EVALUATING',
				trigger: 're-evaluation after remediation',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'DRAFT',
				to: 'SUPERSEDED',
				trigger: 'contract superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'READY',
				to: 'SUPERSEDED',
				trigger: 'contract superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'EVALUATING',
				to: 'SUPERSEDED',
				trigger: 'contract superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'COMPOSABLE',
				to: 'SUPERSEDED',
				trigger: 'contract superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'CONFLICTED',
				to: 'SUPERSEDED',
				trigger: 'contract superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'INSUFFICIENT',
				to: 'SUPERSEDED',
				trigger: 'contract superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §14 enum (VERBATIM). Transitions RECONSTRUCTED from §26.2 events + §34.1 commands + §14.1 invariants. NO explicit matrix.'
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
				guard: 'a claim must have a subject (§15.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_ASSESSMENT',
				to: 'SUPPORTED',
				trigger: 'ClaimSupported',
				guard:
					'must reference admissible evidence; confidence values must not replace evidence (§15.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_ASSESSMENT',
				to: 'CONDITIONALLY_SUPPORTED',
				trigger: 'conditional assessment disposition',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_ASSESSMENT',
				to: 'CONTESTED',
				trigger: 'ClaimContested / EvidenceInvalidated (dependent supported claim)',
				guard: 'contradicting evidence must remain visible (§15.2)',
				note: 'RECONSTRUCTED; §35.1: if supporting evidence is invalidated the claim must become CONTESTED/under-review/invalidated. All three named from-states are in the states list.'
			},
			{
				from: 'SUPPORTED',
				to: 'CONTESTED',
				trigger: 'ClaimContested / EvidenceInvalidated (dependent supported claim)',
				guard: 'contradicting evidence must remain visible (§15.2)',
				note: 'RECONSTRUCTED; §35.1: if supporting evidence is invalidated the claim must become CONTESTED/under-review/invalidated. All three named from-states are in the states list.'
			},
			{
				from: 'CONDITIONALLY_SUPPORTED',
				to: 'CONTESTED',
				trigger: 'ClaimContested / EvidenceInvalidated (dependent supported claim)',
				guard: 'contradicting evidence must remain visible (§15.2)',
				note: 'RECONSTRUCTED; §35.1: if supporting evidence is invalidated the claim must become CONTESTED/under-review/invalidated. All three named from-states are in the states list.'
			},
			{
				from: 'UNDER_ASSESSMENT',
				to: 'REJECTED',
				trigger: 'ClaimRejected',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'CONTESTED',
				to: 'REJECTED',
				trigger: 'ClaimRejected',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'CONTESTED',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'UNDER_ASSESSMENT',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'OPEN',
				to: 'SUPERSEDED',
				trigger: 'claim superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'UNDER_ASSESSMENT',
				to: 'SUPERSEDED',
				trigger: 'claim superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'SUPPORTED',
				to: 'SUPERSEDED',
				trigger: 'claim superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'CONDITIONALLY_SUPPORTED',
				to: 'SUPERSEDED',
				trigger: 'claim superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'CONTESTED',
				to: 'SUPERSEDED',
				trigger: 'claim superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §15.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.5 events + §34.2 commands + §15.2/§35.1 invariants. NO explicit matrix.'
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
				guard: 'evidence must have provenance and state scope + limitations (§16.2)',
				note: 'RECONSTRUCTED'
			},
			{ from: 'PROPOSED', to: 'REJECTED', trigger: 'EvidenceRejected', note: 'RECONSTRUCTED' },
			{
				from: 'ADMISSIBLE',
				to: 'INVALIDATED',
				trigger: 'invalidateEvidence / EvidenceInvalidated / EvidenceExpired',
				guard:
					'invalidated evidence cannot support an active claim; expiration triggers reassessment of dependent claims (§16.2)',
				note: 'RECONSTRUCTED; the EvidenceExpired event has no matching EXPIRED status — see open items.'
			},
			{
				from: 'ADMISSIBLE',
				to: 'SUPERSEDED',
				trigger: 'correction creates a new version (evidence immutability preferred, §16.2)',
				note: 'RECONSTRUCTED'
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §16.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.5 events + §34.2 commands + §16.2 invariants. NO explicit matrix.'
	},
	'AssurancePolicy.status': {
		name: 'AssurancePolicy.status',
		states: ['DRAFT', 'ACTIVE', 'SUSPENDED', 'SUPERSEDED'],
		initialState: 'DRAFT',
		terminalStates: ['SUPERSEDED'],
		transitions: [
			{ from: 'DRAFT', to: 'ACTIVE', trigger: 'policy activated', note: 'RECONSTRUCTED' },
			{ from: 'ACTIVE', to: 'SUSPENDED', trigger: 'policy suspended', note: 'RECONSTRUCTED' },
			{ from: 'SUSPENDED', to: 'ACTIVE', trigger: 'policy resumed', note: 'RECONSTRUCTED' },
			{
				from: 'ACTIVE',
				to: 'SUPERSEDED',
				trigger: 'new policy version supersedes (assessments pin policySemanticVersion, §18)',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'SUSPENDED',
				to: 'SUPERSEDED',
				trigger: 'new policy version supersedes (assessments pin policySemanticVersion, §18)',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			"core-model doc §17.1 enum + assurance doc §3.1 enum (both VERBATIM, same states). NO lifecycle events in either doc's §26; transitions RECONSTRUCTED from enum semantics."
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
				guard: 'independence requirements must be checked BEFORE evaluation begins (§18.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'SATISFIED',
				trigger: 'completeAssuranceAssessment / AssuranceAssessmentSatisfied',
				guard:
					'must identify policy version used, evidence considered, and criteria met (§18.1) — must NOT be forced by executionState=SUCCEEDED (P1/INV-5)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'CONDITIONALLY_SATISFIED',
				trigger: 'AssuranceAssessmentConditionallySatisfied',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'REJECTED',
				trigger: 'AssuranceAssessmentRejected',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'INCONCLUSIVE',
				trigger: 'AssuranceAssessmentInconclusive',
				guard: 'an inconclusive disposition cannot be treated as satisfied (§18.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'ESCALATED',
				trigger: 'AssuranceAssessmentEscalated',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'ASSESSING',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard:
					'a policy cannot waive its own blocking finding unless waiver authority is separately defined (§18.1)',
				note: 'RECONSTRUCTED. All three named from-states are in the states list.'
			},
			{
				from: 'INCONCLUSIVE',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard:
					'a policy cannot waive its own blocking finding unless waiver authority is separately defined (§18.1)',
				note: 'RECONSTRUCTED. All three named from-states are in the states list.'
			},
			{
				from: 'ESCALATED',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard:
					'a policy cannot waive its own blocking finding unless waiver authority is separately defined (§18.1)',
				note: 'RECONSTRUCTED. All three named from-states are in the states list.'
			}
		],
		illegal: [
			{
				from: 'INCONCLUSIVE',
				to: 'SATISFIED',
				reason: '§18.1: an inconclusive disposition cannot be treated as satisfied.'
			}
		],
		guarded: [],
		sourceSection:
			'core-model doc §18 enum (VERBATIM). Transitions RECONSTRUCTED from §26.5 events + §34.2 commands + §18.1 invariants. NO explicit matrix.'
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
				guard: 'one or more required EvidenceRequirements not yet satisfied',
				note: '§30 linear happy-path chain; §29 pipeline.'
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'READY',
				trigger: 'submitEvidenceForAssessment (AssuranceEvidenceReceived)',
				guard:
					'all required evidence present and admissible per §6.2 (identity stable, provenance present, in-scope, not invalidated, sufficiently current, relevant)',
				note: '§30. READY = evidence satisfied + validator selected + independence checked, pre-execution.'
			},
			{
				from: 'READY',
				to: 'ASSESSING',
				trigger:
					'selectAssuranceEvaluator (AssuranceEvaluatorSelected) then beginAssuranceAssessment (AssuranceAssessmentStarted)',
				guard:
					'validator selected AND required independence verified (AssuranceIndependenceVerified) AND context assembled',
				note: '§30 / §29 pipeline: validator selected → independence checked → context assembled → validator executes.'
			},
			{
				from: 'ASSESSING',
				to: 'SATISFIED',
				trigger: 'completeAssuranceAssessment (AssuranceAssessmentSatisfied)',
				guard:
					'all mandatory criteria MET; no open BLOCKING/CRITICAL finding; required independence verified (§8.4, INV-8); every satisfied claim references admissible evidence (INV-3); required evidence admissible (§10.3, §15.9)',
				note: '§30. Authoritative disposition set by the Assurance Service, NOT by the validator recommendation (§4.2).'
			},
			{
				from: 'ASSESSING',
				to: 'CONDITIONALLY_SATISFIED',
				trigger: 'completeAssuranceAssessment (AssuranceAssessmentConditionallySatisfied)',
				guard:
					'claims supportable only if explicit conditions remain true or required follow-up occurs; typically an open MATERIAL finding (§10.1, §10.3)',
				note: '§30'
			},
			{
				from: 'ASSESSING',
				to: 'REJECTED',
				trigger: 'completeAssuranceAssessment (AssuranceAssessmentRejected)',
				guard:
					'open CRITICAL finding (→REJECTED or ESCALATED) OR open BLOCKING finding OR a material claim unsupported/contradicted/violates a blocking criterion (§10.1, §10.3, INV-11)',
				note: '§30'
			},
			{
				from: 'ASSESSING',
				to: 'INCONCLUSIVE',
				trigger: 'completeAssuranceAssessment (AssuranceAssessmentInconclusive)',
				guard:
					'available admissible evidence insufficient to support or reject the claim; evidence deficit (§10.1, §10.3); also on evidence access failure (§34.3)',
				note: '§30'
			},
			{
				from: 'ASSESSING',
				to: 'ESCALATED',
				trigger:
					'completeAssuranceAssessment (AssuranceAssessmentEscalated); EscalationRule.trigger fires (§13)',
				guard:
					'validator or policy cannot resolve the issue within its authority/competence (§10.1); may also be the disposition for an open CRITICAL finding (§10.3)',
				note: '§30'
			},
			{
				from: 'ASSESSING',
				to: 'WAIVED',
				trigger: 'requestAssuranceWaiver (WaiverRequested) → grantAssuranceWaiver (WaiverGranted)',
				guard:
					'WaiverRule.waiverAllowed; criterion ∈ eligibleCriteriaIds; finding severity ∉ prohibitedFindingSeverities; required authority present; rationale/compensating controls recorded (§12). NOT waivable: unauthorized intent alteration (§15.11), critical baseline-integrity failures by ordinary authority (§26.7)',
				note: '§30 lists WAIVED as a direct ASSESSING outcome. WaiverDenied (denyAssuranceWaiver) leaves the prior disposition unchanged (no drawn edge). A waiver never erases a finding (INV-13).'
			},
			{
				from: 'ASSESSING',
				to: 'VALIDATOR_FAILED',
				trigger: 'validator execution failure (§34.1)',
				guard: 'validator crashed / timed out / errored during execution',
				note: '§30. INV-9: a validator failure is NOT an assurance rejection. Next action = RETRY / alternate validator / ESCALATE (spawns a new assessment).'
			},
			{
				from: 'ASSESSING',
				to: 'INDEPENDENCE_VIOLATION',
				trigger:
					'AssuranceIndependenceViolated — required IndependenceRequirement not satisfied (§8.4)',
				guard:
					"producer and evaluator share invocation/agent/model/provider/hidden-context/prompt-lineage/authority in violation of policy's IndependenceRequirement (§8.2)",
				note: '§30. Creates an Independence Violation Observation; another evaluator must be invoked or a waiver obtained (§8.4). Cannot receive SATISFIED (INV-8).'
			},
			{
				from: 'ASSESSING',
				to: 'EVIDENCE_PENDING',
				trigger: 'evidence access failure — required evidence cannot be retrieved (§34.3)',
				guard: 'required evidence becomes unavailable during assessment',
				note: 'NOT drawn in the §30 diagram; grounded in §34.3 (disposition becomes EVIDENCE_PENDING or INCONCLUSIVE; do not infer evidence content).'
			},
			{
				from: 'SATISFIED',
				to: 'INVALIDATED',
				trigger: 'invalidateAssuranceAssessment (AssuranceAssessmentInvalidated)',
				guard:
					'subject semantic version changed (INV-16) OR supporting evidence invalidated (INV-15)',
				note: '§30. Triggers reassessment of dependent claims; a fresh assessment must run — not a self-revert to SATISFIED.'
			},
			{
				from: 'CONDITIONALLY_SATISFIED',
				to: 'INVALIDATED',
				trigger: 'invalidateAssuranceAssessment (AssuranceAssessmentInvalidated)',
				guard:
					'subject semantic version changed (INV-16) OR supporting evidence invalidated (INV-15) OR a required condition ceased to hold',
				note: '§30'
			},
			{
				from: 'WAIVED',
				to: 'WAIVER_EXPIRED',
				trigger: 'expireAssuranceWaiver (WaiverExpired)',
				guard:
					'WaiverRule.maximumDuration / recorded expiration reached, OR revalidationTrigger fired, OR a new subject semantic version (waiver does not apply to future semantic versions unless explicitly renewed — §12.2, INV-14)',
				note: '§30'
			},
			{
				from: 'REQUESTED',
				to: 'CANCELLED',
				trigger: 'cancelAssuranceAssessment (AssuranceAssessmentCancelled)',
				guard: 'the assessment is ACTIVE — it has not reached a disposition',
				note: 'DELIVERED 2026-08-05 (REG-F-021 residual R-1), and its ACCOUNT CORRECTED 2026-08-05 (REG-F-025) — the correction is kept here because the wrong account is the more instructive half.\n\nWHAT WAS TRUE: DOC-004 §30\'s "Alternate transitions" block ratifies SIX arrows, and the sixth — `ANY ACTIVE → CANCELLED` — did not reach the machine. CANCELLED sat declared, TERMINAL, and reachable by nothing: an ending nothing could end at, and the reason an assessment stalled in EVIDENCE_PENDING could not be closed by any means.\n\nWHAT WAS WRONG: the arrow was NOT lost in transcription. It was transcribed, at this exact spot, spelled `ANY_ACTIVE`, carrying a note stating its own intended expansion — and it had been here since the workbench arrived in the repository (19a1b20f). `gen-transitions.ts` recognises the quantifier spelled `Any active`, with a SPACE; `ANY_ACTIVE` matched nothing, fell through to the literal branch, failed the state-set test, and was FILTERED OUT SILENTLY. The corpus said it, the vocab carried it, and the build dropped it — in the one place nobody looked, between two artifacts each individually correct.\n\nWHY THE FIX IS FOUR LITERAL ROWS AND NOT A LOOSER MATCHER: `expandFrom` implements "any active" as states MINUS terminalStates. Here those partitions DIFFER. SATISFIED, CONDITIONALLY_SATISFIED and WAIVED are non-terminal — each can still leave, via INVALIDATED or WAIVER_EXPIRED — but they are not ACTIVE; they are verdicts. Teaching the matcher to accept `ANY_ACTIVE` would have minted SATISFIED → CANCELLED and two more like it: cancelling an assessment that has already concluded, which §30 does not ratify. The silent drop was, by accident, the only thing keeping this machine honest.\n\nACTIVE = the four states before an outcome is reached (REQUESTED, EVIDENCE_PENDING, READY, ASSESSING) — the same partition `assessmentHasConcluded` uses for baseline promotion, derived independently there and agreeing here.\n\nIT CORRECTS AN AUTHORED JUDGEMENT OF MINE. The design proposed cancellation from the three PRE-ASSESSING states only, reasoning that an assessment being judged should reach a disposition and INCONCLUSIVE exists for "could not decide". The corpus says ANY ACTIVE, which includes ASSESSING. The ratified rule is broader than the rule I was about to author, and it wins.'
			},
			{
				from: 'EVIDENCE_PENDING',
				to: 'CANCELLED',
				trigger: 'cancelAssuranceAssessment (AssuranceAssessmentCancelled)',
				guard: 'the assessment is ACTIVE — it has not reached a disposition',
				note: "See the REQUESTED -> CANCELLED row: one of the four arms of §30's ratified `ANY ACTIVE → CANCELLED`."
			},
			{
				from: 'READY',
				to: 'CANCELLED',
				trigger: 'cancelAssuranceAssessment (AssuranceAssessmentCancelled)',
				guard: 'the assessment is ACTIVE — it has not reached a disposition',
				note: "See the REQUESTED -> CANCELLED row: one of the four arms of §30's ratified `ANY ACTIVE → CANCELLED`."
			},
			{
				from: 'ASSESSING',
				to: 'CANCELLED',
				trigger: 'cancelAssuranceAssessment (AssuranceAssessmentCancelled)',
				guard: 'the assessment is ACTIVE — it has not reached a disposition',
				note: "See the REQUESTED -> CANCELLED row: one of the four arms of §30's ratified `ANY ACTIVE → CANCELLED`."
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
		],
		sourceSection:
			'assurance-service doc §30 (states/transitions, the ONLY object with a drawn FSM in that doc) + §29 pipeline + §31 events + §32 commands + §34 error handling + §8.4 independence + §10 dispositions + §12 waivers + §39 invariants'
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
				trigger: 'observation accepted (residual risk acknowledged)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'OPEN',
				to: 'REMEDIATED',
				trigger: 'remediation applied',
				guard:
					'assurance observations must REMAIN VISIBLE after remediation — the observation is not deleted (§18.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'OPEN',
				to: 'WAIVED',
				trigger: 'WaiverGranted',
				guard:
					'waiver includes scope, rationale, authority, duration; human override must not erase prior findings (§23.2, Scenario 4)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'OPEN',
				to: 'REJECTED',
				trigger: 'observation dismissed/rejected',
				note: 'RECONSTRUCTED'
			},
			{ from: 'OPEN', to: 'SUPERSEDED', trigger: 'observation superseded', note: 'RECONSTRUCTED' }
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §19 enum (VERBATIM). Transitions RECONSTRUCTED from §26.5 + §34.2 + §18.1/§24.2 invariants. NO explicit matrix.'
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
				trigger: 'proposeExecutionPlan / ExecutionPlanProposed then submitted for review',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_REVIEW',
				to: 'APPROVED',
				trigger: 'approveExecutionPlan / ExecutionPlanApproved',
				guard:
					'plan approval required before irreversible execution for high-risk work; approval grants NO runtime privileges (§20.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'APPROVED',
				to: 'ACTIVE',
				trigger: 'activateExecutionPlan / ExecutionPlanActivated',
				guard:
					'a PWU may have only ONE active plan at a time; an active plan references exactly one PWU (§20.2)',
				note: 'RECONSTRUCTED'
			},
			{ from: 'ACTIVE', to: 'COMPLETED', trigger: 'all steps succeeded', note: 'RECONSTRUCTED' },
			{
				from: 'ACTIVE',
				to: 'FAILED',
				trigger: 'ExecutionTerminated / unrecoverable failure',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'APPROVED',
				to: 'CANCELLED',
				trigger: 'cancelExecutionPlan',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'ACTIVE',
				to: 'CANCELLED',
				trigger: 'cancelExecutionPlan',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'PROPOSED',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded (plan revision)',
				guard: 'plan revision preserves prior attempt history (§20.2)',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'UNDER_REVIEW',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded (plan revision)',
				guard: 'plan revision preserves prior attempt history (§20.2)',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'APPROVED',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded (plan revision)',
				guard: 'plan revision preserves prior attempt history (§20.2)',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'ACTIVE',
				to: 'SUPERSEDED',
				trigger: 'ExecutionPlanSuperseded (plan revision)',
				guard: 'plan revision preserves prior attempt history (§20.2)',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §20.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.4 events + §34.3 commands + §20.2 invariants. NO explicit matrix.'
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
				guard: 'a step cannot run until preconditions are satisfied (§21.1)',
				note: 'RECONSTRUCTED'
			},
			{ from: 'READY', to: 'QUEUED', trigger: 'step scheduled', note: 'RECONSTRUCTED' },
			{
				from: 'QUEUED',
				to: 'RUNNING',
				trigger: 'startExecutionStep / ExecutionStepStarted',
				note: 'RECONSTRUCTED'
			},
			{ from: 'RUNNING', to: 'WAITING', trigger: 'ExecutionStepWaiting', note: 'RECONSTRUCTED' },
			{ from: 'WAITING', to: 'RUNNING', trigger: 'wait resolved', note: 'RECONSTRUCTED' },
			{
				from: 'RUNNING',
				to: 'SUCCEEDED',
				trigger: 'completeExecutionStep / ExecutionStepSucceeded',
				guard:
					'must record outputs or an explicit no-output result; step success does NOT imply PWU success (§21.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'RUNNING',
				to: 'FAILED',
				trigger: 'failExecutionStep / ExecutionStepFailed',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'FAILED',
				to: 'QUEUED',
				trigger: 'retryExecutionStep / ExecutionStepRetried',
				note: 'RECONSTRUCTED; retry re-queues the step.'
			},
			{
				from: 'READY',
				to: 'SKIPPED',
				trigger: 'ExecutionStepSkipped',
				guard: 'a skipped MANDATORY step requires an authorized plan revision or waiver (§21.1)',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'QUEUED',
				to: 'SKIPPED',
				trigger: 'ExecutionStepSkipped',
				guard: 'a skipped MANDATORY step requires an authorized plan revision or waiver (§21.1)',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'NOT_READY',
				to: 'SKIPPED',
				trigger: 'pruneExecutionStep / ExecutionStepPruned (not-taken/unreachable arm)',
				note: "A not-taken BRANCH arm that never became READY is prunable to SKIPPED — a SYSTEM prune authorized by the plan's own branch logic (no waiver; distinct from the waiver-gated READY/QUEUED skip, which skipExecutionStep.requireFrom keeps to READY|QUEUED). Without this arrow an excluded NOT_READY step can never reach terminal-success and the plan deadlocks (D5); pruneExecutionStep declares NOT_READY in drivesFrom, so INV-4 requires the machine's SKIPPED in-arrows to include it. Added by the JAN-CMDPRE post-build adversarial review (2026-07-24)."
			},
			{
				from: 'READY',
				to: 'CANCELLED',
				trigger: 'ExecutionStepCancelled',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'QUEUED',
				to: 'CANCELLED',
				trigger: 'ExecutionStepCancelled',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'RUNNING',
				to: 'CANCELLED',
				trigger: 'ExecutionStepCancelled',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'WAITING',
				to: 'CANCELLED',
				trigger: 'ExecutionStepCancelled',
				note: 'RECONSTRUCTED. All four named from-states are in the states list.'
			},
			{
				from: 'FAILED',
				to: 'CANCELLED',
				trigger: 'cancelExecutionStep / ExecutionStepCancelled',
				note: "AUTHORED (JAN-EXECREM WP-5). ABANDONING a failed arm is an explicit, governed act. WP-4 made a FAILED in-edge PENDING (FAILED is the only terminal state the machine can leave, so it has not settled) which correctly stops a JOIN releasing around a failure — but that removed the ability to proceed past an arm nobody intends to retry. This arrow restores it WITHOUT restoring the defect: an operator who will not retry CANCELS, which records the abandonment and its reason in the governed stream; the in-edge then reads NEUTRALIZED (CANCELLED is irrecoverable), the join releases if another arm delivered, and the abandoned arm's own downstream becomes structurally dead and prunable. Silence is never taken as abandonment."
			},
			{
				from: 'NOT_READY',
				to: 'SUPERSEDED',
				trigger: 'plan revised/superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'READY',
				to: 'SUPERSEDED',
				trigger: 'plan revised/superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'QUEUED',
				to: 'SUPERSEDED',
				trigger: 'plan revised/superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'RUNNING',
				to: 'SUPERSEDED',
				trigger: 'plan revised/superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			},
			{
				from: 'WAITING',
				to: 'SUPERSEDED',
				trigger: 'plan revised/superseded',
				note: "RECONSTRUCTED. 'Any active' = any non-terminal state."
			}
		],
		illegal: [
			{
				from: 'NOT_READY',
				to: 'RUNNING',
				reason:
					'§21.1: a step cannot run until preconditions are satisfied — must pass through READY.'
			}
		],
		guarded: [],
		sourceSection:
			'core-model doc §21 enum (VERBATIM). Transitions RECONSTRUCTED from §26.4 events + §34.3 commands + §21.1 invariants. NO explicit matrix.'
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
					'requested capability is NOT granted capability; capability scope must be explicit (§22.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'REQUESTED',
				to: 'PARTIALLY_AUTHORIZED',
				trigger: 'partial grant',
				note: 'RECONSTRUCTED'
			},
			{ from: 'REQUESTED', to: 'DENIED', trigger: 'RuntimeBindingDenied', note: 'RECONSTRUCTED' },
			{
				from: 'PARTIALLY_AUTHORIZED',
				to: 'AUTHORIZED',
				trigger: 'new authorization event (privilege expansion)',
				guard: 'privilege expansion requires a NEW authorization event (§22.1)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'AUTHORIZED',
				to: 'REVOKED',
				trigger: 'RuntimeCapabilityRevoked',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'PARTIALLY_AUTHORIZED',
				to: 'REVOKED',
				trigger: 'RuntimeCapabilityRevoked',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §22 enum (VERBATIM). Transitions RECONSTRUCTED from §26.4 events + §22.1 invariants. NO explicit matrix.'
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
					'approval requires authority; an agent may recommend but cannot exercise authority unless delegated (§23.2)',
				note: 'RECONSTRUCTED; DecisionApproved and DecisionEffective both map onto the EFFECTIVE status.'
			},
			{
				from: 'EFFECTIVE',
				to: 'REVOKED',
				trigger: 'revokeDecision / DecisionRevoked',
				guard:
					'revocation triggers impact analysis; a decision cannot retroactively change evidence (§23.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'PROPOSED',
				to: 'SUPERSEDED',
				trigger: 'DecisionRejected / decision superseded',
				note: 'RECONSTRUCTED; DecisionRejected has no matching status value — see open items.'
			},
			{ from: 'EFFECTIVE', to: 'SUPERSEDED', trigger: 'decision superseded', note: 'RECONSTRUCTED' }
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'core-model doc §23.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.6 events + §34.4 commands + §23.2 invariants. NO explicit matrix.'
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
			{
				from: 'DRAFT',
				to: 'CANDIDATE',
				trigger: 'BaselineCreated / nominated as candidate',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'CANDIDATE',
				to: 'UNDER_REVIEW',
				trigger: 'BaselineSubmittedForReview',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'UNDER_REVIEW',
				to: 'APPROVED',
				trigger: 'BaselineApproved',
				guard: 'open BLOCKING observations prevent promotion unless waived (§24.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'APPROVED',
				to: 'AUTHORITATIVE',
				trigger: 'promoteBaseline / BaselinePromoted',
				guard:
					'requires an explicit EFFECTIVE promotion decision (§23.2, §24.2); promotion evidence must be retained; promotion is a governance event, not an execution step (§24.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'AUTHORITATIVE',
				to: 'SUPERSEDED',
				trigger: 'supersedeBaseline / BaselineSuperseded',
				guard:
					'an authoritative baseline is immutable — changes create a SUCCESSOR baseline; supersession preserves traceability (§24.2)',
				note: 'RECONSTRUCTED'
			},
			{
				from: 'APPROVED',
				to: 'REVOKED',
				trigger: 'BaselineRevoked',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			},
			{
				from: 'AUTHORITATIVE',
				to: 'REVOKED',
				trigger: 'BaselineRevoked',
				note: 'RECONSTRUCTED. Both named from-states are in the states list.'
			}
		],
		illegal: [
			{
				from: 'UNDER_REVIEW',
				to: 'AUTHORITATIVE',
				reason:
					"§24.2 + §35.1 'No unauthorized baseline': a baseline cannot become AUTHORITATIVE without an effective promotion decision (must be APPROVED + carry a promotion decision); open blocking observations block promotion unless waived."
			},
			{
				from: 'AUTHORITATIVE',
				to: 'AUTHORITATIVE',
				reason:
					'§24.2: an authoritative baseline is IMMUTABLE — it cannot be re-promoted/mutated in place; changes create a successor baseline.'
			}
		],
		guarded: [],
		sourceSection:
			'core-model doc §24.1 enum (VERBATIM). Transitions RECONSTRUCTED from §26.6 events + §34.4 commands + §24.2 invariants. NO explicit matrix.'
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
		guarded: [],
		sourceSection:
			"assurance-service doc §28.2 (aggregate disposition) + §28.1 (composition rules). 'This must not be reduced to a numerical average.'"
	},
	'ValidatorRegistryEntry.status': {
		name: 'ValidatorRegistryEntry.status',
		states: ['ACTIVE', 'DEGRADED', 'DISABLED'],
		initialState: 'ACTIVE',
		terminalStates: [],
		transitions: [
			{
				from: 'ACTIVE',
				to: 'DEGRADED',
				trigger: 'MarkValidatorDegraded',
				guard: 'a validator execution failure was observed (§34.1)',
				note: '§30 records that an ASSESSMENT failed (ASSESSING → VALIDATOR_FAILED); THIS records that the VALIDATOR did. A governed act, not an inference from one run — RPH-ASR-006 keeps the two apart.'
			},
			{
				from: 'DEGRADED',
				to: 'ACTIVE',
				trigger: 'RestoreValidator',
				guard: 'recovery confirmed',
				note: 'Degradation must be recoverable or it is disablement under another name.'
			},
			{
				from: 'ACTIVE',
				to: 'DISABLED',
				trigger: 'DisableValidator',
				guard: 'authorized withdrawal',
				note: 'A governance act. §35 makes availability a selection input; DISABLED is what removes an implementation from selection.'
			},
			{
				from: 'DEGRADED',
				to: 'DISABLED',
				trigger: 'DisableValidator',
				guard: 'authorized withdrawal',
				note: '§35\'s table reads "ACTIVE | DEGRADED → DISABLED" — both source states, one trigger.'
			},
			{
				from: 'DISABLED',
				to: 'ACTIVE',
				trigger: 'EnableValidator',
				guard: 'authorized reinstatement',
				note: 'The inverse governance act. Returns to ACTIVE, not DEGRADED: reinstatement asserts fitness.'
			}
		],
		illegal: [],
		guarded: [],
		sourceSection:
			'assurance-service doc §35 enum (VERBATIM). TRANSITIONS DECLARED 2026-08-05 by the §35 §0.3 authored clarification — this note previously read "NO transition table specified in the doc", which was true and was the whole of REG-E-024(c): three declared states with no way to move between them, the last unreachable group in the system.'
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
		guarded: [],
		sourceSection: 'RPH-DOC-010 §20 publication flow'
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
		guarded: [],
		sourceSection: 'RPH-DOC-010 §39'
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
		guarded: [],
		sourceSection: 'RPH-DOC-010 §22/§31'
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
		guarded: [],
		sourceSection:
			'AUTHORED 2026-07-19 (JAN-IRP capability C7 — RPH Coordination and Adaptive Tactics). The durable RPH coordination lifecycle: frame -> plan -> coordinate -> (wait <-> coordinate) -> synthesize -> completed, with ESCALATED/SUSPENDED governance branches and SUPERSEDED on revision. First increment mints in FRAMING; coordination transitions are follow-ons.'
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
