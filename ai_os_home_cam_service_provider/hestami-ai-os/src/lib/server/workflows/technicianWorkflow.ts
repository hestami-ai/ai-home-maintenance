/**
 * Technician Workflow (v1)
 *
 * DBOS durable workflow for technician management operations.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ContractorTradeType } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('TechnicianWorkflow');

const WORKFLOW_STATUS_EVENT = 'technician_status';
const WORKFLOW_ERROR_EVENT = 'technician_error';

type TechnicianAction =
	| 'UPSERT_TECHNICIAN'
	| 'ADD_SKILL'
	| 'ADD_CERTIFICATION'
	| 'SET_AVAILABILITY'
	| 'ADD_TIME_OFF'
	| 'ADD_TERRITORY';

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

	let technician;
	if (technicianId) {
		technician = await prisma.technician.update({
			where: { id: technicianId },
			data: {
				...rest,
				branchId: (branchId as string) ?? null,
				hireDate: parsedHire,
				terminationDate: parsedTermination
			}
		});
	} else {
		technician = await prisma.technician.create({
			data: {
				organizationId,
				...rest,
				branchId: (branchId as string) ?? null,
				hireDate: parsedHire,
				terminationDate: parsedTermination
			} as Parameters<typeof prisma.technician.create>[0]['data']
		});
	}

	await recordWorkflowEvent({
		organizationId,
		entityType: 'TECHNICIAN',
		entityId: technician.id,
		action: technicianId ? 'UPDATE' : 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Technician ${technicianId ? 'updated' : 'created'}: ${technician.firstName} ${technician.lastName}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'technicianWorkflow_v1',
		workflowStep: 'UPSERT_TECHNICIAN',
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
	const skill = await prisma.technicianSkill.upsert({
		where: {
			technicianId_trade: {
				technicianId,
				trade: data.trade as ContractorTradeType
			}
		},
		update: {
			level: data.level as number ?? 1,
			notes: data.notes as string | undefined
		},
		create: {
			technicianId,
			trade: data.trade as ContractorTradeType,
			level: data.level as number ?? 1,
			notes: data.notes as string | undefined
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'TECHNICIAN',
		entityId: technicianId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Skill added: ${data.trade}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'technicianWorkflow_v1',
		workflowStep: 'ADD_SKILL',
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
	const cert = await prisma.technicianCertification.create({
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

	await recordWorkflowEvent({
		organizationId,
		entityType: 'TECHNICIAN',
		entityId: technicianId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: `Certification added: ${data.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'technicianWorkflow_v1',
		workflowStep: 'ADD_CERTIFICATION',
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
	const availability = await prisma.technicianAvailability.upsert({
		where: { technicianId },
		update: data as Parameters<typeof prisma.technicianAvailability.update>[0]['data'],
		create: { technicianId, ...data } as Parameters<typeof prisma.technicianAvailability.create>[0]['data']
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'TECHNICIAN',
		entityId: technicianId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Availability updated',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'technicianWorkflow_v1',
		workflowStep: 'SET_AVAILABILITY',
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
	const timeOff = await prisma.technicianTimeOff.create({
		data: {
			technicianId,
			startsAt: new Date(data.startsAt as string),
			endsAt: new Date(data.endsAt as string),
			reason: data.reason as string | undefined
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'TECHNICIAN',
		entityId: technicianId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Time off added',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'technicianWorkflow_v1',
		workflowStep: 'ADD_TIME_OFF',
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
	const isPrimary = data.isPrimary as boolean ?? false;

	// If setting as primary, unset other primaries
	if (isPrimary) {
		await prisma.technicianTerritory.updateMany({
			where: { technicianId, isPrimary: true },
			data: { isPrimary: false }
		});
	}

	const territory = await prisma.technicianTerritory.upsert({
		where: {
			technicianId_serviceAreaId: {
				technicianId,
				serviceAreaId: data.serviceAreaId as string
			}
		},
		update: { isPrimary },
		create: { technicianId, serviceAreaId: data.serviceAreaId as string, isPrimary }
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'TECHNICIAN',
		entityId: technicianId,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Territory added',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'technicianWorkflow_v1',
		workflowStep: 'ADD_TERRITORY',
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
			case 'UPSERT_TECHNICIAN': {
				const result = await DBOS.runStep(
					() => upsertTechnician(input.organizationId, input.userId, input.technicianId, input.data),
					{ name: 'upsertTechnician' }
				);
				entityId = result.id;
				break;
			}
			case 'ADD_SKILL': {
				if (!input.technicianId) throw new Error('technicianId required for ADD_SKILL');
				const result = await DBOS.runStep(
					() => addSkill(input.organizationId, input.userId, input.technicianId!, input.data),
					{ name: 'addSkill' }
				);
				entityId = result.id;
				break;
			}
			case 'ADD_CERTIFICATION': {
				if (!input.technicianId) throw new Error('technicianId required for ADD_CERTIFICATION');
				const result = await DBOS.runStep(
					() => addCertification(input.organizationId, input.userId, input.technicianId!, input.data),
					{ name: 'addCertification' }
				);
				entityId = result.id;
				break;
			}
			case 'SET_AVAILABILITY': {
				if (!input.technicianId) throw new Error('technicianId required for SET_AVAILABILITY');
				const result = await DBOS.runStep(
					() => setAvailability(input.organizationId, input.userId, input.technicianId!, input.data),
					{ name: 'setAvailability' }
				);
				entityId = result.id;
				break;
			}
			case 'ADD_TIME_OFF': {
				if (!input.technicianId) throw new Error('technicianId required for ADD_TIME_OFF');
				const result = await DBOS.runStep(
					() => addTimeOff(input.organizationId, input.userId, input.technicianId!, input.data),
					{ name: 'addTimeOff' }
				);
				entityId = result.id;
				break;
			}
			case 'ADD_TERRITORY': {
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
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'TECHNICIAN_WORKFLOW_ERROR'
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
	workflowId: string
): Promise<TechnicianWorkflowResult> {
	const handle = await DBOS.startWorkflow(technicianWorkflow_v1, {
		workflowID: workflowId
	})(input);

	return handle.getResult();
}

export type { TechnicianWorkflowInput, TechnicianWorkflowResult, TechnicianAction };
