/**
 * Workflow Logger Helper
 * 
 * Provides structured logging for DBOS workflows with:
 * - Workflow start/end logging
 * - Step-level logging
 * - Error logging with context
 * - Duration tracking
 */

import { createModuleLogger, type LogContext, type ChildLogger } from '../logger.js';

/**
 * Context for workflow logging
 */
export interface WorkflowLogContext extends LogContext {
	workflow: string;
	workflowId?: string;
	action?: string;
}

/**
 * Create a workflow-specific logger
 */
export function createWorkflowLogger(
	workflowName: string,
	workflowId?: string,
	action?: string
): ChildLogger {
	return createModuleLogger(workflowName).child({
		workflow: workflowName,
		workflowId,
		action
	});
}

/**
 * Log workflow start
 */
export function logWorkflowStart(
	log: ChildLogger,
	action: string,
	input?: Record<string, unknown>
): number {
	log.info('Workflow started', { action, input: summarizeInput(input) });
	return Date.now();
}

/**
 * Log workflow completion
 */
export function logWorkflowEnd(
	log: ChildLogger,
	action: string,
	success: boolean,
	startTime: number,
	result?: Record<string, unknown>
): void {
	const durationMs = Date.now() - startTime;
	if (success) {
		log.info('Workflow completed', { action, durationMs, result: summarizeInput(result) });
	} else {
		log.error('Workflow failed', { action, durationMs, result: summarizeInput(result) });
	}
}

/**
 * Log workflow step start
 */
export function logStepStart(log: ChildLogger, stepName: string, data?: Record<string, unknown>): number {
	log.debug(`Step started: ${stepName}`, { step: stepName, data: summarizeInput(data) });
	return Date.now();
}

/**
 * Log workflow step completion
 */
export function logStepEnd(
	log: ChildLogger,
	stepName: string,
	startTime: number,
	result?: Record<string, unknown>
): void {
	const durationMs = Date.now() - startTime;
	log.debug(`Step completed: ${stepName}`, { step: stepName, durationMs, result: summarizeInput(result) });
}

/**
 * Log workflow step error
 */
export function logStepError(
	log: ChildLogger,
	stepName: string,
	error: Error,
	data?: Record<string, unknown>
): void {
	log.error(`Step failed: ${stepName}`, {
		step: stepName,
		error: {
			name: error.name,
			message: error.message,
			stack: error.stack
		},
		data: summarizeInput(data)
	});
}

/**
 * Summarize input for logging (avoid logging large payloads)
 */
function summarizeInput(input: unknown): unknown {
	if (input === null || input === undefined) return input;
	if (typeof input !== 'object') return input;

	if (Array.isArray(input)) {
		if (input.length > 10) {
			return {
				_type: 'Array',
				length: input.length,
				sample: input.slice(0, 3).map(summarizeInput)
			};
		}
		return input.map(summarizeInput);
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
		if (typeof value === 'string' && value.length > 200) {
			result[key] = `${value.slice(0, 50)}... [${value.length} chars]`;
		} else if (typeof value === 'object' && value !== null) {
			result[key] = summarizeInput(value);
		} else {
			result[key] = value;
		}
	}
	return result;
}
