/**
 * Pricebook Workflow (v1)
 *
 * DBOS durable workflow for pricebook management operations.
 * Provides idempotency, durability, and trace correlation.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { ContractorTradeType, PricebookItemType, PriceRuleType } from '../../../../generated/prisma/client.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { type LifecycleWorkflowResult } from './schemas.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('PricebookWorkflow');

const WORKFLOW_STATUS_EVENT = 'pricebook_status';
const WORKFLOW_ERROR_EVENT = 'pricebook_error';

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
	let pricebook;
	if (pricebookId) {
		pricebook = await prisma.pricebook.update({
			where: { id: pricebookId },
			data: {
				name: data.name as string | undefined,
				description: data.description as string | undefined,
				isActive: data.isActive as boolean | undefined
			}
		});
	} else {
		pricebook = await prisma.pricebook.create({
			data: {
				organizationId,
				name: data.name as string,
				description: data.description as string | undefined,
				isActive: data.isActive as boolean ?? true
			}
		});
	}

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: pricebook.id,
		action: pricebookId ? 'UPDATE' : 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Pricebook ${pricebookId ? 'updated' : 'created'}: ${pricebook.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: 'UPSERT_PRICEBOOK',
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
	const version = await prisma.pricebookVersion.create({
		data: {
			pricebookId,
			versionNumber,
			notes: data.notes as string | undefined,
			status: 'DRAFT'
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: version.id,
		action: 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Pricebook version created: v${versionNumber}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: 'CREATE_VERSION',
		workflowVersion: 'v1'
	});

	return { id: version.id };
}

async function publishVersion(
	organizationId: string,
	userId: string,
	versionId: string
): Promise<{ id: string }> {
	const version = await prisma.pricebookVersion.update({
		where: { id: versionId },
		data: {
			status: 'PUBLISHED',
			publishedAt: new Date(),
			publishedBy: userId
		}
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: version.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Pricebook version published',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: 'PUBLISH_VERSION',
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
	// Deactivate other active versions
	await prisma.pricebookVersion.updateMany({
		where: { pricebookId, status: 'ACTIVE', NOT: { id: versionId } },
		data: { status: 'ARCHIVED' }
	});

	const version = await prisma.pricebookVersion.update({
		where: { id: versionId },
		data: { status: 'ACTIVE', activatedAt: new Date() }
	});

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: version.id,
		action: 'UPDATE',
		eventCategory: 'EXECUTION',
		summary: 'Pricebook version activated',
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: 'ACTIVATE_VERSION',
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
	let item;
	if (itemId) {
		item = await prisma.pricebookItem.update({
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
		item = await prisma.pricebookItem.create({
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

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: item.id,
		action: itemId ? 'UPDATE' : 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Pricebook item ${itemId ? 'updated' : 'created'}: ${item.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: 'UPSERT_ITEM',
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
	let rule;
	if (ruleId) {
		rule = await prisma.priceRule.update({
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
		rule = await prisma.priceRule.create({
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

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: rule.id,
		action: ruleId ? 'UPDATE' : 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Price rule ${ruleId ? 'updated' : 'created'}: ${rule.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: 'UPSERT_RULE',
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
	let template;
	if (templateId) {
		template = await prisma.jobTemplate.update({
			where: { id: templateId },
			data: {
				name: data.name as string | undefined,
				description: data.description as string | undefined,
				defaultTrade: data.trade as ContractorTradeType | undefined,
				isActive: data.isActive as boolean | undefined
			}
		});
	} else {
		template = await prisma.jobTemplate.create({
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

	await recordWorkflowEvent({
		organizationId,
		entityType: 'JOB',
		entityId: template.id,
		action: templateId ? 'UPDATE' : 'CREATE',
		eventCategory: 'EXECUTION',
		summary: `Job template ${templateId ? 'updated' : 'created'}: ${template.name}`,
		performedById: userId,
		performedByType: 'HUMAN',
		workflowId: 'pricebookWorkflow_v1',
		workflowStep: 'UPSERT_TEMPLATE',
		workflowVersion: 'v1'
	});

	return { id: template.id };
}

async function pricebookWorkflow(input: PricebookWorkflowInput): Promise<PricebookWorkflowResult> {
	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case 'UPSERT_PRICEBOOK': {
				const result = await DBOS.runStep(
					() => upsertPricebook(input.organizationId, input.userId, input.pricebookId, input.data),
					{ name: 'upsertPricebook' }
				);
				entityId = result.id;
				break;
			}
			case 'CREATE_VERSION': {
				if (!input.pricebookId) throw new Error('pricebookId required for CREATE_VERSION');
				const versionNumber = input.data.versionNumber as number;
				const result = await DBOS.runStep(
					() => createVersion(input.organizationId, input.userId, input.pricebookId!, versionNumber, input.data),
					{ name: 'createVersion' }
				);
				entityId = result.id;
				break;
			}
			case 'PUBLISH_VERSION': {
				if (!input.versionId) throw new Error('versionId required for PUBLISH_VERSION');
				const result = await DBOS.runStep(
					() => publishVersion(input.organizationId, input.userId, input.versionId!),
					{ name: 'publishVersion' }
				);
				entityId = result.id;
				break;
			}
			case 'ACTIVATE_VERSION': {
				if (!input.versionId || !input.pricebookId) throw new Error('versionId and pricebookId required for ACTIVATE_VERSION');
				const result = await DBOS.runStep(
					() => activateVersion(input.organizationId, input.userId, input.versionId!, input.pricebookId!),
					{ name: 'activateVersion' }
				);
				entityId = result.id;
				break;
			}
			case 'UPSERT_ITEM': {
				if (!input.versionId) throw new Error('versionId required for UPSERT_ITEM');
				const result = await DBOS.runStep(
					() => upsertItem(input.organizationId, input.userId, input.versionId!, input.itemId, input.data),
					{ name: 'upsertItem' }
				);
				entityId = result.id;
				break;
			}
			case 'UPSERT_RULE': {
				if (!input.versionId) throw new Error('versionId required for UPSERT_RULE');
				const result = await DBOS.runStep(
					() => upsertRule(input.organizationId, input.userId, input.versionId!, input.ruleId, input.data),
					{ name: 'upsertRule' }
				);
				entityId = result.id;
				break;
			}
			case 'UPSERT_TEMPLATE': {
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
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'PRICEBOOK_WORKFLOW_ERROR'
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
	workflowId: string, idempotencyKey: string
): Promise<PricebookWorkflowResult> {
	const handle = await DBOS.startWorkflow(pricebookWorkflow_v1, {
		workflowID: idempotencyKey})(input);

	return handle.getResult();
}

