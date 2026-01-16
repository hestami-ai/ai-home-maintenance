/**
 * Staff Workflow (v1)
 *
 * DBOS durable workflow for staff management operations.
 * Handles both platform-level and organization-scoped staff operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { StaffStatus, StaffRole, PillarAccess } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'staff_workflow_status';
const WORKFLOW_ERROR_EVENT = 'staff_workflow_error';

export const StaffWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	ACTIVATE: 'ACTIVATE',
	SUSPEND: 'SUSPEND',
	DEACTIVATE: 'DEACTIVATE',
	REACTIVATE: 'REACTIVATE',
	UPDATE_ROLES: 'UPDATE_ROLES',
	UPDATE_PILLAR_ACCESS: 'UPDATE_PILLAR_ACCESS',
	REGENERATE_ACTIVATION_CODE: 'REGENERATE_ACTIVATION_CODE',
	ACTIVATE_WITH_CODE: 'ACTIVATE_WITH_CODE'
} as const;

export type StaffWorkflowAction = (typeof StaffWorkflowAction)[keyof typeof StaffWorkflowAction];

export interface StaffWorkflowInput {
	action: StaffWorkflowAction;
	organizationId: string; // 'hestami-platform' for platform-level, actual org ID for org-scoped
	userId: string;
	staffId?: string;
	data?: {
		displayName?: string;
		title?: string | null;
		roles?: StaffRole[];
		pillarAccess?: PillarAccess[];
		canBeAssignedCases?: boolean;
		reason?: string;
		activationCodeEncrypted?: string;
		activationCodeExpiresAt?: Date;
		targetUserId?: string; // For CREATE - the user to create staff for
	};
}

export interface StaffWorkflowResult extends EntityWorkflowResult {
	staffId?: string;
	status?: string;
	activatedAt?: string;
	suspendedAt?: string;
	deactivatedAt?: string;
	escalatedCaseCount?: number;
	activationCodeExpiresAt?: string;
	[key: string]: unknown;
}

async function createStaff(
	organizationId: string,
	userId: string,
	targetUserId: string,
	data: {
		displayName: string;
		title?: string | null;
		roles: StaffRole[];
		pillarAccess: PillarAccess[];
		canBeAssignedCases: boolean;
		activationCodeEncrypted: string;
		activationCodeExpiresAt: Date;
	}
): Promise<{ id: string; displayName: string; status: StaffStatus }> {
	const staff = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.staff.create({
				data: {
					userId: targetUserId,
					...(organizationId !== 'hestami-platform' && { organizationId }),
					displayName: data.displayName,
					title: data.title,
					roles: data.roles,
					pillarAccess: data.pillarAccess,
					canBeAssignedCases: data.canBeAssignedCases,
					status: 'PENDING',
					activationCodeEncrypted: data.activationCodeEncrypted,
					activationCodeExpiresAt: data.activationCodeExpiresAt
				}
			});
		},
		{ userId, reason: 'Create staff member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staff.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Staff member "${staff.displayName}" created with roles: ${data.roles.join(', ')}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'CREATE',
		workflowVersion: 'v1',
		newState: {
			id: staff.id,
			userId: staff.userId,
			displayName: staff.displayName,
			roles: staff.roles,
			pillarAccess: staff.pillarAccess,
			status: staff.status
		}
	});

	return { id: staff.id, displayName: staff.displayName, status: staff.status };
}

async function updateStaff(
	staffId: string,
	organizationId: string,
	userId: string,
	data: {
		displayName?: string;
		title?: string | null;
		canBeAssignedCases?: boolean;
		roles?: StaffRole[];
		pillarAccess?: PillarAccess[];
	},
	previousState: Record<string, unknown>
): Promise<{ id: string; displayName: string }> {
	const updateData: Record<string, unknown> = {};
	if (data.displayName !== undefined) updateData.displayName = data.displayName;
	if (data.title !== undefined) updateData.title = data.title;
	if (data.canBeAssignedCases !== undefined) updateData.canBeAssignedCases = data.canBeAssignedCases;
	if (data.roles !== undefined) updateData.roles = data.roles;
	if (data.pillarAccess !== undefined) updateData.pillarAccess = data.pillarAccess;

	const staff = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.staff.update({
				where: { id: staffId },
				data: updateData
			});
		},
		{ userId, reason: 'Update staff member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staffId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Staff member "${staff.displayName}" updated`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'UPDATE',
		workflowVersion: 'v1',
		previousState,
		newState: {
			displayName: staff.displayName,
			title: staff.title,
			canBeAssignedCases: staff.canBeAssignedCases,
			roles: staff.roles,
			pillarAccess: staff.pillarAccess
		}
	});

	return { id: staff.id, displayName: staff.displayName };
}

async function activateStaff(
	staffId: string,
	organizationId: string,
	userId: string
): Promise<{ id: string; activatedAt: string }> {
	const now = new Date();
	const staff = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.staff.update({
				where: { id: staffId },
				data: {
					status: 'ACTIVE',
					activatedAt: now
				}
			});
		},
		{ userId, reason: 'Activate staff member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staffId,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Staff member "${staff.displayName}" activated`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'ACTIVATE',
		workflowVersion: 'v1',
		previousState: { status: 'PENDING' },
		newState: { status: 'ACTIVE', activatedAt: now.toISOString() }
	});

	return { id: staff.id, activatedAt: now.toISOString() };
}

async function suspendStaff(
	staffId: string,
	organizationId: string,
	userId: string,
	reason: string,
	previousStatus: StaffStatus
): Promise<{ id: string; suspendedAt: string; escalatedCaseCount: number }> {
	const now = new Date();

	// Suspend staff and unassign all cases in a transaction with RLS context
	const { staff, escalatedCaseCount } = await orgTransaction(
		organizationId,
		async (tx) => {
			const staffResult = await tx.staff.update({
				where: { id: staffId },
				data: {
					status: 'SUSPENDED',
					suspendedAt: now,
					suspensionReason: reason
				}
			});
			const updateResult = await tx.staffCaseAssignment.updateMany({
				where: {
					staffId,
					unassignedAt: null
				},
				data: {
					unassignedAt: now,
					justification: `Staff suspended: ${reason}`
				}
			});
			return { staff: staffResult, escalatedCaseCount: updateResult.count };
		},
		{ userId, reason: 'Suspend staff member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staffId,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Staff member "${staff.displayName}" suspended. Reason: ${reason}. ${escalatedCaseCount} cases escalated.`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'SUSPEND',
		workflowVersion: 'v1',
		previousState: { status: previousStatus },
		newState: {
			status: 'SUSPENDED',
			suspendedAt: now.toISOString(),
			suspensionReason: reason,
			escalatedCaseCount
		}
	});

	return { id: staff.id, suspendedAt: now.toISOString(), escalatedCaseCount };
}

async function deactivateStaff(
	staffId: string,
	organizationId: string,
	userId: string,
	reason: string,
	previousStatus: StaffStatus
): Promise<{ id: string; deactivatedAt: string }> {
	const now = new Date();
	const staff = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.staff.update({
				where: { id: staffId },
				data: {
					status: 'DEACTIVATED',
					deactivatedAt: now,
					deactivationReason: reason,
					canBeAssignedCases: false
				}
			});
		},
		{ userId, reason: 'Deactivate staff member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staffId,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Staff member "${staff.displayName}" deactivated. Reason: ${reason}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'DEACTIVATE',
		workflowVersion: 'v1',
		previousState: { status: previousStatus },
		newState: {
			status: 'DEACTIVATED',
			deactivatedAt: now.toISOString(),
			deactivationReason: reason
		}
	});

	return { id: staff.id, deactivatedAt: now.toISOString() };
}

async function reactivateStaff(
	staffId: string,
	organizationId: string,
	userId: string,
	previousStatus: StaffStatus
): Promise<{ id: string }> {
	const staff = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.staff.update({
				where: { id: staffId },
				data: {
					status: 'ACTIVE',
					canBeAssignedCases: true
				}
			});
		},
		{ userId, reason: 'Reactivate staff member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staffId,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Staff member "${staff.displayName}" reactivated from ${previousStatus}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'REACTIVATE',
		workflowVersion: 'v1',
		previousState: { status: previousStatus },
		newState: { status: 'ACTIVE' }
	});

	return { id: staff.id };
}

async function updateRoles(
	staffId: string,
	organizationId: string,
	userId: string,
	roles: StaffRole[],
	previousRoles: StaffRole[]
): Promise<{ id: string }> {
	const staff = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.staff.update({
				where: { id: staffId },
				data: { roles }
			});
		},
		{ userId, reason: 'Update staff roles' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staffId,
		action: 'ROLE_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Staff member "${staff.displayName}" roles updated: ${previousRoles.join(', ')} → ${roles.join(', ')}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'UPDATE_ROLES',
		workflowVersion: 'v1',
		previousState: { roles: previousRoles },
		newState: { roles }
	});

	return { id: staff.id };
}

async function updatePillarAccess(
	staffId: string,
	organizationId: string,
	userId: string,
	pillarAccess: PillarAccess[],
	previousPillarAccess: PillarAccess[]
): Promise<{ id: string }> {
	const staff = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.staff.update({
				where: { id: staffId },
				data: { pillarAccess }
			});
		},
		{ userId, reason: 'Update staff pillar access' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staffId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Staff member "${staff.displayName}" pillar access updated: ${previousPillarAccess.join(', ')} → ${pillarAccess.join(', ')}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'UPDATE_PILLAR_ACCESS',
		workflowVersion: 'v1',
		previousState: { pillarAccess: previousPillarAccess },
		newState: { pillarAccess }
	});

	return { id: staff.id };
}

async function regenerateActivationCode(
	staffId: string,
	organizationId: string,
	userId: string,
	activationCodeEncrypted: string,
	activationCodeExpiresAt: Date
): Promise<{ id: string; expiresAt: string }> {
	const staff = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.staff.update({
				where: { id: staffId },
				data: {
					activationCodeEncrypted,
					activationCodeExpiresAt
				}
			});
		},
		{ userId, reason: 'Regenerate activation code' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staffId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Activation code regenerated for "${staff.displayName}"`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'REGENERATE_ACTIVATION_CODE',
		workflowVersion: 'v1',
		newState: {
			activationCodeExpiresAt: activationCodeExpiresAt.toISOString()
		}
	});

	return { id: staff.id, expiresAt: activationCodeExpiresAt.toISOString() };
}

async function activateWithCode(
	staffId: string,
	organizationId: string,
	userId: string,
	displayName: string
): Promise<{ id: string; activatedAt: string }> {
	const now = new Date();
	await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.staff.update({
				where: { id: staffId },
				data: {
					status: 'ACTIVE',
					activatedAt: now,
					activationCodeEncrypted: null,
					activationCodeExpiresAt: null
				}
			});
		},
		{ userId, reason: 'Activate staff with code' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: 'STAFF',
		entityId: staffId,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Staff member "${displayName}" activated via self-service`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'staffWorkflow_v1',
		workflowStep: 'ACTIVATE_WITH_CODE',
		workflowVersion: 'v1',
		previousState: { status: 'PENDING' },
		newState: { status: 'ACTIVE', activatedAt: now.toISOString() }
	});

	return { id: staffId, activatedAt: now.toISOString() };
}

async function staffWorkflow(input: StaffWorkflowInput): Promise<StaffWorkflowResult> {
	const workflowName = 'staffWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		staffId: input.staffId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CREATE': {
				if (!input.data?.targetUserId || !input.data?.displayName || !input.data?.roles || !input.data?.pillarAccess || !input.data?.activationCodeEncrypted || !input.data?.activationCodeExpiresAt) {
					const error = new Error('Missing required fields for CREATE');
					logStepError(log, 'validation', error, { data: input.data });
					throw error;
				}
				log.debug('Step: createStaff starting', { targetUserId: input.data.targetUserId });
				const result = await DBOS.runStep(
					() => createStaff(input.organizationId, input.userId, input.data!.targetUserId!, {
						displayName: input.data!.displayName!,
						title: input.data!.title,
						roles: input.data!.roles!,
						pillarAccess: input.data!.pillarAccess!,
						canBeAssignedCases: input.data!.canBeAssignedCases ?? false,
						activationCodeEncrypted: input.data!.activationCodeEncrypted!,
						activationCodeExpiresAt: input.data!.activationCodeExpiresAt!
					}),
					{ name: 'createStaff' }
				);
				log.info('Step: createStaff completed', { staffId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'staff_created', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE': {
				if (!input.staffId) {
					const error = new Error('Missing required field: staffId for UPDATE');
					logStepError(log, 'validation', error, { staffId: input.staffId });
					throw error;
				}
				// Get previous state for audit
				const existing = await prisma.staff.findUnique({ where: { id: input.staffId } });
				if (!existing) throw new Error('Staff not found');

				const previousState = {
					displayName: existing.displayName,
					title: existing.title,
					canBeAssignedCases: existing.canBeAssignedCases,
					roles: existing.roles,
					pillarAccess: existing.pillarAccess
				};

				log.debug('Step: updateStaff starting', { staffId: input.staffId });
				const result = await DBOS.runStep(
					() => updateStaff(input.staffId!, input.organizationId, input.userId, input.data || {}, previousState),
					{ name: 'updateStaff' }
				);
				log.info('Step: updateStaff completed', { staffId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'staff_updated', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ACTIVATE': {
				if (!input.staffId) {
					const error = new Error('Missing required field: staffId for ACTIVATE');
					logStepError(log, 'validation', error, { staffId: input.staffId });
					throw error;
				}
				log.debug('Step: activateStaff starting', { staffId: input.staffId });
				const result = await DBOS.runStep(
					() => activateStaff(input.staffId!, input.organizationId, input.userId),
					{ name: 'activateStaff' }
				);
				log.info('Step: activateStaff completed', { staffId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'staff_activated', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id,
					status: 'ACTIVE',
					activatedAt: result.activatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'SUSPEND': {
				if (!input.staffId || !input.data?.reason) {
					const error = new Error('Missing required fields: staffId, reason for SUSPEND');
					logStepError(log, 'validation', error, { staffId: input.staffId });
					throw error;
				}
				// Get previous status for audit
				const existing = await prisma.staff.findUnique({ where: { id: input.staffId } });
				if (!existing) throw new Error('Staff not found');

				log.debug('Step: suspendStaff starting', { staffId: input.staffId });
				const result = await DBOS.runStep(
					() => suspendStaff(input.staffId!, input.organizationId, input.userId, input.data!.reason!, existing.status),
					{ name: 'suspendStaff' }
				);
				log.info('Step: suspendStaff completed', { staffId: result.id, escalatedCaseCount: result.escalatedCaseCount });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'staff_suspended', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id,
					status: 'SUSPENDED',
					suspendedAt: result.suspendedAt,
					escalatedCaseCount: result.escalatedCaseCount
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'DEACTIVATE': {
				if (!input.staffId || !input.data?.reason) {
					const error = new Error('Missing required fields: staffId, reason for DEACTIVATE');
					logStepError(log, 'validation', error, { staffId: input.staffId });
					throw error;
				}
				// Get previous status for audit
				const existing = await prisma.staff.findUnique({ where: { id: input.staffId } });
				if (!existing) throw new Error('Staff not found');

				log.debug('Step: deactivateStaff starting', { staffId: input.staffId });
				const result = await DBOS.runStep(
					() => deactivateStaff(input.staffId!, input.organizationId, input.userId, input.data!.reason!, existing.status),
					{ name: 'deactivateStaff' }
				);
				log.info('Step: deactivateStaff completed', { staffId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'staff_deactivated', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id,
					status: 'DEACTIVATED',
					deactivatedAt: result.deactivatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'REACTIVATE': {
				if (!input.staffId) {
					const error = new Error('Missing required field: staffId for REACTIVATE');
					logStepError(log, 'validation', error, { staffId: input.staffId });
					throw error;
				}
				// Get previous status for audit
				const existing = await prisma.staff.findUnique({ where: { id: input.staffId } });
				if (!existing) throw new Error('Staff not found');

				log.debug('Step: reactivateStaff starting', { staffId: input.staffId });
				const result = await DBOS.runStep(
					() => reactivateStaff(input.staffId!, input.organizationId, input.userId, existing.status),
					{ name: 'reactivateStaff' }
				);
				log.info('Step: reactivateStaff completed', { staffId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'staff_reactivated', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id,
					status: 'ACTIVE'
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE_ROLES': {
				if (!input.staffId || !input.data?.roles) {
					const error = new Error('Missing required fields: staffId, roles for UPDATE_ROLES');
					logStepError(log, 'validation', error, { staffId: input.staffId });
					throw error;
				}
				// Get previous roles for audit
				const existing = await prisma.staff.findUnique({ where: { id: input.staffId } });
				if (!existing) throw new Error('Staff not found');

				log.debug('Step: updateRoles starting', { staffId: input.staffId });
				const result = await DBOS.runStep(
					() => updateRoles(input.staffId!, input.organizationId, input.userId, input.data!.roles!, existing.roles as StaffRole[]),
					{ name: 'updateRoles' }
				);
				log.info('Step: updateRoles completed', { staffId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'roles_updated', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'UPDATE_PILLAR_ACCESS': {
				if (!input.staffId || !input.data?.pillarAccess) {
					const error = new Error('Missing required fields: staffId, pillarAccess for UPDATE_PILLAR_ACCESS');
					logStepError(log, 'validation', error, { staffId: input.staffId });
					throw error;
				}
				// Get previous pillar access for audit
				const existing = await prisma.staff.findUnique({ where: { id: input.staffId } });
				if (!existing) throw new Error('Staff not found');

				log.debug('Step: updatePillarAccess starting', { staffId: input.staffId });
				const result = await DBOS.runStep(
					() => updatePillarAccess(input.staffId!, input.organizationId, input.userId, input.data!.pillarAccess!, existing.pillarAccess as PillarAccess[]),
					{ name: 'updatePillarAccess' }
				);
				log.info('Step: updatePillarAccess completed', { staffId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'pillar_access_updated', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'REGENERATE_ACTIVATION_CODE': {
				if (!input.staffId || !input.data?.activationCodeEncrypted || !input.data?.activationCodeExpiresAt) {
					const error = new Error('Missing required fields for REGENERATE_ACTIVATION_CODE');
					logStepError(log, 'validation', error, { staffId: input.staffId });
					throw error;
				}
				log.debug('Step: regenerateActivationCode starting', { staffId: input.staffId });
				const result = await DBOS.runStep(
					() => regenerateActivationCode(input.staffId!, input.organizationId, input.userId, input.data!.activationCodeEncrypted!, input.data!.activationCodeExpiresAt!),
					{ name: 'regenerateActivationCode' }
				);
				log.info('Step: regenerateActivationCode completed', { staffId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'activation_code_regenerated', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id,
					activationCodeExpiresAt: result.expiresAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ACTIVATE_WITH_CODE': {
				if (!input.staffId || !input.data?.displayName) {
					const error = new Error('Missing required fields for ACTIVATE_WITH_CODE');
					logStepError(log, 'validation', error, { staffId: input.staffId });
					throw error;
				}
				log.debug('Step: activateWithCode starting', { staffId: input.staffId });
				const result = await DBOS.runStep(
					() => activateWithCode(input.staffId!, input.organizationId, input.userId, input.data!.displayName!),
					{ name: 'activateWithCode' }
				);
				log.info('Step: activateWithCode completed', { staffId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'staff_activated_with_code', ...result });
				const successResult: StaffWorkflowResult = {
					success: true,
					entityId: result.id,
					staffId: result.id,
					status: 'ACTIVE',
					activatedAt: result.activatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: StaffWorkflowResult = {
					success: false,
					error: `Unknown action: ${input.action}`
				};
				log.warn('Unknown workflow action', { action: input.action });
				logWorkflowEnd(log, input.action, false, startTime, errorResult);
				return errorResult;
			}
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;

		log.error('Workflow failed', {
			action: input.action,
			staffId: input.staffId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'STAFF_WORKFLOW_ERROR'
		});
		const errorResult: StaffWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const staffWorkflow_v1 = DBOS.registerWorkflow(staffWorkflow);
