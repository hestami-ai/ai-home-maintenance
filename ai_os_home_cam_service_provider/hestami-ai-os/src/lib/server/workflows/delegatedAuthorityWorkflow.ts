/**
 * Delegated Authority Workflow (v1)
 *
 * DBOS durable workflow for delegated authority management.
 * Handles: grant, accept, and revoke operations.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { EntityWorkflowResult } from './schemas.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd, logStepError } from './workflowLogger.js';
import type { Prisma } from '../../../../generated/prisma/client.js';

const WORKFLOW_STATUS_EVENT = 'delegated_authority_workflow_status';
const WORKFLOW_ERROR_EVENT = 'delegated_authority_workflow_error';

// Action types for delegated authority operations
export const DelegatedAuthorityWorkflowAction = {
	GRANT: 'GRANT',
	ACCEPT: 'ACCEPT',
	REVOKE: 'REVOKE'
} as const;

export type DelegatedAuthorityWorkflowAction = (typeof DelegatedAuthorityWorkflowAction)[keyof typeof DelegatedAuthorityWorkflowAction];

export interface DelegatedAuthorityWorkflowInput {
	action: DelegatedAuthorityWorkflowAction;
	organizationId: string;
	userId: string;
	// GRANT fields
	propertyOwnershipId?: string;
	delegatePartyId?: string;
	authorityType?: string;
	monetaryLimit?: number;
	scopeDescription?: string;
	scopeRestrictions?: Record<string, unknown>;
	expiresAt?: Date;
	// ACCEPT/REVOKE fields
	delegatedAuthorityId?: string;
	// REVOKE fields
	reason?: string;
}

export interface DelegatedAuthorityWorkflowResult extends EntityWorkflowResult {
	delegatedAuthorityId?: string;
	status?: string;
	acceptedAt?: string;
	revokedAt?: string;
	revokedBy?: string;
	grantedAt?: string;
	grantedBy?: string;
	monetaryLimit?: number | null;
	scopeDescription?: string | null;
	expiresAt?: string | null;
	propertyOwnershipId?: string;
	delegatePartyId?: string;
	authorityType?: string;
	[key: string]: unknown;
}

// Step functions

async function grantAuthority(
	input: DelegatedAuthorityWorkflowInput
): Promise<{
	id: string;
	propertyOwnershipId: string;
	delegatePartyId: string;
	authorityType: string;
	status: string;
	monetaryLimit: number | null;
	scopeDescription: string | null;
	expiresAt: string | null;
	grantedAt: string;
	grantedBy: string;
}> {
	const delegatedAuthority = await prisma.delegatedAuthority.create({
		data: {
			propertyOwnershipId: input.propertyOwnershipId!,
			delegatePartyId: input.delegatePartyId!,
			authorityType: input.authorityType as 'FULL_AUTHORITY' | 'FINANCIAL' | 'MAINTENANCE' | 'ADMINISTRATIVE' | 'LIMITED',
			status: 'PENDING_ACCEPTANCE',
			monetaryLimit: input.monetaryLimit,
			scopeDescription: input.scopeDescription,
			scopeRestrictions: input.scopeRestrictions as Prisma.InputJsonValue | undefined,
			expiresAt: input.expiresAt,
			grantedBy: input.userId
		}
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId: input.organizationId,
		entityType: 'DELEGATED_AUTHORITY',
		entityId: delegatedAuthority.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Delegated authority granted: ${delegatedAuthority.authorityType}`,
		performedById: input.userId,
		performedByType: 'HUMAN',
		workflowId: 'delegatedAuthorityWorkflow_v1',
		workflowStep: 'GRANT',
		workflowVersion: 'v1',
		newState: {
			authorityType: delegatedAuthority.authorityType,
			status: delegatedAuthority.status,
			delegatePartyId: delegatedAuthority.delegatePartyId
		}
	});

	return {
		id: delegatedAuthority.id,
		propertyOwnershipId: delegatedAuthority.propertyOwnershipId,
		delegatePartyId: delegatedAuthority.delegatePartyId,
		authorityType: delegatedAuthority.authorityType,
		status: delegatedAuthority.status,
		monetaryLimit: delegatedAuthority.monetaryLimit ? Number(delegatedAuthority.monetaryLimit) : null,
		scopeDescription: delegatedAuthority.scopeDescription,
		expiresAt: delegatedAuthority.expiresAt?.toISOString() ?? null,
		grantedAt: delegatedAuthority.grantedAt.toISOString(),
		grantedBy: delegatedAuthority.grantedBy
	};
}

async function acceptAuthority(
	delegatedAuthorityId: string,
	organizationId: string,
	userId: string
): Promise<{ id: string; status: string; acceptedAt: string }> {
	const now = new Date();
	const delegatedAuthority = await prisma.delegatedAuthority.update({
		where: { id: delegatedAuthorityId },
		data: {
			status: 'ACTIVE',
			acceptedAt: now
		}
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId,
		entityType: 'DELEGATED_AUTHORITY',
		entityId: delegatedAuthority.id,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Delegated authority accepted`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'delegatedAuthorityWorkflow_v1',
		workflowStep: 'ACCEPT',
		workflowVersion: 'v1',
		previousState: { status: 'PENDING_ACCEPTANCE' },
		newState: { status: 'ACTIVE', acceptedAt: now.toISOString() }
	});

	return {
		id: delegatedAuthority.id,
		status: delegatedAuthority.status,
		acceptedAt: delegatedAuthority.acceptedAt!.toISOString()
	};
}

async function revokeAuthority(
	delegatedAuthorityId: string,
	organizationId: string,
	userId: string,
	reason?: string
): Promise<{ id: string; status: string; revokedAt: string; revokedBy: string }> {
	const now = new Date();
	const delegatedAuthority = await prisma.delegatedAuthority.update({
		where: { id: delegatedAuthorityId },
		data: {
			status: 'REVOKED',
			revokedAt: now,
			revokedBy: userId,
			revokeReason: reason
		}
	});

	// Record activity event
	await recordWorkflowEvent({
		organizationId,
		entityType: 'DELEGATED_AUTHORITY',
		entityId: delegatedAuthority.id,
		action: 'STATUS_CHANGE',
		eventCategory: 'EXECUTION',
		summary: `Delegated authority revoked${reason ? `: ${reason}` : ''}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'delegatedAuthorityWorkflow_v1',
		workflowStep: 'REVOKE',
		workflowVersion: 'v1',
		previousState: { status: delegatedAuthority.status },
		newState: { status: 'REVOKED', revokedAt: now.toISOString(), revokedBy: userId }
	});

	return {
		id: delegatedAuthority.id,
		status: delegatedAuthority.status,
		revokedAt: delegatedAuthority.revokedAt!.toISOString(),
		revokedBy: delegatedAuthority.revokedBy!
	};
}

// Main workflow function

async function delegatedAuthorityWorkflow(input: DelegatedAuthorityWorkflowInput): Promise<DelegatedAuthorityWorkflowResult> {
	const workflowName = 'delegatedAuthorityWorkflow_v1';
	const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, {
		organizationId: input.organizationId,
		userId: input.userId,
		delegatedAuthorityId: input.delegatedAuthorityId
	}, workflowName, DBOS.workflowID);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		switch (input.action) {
			case 'GRANT': {
				if (!input.propertyOwnershipId || !input.delegatePartyId || !input.authorityType) {
					const error = new Error('Missing required fields: propertyOwnershipId, delegatePartyId, and authorityType for GRANT');
					logStepError(log, 'validation', error, { input });
					throw error;
				}
				log.debug('Step: grantAuthority starting', { propertyOwnershipId: input.propertyOwnershipId });
				const result = await DBOS.runStep(
					() => grantAuthority(input),
					{ name: 'grantAuthority' }
				);
				log.info('Step: grantAuthority completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'authority_granted', ...result });
				const successResult: DelegatedAuthorityWorkflowResult = {
					success: true,
					entityId: result.id,
					delegatedAuthorityId: result.id,
					propertyOwnershipId: result.propertyOwnershipId,
					delegatePartyId: result.delegatePartyId,
					authorityType: result.authorityType,
					status: result.status,
					monetaryLimit: result.monetaryLimit,
					scopeDescription: result.scopeDescription,
					expiresAt: result.expiresAt,
					grantedAt: result.grantedAt,
					grantedBy: result.grantedBy
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'ACCEPT': {
				if (!input.delegatedAuthorityId) {
					const error = new Error('Missing required field: delegatedAuthorityId for ACCEPT');
					logStepError(log, 'validation', error, { delegatedAuthorityId: input.delegatedAuthorityId });
					throw error;
				}
				log.debug('Step: acceptAuthority starting', { delegatedAuthorityId: input.delegatedAuthorityId });
				const result = await DBOS.runStep(
					() => acceptAuthority(input.delegatedAuthorityId!, input.organizationId, input.userId),
					{ name: 'acceptAuthority' }
				);
				log.info('Step: acceptAuthority completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'authority_accepted', ...result });
				const successResult: DelegatedAuthorityWorkflowResult = {
					success: true,
					entityId: result.id,
					delegatedAuthorityId: result.id,
					status: result.status,
					acceptedAt: result.acceptedAt
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			case 'REVOKE': {
				if (!input.delegatedAuthorityId) {
					const error = new Error('Missing required field: delegatedAuthorityId for REVOKE');
					logStepError(log, 'validation', error, { delegatedAuthorityId: input.delegatedAuthorityId });
					throw error;
				}
				log.debug('Step: revokeAuthority starting', { delegatedAuthorityId: input.delegatedAuthorityId });
				const result = await DBOS.runStep(
					() => revokeAuthority(input.delegatedAuthorityId!, input.organizationId, input.userId, input.reason),
					{ name: 'revokeAuthority' }
				);
				log.info('Step: revokeAuthority completed', { id: result.id });
				await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'authority_revoked', ...result });
				const successResult: DelegatedAuthorityWorkflowResult = {
					success: true,
					entityId: result.id,
					delegatedAuthorityId: result.id,
					status: result.status,
					revokedAt: result.revokedAt,
					revokedBy: result.revokedBy
				};
				logWorkflowEnd(log, input.action, true, startTime, successResult);
				return successResult;
			}

			default: {
				const errorResult: DelegatedAuthorityWorkflowResult = {
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
			delegatedAuthorityId: input.delegatedAuthorityId,
			error: errorMessage,
			stack: errorObj.stack
		});

		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'DELEGATED_AUTHORITY_WORKFLOW_ERROR'
		});
		const errorResult: DelegatedAuthorityWorkflowResult = {
			success: false,
			error: errorMessage
		};
		logWorkflowEnd(log, input.action, false, startTime, errorResult);
		return errorResult;
	}
}

export const delegatedAuthorityWorkflow_v1 = DBOS.registerWorkflow(delegatedAuthorityWorkflow);

export async function startDelegatedAuthorityWorkflow(
	input: DelegatedAuthorityWorkflowInput,
	idempotencyKey: string
): Promise<DelegatedAuthorityWorkflowResult> {
	const handle = await DBOS.startWorkflow(delegatedAuthorityWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
