/**
 * Reasoning Reviewer Types
 *
 * Types for the automated reasoning review system that critiques
 * agent thinking processes after CLI invocations complete.
 */

/** Severity levels for reasoning concerns. */
export type ReviewSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

/** A single concern identified by the reasoning reviewer. */
export interface ReviewConcern {
	/** HIGH = likely to cause failures, MEDIUM = fragile, LOW = minor */
	severity: ReviewSeverity;
	/** One-line description of the concern. */
	summary: string;
	/** Detailed explanation of why this is problematic. */
	detail: string;
	/** Which part of the reasoning this relates to (quote or reference). */
	location: string;
	/** What should be done instead. */
	recommendation: string;
}

/** The complete output of a reasoning review. */
export interface ReasoningReview {
	/** Whether any concerns were found. */
	hasConcerns: boolean;
	/** List of identified concerns, ordered by severity (HIGH first). */
	concerns: ReviewConcern[];
	/** Brief overall quality assessment of the reasoning. */
	overallAssessment: string;
	/** How long the review took in milliseconds. */
	reviewDurationMs: number;
	/** Which model performed the review. */
	reviewerModel: string;
	/** The full prompt sent to the reviewer LLM (system + user message). */
	reviewPrompt?: string;
}

/** Options for the reasoning review invocation. */
export interface ReviewOptions {
	/** The raw streaming output from the CLI (intermediate reasoning + tool calls). */
	rawStreamOutput: string;
	/** The extracted final response from the agent. */
	finalResponse: string;
	/** Which role produced this output (for context in the review). */
	role?: string;
	/** Which phase/sub-phase (for context). */
	phase?: string;
	/** Minimum severity to include in results. */
	minSeverity?: ReviewSeverity;
}
