/**
 * Type definitions for the VALIDATE phase Deep Validation Review Subsystem.
 *
 * Pipeline: INGESTING → HYPOTHESIZING → VALIDATING → GRADING → PRESENTING
 */

// ==================== SUB-STATE ENUM ====================

export enum ValidateSubState {
	INGESTING = 'INGESTING',
	HYPOTHESIZING = 'HYPOTHESIZING',
	VALIDATING = 'VALIDATING',
	GRADING = 'GRADING',
	PRESENTING = 'PRESENTING',
}

// ==================== PRIMITIVE TYPES ====================

/** Validation tool used to prove or disprove a hypothesis. */
export type ValidationToolUsed = 'llm_only' | 'dafny' | 'z3' | 'micro_fuzz' | 'sandbox_poc';

/** Outcome of the validation attempt. */
export type ValidationProofStatus = 'proven' | 'disproven' | 'probable' | 'error';

/** Category assigned by the hypothesizer agent. */
export type ValidationCategory = 'security' | 'logic' | 'best_practices';

/** Severity assigned by the hypothesizer agent. */
export type ValidationSeverity = 'critical' | 'high' | 'medium' | 'low';

// ==================== HYPOTHESIS LIFECYCLE ====================

/** Raw hypothesis output from a hypothesizer agent. */
export interface RawHypothesis {
	/** Unique ID within this validation run. */
	id: string;
	/** Human-readable description of the potential issue. */
	text: string;
	/** File path or code location hint (e.g., "src/auth/login.ts:45"). */
	location: string;
	/** Category determines which validation tool will be used. */
	category: ValidationCategory;
	/** Severity influences tool selection (critical → sandbox_poc). */
	severity: ValidationSeverity;
}

/** Hypothesis after the deep validation engine has attempted proof/disproof. */
export interface ValidatedHypothesis extends RawHypothesis {
	/** Tool that was used to validate this hypothesis. */
	tool_used: ValidationToolUsed;
	/** Outcome of the validation attempt. */
	proof_status: ValidationProofStatus;
	/**
	 * Proof artifact text (failing test output, Dafny error, z3 counterexample, etc.).
	 * null if proof_status is 'disproven' or 'error'.
	 */
	proof_artifact: string | null;
}

/** Validated hypothesis after the grader has assigned a confidence score. */
export interface GradedFinding extends ValidatedHypothesis {
	/** Persistent ID for storage and UI feedback. */
	finding_id: string;
	/** Confidence score 0–1 assigned by the grader (hypotheses < 0.6 are suppressed). */
	confidence: number;
}

// ==================== PHASE METADATA ====================

/** Metadata stored in workflow_states for the VALIDATE phase. */
export interface ValidatePhaseMetadata {
	/** Current sub-state of the deep validation pipeline. Undefined until MAKER validation passes. */
	validateSubState?: ValidateSubState;
	/** Files selected for review (populated during INGESTING). */
	targetFiles?: string[];
	/** Assembled context string for hypothesizers (populated during INGESTING). */
	assembledContext?: string;
	/** Raw hypotheses from all three parallel hypothesizer agents. */
	hypotheses?: RawHypothesis[];
	/** Hypotheses after validation engine attempts. */
	validatedHypotheses?: ValidatedHypothesis[];
	/** Final graded findings (confidence ≥ 0.6 only). */
	gradedFindings?: GradedFinding[];
	/** Whether this is an on-demand review (true) or post-MAKER automated review (false). */
	isOnDemand?: boolean;
}
