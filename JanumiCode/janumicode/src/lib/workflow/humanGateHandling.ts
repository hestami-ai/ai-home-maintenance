/**
 * Human Gate Handling
 * Implements Phase 7.4: Workflow suspension/resumption and gate notifications
 * Handles human decision integration with workflow orchestration
 */

import type { Result, Gate, HumanDecision } from '../types';
import { GateStatus, HumanAction } from '../types';
import {
	getWorkflowState,
	transitionWorkflow,
	updateWorkflowMetadata,
	TransitionTrigger,
} from './stateMachine';
import { getGate, resolveGate, getGatesForDialogue } from './gates';
import { captureHumanDecision } from '../roles/human';
import { getDatabase } from '../database';
import { getLogger, isLoggerInitialized } from '../logging';

/**
 * Workflow suspension record
 */
export interface WorkflowSuspension {
	suspension_id: string;
	dialogue_id: string;
	gate_id: string;
	suspended_phase: string; // Phase where suspension occurred
	suspended_at: string; // ISO-8601
	resumed_at: string | null; // ISO-8601 when resumed
	timeout_at: string | null; // ISO-8601 timeout deadline
}

/**
 * Gate notification
 */
export interface GateNotification {
	notification_id: string;
	gate_id: string;
	message: string;
	priority: NotificationPriority;
	created_at: string;
	acknowledged_at: string | null;
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
	LOW = 'LOW',
	MEDIUM = 'MEDIUM',
	HIGH = 'HIGH',
	URGENT = 'URGENT',
}

/**
 * Human gate decision input
 */
export interface HumanGateDecisionInput {
	gateId: string;
	action: HumanAction;
	rationale: string;
	decisionMaker: string;
	attachmentsRef?: string[];
}

/**
 * Suspend workflow at gate
 * Pauses workflow execution until human decision
 *
 * @param dialogueId Dialogue ID
 * @param gateId Gate ID
 * @param timeoutMinutes Optional timeout in minutes
 * @returns Result containing suspension record
 */
export function suspendWorkflowAtGate(
	dialogueId: string,
	gateId: string,
	timeoutMinutes?: number
): Result<WorkflowSuspension> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Get current workflow state
		const stateResult = getWorkflowState(dialogueId);
		if (!stateResult.success) {
			return stateResult as Result<WorkflowSuspension>;
		}

		const currentPhase = stateResult.value.current_phase;

		// Create suspensions table if needed
		db.exec(`
			CREATE TABLE IF NOT EXISTS workflow_suspensions (
				suspension_id TEXT PRIMARY KEY,
				dialogue_id TEXT NOT NULL,
				gate_id TEXT NOT NULL,
				suspended_phase TEXT NOT NULL,
				suspended_at TEXT NOT NULL,
				resumed_at TEXT,
				timeout_at TEXT,
				FOREIGN KEY (gate_id) REFERENCES gates(gate_id)
			)
		`);

		const suspensionId = require('nanoid').nanoid();
		const now = new Date().toISOString();

		let timeoutAt: string | null = null;
		if (timeoutMinutes) {
			const timeout = new Date();
			timeout.setMinutes(timeout.getMinutes() + timeoutMinutes);
			timeoutAt = timeout.toISOString();
		}

		const suspension: WorkflowSuspension = {
			suspension_id: suspensionId,
			dialogue_id: dialogueId,
			gate_id: gateId,
			suspended_phase: currentPhase,
			suspended_at: now,
			resumed_at: null,
			timeout_at: timeoutAt,
		};

		db.prepare(
			`
			INSERT INTO workflow_suspensions (
				suspension_id, dialogue_id, gate_id, suspended_phase,
				suspended_at, resumed_at, timeout_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			suspension.suspension_id,
			suspension.dialogue_id,
			suspension.gate_id,
			suspension.suspended_phase,
			suspension.suspended_at,
			suspension.resumed_at,
			suspension.timeout_at
		);

		// Update workflow metadata to mark as suspended
		updateWorkflowMetadata(dialogueId, {
			suspended: true,
			suspendedAt: now,
			suspensionId: suspensionId,
		});

		return { success: true, value: suspension };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to suspend workflow'),
		};
	}
}

/**
 * Resume workflow after gate resolution
 * Continues workflow execution after human decision
 *
 * @param dialogueId Dialogue ID
 * @param gateId Gate ID
 * @returns Result containing updated suspension record
 */
export function resumeWorkflowAfterGate(
	dialogueId: string,
	gateId: string
): Result<WorkflowSuspension> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Verify gate is resolved
		const gateResult = getGate(gateId);
		if (!gateResult.success) {
			return gateResult as Result<WorkflowSuspension>;
		}

		if (gateResult.value.status !== GateStatus.RESOLVED) {
			return {
				success: false,
				error: new Error('Cannot resume: gate is not resolved'),
			};
		}

		// Get suspension record
		const suspension = db
			.prepare(
				`
			SELECT suspension_id, dialogue_id, gate_id, suspended_phase,
			       suspended_at, resumed_at, timeout_at
			FROM workflow_suspensions
			WHERE dialogue_id = ? AND gate_id = ?
		`
			)
			.get(dialogueId, gateId) as WorkflowSuspension | undefined;

		if (!suspension) {
			return {
				success: false,
				error: new Error('Suspension record not found'),
			};
		}

		if (suspension.resumed_at) {
			return {
				success: false,
				error: new Error('Workflow already resumed'),
			};
		}

		const now = new Date().toISOString();

		// Update suspension record
		db.prepare(
			`
			UPDATE workflow_suspensions
			SET resumed_at = ?
			WHERE suspension_id = ?
		`
		).run(now, suspension.suspension_id);

		// Update workflow metadata
		updateWorkflowMetadata(dialogueId, {
			suspended: false,
			resumedAt: now,
		});

		// Transition workflow (if needed)
		transitionWorkflow(
			dialogueId,
			suspension.suspended_phase as any,
			TransitionTrigger.GATE_RESOLVED,
			{
				gateId,
				resumedFrom: suspension.suspended_phase,
			}
		);

		return {
			success: true,
			value: {
				...suspension,
				resumed_at: now,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to resume workflow'),
		};
	}
}

/**
 * Process human gate decision
 * Captures human decision and resolves gate
 *
 * @param input Human gate decision input
 * @returns Result containing human decision
 */
export function processHumanGateDecision(
	input: HumanGateDecisionInput
): Result<HumanDecision> {
	try {
		// Verify gate exists and is open
		const gateResult = getGate(input.gateId);
		if (!gateResult.success) {
			return gateResult as Result<HumanDecision>;
		}

		const gate = gateResult.value;

		if (gate.status !== GateStatus.OPEN) {
			return {
				success: false,
				error: new Error(`Gate ${input.gateId} is not open`),
			};
		}

		// Capture human decision
		const decisionResult = captureHumanDecision({
			gateId: input.gateId,
			action: input.action,
			rationale: input.rationale,
			decisionMaker: input.decisionMaker,
			attachmentsRef: input.attachmentsRef,
		});

		if (!decisionResult.success) {
			return decisionResult;
		}

		const decision = decisionResult.value;

		// Resolve gate based on action
		let resolution: string;
		switch (input.action) {
			case HumanAction.APPROVE:
				resolution = 'Approved - proceeding with workflow';
				break;
			case HumanAction.REJECT:
				resolution = 'Rejected - blocking workflow';
				break;
			case HumanAction.OVERRIDE:
				resolution = 'Override applied - proceeding with caution';
				break;
			case HumanAction.REFRAME:
				resolution = 'Reframing required - replanning workflow';
				break;
			case HumanAction.DELEGATE:
				resolution = 'Delegated to another authority';
				break;
			case HumanAction.ESCALATE:
				resolution = 'Escalated to higher authority';
				break;
			default:
				resolution = 'Decision recorded';
		}

		// Resolve gate (only if approved or overridden)
		if (
			input.action === HumanAction.APPROVE ||
			input.action === HumanAction.OVERRIDE
		) {
			const resolveResult = resolveGate({
				gateId: input.gateId,
				decisionId: decision.decision_id,
				resolution,
			});

			if (!resolveResult.success) {
				return resolveResult as Result<HumanDecision>;
			}

			// Resume workflow
			const resumeResult = resumeWorkflowAfterGate(
				gate.dialogue_id,
				input.gateId
			);

			if (!resumeResult.success && isLoggerInitialized()) {
				getLogger().child({ component: 'workflow:gate' }).warn('Failed to resume workflow', {
					error: resumeResult.error.message,
					gateId: input.gateId,
				});
			}
		}

		return { success: true, value: decision };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to process human gate decision'),
		};
	}
}

/**
 * Create gate notification
 * Creates a notification for an open gate
 *
 * @param gateId Gate ID
 * @param message Notification message
 * @param priority Notification priority
 * @returns Result containing notification
 */
export function createGateNotification(
	gateId: string,
	message: string,
	priority: NotificationPriority = NotificationPriority.MEDIUM
): Result<GateNotification> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Create notifications table if needed
		db.exec(`
			CREATE TABLE IF NOT EXISTS gate_notifications (
				notification_id TEXT PRIMARY KEY,
				gate_id TEXT NOT NULL,
				message TEXT NOT NULL,
				priority TEXT NOT NULL,
				created_at TEXT NOT NULL,
				acknowledged_at TEXT,
				FOREIGN KEY (gate_id) REFERENCES gates(gate_id)
			)
		`);

		const notificationId = require('nanoid').nanoid();
		const now = new Date().toISOString();

		const notification: GateNotification = {
			notification_id: notificationId,
			gate_id: gateId,
			message,
			priority,
			created_at: now,
			acknowledged_at: null,
		};

		db.prepare(
			`
			INSERT INTO gate_notifications (
				notification_id, gate_id, message, priority,
				created_at, acknowledged_at
			) VALUES (?, ?, ?, ?, ?, ?)
		`
		).run(
			notification.notification_id,
			notification.gate_id,
			notification.message,
			notification.priority,
			notification.created_at,
			notification.acknowledged_at
		);

		return { success: true, value: notification };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to create gate notification'),
		};
	}
}

/**
 * Acknowledge gate notification
 * Marks a notification as acknowledged
 *
 * @param notificationId Notification ID
 * @returns Result containing updated notification
 */
export function acknowledgeGateNotification(
	notificationId: string
): Result<GateNotification> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const now = new Date().toISOString();

		db.prepare(
			`
			UPDATE gate_notifications
			SET acknowledged_at = ?
			WHERE notification_id = ?
		`
		).run(now, notificationId);

		const notification = db
			.prepare(
				`
			SELECT notification_id, gate_id, message, priority,
			       created_at, acknowledged_at
			FROM gate_notifications
			WHERE notification_id = ?
		`
			)
			.get(notificationId) as GateNotification | undefined;

		if (!notification) {
			return {
				success: false,
				error: new Error('Notification not found'),
			};
		}

		return { success: true, value: notification };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to acknowledge gate notification'),
		};
	}
}

/**
 * Get pending gate notifications
 * Retrieves unacknowledged notifications
 *
 * @param dialogueId Optional dialogue ID filter
 * @returns Result containing pending notifications
 */
export function getPendingGateNotifications(
	dialogueId?: string
): Result<GateNotification[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		let query = `
			SELECT gn.notification_id, gn.gate_id, gn.message, gn.priority,
			       gn.created_at, gn.acknowledged_at
			FROM gate_notifications gn
			JOIN gates g ON gn.gate_id = g.gate_id
			WHERE gn.acknowledged_at IS NULL
		`;

		const params: unknown[] = [];

		if (dialogueId) {
			query += ' AND g.dialogue_id = ?';
			params.push(dialogueId);
		}

		query += ' ORDER BY gn.created_at DESC';

		const notifications = db
			.prepare(query)
			.all(...params) as GateNotification[];

		return { success: true, value: notifications };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get pending gate notifications'),
		};
	}
}

/**
 * Handle gate timeout
 * Processes timed-out gates and suspensions
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing timed-out suspensions
 */
export function handleGateTimeouts(
	dialogueId: string
): Result<WorkflowSuspension[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const now = new Date().toISOString();

		// Find timed-out suspensions
		const timedOutSuspensions = db
			.prepare(
				`
			SELECT suspension_id, dialogue_id, gate_id, suspended_phase,
			       suspended_at, resumed_at, timeout_at
			FROM workflow_suspensions
			WHERE dialogue_id = ?
			  AND resumed_at IS NULL
			  AND timeout_at IS NOT NULL
			  AND datetime(timeout_at) < datetime(?)
		`
			)
			.all(dialogueId, now) as WorkflowSuspension[];

		// For each timed-out suspension, create a notification
		for (const suspension of timedOutSuspensions) {
			createGateNotification(
				suspension.gate_id,
				`Gate timed out after ${suspension.timeout_at}`,
				NotificationPriority.URGENT
			);
		}

		return { success: true, value: timedOutSuspensions };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to handle gate timeouts'),
		};
	}
}

/**
 * Check if workflow is suspended
 * Quick check for workflow suspension status
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing suspension status
 */
export function isWorkflowSuspended(dialogueId: string): Result<boolean> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const result = db
			.prepare(
				`
			SELECT COUNT(*) as count
			FROM workflow_suspensions
			WHERE dialogue_id = ? AND resumed_at IS NULL
		`
			)
			.get(dialogueId) as { count: number };

		return { success: true, value: result.count > 0 };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to check workflow suspension status'),
		};
	}
}
