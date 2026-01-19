/**
 * Maintenance Contract Workflow (v1)
 *
 * DBOS durable workflow for recurring visit scheduling, renewals, and SLA scoring.
 * Handles: visit generation, renewal processing, SLA calculation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import type { ServiceContractStatus, RecurrenceFrequency } from '../../../../generated/prisma/client.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import {
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType,
	RecurrenceFrequency as RecurrenceFrequencyEnum,
	ServiceContractStatus as ServiceContractStatusEnum,
	ScheduledVisitStatus
} from '../../../../generated/prisma/enums.js';

// Action types for maintenance contract operations
const MaintenanceContractAction = {
	GENERATE_VISITS: 'GENERATE_VISITS',
	PROCESS_RENEWAL: 'PROCESS_RENEWAL',
	CALCULATE_SLA: 'CALCULATE_SLA',
	CHECK_EXPIRATION: 'CHECK_EXPIRATION'
} as const;

// Workflow error types for tracing
const WorkflowErrorType = {
	MAINTENANCE_CONTRACT_WORKFLOW_ERROR: 'MAINTENANCE_CONTRACT_WORKFLOW_ERROR'
} as const;

const WORKFLOW_STATUS_EVENT = 'contract_status';
const WORKFLOW_ERROR_EVENT = 'contract_error';

interface ContractWorkflowInput {
	organizationId: string;
	contractId: string;
	action: 'GENERATE_VISITS' | 'PROCESS_RENEWAL' | 'CALCULATE_SLA' | 'CHECK_EXPIRATION';
	userId: string;
	throughDate?: string;
	newEndDate?: string;
	newContractValue?: number;
}

interface ContractWorkflowResult {
	success: boolean;
	contractId: string;
	action: string;
	timestamp: string;
	visitsGenerated?: number;
	slaScore?: number;
	renewed?: boolean;
	error?: string;
}

function calculateNextVisitDate(
	frequency: RecurrenceFrequency,
	fromDate: Date,
	preferredDayOfWeek?: number | null,
	preferredDayOfMonth?: number | null
): Date {
	const next = new Date(fromDate);

	switch (frequency) {
		case RecurrenceFrequencyEnum.DAILY:
			next.setDate(next.getDate() + 1);
			break;
		case RecurrenceFrequencyEnum.WEEKLY:
			next.setDate(next.getDate() + 7);
			if (preferredDayOfWeek !== null && preferredDayOfWeek !== undefined) {
				const currentDay = next.getDay();
				const daysUntil = (preferredDayOfWeek - currentDay + 7) % 7;
				next.setDate(next.getDate() + daysUntil);
			}
			break;
		case RecurrenceFrequencyEnum.BIWEEKLY:
			next.setDate(next.getDate() + 14);
			break;
		case RecurrenceFrequencyEnum.MONTHLY:
			next.setMonth(next.getMonth() + 1);
			if (preferredDayOfMonth !== null && preferredDayOfMonth !== undefined) {
				next.setDate(Math.min(preferredDayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
			}
			break;
		case RecurrenceFrequencyEnum.QUARTERLY:
			next.setMonth(next.getMonth() + 3);
			break;
		case RecurrenceFrequencyEnum.SEMI_ANNUAL:
			next.setMonth(next.getMonth() + 6);
			break;
		case RecurrenceFrequencyEnum.ANNUAL:
			next.setFullYear(next.getFullYear() + 1);
			break;
	}

	return next;
}

async function generateScheduledVisits(
	contractId: string,
	throughDate: Date,
	organizationId: string,
	userId: string
): Promise<number> {
	const schedules = await prisma.contractSchedule.findMany({
		where: { contractId, isActive: true }
	});

	let totalVisitsCreated = 0;

	for (const schedule of schedules) {
		const visits: any[] = [];
		let currentDate = schedule.nextGenerateAt ?? schedule.startDate;
		const endDate = schedule.endDate
			? new Date(Math.min(throughDate.getTime(), schedule.endDate.getTime()))
			: throughDate;

		// Get current max visit number
		const maxVisit = await prisma.scheduledVisit.findFirst({
			where: { contractId },
			orderBy: { visitNumber: 'desc' }
		});
		let visitNumber = (maxVisit?.visitNumber ?? 0) + 1;

		while (currentDate <= endDate) {
			visits.push({
				contractId,
				scheduleId: schedule.id,
				visitNumber: visitNumber++,
				scheduledDate: new Date(currentDate),
				scheduledStart: schedule.preferredTimeStart
					? new Date(`${currentDate.toISOString().split('T')[0]}T${schedule.preferredTimeStart}:00`)
					: null,
				scheduledEnd: schedule.preferredTimeEnd
					? new Date(`${currentDate.toISOString().split('T')[0]}T${schedule.preferredTimeEnd}:00`)
					: null,
				technicianId: schedule.technicianId
			});

			currentDate = calculateNextVisitDate(
				schedule.frequency,
				currentDate,
				schedule.preferredDayOfWeek,
				schedule.preferredDayOfMonth
			);
		}

		if (visits.length > 0) {
			await orgTransaction(organizationId, async (tx) => {
				await tx.scheduledVisit.createMany({ data: visits });
				await tx.contractSchedule.update({
					where: { id: schedule.id },
					data: {
						lastGeneratedAt: new Date(),
						nextGenerateAt: currentDate
					}
				});
			}, { userId, reason: 'Generate scheduled visits for maintenance contract' });
			totalVisitsCreated += visits.length;
		}
	}

	return totalVisitsCreated;
}

async function processContractRenewal(
	contractId: string,
	newEndDate: Date,
	newContractValue: number | undefined,
	userId: string,
	organizationId: string
): Promise<boolean> {
	const contract = await prisma.serviceContract.findUnique({
		where: { id: contractId }
	});

	if (!contract || !([ServiceContractStatusEnum.ACTIVE, ServiceContractStatusEnum.EXPIRED] as ServiceContractStatus[]).includes(contract.status)) {
		return false;
	}

	const renewalCount = await prisma.contractRenewal.count({
		where: { contractId }
	});

	const newValue = newContractValue ?? Number(contract.contractValue);
	const previousValue = Number(contract.contractValue);
	const changePercent = previousValue > 0
		? ((newValue - previousValue) / previousValue) * 100
		: 0;

	await orgTransaction(organizationId, async (tx) => {
		await tx.contractRenewal.create({
			data: {
				contractId,
				renewalNumber: renewalCount + 1,
				previousEndDate: contract.endDate,
				newEndDate,
				previousValue: contract.contractValue,
				newValue,
				changePercent,
				renewedAt: new Date(),
				renewedBy: userId
			}
		});
		await tx.serviceContract.update({
			where: { id: contractId },
			data: {
				status: ServiceContractStatusEnum.ACTIVE,
				endDate: newEndDate,
				contractValue: newValue
			}
		});
	}, { userId, reason: 'Process contract renewal' });

	return true;
}

async function calculateSLAScore(
	contractId: string,
	organizationId: string,
	userId: string
): Promise<number> {
	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	const visits = await prisma.scheduledVisit.findMany({
		where: {
			contractId,
			scheduledDate: { gte: thirtyDaysAgo, lte: now }
		}
	});

	if (visits.length === 0) {
		return 100; // No visits scheduled = 100% compliance
	}

	const completedOnTime = visits.filter(v => {
		if (v.status !== ScheduledVisitStatus.COMPLETED) return false;
		if (!v.completedAt) return false;
		// Consider on-time if completed within 24 hours of scheduled date
		const scheduledEnd = v.scheduledEnd ?? v.scheduledDate;
		const deadline = new Date(scheduledEnd.getTime() + 24 * 60 * 60 * 1000);
		return v.completedAt <= deadline;
	}).length;

	const score = Math.round((completedOnTime / visits.length) * 100);

	// Update or create SLA record for this period
	const periodStart = thirtyDaysAgo;
	const periodEnd = now;

	await orgTransaction(organizationId, async (tx) => {
		await tx.contractSLARecord.upsert({
			where: {
				contractId_periodStart_periodEnd: {
					contractId,
					periodStart,
					periodEnd
				}
			},
			create: {
				contractId,
				periodStart,
				periodEnd,
				scheduledVisits: visits.length,
				completedVisits: visits.filter(v => v.status === ScheduledVisitStatus.COMPLETED).length,
				missedVisits: visits.filter(v => v.status === ScheduledVisitStatus.MISSED).length,
				visitCompliancePercent: score
			},
			update: {
				scheduledVisits: visits.length,
				completedVisits: visits.filter(v => v.status === ScheduledVisitStatus.COMPLETED).length,
				missedVisits: visits.filter(v => v.status === ScheduledVisitStatus.MISSED).length,
				visitCompliancePercent: score
			}
		});
	}, { userId, reason: 'Calculate SLA score for contract' });

	return score;
}

async function checkContractExpiration(
	contractId: string,
	organizationId: string,
	userId: string
): Promise<{ expired: boolean; daysUntilExpiration: number }> {
	const contract = await prisma.serviceContract.findUnique({
		where: { id: contractId },
		select: { endDate: true, status: true, autoRenew: true }
	});

	if (!contract) {
		return { expired: false, daysUntilExpiration: 0 };
	}

	const now = new Date();
	const daysUntilExpiration = Math.ceil((contract.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

	if (daysUntilExpiration <= 0 && contract.status === ServiceContractStatusEnum.ACTIVE) {
		// Mark as expired
		await orgTransaction(organizationId, async (tx) => {
			await tx.serviceContract.update({
				where: { id: contractId },
				data: { status: ServiceContractStatusEnum.EXPIRED }
			});
		}, { userId, reason: 'Mark contract as expired' });
		return { expired: true, daysUntilExpiration };
	}

	return { expired: false, daysUntilExpiration };
}

async function maintenanceContractWorkflow(input: ContractWorkflowInput): Promise<ContractWorkflowResult> {
	// Cast input to any to satisfy logger type compatibility
	const log = createWorkflowLogger('maintenanceContractWorkflow', DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, input as any);

	try {
		const contract = await prisma.serviceContract.findUnique({
			where: { id: input.contractId },
			select: { id: true, status: true, organizationId: true }
		});

		if (!contract) {
			const errorResult = {
				success: false,
				contractId: input.contractId,
				action: input.action,
				timestamp: new Date().toISOString(),
				error: 'Contract not found'
			};
			logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
			return errorResult;
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'validated', action: input.action });

		let successResult: ContractWorkflowResult;

		switch (input.action) {
			case 'GENERATE_VISITS': {
				const throughDate = input.throughDate ? new Date(input.throughDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
				const visitsGenerated = await DBOS.runStep(
					() => generateScheduledVisits(input.contractId, throughDate, contract.organizationId, input.userId),
					{ name: 'generateScheduledVisits' }
				);

				await recordWorkflowEvent({
					organizationId: contract.organizationId,
					entityType: ActivityEntityType.JOB,
					entityId: input.contractId,
					action: ActivityActionType.CREATE,
					eventCategory: ActivityEventCategory.SYSTEM,
					summary: `Generated ${visitsGenerated} visits for contract`,
					performedById: input.userId,
					performedByType: ActivityActorType.HUMAN,
					workflowId: 'maintenanceContract_v1',
					workflowStep: MaintenanceContractAction.GENERATE_VISITS,
					workflowVersion: 'v1'
				});

				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'visits_generated', count: visitsGenerated });

				successResult = {
					success: true,
					contractId: input.contractId,
					action: input.action,
					timestamp: new Date().toISOString(),
					visitsGenerated
				};
				break;
			}

			case 'PROCESS_RENEWAL': {
				if (!input.newEndDate) {
					const errorResult = {
						success: false,
						contractId: input.contractId,
						action: input.action,
						timestamp: new Date().toISOString(),
						error: 'New end date is required for renewal'
					};
					logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
					return errorResult;
				}

				const renewed = await DBOS.runStep(
					() => processContractRenewal(input.contractId, new Date(input.newEndDate!), input.newContractValue, input.userId, contract.organizationId),
					{ name: 'processContractRenewal' }
				);

				if (renewed) {
					await recordWorkflowEvent({
						organizationId: contract.organizationId,
						entityType: ActivityEntityType.JOB,
						entityId: input.contractId,
						action: ActivityActionType.UPDATE, // RENEWAL is an update to contract status
						eventCategory: ActivityEventCategory.EXECUTION,
						summary: 'Contract renewed',
						performedById: input.userId,
						performedByType: ActivityActorType.HUMAN,
						workflowId: 'maintenanceContract_v1',
						workflowStep: MaintenanceContractAction.PROCESS_RENEWAL,
						workflowVersion: 'v1'
					});
				}

				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'renewal_processed', renewed });

				successResult = {
					success: renewed,
					contractId: input.contractId,
					action: input.action,
					timestamp: new Date().toISOString(),
					renewed,
					error: renewed ? undefined : 'Contract cannot be renewed in current status'
				};
				break;
			}

			case 'CALCULATE_SLA': {
				const slaScore = await DBOS.runStep(
					() => calculateSLAScore(input.contractId, input.organizationId, input.userId),
					{ name: 'calculateSLAScore' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'sla_calculated', score: slaScore });

				successResult = {
					success: true,
					contractId: input.contractId,
					action: input.action,
					timestamp: new Date().toISOString(),
					slaScore
				};
				break;
			}

			case 'CHECK_EXPIRATION': {
				const expirationStatus = await DBOS.runStep(
					() => checkContractExpiration(input.contractId, input.organizationId, input.userId),
					{ name: 'checkContractExpiration' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'expiration_checked', ...expirationStatus });

				successResult = {
					success: true,
					contractId: input.contractId,
					action: input.action,
					timestamp: new Date().toISOString()
				};
				break;
			}

			default:
				const errorResult = {
					success: false,
					contractId: input.contractId,
					action: input.action,
					timestamp: new Date().toISOString(),
					error: `Unknown action: ${input.action}`
				};
				logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
				return errorResult;
		}

		logWorkflowEnd(log, input.action, true, startTime, successResult as any);
		return successResult;

	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error('Workflow failed', { action: input.action, error: errorMessage });
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.MAINTENANCE_CONTRACT_WORKFLOW_ERROR
		});

		const errorResult = {
			success: false,
			contractId: input.contractId,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
		return errorResult;
	}
}

export const maintenanceContract_v1 = DBOS.registerWorkflow(maintenanceContractWorkflow);

export async function startMaintenanceContractWorkflow(
	input: ContractWorkflowInput,
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `contract-${input.action.toLowerCase()}-${input.contractId}-${Date.now()}`;
	await DBOS.startWorkflow(maintenanceContract_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getMaintenanceContractWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

export async function getMaintenanceContractWorkflowError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

export type { ContractWorkflowInput, ContractWorkflowResult };
