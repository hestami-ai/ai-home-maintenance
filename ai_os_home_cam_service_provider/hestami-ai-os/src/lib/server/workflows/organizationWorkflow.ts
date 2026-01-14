/**
 * Organization Workflow (v1)
 *
 * DBOS durable workflow for organization management operations.
 * Handles: createWithAdmin, createAssociation, update, delete, setDefault.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';
import type { Prisma, OrganizationType, OrganizationStatus } from '../../../../generated/prisma/client.js';

const log = createWorkflowLogger('OrganizationWorkflow');

// Action types for the unified workflow
export const OrganizationWorkflowAction = {
	CREATE_WITH_ADMIN: 'CREATE_WITH_ADMIN',
	CREATE_ASSOCIATION: 'CREATE_ASSOCIATION',
	UPDATE: 'UPDATE',
	DELETE: 'DELETE',
	SET_DEFAULT: 'SET_DEFAULT'
} as const;

export type OrganizationWorkflowAction = (typeof OrganizationWorkflowAction)[keyof typeof OrganizationWorkflowAction];

interface CreateOrgResult {
	id: string;
	name: string;
	slug: string;
	type: string;
	status: string;
	created_at: Date;
	updated_at: Date;
}

export interface OrganizationWorkflowInput {
	action: OrganizationWorkflowAction;
	userId: string;
	organizationId?: string;
	data: {
		// CREATE_WITH_ADMIN fields
		name?: string;
		slug?: string;
		type?: string;
		// CREATE_ASSOCIATION fields
		associationName?: string;
		legalName?: string | null;
		boardSeats?: number;
		totalUnits?: number;
		fiscalYearEndMonth?: number;
		// UPDATE fields
		settings?: Record<string, unknown>;
		// SET_DEFAULT fields
		membershipId?: string;
	};
}

export interface OrganizationWorkflowResult extends EntityWorkflowResult {
	organizationId?: string;
	organizationType?: string;
	organizationStatus?: string;
	associationId?: string;
}

// Step functions

async function createOrganizationWithAdmin(
	userId: string,
	name: string,
	slug: string,
	type: string
): Promise<{ id: string; name: string; slug: string; type: string; status: string }> {
	// Use SECURITY DEFINER function to bypass RLS during org creation
	const [orgResult] = await prisma.$queryRaw<CreateOrgResult[]>`
		SELECT * FROM create_organization_with_admin(
			${name}::TEXT,
			${slug}::TEXT,
			${type}::TEXT,
			${userId}::TEXT
		)
	`;

	if (!orgResult) {
		throw new Error('Failed to create organization');
	}

	log.info('CREATE_WITH_ADMIN completed', { organizationId: orgResult.id, userId });
	return {
		id: orgResult.id,
		name: orgResult.name,
		slug: orgResult.slug,
		type: orgResult.type,
		status: orgResult.status
	};
}

async function createAssociation(
	organizationId: string,
	organizationName: string,
	data: OrganizationWorkflowInput['data']
): Promise<{ associationId: string; name: string; status: string }> {
	const association = await prisma.association.create({
		data: {
			organizationId,
			name: data.associationName ?? organizationName,
			legalName: data.legalName ?? null,
			fiscalYearEnd: data.fiscalYearEndMonth ?? 12,
			status: 'ONBOARDING',
			settings: {
				boardSeats: data.boardSeats ?? 5,
				totalUnits: data.totalUnits ?? 0
			}
		}
	});

	log.info('CREATE_ASSOCIATION completed', { associationId: association.id, organizationId });
	return {
		associationId: association.id,
		name: association.name,
		status: association.status
	};
}

async function updateOrganization(
	organizationId: string,
	userId: string,
	data: OrganizationWorkflowInput['data']
): Promise<{ id: string; name: string; slug: string; type: string; status: string }> {
	const organization = await prisma.organization.update({
		where: { id: organizationId },
		data: {
			...(data.name && { name: data.name }),
			...(data.settings && { settings: data.settings as Prisma.InputJsonValue })
		}
	});

	log.info('UPDATE completed', { organizationId, userId });
	return {
		id: organization.id,
		name: organization.name,
		slug: organization.slug,
		type: organization.type,
		status: organization.status
	};
}

async function deleteOrganization(
	organizationId: string,
	userId: string
): Promise<{ deletedAt: string }> {
	const now = new Date();
	await prisma.organization.update({
		where: { id: organizationId },
		data: { deletedAt: now }
	});

	log.info('DELETE completed', { organizationId, userId });
	return { deletedAt: now.toISOString() };
}

async function setDefaultOrganization(
	userId: string,
	membershipId: string
): Promise<{ success: boolean }> {
	await prisma.$transaction([
		prisma.userOrganization.updateMany({
			where: { userId, isDefault: true },
			data: { isDefault: false }
		}),
		prisma.userOrganization.update({
			where: { id: membershipId },
			data: { isDefault: true }
		})
	]);

	log.info('SET_DEFAULT completed', { userId, membershipId });
	return { success: true };
}

// Main workflow function
async function organizationWorkflow(input: OrganizationWorkflowInput): Promise<OrganizationWorkflowResult> {
	try {
		switch (input.action) {
			case 'CREATE_WITH_ADMIN': {
				const result = await DBOS.runStep(
					() => createOrganizationWithAdmin(
						input.userId,
						input.data.name!,
						input.data.slug!,
						input.data.type!
					),
					{ name: 'createOrganizationWithAdmin' }
				);
				return {
					success: true,
					entityId: result.id,
					organizationId: result.id,
					organizationType: result.type,
					organizationStatus: result.status
				};
			}

			case 'CREATE_ASSOCIATION': {
				const result = await DBOS.runStep(
					() => createAssociation(
						input.organizationId!,
						input.data.name!,
						input.data
					),
					{ name: 'createAssociation' }
				);
				return {
					success: true,
					entityId: result.associationId,
					associationId: result.associationId
				};
			}

			case 'UPDATE': {
				const result = await DBOS.runStep(
					() => updateOrganization(input.organizationId!, input.userId, input.data),
					{ name: 'updateOrganization' }
				);
				return {
					success: true,
					entityId: result.id,
					organizationId: result.id,
					organizationType: result.type,
					organizationStatus: result.status
				};
			}

			case 'DELETE': {
				const result = await DBOS.runStep(
					() => deleteOrganization(input.organizationId!, input.userId),
					{ name: 'deleteOrganization' }
				);
				return {
					success: true,
					entityId: input.organizationId
				};
			}

			case 'SET_DEFAULT': {
				await DBOS.runStep(
					() => setDefaultOrganization(input.userId, input.data.membershipId!),
					{ name: 'setDefaultOrganization' }
				);
				return { success: true };
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[OrganizationWorkflow] Error in ${input.action}:`, errorMessage);

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'ORGANIZATION_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const organizationWorkflow_v1 = DBOS.registerWorkflow(organizationWorkflow);

export async function startOrganizationWorkflow(
	input: OrganizationWorkflowInput,
	idempotencyKey: string
): Promise<OrganizationWorkflowResult> {
	const handle = await DBOS.startWorkflow(organizationWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
