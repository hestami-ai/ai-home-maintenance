import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { orgTransaction } from '../db/rls.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { seedDefaultChartOfAccounts } from '../accounting/glService.js';
import { COATemplateId } from '../accounting/defaultChartOfAccounts.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import {
    ActivityEntityType,
    ActivityActionType,
    ActivityEventCategory,
    AssociationStatus
} from '../../../../generated/prisma/enums.js';

// Workflow error types for tracing
const WorkflowErrorType = {
    ASSOCIATION_CREATION_ERROR: 'ASSOCIATION_CREATION_ERROR',
    ASSOCIATION_MANAGEMENT_ERROR: 'ASSOCIATION_MANAGEMENT_ERROR'
} as const;

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
                return orgTransaction(input.organizationId, async (tx) => {
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
                            status: AssociationStatus.ONBOARDING
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
                }, { userId: input.userId, reason: 'Create managed association and optional management contract' });
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
            entityType: ActivityEntityType.ASSOCIATION,
            entityId: association.id,
            action: ActivityActionType.CREATE,
            eventCategory: ActivityEventCategory.EXECUTION,
            workflowId: 'createManagedAssociation_v1',
            workflowStep: 'CREATE_MANAGED_ASSOCIATION',
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
            errorCode: ActivityActionType.WORKFLOW_FAILED,
            errorType: WorkflowErrorType.ASSOCIATION_CREATION_ERROR
        });

        const errorResult = { success: false, error: errorObj.message };
        logWorkflowEnd(log, input.action, false, startTime, errorResult);
        return errorResult;
    }
}

export const createManagedAssociation_v1_wf = DBOS.registerWorkflow(createManagedAssociation_v1);

// ============================================================================
// Association Management Workflow (Update, SetDefault, Delete)
// ============================================================================

export const AssociationManagementAction = {
    UPDATE: 'UPDATE',
    SET_DEFAULT: 'SET_DEFAULT',
    DELETE: 'DELETE'
} as const;

export type AssociationManagementAction = (typeof AssociationManagementAction)[keyof typeof AssociationManagementAction];

export interface AssociationManagementInput {
    action: AssociationManagementAction;
    organizationId: string;
    userId: string;
    associationId: string;
    data?: {
        // UPDATE fields
        name?: string;
        legalName?: string | null;
        taxId?: string | null;
        fiscalYearEnd?: number;
        settings?: Prisma.InputJsonValue;
    };
}

export interface AssociationManagementResult {
    success: boolean;
    error?: string;
    associationId?: string;
}

async function updateAssociationStep(
    organizationId: string,
    userId: string,
    associationId: string,
    data: NonNullable<AssociationManagementInput['data']>
): Promise<{ id: string }> {
    const { settings, ...updateData } = data;
    return orgTransaction(organizationId, async (tx) => {
        const association = await tx.association.update({
            where: { id: associationId },
            data: {
                ...updateData,
                ...(settings !== undefined && { settings: settings as Prisma.InputJsonValue })
            }
        });
        return { id: association.id };
    }, { userId, reason: 'Update association details' });
}

async function setDefaultAssociationStep(
    userId: string,
    organizationId: string,
    associationId: string
): Promise<void> {
    await orgTransaction(organizationId, async (tx) => {
        await tx.userAssociationPreference.upsert({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId
                }
            },
            create: {
                userId,
                organizationId,
                associationId
            },
            update: {
                associationId
            }
        });
    }, { userId, reason: 'Set default association preference for user' });
}

async function deleteAssociationStep(
    organizationId: string,
    userId: string,
    associationId: string
): Promise<{ deletedAt: Date }> {
    const now = new Date();
    await orgTransaction(organizationId, async (tx) => {
        await tx.association.update({
            where: { id: associationId },
            data: { deletedAt: now }
        });
    }, { userId, reason: 'Soft delete association' });
    return { deletedAt: now };
}

async function associationManagementWorkflow(input: AssociationManagementInput): Promise<AssociationManagementResult> {
    const workflowName = 'associationManagement_v1';
    const log = createWorkflowLogger(workflowName, DBOS.workflowID, input.action);

    try {
        switch (input.action) {
            case AssociationManagementAction.UPDATE: {
                if (!input.data) {
                    return { success: false, error: 'Update data is required' };
                }
                const result = await DBOS.runStep(
                    () => updateAssociationStep(input.organizationId, input.userId, input.associationId, input.data!),
                    { name: 'updateAssociation' }
                );
                return { success: true, associationId: result.id };
            }

            case AssociationManagementAction.SET_DEFAULT: {
                await DBOS.runStep(
                    () => setDefaultAssociationStep(input.userId, input.organizationId, input.associationId),
                    { name: 'setDefaultAssociation' }
                );
                return { success: true, associationId: input.associationId };
            }

            case AssociationManagementAction.DELETE: {
                await DBOS.runStep(
                    () => deleteAssociationStep(input.organizationId, input.userId, input.associationId!),
                    { name: 'deleteAssociation' }
                );
                return { success: true, associationId: input.associationId };
            }

            default:
                return { success: false, error: `Unknown action: ${input.action}` };
        }
    } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        log.error('Workflow failed', { action: input.action, error: errorObj.message });

        await recordSpanError(errorObj, {
            errorCode: ActivityActionType.WORKFLOW_FAILED,
            errorType: WorkflowErrorType.ASSOCIATION_MANAGEMENT_ERROR
        });

        return { success: false, error: errorObj.message };
    }
}

export const associationManagement_v1 = DBOS.registerWorkflow(associationManagementWorkflow);

export async function startAssociationManagementWorkflow(
    input: AssociationManagementInput,
    idempotencyKey: string
): Promise<AssociationManagementResult> {
    const handle = await DBOS.startWorkflow(associationManagement_v1, { workflowID: idempotencyKey })(input);
    return handle.getResult();
}
