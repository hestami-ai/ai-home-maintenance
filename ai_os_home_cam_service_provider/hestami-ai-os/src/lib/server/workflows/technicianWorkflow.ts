/**
 * Technician Workflow (v1)
 *
 * DBOS durable workflow for technician management operations.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import type { ContractorTradeType } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import { orgTransaction } from '../db/rls.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	TECHNICIAN_WORKFLOW_ERROR: 'TECHNICIAN_WORKFLOW_ERROR'
} as const;

const log = createWorkflowLogger('TechnicianWorkflow');

const WORKFLOW_STATUS_EVENT = 'technician_status';
const WORKFLOW_ERROR_EVENT = 'technician_error';

export const TechnicianActionConst = {
	UPSERT_TECHNICIAN: 'UPSERT_TECHNICIAN',
	ADD_SKILL: 'ADD_SKILL',
	ADD_CERTIFICATION: 'ADD_CERTIFICATION',
	SET_AVAILABILITY: 'SET_AVAILABILITY',
	ADD_TIME_OFF: 'ADD_TIME_OFF',
	ADD_TERRITORY: 'ADD_TERRITORY'
} as const;

type TechnicianAction = (typeof TechnicianActionConst)[keyof typeof TechnicianActionConst];

interface TechnicianWorkflowInput {
	action: TechnicianAction;
	organizationId: string;
	userId: string;
	technicianId?: string;
	data: Record<string, unknown>;
}

interface TechnicianWorkflowResult {
	success: boolean;
	action: TechnicianAction;
	entityId?: string;
	timestamp: string;
	error?: string;
}

async function upsertTechnician(
	organizationId: string,
	userId: string,
	technicianId: string | undefined,
	data: Record<string, unknown>
): Promise<{ id: string; firstName: string; lastName: string }> {
	const { branchId, hireDate, terminationDate, ...rest } = data;
	const parsedHire = hireDate ? new Date(hireDate as string) : undefined;
	const parsedTermination = terminationDate ? new Date(terminationDate as string) : undefined;

	const technician = await orgTransaction(
		organizationId,
		async (tx) => {
			if (technicianId) {
				return tx.technician.update({
					where: { id: technicianId },
					data: {
						...rest,
						branchId: (branchId as string) ?? null,
						hireDate: parsedHire,
						terminationDate: parsedTermination
					}
				});
			} else {
				return tx.technician.create({
					data: {
						organizationId,
						...rest,
						branchId: (branchId as string) ?? null,
						hireDate: parsedHire,
						terminationDate: parsedTermination
					} as Parameters<typeof tx.technician.create>[0]['data']
				});
			}
		},
		{ userId, reason: 'Upsert technician' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.TECHNICIAN,
		entityId: technician.id,
		action: technicianId ? ActivityActionType.UPDATE : ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Technician ${technicianId ? 'updated' : 'created'}: ${technician.firstName} ${technician.lastName}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'technicianWorkflow_v1',
		workflowStep: TechnicianActionConst.UPSERT_TECHNICIAN,
		workflowVersion: 'v1',
		technicianId: technician.id
	});

	return { id: technician.id, firstName: technician.firstName, lastName: technician.lastName };
}

async function addSkill(
	organizationId: string,
	userId: string,
	technicianId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const skill = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.technicianSkill.upsert({
				where: {
					technicianId_trade: {
						technicianId,
						trade: data.trade as ContractorTradeType
					}
				},
				update: {
					level: (data.level as number) ?? 1,
					notes: data.notes as string | undefined
				},
				create: {
					technicianId,
					trade: data.trade as ContractorTradeType,
					level: (data.level as number) ?? 1,
					notes: data.notes as string | undefined
				}
			});
		},
		{ userId, reason: 'Add technician skill' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.TECHNICIAN,
		entityId: technicianId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Skill added: ${data.trade}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'technicianWorkflow_v1',
		workflowStep: TechnicianActionConst.ADD_SKILL,
		workflowVersion: 'v1',
		technicianId
	});

	return { id: skill.id };
}

async function addCertification(
	organizationId: string,
	userId: string,
	technicianId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const cert = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.technicianCertification.create({
				data: {
					technicianId,
					name: data.name as string,
					authority: data.authority as string | undefined,
					certificationId: data.certificationId as string | undefined,
					issuedAt: data.issuedAt ? new Date(data.issuedAt as string) : undefined,
					expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : undefined,
					documentUrl: data.documentUrl as string | undefined
				}
			});
		},
		{ userId, reason: 'Add technician certification' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.TECHNICIAN,
		entityId: technicianId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Certification added: ${data.name}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'technicianWorkflow_v1',
		workflowStep: TechnicianActionConst.ADD_CERTIFICATION,
		workflowVersion: 'v1',
		technicianId
	});

	return { id: cert.id };
}

async function setAvailability(
	organizationId: string,
	userId: string,
	technicianId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const availability = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.technicianAvailability.upsert({
				where: { technicianId },
				update: data as Parameters<typeof tx.technicianAvailability.update>[0]['data'],
				create: { technicianId, ...data } as Parameters<typeof tx.technicianAvailability.create>[0]['data']
			});
		},
		{ userId, reason: 'Set technician availability' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.TECHNICIAN,
		entityId: technicianId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Availability updated',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'technicianWorkflow_v1',
		workflowStep: TechnicianActionConst.SET_AVAILABILITY,
		workflowVersion: 'v1',
		technicianId
	});

	return { id: availability.id };
}

async function addTimeOff(
	organizationId: string,
	userId: string,
	technicianId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const timeOff = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.technicianTimeOff.create({
				data: {
					technicianId,
					startsAt: new Date(data.startsAt as string),
					endsAt: new Date(data.endsAt as string),
					reason: data.reason as string | undefined
				}
			});
		},
		{ userId, reason: 'Add technician time off' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.TECHNICIAN,
		entityId: technicianId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Time off added',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'technicianWorkflow_v1',
		workflowStep: TechnicianActionConst.ADD_TIME_OFF,
		workflowVersion: 'v1',
		technicianId
	});

	return { id: timeOff.id };
}

async function addTerritory(
	organizationId: string,
	userId: string,
	technicianId: string,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const isPrimary = (data.isPrimary as boolean) ?? false;

	const territory = await orgTransaction(
		organizationId,
		async (tx) => {
			// If setting as primary, unset other primaries
			if (isPrimary) {
				await tx.technicianTerritory.updateMany({
					where: { technicianId, isPrimary: true },
					data: { isPrimary: false }
				});
			}

			return tx.technicianTerritory.upsert({
				where: {
					technicianId_serviceAreaId: {
						technicianId,
						serviceAreaId: data.serviceAreaId as string
					}
				},
				update: { isPrimary },
				create: { technicianId, serviceAreaId: data.serviceAreaId as string, isPrimary }
			});
		},
		{ userId, reason: 'Add technician territory' }
	);

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.TECHNICIAN,
		entityId: technicianId,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Territory added',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'technicianWorkflow_v1',
		workflowStep: TechnicianActionConst.ADD_TERRITORY,
		workflowVersion: 'v1',
		technicianId
	});

	return { id: territory.id };
}

async function technicianWorkflow(input: TechnicianWorkflowInput): Promise<TechnicianWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case TechnicianActionConst.UPSERT_TECHNICIAN: {
				const result = await DBOS.runStep(
					() => upsertTechnician(input.organizationId, input.userId, input.technicianId, input.data),
					{ name: 'upsertTechnician' }
				);
				entityId = result.id;
				break;
			}
			case TechnicianActionConst.ADD_SKILL: {
				if (!input.technicianId) throw new Error('technicianId required for ADD_SKILL');
				const result = await DBOS.runStep(
					() => addSkill(input.organizationId, input.userId, input.technicianId!, input.data),
					{ name: 'addSkill' }
				);
				entityId = result.id;
				break;
			}
			case TechnicianActionConst.ADD_CERTIFICATION: {
				if (!input.technicianId) throw new Error('technicianId required for ADD_CERTIFICATION');
				const result = await DBOS.runStep(
					() => addCertification(input.organizationId, input.userId, input.technicianId!, input.data),
					{ name: 'addCertification' }
				);
				entityId = result.id;
				break;
			}
			case TechnicianActionConst.SET_AVAILABILITY: {
				if (!input.technicianId) throw new Error('technicianId required for SET_AVAILABILITY');
				const result = await DBOS.runStep(
					() => setAvailability(input.organizationId, input.userId, input.technicianId!, input.data),
					{ name: 'setAvailability' }
				);
				entityId = result.id;
				break;
			}
			case TechnicianActionConst.ADD_TIME_OFF: {
				if (!input.technicianId) throw new Error('technicianId required for ADD_TIME_OFF');
				const result = await DBOS.runStep(
					() => addTimeOff(input.organizationId, input.userId, input.technicianId!, input.data),
					{ name: 'addTimeOff' }
				);
				entityId = result.id;
				break;
			}
			case TechnicianActionConst.ADD_TERRITORY: {
				if (!input.technicianId) throw new Error('technicianId required for ADD_TERRITORY');
				const result = await DBOS.runStep(
					() => addTerritory(input.organizationId, input.userId, input.technicianId!, input.data),
					{ name: 'addTerritory' }
				);
				entityId = result.id;
				break;
			}
			default:
				throw new Error(`Unknown action: ${input.action}`);
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId });

		return {
			success: true,
			action: input.action,
			entityId,
			timestamp: new Date().toISOString()
		};
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.TECHNICIAN_WORKFLOW_ERROR
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const technicianWorkflow_v1 = DBOS.registerWorkflow(technicianWorkflow);

export async function startTechnicianWorkflow(
	input: TechnicianWorkflowInput,
	idempotencyKey: string
): Promise<TechnicianWorkflowResult> {
	const handle = await DBOS.startWorkflow(technicianWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

export type { TechnicianWorkflowInput, TechnicianWorkflowResult, TechnicianAction };
