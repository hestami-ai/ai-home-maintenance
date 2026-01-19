/**
 * Pricebook Workflow (v1)
 *
 * DBOS durable workflow for pricebook management operations.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import type { ContractorTradeType, PricebookItemType, PriceRuleType } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { orgTransaction } from '../db/rls.js';
import { type LifecycleWorkflowResult } from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';
import {
	PricebookVersionStatus,
	ActivityEntityType,
	ActivityActionType,
	ActivityEventCategory,
	ActivityActorType
} from '../../../../generated/prisma/enums.js';

const log = createWorkflowLogger('PricebookWorkflow');

const WORKFLOW_STATUS_EVENT = 'pricebook_status';
const WORKFLOW_ERROR_EVENT = 'pricebook_error';

// Workflow error types for tracing
const WorkflowErrorType = {
	PRICEBOOK_WORKFLOW_ERROR: 'PRICEBOOK_WORKFLOW_ERROR'
} as const;

export const PricebookAction = {
	UPSERT_PRICEBOOK: 'UPSERT_PRICEBOOK',
	CREATE_VERSION: 'CREATE_VERSION',
	PUBLISH_VERSION: 'PUBLISH_VERSION',
	ACTIVATE_VERSION: 'ACTIVATE_VERSION',
	UPSERT_ITEM: 'UPSERT_ITEM',
	UPSERT_RULE: 'UPSERT_RULE',
	UPSERT_TEMPLATE: 'UPSERT_TEMPLATE'
} as const;

export type PricebookAction = (typeof PricebookAction)[keyof typeof PricebookAction];

export interface PricebookWorkflowInput {
	action: PricebookAction;
	organizationId: string;
	userId: string;
	pricebookId?: string;
	versionId?: string;
	itemId?: string;
	ruleId?: string;
	templateId?: string;
	data: Record<string, unknown>;
}

export interface PricebookWorkflowResult extends LifecycleWorkflowResult {
	entityId?: string;
}

async function upsertPricebook(
	organizationId: string,
	userId: string,
	pricebookId: string | undefined,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const pricebook = await orgTransaction(
		organizationId,
		async (tx) => {
			if (pricebookId) {
				return tx.pricebook.update({
					where: { id: pricebookId },
					data: {
						name: data.name as string | undefined,
						description: data.description as string | undefined,
						isActive: data.isActive as boolean | undefined
					}
				});
			} else {
				return tx.pricebook.create({
					data: {
						organizationId,
						name: data.name as string,
						description: data.description as string | undefined,
						isActive: data.isActive as boolean ?? true
					}
				});
			}
		},
		{ userId, reason: pricebookId ? 'Updating pricebook' : 'Creating pricebook' }
	);

	log.info(`Pricebook ${pricebookId ? 'updated' : 'created'}: ${pricebook.name}`, { pricebookId: pricebook.id, action: pricebookId ? 'updated' : 'created' });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: pricebook.id,
		action: pricebookId ? ActivityActionType.UPDATE : ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Pricebook ${pricebookId ? 'updated' : 'created'}: ${pricebook.name}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: PricebookAction.UPSERT_PRICEBOOK,
		workflowVersion: 'v1'
	});

	return { id: pricebook.id };
}

async function createVersion(
	organizationId: string,
	userId: string,
	pricebookId: string,
	versionNumber: number,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const version = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.pricebookVersion.create({
				data: {
					pricebookId,
					versionNumber,
					notes: data.notes as string | undefined,
					status: PricebookVersionStatus.DRAFT
				}
			});
		},
		{ userId, reason: 'Creating pricebook version' }
	);

	log.info(`Pricebook version created: v${versionNumber}`, { versionId: version.id, versionNumber });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: version.id,
		action: ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Pricebook version created: v${versionNumber}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: PricebookAction.CREATE_VERSION,
		workflowVersion: 'v1'
	});

	return { id: version.id };
}

async function publishVersion(
	organizationId: string,
	userId: string,
	versionId: string
): Promise<{ id: string }> {
	const version = await orgTransaction(
		organizationId,
		async (tx) => {
			return tx.pricebookVersion.update({
				where: { id: versionId },
				data: {
					status: PricebookVersionStatus.PUBLISHED,
					publishedAt: new Date(),
					publishedBy: userId
				}
			});
		},
		{ userId, reason: 'Publishing pricebook version' }
	);

	log.info('Pricebook version published', { versionId: version.id });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: version.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Pricebook version published',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: PricebookAction.PUBLISH_VERSION,
		workflowVersion: 'v1'
	});

	return { id: version.id };
}

async function activateVersion(
	organizationId: string,
	userId: string,
	versionId: string,
	pricebookId: string
): Promise<{ id: string }> {
	const version = await orgTransaction(
		organizationId,
		async (tx) => {
			// Deactivate other active versions
			await tx.pricebookVersion.updateMany({
				where: { pricebookId, status: PricebookVersionStatus.ACTIVE, NOT: { id: versionId } },
				data: { status: PricebookVersionStatus.ARCHIVED }
			});

			return tx.pricebookVersion.update({
				where: { id: versionId },
				data: { status: PricebookVersionStatus.ACTIVE, activatedAt: new Date() }
			});
		},
		{ userId, reason: 'Activating pricebook version' }
	);

	log.info('Pricebook version activated', { versionId: version.id, pricebookId });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: version.id,
		action: ActivityActionType.UPDATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: 'Pricebook version activated',
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: PricebookAction.ACTIVATE_VERSION,
		workflowVersion: 'v1'
	});

	return { id: version.id };
}

async function upsertItem(
	organizationId: string,
	userId: string,
	versionId: string,
	itemId: string | undefined,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const item = await orgTransaction(
		organizationId,
		async (tx) => {
			if (itemId) {
				return tx.pricebookItem.update({
					where: { id: itemId },
					data: {
						code: data.code as string | undefined,
						name: data.name as string | undefined,
						description: data.description as string | undefined,
						type: data.type as PricebookItemType | undefined,
						trade: data.trade as ContractorTradeType | undefined,
						basePrice: data.basePrice as number | undefined,
						unitOfMeasure: data.unitOfMeasure as string | undefined
					}
				});
			} else {
				return tx.pricebookItem.create({
					data: {
						pricebookVersionId: versionId,
						code: data.code as string,
						name: data.name as string,
						description: data.description as string | undefined,
						type: data.type as PricebookItemType,
						trade: data.trade as ContractorTradeType | undefined,
						basePrice: data.basePrice as number,
						unitOfMeasure: data.unitOfMeasure as string | undefined
					}
				});
			}
		},
		{ userId, reason: itemId ? 'Updating pricebook item' : 'Creating pricebook item' }
	);

	log.info(`Pricebook item ${itemId ? 'updated' : 'created'}: ${item.name}`, { itemId: item.id, action: itemId ? 'updated' : 'created' });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: item.id,
		action: itemId ? ActivityActionType.UPDATE : ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Pricebook item ${itemId ? 'updated' : 'created'}: ${item.name}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: PricebookAction.UPSERT_ITEM,
		workflowVersion: 'v1'
	});

	return { id: item.id };
}

async function upsertRule(
	organizationId: string,
	userId: string,
	versionId: string,
	ruleId: string | undefined,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const rule = await orgTransaction(
		organizationId,
		async (tx) => {
			if (ruleId) {
				return tx.priceRule.update({
					where: { id: ruleId },
					data: {
						name: data.name as string | undefined,
						description: data.description as string | undefined,
						ruleType: data.ruleType as PriceRuleType | undefined,
						priority: data.priority as number | undefined,
						percentageAdjustment: data.percentageAdjustment as number | undefined,
						amountAdjustment: data.amountAdjustment as number | undefined
					}
				});
			} else {
				return tx.priceRule.create({
					data: {
						pricebookVersionId: versionId,
						name: data.name as string,
						description: data.description as string | undefined,
						ruleType: data.ruleType as PriceRuleType,
						priority: data.priority as number ?? 0,
						percentageAdjustment: data.percentageAdjustment as number | undefined,
						amountAdjustment: data.amountAdjustment as number | undefined
					}
				});
			}
		},
		{ userId, reason: ruleId ? 'Updating price rule' : 'Creating price rule' }
	);

	log.info(`Price rule ${ruleId ? 'updated' : 'created'}: ${rule.name}`, { ruleId: rule.id, action: ruleId ? 'updated' : 'created' });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: rule.id,
		action: ruleId ? ActivityActionType.UPDATE : ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Price rule ${ruleId ? 'updated' : 'created'}: ${rule.name}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: PricebookAction.UPSERT_RULE,
		workflowVersion: 'v1'
	});

	return { id: rule.id };
}

async function upsertTemplate(
	organizationId: string,
	userId: string,
	versionId: string,
	templateId: string | undefined,
	data: Record<string, unknown>
): Promise<{ id: string }> {
	const template = await orgTransaction(
		organizationId,
		async (tx) => {
			if (templateId) {
				return tx.jobTemplate.update({
					where: { id: templateId },
					data: {
						name: data.name as string | undefined,
						description: data.description as string | undefined,
						defaultTrade: data.trade as ContractorTradeType | undefined,
						isActive: data.isActive as boolean | undefined
					}
				});
			} else {
				return tx.jobTemplate.create({
					data: {
						organizationId,
						pricebookVersionId: versionId,
						name: data.name as string,
						description: data.description as string | undefined,
						defaultTrade: data.trade as ContractorTradeType | undefined,
						isActive: data.isActive as boolean ?? true
					}
				});
			}
		},
		{ userId, reason: templateId ? 'Updating job template' : 'Creating job template' }
	);

	log.info(`Job template ${templateId ? 'updated' : 'created'}: ${template.name}`, { templateId: template.id, action: templateId ? 'updated' : 'created' });

	await recordWorkflowEvent({
		organizationId,
		entityType: ActivityEntityType.JOB,
		entityId: template.id,
		action: templateId ? ActivityActionType.UPDATE : ActivityActionType.CREATE,
		eventCategory: ActivityEventCategory.EXECUTION,
		summary: `Job template ${templateId ? 'updated' : 'created'}: ${template.name}`,
		performedById: userId,
		performedByType: ActivityActorType.HUMAN,
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: PricebookAction.UPSERT_TEMPLATE,
		workflowVersion: 'v1'
	});

	return { id: template.id };
}

async function pricebookWorkflow(input: PricebookWorkflowInput): Promise<PricebookWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case PricebookAction.UPSERT_PRICEBOOK: {
				const result = await DBOS.runStep(
					() => upsertPricebook(input.organizationId, input.userId, input.pricebookId, input.data),
					{ name: 'upsertPricebook' }
				);
				entityId = result.id;
				break;
			}
			case PricebookAction.CREATE_VERSION: {
				if (!input.pricebookId) throw new Error('pricebookId required for CREATE_VERSION');
				const versionNumber = input.data.versionNumber as number;
				const result = await DBOS.runStep(
					() => createVersion(input.organizationId, input.userId, input.pricebookId!, versionNumber, input.data),
					{ name: 'createVersion' }
				);
				entityId = result.id;
				break;
			}
			case PricebookAction.PUBLISH_VERSION: {
				if (!input.versionId) throw new Error('versionId required for PUBLISH_VERSION');
				const result = await DBOS.runStep(
					() => publishVersion(input.organizationId, input.userId, input.versionId!),
					{ name: 'publishVersion' }
				);
				entityId = result.id;
				break;
			}
			case PricebookAction.ACTIVATE_VERSION: {
				if (!input.versionId || !input.pricebookId) throw new Error('versionId and pricebookId required for ACTIVATE_VERSION');
				const result = await DBOS.runStep(
					() => activateVersion(input.organizationId, input.userId, input.versionId!, input.pricebookId!),
					{ name: 'activateVersion' }
				);
				entityId = result.id;
				break;
			}
			case PricebookAction.UPSERT_ITEM: {
				if (!input.versionId) throw new Error('versionId required for UPSERT_ITEM');
				const result = await DBOS.runStep(
					() => upsertItem(input.organizationId, input.userId, input.versionId!, input.itemId, input.data),
					{ name: 'upsertItem' }
				);
				entityId = result.id;
				break;
			}
			case PricebookAction.UPSERT_RULE: {
				if (!input.versionId) throw new Error('versionId required for UPSERT_RULE');
				const result = await DBOS.runStep(
					() => upsertRule(input.organizationId, input.userId, input.versionId!, input.ruleId, input.data),
					{ name: 'upsertRule' }
				);
				entityId = result.id;
				break;
			}
			case PricebookAction.UPSERT_TEMPLATE: {
				if (!input.versionId) throw new Error('versionId required for UPSERT_TEMPLATE');
				const result = await DBOS.runStep(
					() => upsertTemplate(input.organizationId, input.userId, input.versionId!, input.templateId, input.data),
					{ name: 'upsertTemplate' }
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
			errorType: WorkflowErrorType.PRICEBOOK_WORKFLOW_ERROR
		});

		return {
			success: false,
			action: input.action,
			timestamp: new Date().toISOString(),
			error: errorMessage
		};
	}
}

export const pricebookWorkflow_v1 = DBOS.registerWorkflow(pricebookWorkflow);

export async function startPricebookWorkflow(
	input: PricebookWorkflowInput,
	idempotencyKey: string
): Promise<PricebookWorkflowResult> {
	const handle = await DBOS.startWorkflow(pricebookWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

