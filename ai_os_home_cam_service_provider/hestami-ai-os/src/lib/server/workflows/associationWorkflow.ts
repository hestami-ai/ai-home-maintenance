import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { seedDefaultChartOfAccounts } from '../accounting/glService.js';
import { COATemplateId } from '../accounting/defaultChartOfAccounts.js';
import type {
    Prisma,
    ActivityEntityType,
    ActivityActionType,
    ActivityEventCategory
} from '../../../../generated/prisma/client.js';

/**
 * Input for the CREATE_MANAGED_ASSOCIATION workflow
 */
export interface CreateManagedAssociationInput {
    action: 'CREATE_MANAGED_ASSOCIATION';
    organizationId: string; // The management company
    userId: string;
    associationData: {
        name: string;
        legalName?: string | null;
        taxId?: string | null;
        incorporationDate?: Date | null;
        fiscalYearEnd: number;
        settings?: Prisma.InputJsonValue;
    };
    coaTemplateId: COATemplateId;
    contractData?: {
        contractNumber?: string | null;
        startDate: Date;
    } | null;
}

/**
 * Result of the CREATE_MANAGED_ASSOCIATION workflow
 */
export interface CreateManagedAssociationResult {
    success: boolean;
    error?: string;
    associationId?: string;
}

/**
 * Durable workflow to create an association and link it to a management company
 */
async function createManagedAssociation_v1(input: CreateManagedAssociationInput): Promise<CreateManagedAssociationResult> {
    const workflowName = 'createManagedAssociation_v1';
    const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);
    const startTime = logWorkflowStart(log, input.action, input as unknown as Record<string, unknown>, workflowName, DBOS.workflowID);

    try {
        // 1. Create Association and (optionally) Management Contract in a transaction
        const { association, contract } = await DBOS.runStep(
            async () => {
                return prisma.$transaction(async (tx) => {
                    // Create association
                    const association = await tx.association.create({
                        data: {
                            organizationId: input.organizationId,
                            name: input.associationData.name,
                            legalName: input.associationData.legalName,
                            taxId: input.associationData.taxId,
                            incorporationDate: input.associationData.incorporationDate,
                            fiscalYearEnd: input.associationData.fiscalYearEnd,
                            settings: input.associationData.settings ?? {},
                            status: 'ONBOARDING'
                        }
                    });

                    // Create management contract if provided
                    let contract = null;
                    if (input.contractData) {
                        contract = await tx.managementContract.create({
                            data: {
                                associationId: association.id,
                                managementCompanyId: input.organizationId,
                                contractNumber: input.contractData.contractNumber,
                                startDate: input.contractData.startDate
                            }
                        });
                    }

                    return { association, contract };
                });
            },
            { name: 'createAssociationAndContract' }
        );

        // 2. Seed Chart of Accounts using the selected template
        await DBOS.runStep(
            async () => {
                await seedDefaultChartOfAccounts(input.organizationId, association.id, input.coaTemplateId);
            },
            { name: 'seedCOA' }
        );

        // 3. Record activity event
        await recordWorkflowEvent({
            organizationId: input.organizationId,
            entityType: 'ASSOCIATION' as ActivityEntityType,
            entityId: association.id,
            action: 'CREATE' as ActivityActionType,
            eventCategory: 'EXECUTION' as ActivityEventCategory,
            workflowId: 'createManagedAssociation_v1',
            workflowStep: 'COMPLETE',
            summary: `Association created: ${association.name}`,
            associationId: association.id,
            newState: { name: association.name, status: association.status } as Record<string, unknown>
        });

        const result = { success: true, associationId: association.id };
        logWorkflowEnd(log, input.action, true, startTime, result);
        return result;

    } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        log.error('Workflow failed', { action: input.action, error: errorObj.message });

        await recordSpanError(errorObj, {
            errorCode: 'WORKFLOW_FAILED',
            errorType: 'ASSOCIATION_CREATION_ERROR'
        });

        const errorResult = { success: false, error: errorObj.message };
        logWorkflowEnd(log, input.action, false, startTime, errorResult);
        return errorResult;
    }
}

export const createManagedAssociation_v1_wf = DBOS.registerWorkflow(createManagedAssociation_v1);
