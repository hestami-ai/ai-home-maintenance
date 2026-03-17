/**
 * Orchestrator Types
 *
 * Defines the plan format that the LLM generates and the executor runs.
 */

/**
 * A single step in an orchestrated plan.
 */
export interface PlanStep {
	/** Unique step ID for result binding (e.g., "s1") */
	id: string;
	/** Primitive ID from the registry (e.g., "state.getOpenGates") */
	primitiveId: string;
	/** Parameters for the primitive.
	 *  Values can be:
	 *  - Literals: "some string", 42, true
	 *  - Bind expressions: "$s1.value.current_phase" (previous step output)
	 *  - Context refs: "$context.dialogueId" */
	params: Record<string, unknown>;
	/** Human-readable reason for this step */
	reason: string;
	/** Optional condition — step is skipped if condition evaluates to false.
	 *  Simple expressions: "$s1.value.length > 0", "$s1.value != null" */
	condition?: string;
}

/**
 * A complete plan composed by the LLM.
 */
export interface Plan {
	/** What the user asked for, in the LLM's words */
	intent: string;
	/** Ordered steps to execute */
	steps: PlanStep[];
	/** Expected outcome description */
	expectedOutcome: string;
}

/**
 * Result of executing a single plan step.
 */
export interface StepExecutionResult {
	stepId: string;
	primitiveId: string;
	success: boolean;
	value?: unknown;
	error?: string;
	/** True if the step's condition evaluated to false */
	skipped?: boolean;
}

/**
 * Result of executing a complete plan.
 */
export interface PlanExecutionResult {
	plan: Plan;
	steps: StepExecutionResult[];
	success: boolean;
	/** Summary message for the user */
	summary: string;
}
