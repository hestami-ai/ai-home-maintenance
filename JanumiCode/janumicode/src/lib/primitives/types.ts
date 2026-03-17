/**
 * Composable Primitive Types
 *
 * Defines the type system for the primitive registry — the building blocks
 * that the LLM orchestrator composes into action plans.
 */

import type { Result } from '../types';

/**
 * Safety classification. Determines validation and confirmation requirements.
 */
export enum PrimitiveSafety {
	/** Read-only operations, UI messages. Always safe to execute. */
	OPEN = 'OPEN',
	/** Mutations that are contextually appropriate (e.g., resolve an open gate).
	 *  Executed if runtime preconditions pass. */
	GUARDED = 'GUARDED',
	/** Phase transitions, data deletion, process killing.
	 *  Excluded from LLM catalog — only invocable by hardcoded handlers. */
	RESTRICTED = 'RESTRICTED',
}

/**
 * Primitive categories for organization and catalog generation.
 */
export enum PrimitiveCategory {
	STATE_READ = 'STATE_READ',
	STATE_MUTATION = 'STATE_MUTATION',
	UI_COMMUNICATION = 'UI_COMMUNICATION',
	WORKFLOW_CONTROL = 'WORKFLOW_CONTROL',
}

/**
 * Parameter definition for a primitive.
 */
export interface PrimitiveParam {
	name: string;
	type: 'string' | 'number' | 'boolean' | 'object' | 'string[]';
	description: string;
	required: boolean;
}

/**
 * Precondition check result.
 */
export type PreconditionResult =
	| { ok: true }
	| { ok: false; reason: string };

/**
 * Precondition function — validates state before execution.
 */
export type PreconditionFn = (
	params: Record<string, unknown>,
	ctx: ExecutionContext
) => PreconditionResult;

/**
 * Bridge to GovernedStreamPanel UI methods.
 * Avoids direct coupling between the executor and the panel.
 */
export interface UIChannel {
	postSystemMessage(message: string): void;
	postProcessing(active: boolean, phase?: string, detail?: string): void;
	postInputEnabled(enabled: boolean): void;
	update(): void;
	runWorkflowCycle(): Promise<void>;
}

/**
 * Context available to primitive execute functions.
 */
export interface ExecutionContext {
	dialogueId: string;
	/** Results from completed plan steps, keyed by step ID */
	stepResults: Map<string, unknown>;
	/** UI bridge for communication */
	uiChannel: UIChannel;
}

/**
 * A registered primitive operation.
 */
export interface PrimitiveDefinition {
	/** Unique identifier (e.g., 'state.getWorkflowState') */
	id: string;
	/** Human-readable name for LLM consumption */
	name: string;
	/** What this primitive does (1-2 sentences) */
	description: string;
	/** Category for catalog grouping */
	category: PrimitiveCategory;
	/** Safety classification */
	safety: PrimitiveSafety;
	/** Input parameter definitions */
	params: PrimitiveParam[];
	/** Description of the return value */
	returns: string;
	/** Runtime preconditions checked before execution */
	preconditions?: PreconditionFn[];
	/** The implementation. Receives resolved params and execution context. */
	execute: (
		params: Record<string, unknown>,
		ctx: ExecutionContext
	) => Promise<Result<unknown>> | Result<unknown>;
}
