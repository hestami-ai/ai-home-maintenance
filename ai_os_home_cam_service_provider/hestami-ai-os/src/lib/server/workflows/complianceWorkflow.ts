/**
 * Compliance Workflow (v1)
 *
 * DBOS durable workflow for license/insurance checks, vendor approval updates, gating unsafe vendors.
 * Handles: compliance verification, expiration alerts, vendor status updates.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import { type LifecycleWorkflowResult } from './schemas.js';
import {
	ActivityActionType,
	LicenseStatus,
	InsuranceStatus,
	ComplianceStatus
} from '../../../../generated/prisma/enums.js';

// Alias for backward compatibility
const ComplianceDeadlineStatus = ComplianceStatus;
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

// Workflow error types for tracing
const WorkflowErrorType = {
	COMPLIANCE_WORKFLOW_ERROR: 'COMPLIANCE_WORKFLOW_ERROR'
} as const;

const log = createWorkflowLogger('ComplianceWorkflow');

// Expiring item types for compliance checks
const ExpiringItemType = {
	LICENSE: 'LICENSE',
	INSURANCE: 'INSURANCE'
} as const;

const WORKFLOW_STATUS_EVENT = 'compliance_status';
const WORKFLOW_ERROR_EVENT = 'compliance_error';

export const ComplianceAction = {
	CHECK_COMPLIANCE: 'CHECK_COMPLIANCE',
	CHECK_EXPIRATIONS: 'CHECK_EXPIRATIONS',
	UPDATE_COMPLIANCE_SCORE: 'UPDATE_COMPLIANCE_SCORE',
	CREATE_REQUIREMENT: 'CREATE_REQUIREMENT',
	UPDATE_REQUIREMENT: 'UPDATE_REQUIREMENT',
	CREATE_DEADLINE: 'CREATE_DEADLINE',
	UPDATE_DEADLINE_STATUS: 'UPDATE_DEADLINE_STATUS',
	ADD_EVIDENCE_DOCUMENT: 'ADD_EVIDENCE_DOCUMENT',
	UPDATE_CHECKLIST_ITEM: 'UPDATE_CHECKLIST_ITEM'
} as const;

export type ComplianceAction = (typeof ComplianceAction)[keyof typeof ComplianceAction];

export interface ComplianceWorkflowInput {
	action: ComplianceAction;
	organizationId: string;
	userId: string;
	data?: Record<string, unknown>;
}

export interface ComplianceWorkflowResult extends LifecycleWorkflowResult {
	entityId?: string;
	isCompliant?: boolean;
	complianceScore?: number;
	issues?: string[];
	expiringItems?: Array<{ type: string; id: string; expiresAt: string; daysUntil: number }>;
}

async function checkOrganizationCompliance(
	organizationId: string
): Promise<{ isCompliant: boolean; score: number; issues: string[] }> {
	const issues: string[] = [];
	let score = 100;

	const profile = await prisma.contractorProfile.findUnique({
		where: { organizationId },
		include: {
			licenses: true,
			insurances: true
		}
	});

	if (!profile) {
		return { isCompliant: false, score: 0, issues: ['No contractor profile found'] };
	}

	const now = new Date();

	// Check licenses
	const activeLicenses = profile.licenses.filter(
		l => l.status === LicenseStatus.ACTIVE && (!l.expirationDate || l.expirationDate > now)
	);

	if (activeLicenses.length === 0) {
		issues.push('No active license on file');
		score -= 50;
	}

	const expiredLicenses = profile.licenses.filter(
		l => l.expirationDate && l.expirationDate <= now
	);
	if (expiredLicenses.length > 0) {
		issues.push(`${expiredLicenses.length} expired license(s)`);
		score -= 10 * expiredLicenses.length;
	}

	// Check insurance
	const activeInsurance = profile.insurances.filter(
		i => i.status === InsuranceStatus.ACTIVE && (!i.expirationDate || i.expirationDate > now)
	);

	if (activeInsurance.length === 0) {
		issues.push('No active insurance on file');
		score -= 50;
	}

	const expiredInsurance = profile.insurances.filter(
		i => i.expirationDate && i.expirationDate <= now
	);
	if (expiredInsurance.length > 0) {
		issues.push(`${expiredInsurance.length} expired insurance policy(ies)`);
		score -= 10 * expiredInsurance.length;
	}

	// Ensure score is between 0 and 100
	score = Math.max(0, Math.min(100, score));

	const isCompliant = activeLicenses.length > 0 && activeInsurance.length > 0;

	return { isCompliant, score, issues };
}

async function checkUpcomingExpirations(
	organizationId: string,
	daysAhead: number = 30
): Promise<Array<{ type: string; id: string; expiresAt: string; daysUntil: number }>> {
	const expiringItems: Array<{ type: string; id: string; expiresAt: string; daysUntil: number }> = [];
	const now = new Date();
	const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

	const profile = await prisma.contractorProfile.findUnique({
		where: { organizationId },
		include: {
			licenses: {
				where: {
					expirationDate: { gte: now, lte: futureDate }
				}
			},
			insurances: {
				where: {
					expirationDate: { gte: now, lte: futureDate }
				}
			}
		}
	});

	if (!profile) {
		return expiringItems;
	}

	for (const license of profile.licenses) {
		if (license.expirationDate) {
			const daysUntil = Math.ceil((license.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
			expiringItems.push({
				type: ExpiringItemType.LICENSE,
				id: license.id,
				expiresAt: license.expirationDate.toISOString(),
				daysUntil
			});
		}
	}

	for (const insurance of profile.insurances) {
		if (insurance.expirationDate) {
			const daysUntil = Math.ceil((insurance.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
			expiringItems.push({
				type: ExpiringItemType.INSURANCE,
				id: insurance.id,
				expiresAt: insurance.expirationDate.toISOString(),
				daysUntil
			});
		}
	}

	return expiringItems.sort((a, b) => a.daysUntil - b.daysUntil);
}

async function updateComplianceScore(
	organizationId: string,
	userId: string,
	score: number
): Promise<void> {
	await orgTransaction(organizationId, async (tx) => {
		await tx.contractorProfile.update({
			where: { organizationId },
			data: {
				complianceScore: score,
				lastComplianceCheck: new Date()
			}
		});
	}, { userId, reason: 'Update compliance score' });
}

async function createRequirement(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	return orgTransaction(organizationId, async (tx) => {
		const requirement = await tx.complianceRequirement.create({
			data: {
				organizationId,
				name: data.name as string,
				description: data.description as string | undefined,
				type: data.type as any,
				jurisdiction: data.jurisdiction as string | undefined,
				recurrence: (data.recurrence as any) ?? 'ANNUAL',
				defaultDueDayOfYear: data.defaultDueDayOfYear as number | undefined,
				defaultLeadDays: (data.defaultLeadDays as number) ?? 30,
				requiresEvidence: (data.requiresEvidence as boolean) ?? false,
				evidenceTypes: (data.evidenceTypes as string[]) ?? [],
				statutoryReference: data.statutoryReference as string | undefined,
				penaltyDescription: data.penaltyDescription as string | undefined,
				checklistTemplate: data.checklistTemplate as any
			}
		});
		return requirement.id;
	}, { userId, reason: 'Create compliance requirement' });
}

async function updateRequirement(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const id = data.id as string;
	const updateData: Record<string, unknown> = {};

	if (data.name) updateData.name = data.name as string;
	if (data.description !== undefined) updateData.description = data.description as string;
	if (data.type) updateData.type = data.type;
	if (data.jurisdiction !== undefined) updateData.jurisdiction = data.jurisdiction as string;
	if (data.recurrence) updateData.recurrence = data.recurrence;
	if (data.defaultDueDayOfYear !== undefined) updateData.defaultDueDayOfYear = data.defaultDueDayOfYear as number;
	if (data.defaultLeadDays !== undefined) updateData.defaultLeadDays = data.defaultLeadDays as number;
	if (data.requiresEvidence !== undefined) updateData.requiresEvidence = data.requiresEvidence as boolean;
	if (data.evidenceTypes) updateData.evidenceTypes = data.evidenceTypes as string[];
	if (data.statutoryReference !== undefined) updateData.statutoryReference = data.statutoryReference as string;
	if (data.penaltyDescription !== undefined) updateData.penaltyDescription = data.penaltyDescription as string;
	if (data.isActive !== undefined) updateData.isActive = data.isActive as boolean;

	await orgTransaction(organizationId, async (tx) => {
		await tx.complianceRequirement.update({
			where: { id },
			data: updateData as any
		});
	}, { userId, reason: 'Update compliance requirement' });
	return id;
}

async function createDeadline(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const requirementId = data.requirementId as string;

	// Get requirement for checklist template
	const requirement = await prisma.complianceRequirement.findFirst({
		where: { id: requirementId, organizationId }
	});

	return orgTransaction(organizationId, async (tx) => {
		const deadline = await tx.complianceDeadline.create({
			data: {
				associationId: data.associationId as string,
				requirementId,
				title: data.title as string,
				description: data.description as string | undefined,
				dueDate: new Date(data.dueDate as string),
				reminderDate: data.reminderDate ? new Date(data.reminderDate as string) : undefined,
				fiscalYear: data.fiscalYear as number | undefined,
				notes: data.notes as string | undefined
			}
		});

		// Create checklist items from template if available
		if (requirement?.checklistTemplate && Array.isArray(requirement.checklistTemplate)) {
			const template = requirement.checklistTemplate as Array<{ title: string; description?: string }>;
			await tx.complianceChecklistItem.createMany({
				data: template.map((item, index) => ({
					deadlineId: deadline.id,
					title: item.title,
					description: item.description,
					sortOrder: index
				}))
			});
		}

		return deadline.id;
	}, { userId, reason: 'Create compliance deadline' });
}

async function updateDeadlineStatusStep(
	organizationId: string,
	deadlineId: string,
	userId: string,
	status: string,
	notes?: string
): Promise<string> {
	const deadline = await prisma.complianceDeadline.findUnique({
		where: { id: deadlineId }
	});

	if (!deadline) {
		throw new Error('Deadline not found');
	}

	const isCompleting = status === ComplianceDeadlineStatus.COMPLETED && deadline.status !== ComplianceDeadlineStatus.COMPLETED;

	await orgTransaction(organizationId, async (tx) => {
		await tx.complianceDeadline.update({
			where: { id: deadlineId },
			data: {
				status: status as any,
				...(isCompleting && { completedAt: new Date(), completedBy: userId }),
				...(notes !== undefined && { notes })
			}
		});
	}, { userId, reason: 'Update compliance deadline status' });

	return deadlineId;
}

async function addEvidenceDocumentStep(
	organizationId: string,
	userId: string,
	deadlineId: string,
	documentId: string
): Promise<string> {
	const deadline = await prisma.complianceDeadline.findUnique({
		where: { id: deadlineId }
	});

	if (!deadline) {
		throw new Error('Deadline not found');
	}

	if (!deadline.evidenceDocumentIds.includes(documentId)) {
		await orgTransaction(organizationId, async (tx) => {
			await tx.complianceDeadline.update({
				where: { id: deadlineId },
				data: {
					evidenceDocumentIds: [...deadline.evidenceDocumentIds, documentId]
				}
			});
		}, { userId, reason: 'Add evidence document to compliance deadline' });
	}

	return deadlineId;
}

async function updateChecklistItemStep(
	organizationId: string,
	itemId: string,
	userId: string,
	isCompleted?: boolean,
	notes?: string,
	evidenceDocumentId?: string
): Promise<string> {
	const item = await prisma.complianceChecklistItem.findUnique({
		where: { id: itemId }
	});

	if (!item) {
		throw new Error('Checklist item not found');
	}

	const isCompletingItem = isCompleted === true && !item.isCompleted;
	const isUncompletingItem = isCompleted === false && item.isCompleted;

	await orgTransaction(organizationId, async (tx) => {
		await tx.complianceChecklistItem.update({
			where: { id: itemId },
			data: {
				...(isCompleted !== undefined && { isCompleted }),
				...(isCompletingItem && { completedAt: new Date(), completedBy: userId }),
				...(isUncompletingItem && { completedAt: null, completedBy: null }),
				...(notes !== undefined && { notes }),
				...(evidenceDocumentId !== undefined && { evidenceDocumentId })
			}
		});
	}, { userId, reason: 'Update compliance checklist item' });

	return itemId;
}

async function complianceWorkflow(input: ComplianceWorkflowInput): Promise<ComplianceWorkflowResult> {
	const workflowId = DBOS.workflowID;

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case ComplianceAction.CHECK_COMPLIANCE: {
				const compliance = await DBOS.runStep(
					() => checkOrganizationCompliance(input.organizationId),
					{ name: 'checkOrganizationCompliance' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'compliance_checked', ...compliance });

				// Update the score in the profile
				await DBOS.runStep(
					() => updateComplianceScore(input.organizationId, input.userId, compliance.score),
					{ name: 'updateComplianceScore' }
				);

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					isCompliant: compliance.isCompliant,
					complianceScore: compliance.score,
					issues: compliance.issues
				};
			}

			case ComplianceAction.CHECK_EXPIRATIONS: {
				const expiringItems = await DBOS.runStep(
					() => checkUpcomingExpirations(input.organizationId),
					{ name: 'checkUpcomingExpirations' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'expirations_checked', count: expiringItems.length });

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					expiringItems
				};
			}

			case ComplianceAction.UPDATE_COMPLIANCE_SCORE: {
				const compliance = await DBOS.runStep(
					() => checkOrganizationCompliance(input.organizationId),
					{ name: 'checkOrganizationCompliance' }
				);

				await DBOS.runStep(
					() => updateComplianceScore(input.organizationId, input.userId, compliance.score),
					{ name: 'updateComplianceScore' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'score_updated', score: compliance.score });

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					complianceScore: compliance.score
				};
			}

			case ComplianceAction.CREATE_REQUIREMENT: {
				const entityId = await DBOS.runStep(
					() => createRequirement(input.organizationId, input.userId, input.data!),
					{ name: 'createRequirement' }
				);

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					entityId
				};
			}

			case ComplianceAction.UPDATE_REQUIREMENT: {
				const entityId = await DBOS.runStep(
					() => updateRequirement(input.organizationId, input.userId, input.data!),
					{ name: 'updateRequirement' }
				);

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					entityId
				};
			}

			case ComplianceAction.CREATE_DEADLINE: {
				const entityId = await DBOS.runStep(
					() => createDeadline(input.organizationId, input.userId, input.data!),
					{ name: 'createDeadline' }
				);

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					entityId
				};
			}

			case ComplianceAction.UPDATE_DEADLINE_STATUS: {
				const data = input.data || {};
				const entityId = await DBOS.runStep(
					() => updateDeadlineStatusStep(
						input.organizationId,
						data.deadlineId as string,
						input.userId,
						data.status as string,
						data.notes as string | undefined
					),
					{ name: 'updateDeadlineStatus' }
				);

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					entityId
				};
			}

			case ComplianceAction.ADD_EVIDENCE_DOCUMENT: {
				const data = input.data || {};
				const entityId = await DBOS.runStep(
					() => addEvidenceDocumentStep(
						input.organizationId,
						input.userId,
						data.deadlineId as string,
						data.documentId as string
					),
					{ name: 'addEvidenceDocument' }
				);

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					entityId
				};
			}

			case ComplianceAction.UPDATE_CHECKLIST_ITEM: {
				const data = input.data || {};
				const entityId = await DBOS.runStep(
					() => updateChecklistItemStep(
						input.organizationId,
						data.itemId as string,
						input.userId,
						data.isCompleted as boolean | undefined,
						data.notes as string | undefined,
						data.evidenceDocumentId as string | undefined
					),
					{ name: 'updateChecklistItem' }
				);

				return {
					success: true,
					action: input.action,
					timestamp: new Date().toISOString(),
					entityId
				};
			}

			default:
				return {
					success: false,
					action: input.action,
					timestamp: new Date().toISOString(),
					error: `Unknown action: ${input.action}`
				};
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: ActivityActionType.WORKFLOW_FAILED,
			errorType: WorkflowErrorType.COMPLIANCE_WORKFLOW_ERROR
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const complianceWorkflow_v1 = DBOS.registerWorkflow(complianceWorkflow);

export async function startComplianceWorkflow(
	input: ComplianceWorkflowInput,
	idempotencyKey: string
): Promise<ComplianceWorkflowResult> {
	const id = idempotencyKey || `compliance-${input.action.toLowerCase()}-${input.organizationId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(complianceWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}

export async function getComplianceWorkflowStatus(
	workflowId: string
): Promise<{ step: string;[key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string;[key: string]: unknown } | null;
}

export async function getComplianceWorkflowError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

