/**
 * Event Bus Integration
 * Implements Phase 9.1.6: Event-driven architecture for component communication
 * Provides publish-subscribe pattern for loosely coupled component interaction
 */

import { EventEmitter } from 'events';

/**
 * Event types
 */
export type JanumiCodeEventType =
	| 'dialogue:started'
	| 'dialogue:turn_added'
	| 'workflow:phase_changed'
	| 'workflow:gate_triggered'
	| 'workflow:gate_resolved'
	| 'workflow:completed'
	| 'workflow:command'
	| 'claim:created'
	| 'claim:verified'
	| 'claim:disproved'
	| 'verdict:emitted'
	| 'artifact:created'
	| 'intake:turn_completed'
	| 'intake:plan_updated'
	| 'intake:finalize_requested'
	| 'intake:plan_finalized'
	| 'intake:plan_approved'
	| 'dialogue:resumed'
	| 'dialogue:title_updated'
	| 'workflow:phase_failed'
	| 'error:occurred'
	| 'ui:refresh_required'
	| 'cli:activity'
	| 'permission:requested'
	| 'permission:decided'
	| 'intake:mode_selected'
	| 'intake:engineering_domain_coverage_updated'
	| 'intake:checkpoint_triggered'
	| 'intake:domain_transition'
	| 'intake:classifier_result'
	| 'intake:gathering_skipped'
	| 'intake:gathering_complete'
	| 'intake:analysis_complete'
	| 'intake:clarification_round_complete';

/**
 * Event data payloads
 */
export interface EventPayloads {
	'dialogue:started': {
		dialogueId: string;
		goal: string;
	};
	'dialogue:turn_added': {
		dialogueId: string;
		turnId: number;
		role: string;
	};
	'workflow:phase_changed': {
		dialogueId: string;
		previousPhase: string;
		currentPhase: string;
	};
	'workflow:gate_triggered': {
		dialogueId: string;
		gateId: string;
		reason: string;
	};
	'workflow:gate_resolved': {
		dialogueId: string;
		gateId: string;
		action: string;
	};
	'workflow:completed': {
		dialogueId: string;
		phasesExecuted: number;
	};
	'workflow:command': {
		dialogueId: string;
		commandId: string;
		action: 'start' | 'output' | 'complete' | 'error';
		commandType: 'cli_invocation' | 'llm_api_call' | 'role_invocation';
		label: string;
		summary?: string;
		detail?: string;
		lineType?: 'summary' | 'detail' | 'error' | 'stdin';
		status?: 'running' | 'success' | 'error';
		timestamp: string;
		collapsed?: boolean;
	};
	'claim:created': {
		dialogueId: string;
		claimId: string;
		statement: string;
	};
	'claim:verified': {
		claimId: string;
		verdict: string;
	};
	'claim:disproved': {
		claimId: string;
		verdict: string;
	};
	'verdict:emitted': {
		verdictId: string;
		claimId: string;
		verdict: string;
	};
	'artifact:created': {
		dialogueId: string;
		artifactId: string;
		artifactType: string;
	};
	'dialogue:resumed': {
		dialogueId: string;
	};
	'dialogue:title_updated': {
		dialogueId: string;
		title: string;
	};
	'error:occurred': {
		code: string;
		message: string;
		context?: Record<string, unknown>;
	};
	'ui:refresh_required': {
		viewId: string;
	};
	'intake:turn_completed': {
		dialogueId: string;
		turnNumber: number;
		conversationalResponse: string;
		planVersion: number;
	};
	'intake:plan_updated': {
		dialogueId: string;
		plan: import('../types/intake').IntakePlanDocument;
	};
	'intake:finalize_requested': {
		dialogueId: string;
	};
	'intake:plan_finalized': {
		dialogueId: string;
		plan: import('../types/intake').IntakePlanDocument;
	};
	'intake:plan_approved': {
		dialogueId: string;
	};
	'workflow:phase_failed': {
		dialogueId: string;
		phase: string;
		error: string;
	};
	'cli:activity': {
		dialogueId: string;
		event: import('../cli/types').CLIActivityEvent;
	};
	'permission:requested': {
		dialogueId: string;
		permissionId: string;
		tool: string;
		input: Record<string, unknown>;
	};
	'permission:decided': {
		permissionId: string;
		approved: boolean;
		approveAll?: boolean;
		reason: string;
	};
	'intake:mode_selected': {
		dialogueId: string;
		mode: import('../types/intake').IntakeMode;
		source: 'classifier' | 'user';
	};
	'intake:engineering_domain_coverage_updated': {
		dialogueId: string;
		coverage: import('../types/intake').EngineeringDomainCoverageMap;
	};
	'intake:checkpoint_triggered': {
		dialogueId: string;
		checkpoint: import('../types/intake').IntakeCheckpoint;
	};
	'intake:domain_transition': {
		dialogueId: string;
		fromDomain: import('../types/intake').EngineeringDomain | null;
		toDomain: import('../types/intake').EngineeringDomain | null;
	};
	'intake:classifier_result': {
		dialogueId: string;
		recommendation: import('../types/intake').IntakeModeRecommendation;
	};
	'intake:gathering_skipped': {
		dialogueId: string;
	};
	'intake:gathering_complete': {
		dialogueId: string;
	};
	'intake:analysis_complete': {
		dialogueId: string;
		engineeringDomainAssessment: Array<{ domain: string; level: string; evidence: string }>;
	};
	'intake:clarification_round_complete': {
		dialogueId: string;
		round: number;
		isComplete: boolean;
	};
}

/**
 * Event listener callback
 */
export type EventListener<T extends JanumiCodeEventType> = (
	payload: EventPayloads[T]
) => void | Promise<void>;

/**
 * Event bus singleton
 */
class JanumiCodeEventBus {
	private emitter: EventEmitter;
	private listeners: Map<JanumiCodeEventType, Set<EventListener<any>>>;

	constructor() {
		this.emitter = new EventEmitter();
		this.listeners = new Map();
		this.emitter.setMaxListeners(100); // Increase default limit
	}

	/**
	 * Subscribe to an event
	 *
	 * @param eventType Event type to listen for
	 * @param listener Callback function
	 * @returns Unsubscribe function
	 */
	on<T extends JanumiCodeEventType>(
		eventType: T,
		listener: EventListener<T>
	): () => void {
		// Track listener
		if (!this.listeners.has(eventType)) {
			this.listeners.set(eventType, new Set());
		}
		this.listeners.get(eventType)!.add(listener);

		// Register with EventEmitter
		this.emitter.on(eventType, listener);

		// Return unsubscribe function
		return () => {
			this.off(eventType, listener);
		};
	}

	/**
	 * Subscribe to an event (one-time)
	 *
	 * @param eventType Event type to listen for
	 * @param listener Callback function
	 */
	once<T extends JanumiCodeEventType>(eventType: T, listener: EventListener<T>): void {
		const wrappedListener = (payload: EventPayloads[T]) => {
			listener(payload);
			this.off(eventType, wrappedListener as EventListener<T>);
		};

		this.on(eventType, wrappedListener as EventListener<T>);
	}

	/**
	 * Unsubscribe from an event
	 *
	 * @param eventType Event type
	 * @param listener Callback function to remove
	 */
	off<T extends JanumiCodeEventType>(eventType: T, listener: EventListener<T>): void {
		// Remove from tracking
		const listeners = this.listeners.get(eventType);
		if (listeners) {
			listeners.delete(listener);
			if (listeners.size === 0) {
				this.listeners.delete(eventType);
			}
		}

		// Remove from EventEmitter
		this.emitter.off(eventType, listener);
	}

	/**
	 * Publish an event
	 *
	 * @param eventType Event type
	 * @param payload Event payload
	 */
	emit<T extends JanumiCodeEventType>(eventType: T, payload: EventPayloads[T]): void {
		this.emitter.emit(eventType, payload);
	}

	/**
	 * Publish an event asynchronously
	 * Waits for all async listeners to complete
	 *
	 * @param eventType Event type
	 * @param payload Event payload
	 */
	async emitAsync<T extends JanumiCodeEventType>(
		eventType: T,
		payload: EventPayloads[T]
	): Promise<void> {
		const listeners = this.listeners.get(eventType);
		if (!listeners || listeners.size === 0) {
			return;
		}

		// Execute all listeners
		const promises = Array.from(listeners).map((listener) =>
			Promise.resolve(listener(payload))
		);

		await Promise.all(promises);
	}

	/**
	 * Remove all listeners for an event type
	 *
	 * @param eventType Event type
	 */
	removeAllListeners(eventType?: JanumiCodeEventType): void {
		if (eventType) {
			this.listeners.delete(eventType);
			this.emitter.removeAllListeners(eventType);
		} else {
			this.listeners.clear();
			this.emitter.removeAllListeners();
		}
	}

	/**
	 * Get listener count for an event type
	 *
	 * @param eventType Event type
	 * @returns Number of listeners
	 */
	listenerCount(eventType: JanumiCodeEventType): number {
		return this.listeners.get(eventType)?.size || 0;
	}

	/**
	 * Get all event types with listeners
	 *
	 * @returns Array of event types
	 */
	eventTypes(): JanumiCodeEventType[] {
		return Array.from(this.listeners.keys());
	}
}

// Singleton instance
let eventBusInstance: JanumiCodeEventBus | null = null;

/**
 * Get event bus instance
 *
 * @returns Event bus singleton
 */
export function getEventBus(): JanumiCodeEventBus {
	if (!eventBusInstance) {
		eventBusInstance = new JanumiCodeEventBus();
	}
	return eventBusInstance;
}

/**
 * Reset event bus (for testing)
 */
export function resetEventBus(): void {
	if (eventBusInstance) {
		eventBusInstance.removeAllListeners();
	}
	eventBusInstance = null;
}

// Convenience functions for common events

/**
 * Emit dialogue started event
 */
export function emitDialogueStarted(dialogueId: string, goal: string): void {
	getEventBus().emit('dialogue:started', { dialogueId, goal });
}

/**
 * Emit dialogue turn added event
 */
export function emitDialogueTurnAdded(
	dialogueId: string,
	turnId: number,
	role: string
): void {
	getEventBus().emit('dialogue:turn_added', { dialogueId, turnId, role });
}

/**
 * Emit workflow phase changed event
 */
export function emitWorkflowPhaseChanged(
	dialogueId: string,
	previousPhase: string,
	currentPhase: string
): void {
	getEventBus().emit('workflow:phase_changed', {
		dialogueId,
		previousPhase,
		currentPhase,
	});
}

/**
 * Emit workflow gate triggered event
 */
export function emitWorkflowGateTriggered(
	dialogueId: string,
	gateId: string,
	reason: string
): void {
	getEventBus().emit('workflow:gate_triggered', { dialogueId, gateId, reason });
}

/**
 * Emit workflow gate resolved event
 */
export function emitWorkflowGateResolved(
	dialogueId: string,
	gateId: string,
	action: string
): void {
	getEventBus().emit('workflow:gate_resolved', { dialogueId, gateId, action });
}

/**
 * Emit claim created event
 */
export function emitClaimCreated(
	dialogueId: string,
	claimId: string,
	statement: string
): void {
	getEventBus().emit('claim:created', { dialogueId, claimId, statement });
}

/**
 * Emit artifact created event
 */
export function emitArtifactCreated(
	dialogueId: string,
	artifactId: string,
	artifactType: string
): void {
	getEventBus().emit('artifact:created', { dialogueId, artifactId, artifactType });
}

/**
 * Emit error occurred event
 */
export function emitError(
	code: string,
	message: string,
	context?: Record<string, unknown>
): void {
	getEventBus().emit('error:occurred', { code, message, context });
}

/**
 * Emit workflow phase failed event.
 * Used to notify UI that a phase failed and retry is available.
 */
export function emitWorkflowPhaseFailed(
	dialogueId: string,
	phase: string,
	error: string
): void {
	getEventBus().emit('workflow:phase_failed', { dialogueId, phase, error });
}

/**
 * Emit UI refresh required event
 */
export function emitUIRefresh(viewId: string): void {
	getEventBus().emit('ui:refresh_required', { viewId });
}

/**
 * Emit CLI activity event.
 * Used by CLI providers to stream real-time activity into the governed stream UI.
 * Events are always persisted to DB for audit, regardless of UI display level.
 */
export function emitCLIActivity(
	dialogueId: string,
	event: import('../cli/types').CLIActivityEvent
): void {
	getEventBus().emit('cli:activity', { dialogueId, event });
}

/**
 * Emit workflow command event.
 * Used to stream command invocations and output into the governed stream UI.
 */
export function emitWorkflowCommand(
	payload: EventPayloads['workflow:command']
): void {
	getEventBus().emit('workflow:command', payload);
}

/**
 * Subscribe to CLI activity events
 *
 * @param listener Callback for CLI activity events
 * @returns Unsubscribe function
 */
export function subscribeToCLIActivity(
	listener: (payload: EventPayloads['cli:activity']) => void
): () => void {
	return getEventBus().on('cli:activity', listener);
}

/**
 * Subscribe to all workflow events
 *
 * @param listener Callback for workflow events
 * @returns Unsubscribe function
 */
export function subscribeToWorkflowEvents(
	listener: (eventType: string, payload: any) => void
): () => void {
	const workflowEvents: JanumiCodeEventType[] = [
		'workflow:phase_changed',
		'workflow:gate_triggered',
		'workflow:gate_resolved',
		'workflow:completed',
	];

	const unsubscribeFns = workflowEvents.map((eventType) =>
		getEventBus().on(eventType, (payload) => listener(eventType, payload))
	);

	return () => {
		unsubscribeFns.forEach((fn) => fn());
	};
}

/**
 * Emit intake turn completed event
 */
export function emitIntakeTurnCompleted(
	dialogueId: string,
	turnNumber: number,
	conversationalResponse: string,
	planVersion: number
): void {
	getEventBus().emit('intake:turn_completed', {
		dialogueId,
		turnNumber,
		conversationalResponse,
		planVersion,
	});
}

/**
 * Emit intake plan updated event
 */
export function emitIntakePlanUpdated(
	dialogueId: string,
	plan: import('../types/intake').IntakePlanDocument
): void {
	getEventBus().emit('intake:plan_updated', { dialogueId, plan });
}

/**
 * Emit intake finalize requested event
 */
export function emitIntakeFinalizeRequested(dialogueId: string): void {
	getEventBus().emit('intake:finalize_requested', { dialogueId });
}

/**
 * Emit intake plan finalized event
 */
export function emitIntakePlanFinalized(
	dialogueId: string,
	plan: import('../types/intake').IntakePlanDocument
): void {
	getEventBus().emit('intake:plan_finalized', { dialogueId, plan });
}

/**
 * Emit intake plan approved event
 */
export function emitIntakePlanApproved(dialogueId: string): void {
	getEventBus().emit('intake:plan_approved', { dialogueId });
}

/**
 * Subscribe to all intake events
 *
 * @param listener Callback for intake events
 * @returns Unsubscribe function
 */
export function subscribeToIntakeEvents(
	listener: (eventType: string, payload: any) => void
): () => void {
	const intakeEvents: JanumiCodeEventType[] = [
		'intake:turn_completed',
		'intake:plan_updated',
		'intake:finalize_requested',
		'intake:plan_finalized',
		'intake:plan_approved',
		'intake:mode_selected',
		'intake:engineering_domain_coverage_updated',
		'intake:checkpoint_triggered',
		'intake:domain_transition',
		'intake:classifier_result',
		'intake:gathering_skipped',
	];

	const unsubscribeFns = intakeEvents.map((eventType) =>
		getEventBus().on(eventType, (payload) => listener(eventType, payload))
	);

	return () => {
		unsubscribeFns.forEach((fn) => fn());
	};
}

/**
 * Emit dialogue resumed event
 */
export function emitDialogueResumed(dialogueId: string): void {
	getEventBus().emit('dialogue:resumed', { dialogueId });
}

/**
 * Emit dialogue title updated event
 */
export function emitDialogueTitleUpdated(
	dialogueId: string,
	title: string
): void {
	getEventBus().emit('dialogue:title_updated', { dialogueId, title });
}

/**
 * Subscribe to all dialogue events
 *
 * @param listener Callback for dialogue events
 * @returns Unsubscribe function
 */
export function subscribeToDialogueEvents(
	listener: (eventType: string, payload: any) => void
): () => void {
	const dialogueEvents: JanumiCodeEventType[] = [
		'dialogue:started',
		'dialogue:turn_added',
		'dialogue:resumed',
		'dialogue:title_updated',
	];

	const unsubscribeFns = dialogueEvents.map((eventType) =>
		getEventBus().on(eventType, (payload) => listener(eventType, payload))
	);

	return () => {
		unsubscribeFns.forEach((fn) => fn());
	};
}
