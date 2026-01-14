/**
 * Contractor Compliance Workflow (v1)
 *
 * DBOS durable workflow for managing contractor compliance operations.
 * Handles: refresh, setBlock, linkHoaApproval.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { VendorApprovalStatus } from '../../../../generated/prisma/client.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('ContractorComplianceWorkflow');

// Action types for the unified workflow
export const ContractorComplianceAction = {
	REFRESH: 'REFRESH',
	SET_BLOCK: 'SET_BLOCK',
	LINK_HOA_APPROVAL: 'LINK_HOA_APPROVAL'
} as const;

export type ContractorComplianceAction = (typeof ContractorComplianceAction)[keyof typeof ContractorComplianceAction];

export interface ContractorComplianceWorkflowInput {
	action: ContractorComplianceAction;
	organizationId: string;
	userId: string;
	vendorId: string;
	data: Record<string, unknown>;
}

export interface ContractorComplianceWorkflowResult extends EntityWorkflowResult {
	complianceData?: Record<string, unknown>;
}

async function getLinkAndProfile(vendorId: string, organizationId: string) {
	const link = await prisma.serviceProviderLink.findFirst({
		where: { vendorId, serviceProviderOrgId: organizationId }
	});
	if (!link) throw new Error('ServiceProviderLink not found');

	const profile = await prisma.contractorProfile.findUnique({
		where: { organizationId }
	});
	if (!profile) throw new Error('ContractorProfile not found');

	return { link, profile };
}

async function ensureComplianceRecord(vendorId: string, organizationId: string) {
	const existing = await prisma.contractorComplianceStatus.findUnique({
		where: { vendorId }
	});
	if (existing) return existing;

	const { link } = await getLinkAndProfile(vendorId, organizationId);
	return prisma.contractorComplianceStatus.create({
		data: {
			vendorId: link.vendorId,
			lastCheckedAt: new Date()
		}
	});
}

async function computeCompliance(vendorId: string, organizationId: string, persist = false) {
	const { link, profile } = await getLinkAndProfile(vendorId, organizationId);

	// Find latest valid license and insurance
	const now = new Date();
	const license = await prisma.contractorLicense.findFirst({
		where: {
			contractorProfileId: profile.id,
			status: 'ACTIVE',
			OR: [{ expirationDate: null }, { expirationDate: { gt: now } }]
		},
		orderBy: { expirationDate: 'asc' }
	});

	const insurance = await prisma.contractorInsurance.findFirst({
		where: {
			contractorProfileId: profile.id,
			status: 'ACTIVE',
			expirationDate: { gt: now }
		},
		orderBy: { expirationDate: 'asc' }
	});

	const hasValidLicense = !!license;
	const hasValidInsurance = !!insurance;
	const earliestLicenseExpiry = license?.expirationDate ?? null;
	const earliestInsuranceExpiry = insurance?.expirationDate ?? null;
	const meetsMinCoverage = !!insurance;
	const hasW9OnFile = !!(await prisma.vendor.findUnique({ where: { id: vendorId }, select: { w9OnFile: true } }))
		?.w9OnFile;

	let complianceScore = 0;
	if (hasValidLicense) complianceScore += 45;
	if (hasValidInsurance) complianceScore += 45;
	if (meetsMinCoverage) complianceScore += 5;
	if (hasW9OnFile) complianceScore += 5;

	const baseStatus = await prisma.contractorComplianceStatus.findUnique({ where: { vendorId } });
	const isBlocked = baseStatus?.isBlocked ?? false;
	const blockReason = baseStatus?.blockReason ?? null;

	const status = {
		vendorId,
		isCompliant: hasValidLicense && hasValidInsurance && !isBlocked,
		complianceScore,
		hasValidLicense,
		hasValidInsurance,
		hasW9OnFile,
		meetsMinCoverage,
		earliestLicenseExpiry,
		earliestInsuranceExpiry,
		isBlocked,
		blockReason,
		lastCheckedAt: new Date()
	};

	if (persist) {
		const existing = await prisma.contractorComplianceStatus.findUnique({ where: { vendorId } });
		if (existing) {
			return prisma.contractorComplianceStatus.update({
				where: { vendorId },
				data: status
			});
		}
		return prisma.contractorComplianceStatus.create({
			data: status
		});
	}

	return status;
}

// Step functions for each operation
async function refreshCompliance(
	organizationId: string,
	userId: string,
	vendorId: string
): Promise<Record<string, unknown>> {
	const result = await computeCompliance(vendorId, organizationId, true);
	console.log(`[ContractorComplianceWorkflow] REFRESH vendor:${vendorId} by user ${userId}`);
	return result as unknown as Record<string, unknown>;
}

async function setBlock(
	organizationId: string,
	userId: string,
	vendorId: string,
	data: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const existing = await ensureComplianceRecord(vendorId, organizationId);
	const isBlocked = data.isBlocked as boolean;
	const blockReason = data.blockReason as string | undefined;

	const result = await prisma.contractorComplianceStatus.update({
		where: { id: existing.id },
		data: {
			isBlocked,
			blockReason: isBlocked ? blockReason ?? 'Blocked by admin' : null,
			blockedAt: isBlocked ? new Date() : null,
			blockedBy: isBlocked ? userId : null,
			lastCheckedAt: new Date()
		}
	});

	console.log(`[ContractorComplianceWorkflow] SET_BLOCK vendor:${vendorId} blocked:${isBlocked} by user ${userId}`);
	return result as unknown as Record<string, unknown>;
}

async function linkHoaApproval(
	organizationId: string,
	userId: string,
	vendorId: string,
	data: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const { link } = await getLinkAndProfile(vendorId, organizationId);

	await prisma.vendor.update({
		where: { id: vendorId },
		data: {
			approvalStatus: data.approvalStatus as VendorApprovalStatus,
			insuranceVerified: data.insuranceVerified as boolean | undefined,
			licenseVerified: data.licenseVerified as boolean | undefined,
			complianceNotes: data.complianceNotes as string | undefined,
			approvedBy: userId,
			approvedAt: new Date()
		}
	});

	await prisma.serviceProviderLink.update({
		where: { id: link.id },
		data: {
			status: data.approvalStatus === 'REJECTED' ? 'REVOKED' : 'VERIFIED',
			linkedAt: new Date(),
			linkedBy: userId
		}
	});

	const result = await computeCompliance(vendorId, organizationId, true);
	console.log(`[ContractorComplianceWorkflow] LINK_HOA_APPROVAL vendor:${vendorId} status:${data.approvalStatus} by user ${userId}`);
	return result as unknown as Record<string, unknown>;
}

// Main workflow function
async function contractorComplianceWorkflow(input: ContractorComplianceWorkflowInput): Promise<ContractorComplianceWorkflowResult> {
	try {
		let complianceData: Record<string, unknown> | undefined;

		switch (input.action) {
			case 'REFRESH':
				complianceData = await DBOS.runStep(
					() => refreshCompliance(input.organizationId, input.userId, input.vendorId),
					{ name: 'refreshCompliance' }
				);
				break;

			case 'SET_BLOCK':
				complianceData = await DBOS.runStep(
					() => setBlock(input.organizationId, input.userId, input.vendorId, input.data),
					{ name: 'setBlock' }
				);
				break;

			case 'LINK_HOA_APPROVAL':
				complianceData = await DBOS.runStep(
					() => linkHoaApproval(input.organizationId, input.userId, input.vendorId, input.data),
					{ name: 'linkHoaApproval' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId: input.vendorId, complianceData };
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[ContractorComplianceWorkflow] Error in ${input.action}:`, errorMessage);

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'CONTRACTOR_COMPLIANCE_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const contractorComplianceWorkflow_v1 = DBOS.registerWorkflow(contractorComplianceWorkflow);

export async function startContractorComplianceWorkflow(
	input: ContractorComplianceWorkflowInput,
	idempotencyKey: string
): Promise<ContractorComplianceWorkflowResult> {
	const workflowId = idempotencyKey || `contractor-compliance-${input.action}-${input.vendorId}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(contractorComplianceWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
