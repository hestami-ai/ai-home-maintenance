/**
 * Service Provider Team Member Workflow (v1)
 *
 * DBOS durable workflow for service provider team member management operations.
 * Handles team member lifecycle: create, activate, suspend, deactivate, update roles.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { ServiceProviderRole } from '../../../../generated/prisma/client.js';
import {
	ServiceProviderTeamMemberStatus,
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType
} from '../../../../generated/prisma/enums.js';

const WORKFLOW_STATUS_EVENT = 'service_provider_team_workflow_status';
const WORKFLOW_ERROR_EVENT = 'service_provider_team_workflow_error';

export const ServiceProviderTeamWorkflowAction = {
	CREATE: 'CREATE',
	UPDATE: 'UPDATE',
	ACTIVATE: 'ACTIVATE',
	SUSPEND: 'SUSPEND',
	DEACTIVATE: 'DEACTIVATE',
	REACTIVATE: 'REACTIVATE',
	UPDATE_ROLES: 'UPDATE_ROLES',
	REGENERATE_ACTIVATION_CODE: 'REGENERATE_ACTIVATION_CODE',
	ACTIVATE_WITH_CODE: 'ACTIVATE_WITH_CODE',
	LINK_TECHNICIAN: 'LINK_TECHNICIAN',
	UNLINK_TECHNICIAN: 'UNLINK_TECHNICIAN'
} as const;

export type ServiceProviderTeamWorkflowAction = (typeof ServiceProviderTeamWorkflowAction)[keyof typeof ServiceProviderTeamWorkflowAction];

export interface ServiceProviderTeamWorkflowInput {
	action: ServiceProviderTeamWorkflowAction;
	organizationId: string;
	userId: string;
	teamMemberId?: string;
	data?: {
		displayName?: string;
		title?: string | null;
		roles?: ServiceProviderRole[];
		reason?: string;
		activationCodeEncrypted?: string;
		activationCodeExpiresAt?: Date;
		targetUserId?: string;
		technicianId?: string | null;
	};
}

export interface ServiceProviderTeamWorkflowResult extends EntityWorkflowResult {
	teamMemberId?: string;
	status?: string;
	activatedAt?: string;
	suspendedAt?: string;
	deactivatedAt?: string;
	activationCodeExpiresAt?: string;
	[key: string]: unknown;
}

async function createTeamMember(
	organizationId: string,
	userId: string,
	targetUserId: string,
	data: {
		displayName: string;
		title?: string | null;
		roles: ServiceProviderRole[];
		activationCodeEncrypted: string;
		activationCodeExpiresAt: Date;
		technicianId?: string | null;
	}
): Promise<{ id: string; displayName: string; status: ServiceProviderTeamMemberStatus }> {
	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.create({
				data: {
					organizationId,
					userId: targetUserId,
					displayName: data.displayName,
					title: data.title,
					roles: data.roles,
					status: ServiceProviderTeamMemberStatus.PENDING,
					activationCodeEncrypted: data.activationCodeEncrypted,
					activationCodeExpiresAt: data.activationCodeExpiresAt,
					technicianId: data.technicianId
				}
			});
		},
		{ userId, reason: 'Create service provider team member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.USER,
		entityId: teamMember.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Team member "${teamMember.displayName}" created with roles: ${data.roles.join(', ')}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.CREATE,
		workflowVersion: 'v1',
		newState: {
			id: teamMember.id,
			userId: teamMember.userId,
			displayName: teamMember.displayName,
			roles: teamMember.roles,
			status: teamMember.status
		}
	});

	return { id: teamMember.id, displayName: teamMember.displayName, status: teamMember.status };
}

async function updateTeamMember(
	teamMemberId: string,
	organizationId: string,
	userId: string,
	data: {
		displayName?: string;
		title?: string | null;
		roles?: ServiceProviderRole[];
	},
	previousState: Record<string, unknown>
): Promise<{ id: string; displayName: string }> {
	const updateData: Record<string, unknown> = {};
	if (data.displayName !== undefined) updateData.displayName = data.displayName;
	if (data.title !== undefined) updateData.title = data.title;
	if (data.roles !== undefined) updateData.roles = data.roles;

	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.update({
				where: { id: teamMemberId },
				data: updateData
			});
		},
		{ userId, reason: 'Update service provider team member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.USER,
		entityId: teamMemberId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Team member "${teamMember.displayName}" updated`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.UPDATE,
		workflowVersion: 'v1',
		previousState,
		newState: {
			displayName: teamMember.displayName,
			title: teamMember.title,
			roles: teamMember.roles
		}
	});

	return { id: teamMember.id, displayName: teamMember.displayName };
}

async function activateTeamMember(
	teamMemberId: string,
	organizationId: string,
	userId: string
): Promise<{ id: string; activatedAt: string }> {
	const now = new Date();
	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.update({
				where: { id: teamMemberId },
				data: {
					status: ServiceProviderTeamMemberStatus.ACTIVE,
					activatedAt: now,
					activationCodeEncrypted: null,
					activationCodeExpiresAt: null
				}
			});
		},
		{ userId, reason: 'Activate service provider team member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.USER,
		entityId: teamMemberId,
		action: ActivityActionType.STATUS_CHANGE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Team member "${teamMember.displayName}" activated`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.ACTIVATE,
		workflowVersion: 'v1',
		previousState: { status: ServiceProviderTeamMemberStatus.PENDING },
		newState: { status: ServiceProviderTeamMemberStatus.ACTIVE, activatedAt: now.toISOString() }
	});

	return { id: teamMember.id, activatedAt: now.toISOString() };
}

async function suspendTeamMember(
	teamMemberId: string,
	organizationId: string,
	userId: string,
	reason: string,
	previousStatus: ServiceProviderTeamMemberStatus
): Promise<{ id: string; suspendedAt: string }> {
	const now = new Date();

	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.update({
				where: { id: teamMemberId },
				data: {
					status: ServiceProviderTeamMemberStatus.SUSPENDED,
					suspendedAt: now,
					suspensionReason: reason
				}
			});
		},
		{ userId, reason: 'Suspend service provider team member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.USER,
		entityId: teamMemberId,
		action: ActivityActionType.STATUS_CHANGE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Team member "${teamMember.displayName}" suspended. Reason: ${reason}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.SUSPEND,
		workflowVersion: 'v1',
		previousState: { status: previousStatus },
		newState: {
			status: ServiceProviderTeamMemberStatus.SUSPENDED,
			suspendedAt: now.toISOString(),
			suspensionReason: reason
		}
	});

	return { id: teamMember.id, suspendedAt: now.toISOString() };
}

async function deactivateTeamMember(
	teamMemberId: string,
	organizationId: string,
	userId: string,
	reason: string,
	previousStatus: ServiceProviderTeamMemberStatus
): Promise<{ id: string; deactivatedAt: string }> {
	const now = new Date();
	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.update({
				where: { id: teamMemberId },
				data: {
					status: ServiceProviderTeamMemberStatus.DEACTIVATED,
					deactivatedAt: now,
					deactivationReason: reason
				}
			});
		},
		{ userId, reason: 'Deactivate service provider team member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.USER,
		entityId: teamMemberId,
		action: ActivityActionType.STATUS_CHANGE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Team member "${teamMember.displayName}" deactivated. Reason: ${reason}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.DEACTIVATE,
		workflowVersion: 'v1',
		previousState: { status: previousStatus },
		newState: {
			status: ServiceProviderTeamMemberStatus.DEACTIVATED,
			deactivatedAt: now.toISOString(),
			deactivationReason: reason
		}
	});

	return { id: teamMember.id, deactivatedAt: now.toISOString() };
}

async function reactivateTeamMember(
	teamMemberId: string,
	organizationId: string,
	userId: string,
	previousStatus: ServiceProviderTeamMemberStatus
): Promise<{ id: string; activatedAt: string }> {
	const now = new Date();
	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.update({
				where: { id: teamMemberId },
				data: {
					status: ServiceProviderTeamMemberStatus.ACTIVE,
					activatedAt: now,
					suspendedAt: null,
					suspensionReason: null,
					deactivatedAt: null,
					deactivationReason: null
				}
			});
		},
		{ userId, reason: 'Reactivate service provider team member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.USER,
		entityId: teamMemberId,
		action: ActivityActionType.STATUS_CHANGE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Team member "${teamMember.displayName}" reactivated`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.REACTIVATE,
		workflowVersion: 'v1',
		previousState: { status: previousStatus },
		newState: { status: ServiceProviderTeamMemberStatus.ACTIVE, activatedAt: now.toISOString() }
	});

	return { id: teamMember.id, activatedAt: now.toISOString() };
}

async function updateRoles(
	teamMemberId: string,
	organizationId: string,
	userId: string,
	roles: ServiceProviderRole[],
	previousRoles: ServiceProviderRole[]
): Promise<{ id: string }> {
	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.update({
				where: { id: teamMemberId },
				data: { roles }
			});
		},
		{ userId, reason: 'Update team member roles' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.USER,
		entityId: teamMemberId,
		action: ActivityActionType.ROLE_CHANGE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Team member "${teamMember.displayName}" roles updated: ${previousRoles.join(', ')} → ${roles.join(', ')}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.UPDATE_ROLES,
		workflowVersion: 'v1',
		previousState: { roles: previousRoles },
		newState: { roles }
	});

	return { id: teamMember.id };
}

async function regenerateActivationCode(
	teamMemberId: string,
	organizationId: string,
	userId: string,
	activationCodeEncrypted: string,
	activationCodeExpiresAt: Date
): Promise<{ id: string; activationCodeExpiresAt: string }> {
	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.update({
				where: { id: teamMemberId },
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
		entityType: ActivityEntityType.USER,
		entityId: teamMemberId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Activation code regenerated for team member "${teamMember.displayName}"`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.REGENERATE_ACTIVATION_CODE,
		workflowVersion: 'v1'
	});

	return { id: teamMember.id, activationCodeExpiresAt: activationCodeExpiresAt.toISOString() };
}

async function linkTechnician(
	teamMemberId: string,
	organizationId: string,
	userId: string,
	technicianId: string
): Promise<{ id: string }> {
	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.update({
				where: { id: teamMemberId },
				data: { technicianId }
			});
		},
		{ userId, reason: 'Link technician to team member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.USER,
		entityId: teamMemberId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Team member "${teamMember.displayName}" linked to technician`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.LINK_TECHNICIAN,
		workflowVersion: 'v1',
		newState: { technicianId }
	});

	return { id: teamMember.id };
}

async function unlinkTechnician(
	teamMemberId: string,
	organizationId: string,
	userId: string,
	previousTechnicianId: string
): Promise<{ id: string }> {
	const teamMember = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.serviceProviderTeamMember.update({
				where: { id: teamMemberId },
				data: { technicianId: null }
			});
		},
		{ userId, reason: 'Unlink technician from team member' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.USER,
		entityId: teamMemberId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Team member "${teamMember.displayName}" unlinked from technician`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'serviceProviderTeamWorkflow_v1',
		workflowStep: ServiceProviderTeamWorkflowAction.UNLINK_TECHNICIAN,
		workflowVersion: 'v1',
		previousState: { technicianId: previousTechnicianId },
		newState: { technicianId: null }
	});

	return { id: teamMember.id };
}

async function serviceProviderTeamWorkflow(
	input: ServiceProviderTeamWorkflowInput
): Promise<ServiceProviderTeamWorkflowResult> {
	const log = createWorkflowLogger('serviceProviderTeamWorkflow_v1', input.organizationId);
	const startTime = Date.now();
	logWorkflowStart(log, input.action, { teamMemberId: input.teamMemberId, organizationId: input.organizationId });

	try {
		switch (input.action) {
			case ServiceProviderTeamWorkflowAction.CREATE: {
				if (!input.data?.targetUserId || !input.data?.displayName || !input.data?.roles || !input.data?.activationCodeEncrypted || !input.data?.activationCodeExpiresAt) {
					const error = new Error('Missing required fields for CREATE: targetUserId, displayName, roles, activationCodeEncrypted, activationCodeExpiresAt');
					logStepError(log, 'validation', error, { data: input.data });
					throw error;
				}
				log.debug('Step: createTeamMember starting');
				const result = await DBOS.runStep(
					() => createTeamMember(input.organizationId, input.userId, input.data!.targetUserId!, {
						displayName: input.data!.displayName!,
						title: input.data!.title,
						roles: input.data!.roles!,
						activationCodeEncrypted: input.data!.activationCodeEncrypted!,
						activationCodeExpiresAt: input.data!.activationCodeExpiresAt!,
						technicianId: input.data!.technicianId
					}),
					{ name: 'createTeamMember' }
				);
				log.info('Step: createTeamMember completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'team_member_created', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id,
					status: result.status
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.UPDATE: {
				if (!input.teamMemberId) {
					const error = new Error('Missing required field: teamMemberId for UPDATE');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				const existing = await prisma.serviceProviderTeamMember.findUnique({ where: { id: input.teamMemberId } });
				if (!existing) throw new Error('Team member not found');

				const previousState = {
					displayName: existing.displayName,
					title: existing.title,
					roles: existing.roles
				};

				log.debug('Step: updateTeamMember starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => updateTeamMember(input.teamMemberId!, input.organizationId, input.userId, input.data || {}, previousState),
					{ name: 'updateTeamMember' }
				);
				log.info('Step: updateTeamMember completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'team_member_updated', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.ACTIVATE: {
				if (!input.teamMemberId) {
					const error = new Error('Missing required field: teamMemberId for ACTIVATE');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				log.debug('Step: activateTeamMember starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => activateTeamMember(input.teamMemberId!, input.organizationId, input.userId),
					{ name: 'activateTeamMember' }
				);
				log.info('Step: activateTeamMember completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'team_member_activated', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id,
					status: ServiceProviderTeamMemberStatus.ACTIVE,
					activatedAt: result.activatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.SUSPEND: {
				if (!input.teamMemberId || !input.data?.reason) {
					const error = new Error('Missing required fields: teamMemberId, reason for SUSPEND');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				const existing = await prisma.serviceProviderTeamMember.findUnique({ where: { id: input.teamMemberId } });
				if (!existing) throw new Error('Team member not found');

				log.debug('Step: suspendTeamMember starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => suspendTeamMember(input.teamMemberId!, input.organizationId, input.userId, input.data!.reason!, existing.status),
					{ name: 'suspendTeamMember' }
				);
				log.info('Step: suspendTeamMember completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'team_member_suspended', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id,
					status: ServiceProviderTeamMemberStatus.SUSPENDED,
					suspendedAt: result.suspendedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.DEACTIVATE: {
				if (!input.teamMemberId || !input.data?.reason) {
					const error = new Error('Missing required fields: teamMemberId, reason for DEACTIVATE');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				const existing = await prisma.serviceProviderTeamMember.findUnique({ where: { id: input.teamMemberId } });
				if (!existing) throw new Error('Team member not found');

				log.debug('Step: deactivateTeamMember starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => deactivateTeamMember(input.teamMemberId!, input.organizationId, input.userId, input.data!.reason!, existing.status),
					{ name: 'deactivateTeamMember' }
				);
				log.info('Step: deactivateTeamMember completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'team_member_deactivated', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id,
					status: ServiceProviderTeamMemberStatus.DEACTIVATED,
					deactivatedAt: result.deactivatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.REACTIVATE: {
				if (!input.teamMemberId) {
					const error = new Error('Missing required field: teamMemberId for REACTIVATE');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				const existing = await prisma.serviceProviderTeamMember.findUnique({ where: { id: input.teamMemberId } });
				if (!existing) throw new Error('Team member not found');

				log.debug('Step: reactivateTeamMember starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => reactivateTeamMember(input.teamMemberId!, input.organizationId, input.userId, existing.status),
					{ name: 'reactivateTeamMember' }
				);
				log.info('Step: reactivateTeamMember completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'team_member_reactivated', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id,
					status: ServiceProviderTeamMemberStatus.ACTIVE,
					activatedAt: result.activatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.UPDATE_ROLES: {
				if (!input.teamMemberId || !input.data?.roles) {
					const error = new Error('Missing required fields: teamMemberId, roles for UPDATE_ROLES');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				const existing = await prisma.serviceProviderTeamMember.findUnique({ where: { id: input.teamMemberId } });
				if (!existing) throw new Error('Team member not found');

				log.debug('Step: updateRoles starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => updateRoles(input.teamMemberId!, input.organizationId, input.userId, input.data!.roles!, existing.roles as ServiceProviderRole[]),
					{ name: 'updateRoles' }
				);
				log.info('Step: updateRoles completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'roles_updated', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.REGENERATE_ACTIVATION_CODE: {
				if (!input.teamMemberId || !input.data?.activationCodeEncrypted || !input.data?.activationCodeExpiresAt) {
					const error = new Error('Missing required fields: teamMemberId, activationCodeEncrypted, activationCodeExpiresAt for REGENERATE_ACTIVATION_CODE');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				log.debug('Step: regenerateActivationCode starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => regenerateActivationCode(input.teamMemberId!, input.organizationId, input.userId, input.data!.activationCodeEncrypted!, input.data!.activationCodeExpiresAt!),
					{ name: 'regenerateActivationCode' }
				);
				log.info('Step: regenerateActivationCode completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'activation_code_regenerated', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id,
					activationCodeExpiresAt: result.activationCodeExpiresAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.ACTIVATE_WITH_CODE: {
				if (!input.teamMemberId) {
					const error = new Error('Missing required field: teamMemberId for ACTIVATE_WITH_CODE');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				log.debug('Step: activateTeamMember (with code) starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => activateTeamMember(input.teamMemberId!, input.organizationId, input.userId),
					{ name: 'activateTeamMemberWithCode' }
				);
				log.info('Step: activateTeamMember (with code) completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'team_member_activated_with_code', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id,
					status: ServiceProviderTeamMemberStatus.ACTIVE,
					activatedAt: result.activatedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.LINK_TECHNICIAN: {
				if (!input.teamMemberId || !input.data?.technicianId) {
					const error = new Error('Missing required fields: teamMemberId, technicianId for LINK_TECHNICIAN');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				log.debug('Step: linkTechnician starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => linkTechnician(input.teamMemberId!, input.organizationId, input.userId, input.data!.technicianId!),
					{ name: 'linkTechnician' }
				);
				log.info('Step: linkTechnician completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'technician_linked', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case ServiceProviderTeamWorkflowAction.UNLINK_TECHNICIAN: {
				if (!input.teamMemberId) {
					const error = new Error('Missing required field: teamMemberId for UNLINK_TECHNICIAN');
					logStepError(log, 'validation', error, { teamMemberId: input.teamMemberId });
					throw error;
				}
				const existing = await prisma.serviceProviderTeamMember.findUnique({ where: { id: input.teamMemberId } });
				if (!existing) throw new Error('Team member not found');
				if (!existing.technicianId) throw new Error('Team member is not linked to a technician');

				log.debug('Step: unlinkTechnician starting', { teamMemberId: input.teamMemberId });
				const result = await DBOS.runStep(
					() => unlinkTechnician(input.teamMemberId!, input.organizationId, input.userId, existing.technicianId!),
					{ name: 'unlinkTechnician' }
				);
				log.info('Step: unlinkTechnician completed', { teamMemberId: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'technician_unlinked', ...result });
				const successResult: ServiceProviderTeamWorkflowResult = {
					success: true,
					entityId: result.id,
					teamMemberId: result.id
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const error = new Error(`Unknown action: ${input.action}`);
				logStepError(log, 'validation', error, { action: input.action });
				throw error;
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		log.error('Workflow failed', { error: errorMessage });
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });
		const failureResult: ServiceProviderTeamWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, failureResult);
		return failureResult;
	}
}

export const serviceProviderTeamWorkflow_v1 = DBOS.registerWorkflow(serviceProviderTeamWorkflow);
