/**
 * Contractor Profile Workflow (v1)
 *
 * DBOS durable workflow for managing contractor profile, license, and insurance operations.
 * Handles: createOrUpdateProfile, createOrUpdateLicense, createOrUpdateInsurance.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { LicenseStatus, InsuranceType, InsuranceStatus } from '../../../../generated/prisma/client.js';

// Action types for the unified workflow
export type ContractorProfileAction = 
	| 'CREATE_OR_UPDATE_PROFILE'
	| 'CREATE_OR_UPDATE_LICENSE'
	| 'CREATE_OR_UPDATE_INSURANCE';

export interface ContractorProfileWorkflowInput {
	action: ContractorProfileAction;
	organizationId: string;
	userId: string;
	entityId?: string;
	data: Record<string, unknown>;
}

export interface ContractorProfileWorkflowResult {
	success: boolean;
	entityId?: string;
	error?: string;
}

// Step functions for each operation
async function createOrUpdateProfile(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const existing = await prisma.contractorProfile.findUnique({
		where: { organizationId }
	});

	let profile;
	if (existing) {
		profile = await prisma.contractorProfile.update({
			where: { organizationId },
			data: {
				legalName: data.legalName as string | undefined,
				dba: data.dba as string | undefined,
				taxId: data.taxId as string | undefined,
				primaryContactName: data.primaryContactName as string | undefined,
				primaryContactEmail: data.primaryContactEmail as string | undefined,
				primaryContactPhone: data.primaryContactPhone as string | undefined,
				addressLine1: data.addressLine1 as string | undefined,
				addressLine2: data.addressLine2 as string | undefined,
				city: data.city as string | undefined,
				state: data.state as string | undefined,
				postalCode: data.postalCode as string | undefined,
				country: data.country as string | undefined,
				operatingHoursJson: data.operatingHoursJson as string | undefined,
				timezone: data.timezone as string | undefined,
				maxTechnicians: data.maxTechnicians as number | undefined,
				maxServiceRadius: data.maxServiceRadius as number | undefined
			}
		});
	} else {
		profile = await prisma.contractorProfile.create({
			data: {
				organizationId,
				legalName: data.legalName as string,
				dba: data.dba as string | undefined,
				taxId: data.taxId as string | undefined,
				primaryContactName: data.primaryContactName as string | undefined,
				primaryContactEmail: data.primaryContactEmail as string | undefined,
				primaryContactPhone: data.primaryContactPhone as string | undefined,
				addressLine1: data.addressLine1 as string | undefined,
				addressLine2: data.addressLine2 as string | undefined,
				city: data.city as string | undefined,
				state: data.state as string | undefined,
				postalCode: data.postalCode as string | undefined,
				country: (data.country as string) || 'US',
				operatingHoursJson: data.operatingHoursJson as string | undefined,
				timezone: data.timezone as string | undefined,
				maxTechnicians: data.maxTechnicians as number | undefined,
				maxServiceRadius: data.maxServiceRadius as number | undefined
			}
		});
	}

	console.log(`[ContractorProfileWorkflow] CREATE_OR_UPDATE_PROFILE profile:${profile.id} by user ${userId}`);
	return profile.id;
}

async function createOrUpdateLicense(
	organizationId: string,
	userId: string,
	profileId: string,
	licenseId: string | undefined,
	data: Record<string, unknown>
): Promise<string> {
	let license;
	if (licenseId) {
		const existing = await prisma.contractorLicense.findFirst({
			where: { id: licenseId, contractorProfileId: profileId }
		});
		if (!existing) throw new Error('ContractorLicense not found');

		license = await prisma.contractorLicense.update({
			where: { id: licenseId },
			data: {
				licenseType: data.licenseType as string | undefined,
				licenseNumber: data.licenseNumber as string | undefined,
				issuingAuthority: data.issuingAuthority as string | undefined,
				issuingState: data.issuingState as string | undefined,
				issueDate: data.issueDate ? new Date(data.issueDate as string) : undefined,
				expirationDate: data.expirationDate ? new Date(data.expirationDate as string) : undefined,
				status: data.status as LicenseStatus | undefined,
				documentUrl: data.documentUrl as string | undefined
			}
		});
	} else {
		license = await prisma.contractorLicense.create({
			data: {
				contractorProfileId: profileId,
				licenseType: data.licenseType as string,
				licenseNumber: data.licenseNumber as string,
				issuingAuthority: (data.issuingAuthority as string) || 'Unknown',
				issuingState: data.issuingState as string | undefined,
				issueDate: data.issueDate ? new Date(data.issueDate as string) : undefined,
				expirationDate: data.expirationDate ? new Date(data.expirationDate as string) : undefined,
				status: (data.status as LicenseStatus) || 'PENDING',
				documentUrl: data.documentUrl as string | undefined
			}
		});
	}

	console.log(`[ContractorProfileWorkflow] CREATE_OR_UPDATE_LICENSE license:${license.id} by user ${userId}`);
	return license.id;
}

async function createOrUpdateInsurance(
	organizationId: string,
	userId: string,
	profileId: string,
	insuranceId: string | undefined,
	data: Record<string, unknown>
): Promise<string> {
	let insurance;
	if (insuranceId) {
		const existing = await prisma.contractorInsurance.findFirst({
			where: { id: insuranceId, contractorProfileId: profileId }
		});
		if (!existing) throw new Error('ContractorInsurance not found');

		insurance = await prisma.contractorInsurance.update({
			where: { id: insuranceId },
			data: {
				insuranceType: data.insuranceType as InsuranceType | undefined,
				policyNumber: data.policyNumber as string | undefined,
				carrier: data.carrier as string | undefined,
				coverageAmount: data.coverageAmount as number | undefined,
				deductible: data.deductible as number | undefined,
				effectiveDate: data.effectiveDate ? new Date(data.effectiveDate as string) : undefined,
				expirationDate: data.expirationDate ? new Date(data.expirationDate as string) : undefined,
				status: data.status as InsuranceStatus | undefined,
				coiDocumentUrl: data.coiDocumentUrl as string | undefined
			}
		});
	} else {
		insurance = await prisma.contractorInsurance.create({
			data: {
				contractorProfileId: profileId,
				insuranceType: data.insuranceType as InsuranceType,
				policyNumber: data.policyNumber as string,
				carrier: (data.carrier as string) || 'Unknown',
				coverageAmount: (data.coverageAmount as number) || 0,
				deductible: data.deductible as number | undefined,
				effectiveDate: new Date(data.effectiveDate as string),
				expirationDate: new Date(data.expirationDate as string),
				status: (data.status as InsuranceStatus) || 'PENDING_VERIFICATION',
				coiDocumentUrl: data.coiDocumentUrl as string | undefined
			}
		});
	}

	console.log(`[ContractorProfileWorkflow] CREATE_OR_UPDATE_INSURANCE insurance:${insurance.id} by user ${userId}`);
	return insurance.id;
}

// Main workflow function
async function contractorProfileWorkflow(input: ContractorProfileWorkflowInput): Promise<ContractorProfileWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'CREATE_OR_UPDATE_PROFILE':
				entityId = await DBOS.runStep(
					() => createOrUpdateProfile(input.organizationId, input.userId, input.data),
					{ name: 'createOrUpdateProfile' }
				);
				break;

			case 'CREATE_OR_UPDATE_LICENSE':
				entityId = await DBOS.runStep(
					() => createOrUpdateLicense(
						input.organizationId,
						input.userId,
						input.data.profileId as string,
						input.entityId,
						input.data
					),
					{ name: 'createOrUpdateLicense' }
				);
				break;

			case 'CREATE_OR_UPDATE_INSURANCE':
				entityId = await DBOS.runStep(
					() => createOrUpdateInsurance(
						input.organizationId,
						input.userId,
						input.data.profileId as string,
						input.entityId,
						input.data
					),
					{ name: 'createOrUpdateInsurance' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[ContractorProfileWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const contractorProfileWorkflow_v1 = DBOS.registerWorkflow(contractorProfileWorkflow);

export async function startContractorProfileWorkflow(
	input: ContractorProfileWorkflowInput,
	idempotencyKey?: string
): Promise<ContractorProfileWorkflowResult> {
	const workflowId = idempotencyKey || `contractor-profile-${input.action}-${input.entityId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(contractorProfileWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
