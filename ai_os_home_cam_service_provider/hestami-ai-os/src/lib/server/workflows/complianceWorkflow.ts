/**
 * Compliance Workflow (v1)
 *
 * DBOS durable workflow for license/insurance checks, vendor approval updates, gating unsafe vendors.
 * Handles: compliance verification, expiration alerts, vendor status updates.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';

const WORKFLOW_STATUS_EVENT = 'compliance_status';
const WORKFLOW_ERROR_EVENT = 'compliance_error';

interface ComplianceWorkflowInput {
	action: 'CHECK_COMPLIANCE' | 'CHECK_EXPIRATIONS' | 'UPDATE_COMPLIANCE_SCORE';
	organizationId: string;
	userId: string;
}

interface ComplianceWorkflowResult {
	success: boolean;
	action: string;
	timestamp: string;
	isCompliant?: boolean;
	complianceScore?: number;
	issues?: string[];
	expiringItems?: Array<{ type: string; id: string; expiresAt: string; daysUntil: number }>;
	error?: string;
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
		l => l.status === 'ACTIVE' && (!l.expirationDate || l.expirationDate > now)
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
		i => i.status === 'ACTIVE' && (!i.expirationDate || i.expirationDate > now)
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
				type: 'LICENSE',
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
				type: 'INSURANCE',
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
	score: number
): Promise<void> {
	await prisma.contractorProfile.update({
		where: { organizationId },
		data: {
			complianceScore: score,
			lastComplianceCheck: new Date()
		}
	});
}

async function complianceWorkflow(input: ComplianceWorkflowInput): Promise<ComplianceWorkflowResult> {
	const workflowId = DBOS.workflowID;

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'CHECK_COMPLIANCE': {
				const compliance = await DBOS.runStep(
					() => checkOrganizationCompliance(input.organizationId),
					{ name: 'checkOrganizationCompliance' }
				);
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'compliance_checked', ...compliance });

				// Update the score in the profile
				await DBOS.runStep(
					() => updateComplianceScore(input.organizationId, compliance.score),
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

			case 'CHECK_EXPIRATIONS': {
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

			case 'UPDATE_COMPLIANCE_SCORE': {
				const compliance = await DBOS.runStep(
					() => checkOrganizationCompliance(input.organizationId),
					{ name: 'checkOrganizationCompliance' }
				);

				await DBOS.runStep(
					() => updateComplianceScore(input.organizationId, compliance.score),
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

			default:
				return {
					success: false,
					action: input.action,
					timestamp: new Date().toISOString(),
					error: `Unknown action: ${input.action}`
				};
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

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
	workflowId?: string
): Promise<{ workflowId: string }> {
	const id = workflowId || `compliance-${input.action.toLowerCase()}-${input.organizationId}-${Date.now()}`;
	await DBOS.startWorkflow(complianceWorkflow_v1, { workflowID: id })(input);
	return { workflowId: id };
}

export async function getComplianceWorkflowStatus(
	workflowId: string
): Promise<{ step: string; [key: string]: unknown } | null> {
	const status = await DBOS.getEvent(workflowId, WORKFLOW_STATUS_EVENT, 0);
	return status as { step: string; [key: string]: unknown } | null;
}

export async function getComplianceWorkflowError(
	workflowId: string
): Promise<{ error: string } | null> {
	const error = await DBOS.getEvent(workflowId, WORKFLOW_ERROR_EVENT, 0);
	return error as { error: string } | null;
}

export type { ComplianceWorkflowInput, ComplianceWorkflowResult };
