import { z } from 'zod';
import { ResponseMetaSchema, JsonSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse, IdempotencyKeySchema, PaginationInputSchema, PaginationOutputSchema } from '../../router.js';
import { prisma } from '../../../db.js';
import { startGovernanceWorkflow } from '../../../workflows/governanceWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('CommitteeRoute');

// Enums matching Prisma schema
const committeeTypeEnum = z.enum(['ARC', 'SOCIAL', 'LANDSCAPE', 'BUDGET', 'SAFETY', 'NOMINATING', 'CUSTOM']);
const committeeRoleEnum = z.enum(['CHAIR', 'VICE_CHAIR', 'SECRETARY', 'MEMBER']);

// Output schemas
const CommitteeOutputSchema = z.object({
    id: z.string(),
    associationId: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    committeeType: committeeTypeEnum,
    isArcLinked: z.boolean(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    memberCount: z.number().optional()
});

const CommitteeMemberOutputSchema = z.object({
    id: z.string(),
    committeeId: z.string(),
    partyId: z.string(),
    role: committeeRoleEnum,
    termStart: z.string(),
    termEnd: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.string(),
    party: z.object({
        id: z.string(),
        partyType: z.string(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        entityName: z.string().nullable(),
        email: z.string().nullable()
    }).optional()
});

// Helper functions
const getAssociationOrThrow = async (associationId: string, organizationId: string, errors: any) => {
    const association = await prisma.association.findFirst({ where: { id: associationId, organizationId, deletedAt: null } });
    if (!association) throw errors.NOT_FOUND({ message: 'Association' });
    return association;
};

const ensurePartyBelongs = async (partyId: string, organizationId: string, errors: any) => {
    const party = await prisma.party.findFirst({ where: { id: partyId, organizationId, deletedAt: null } });
    if (!party) throw errors.NOT_FOUND({ message: 'Party' });
    return party;
};

export const governanceCommitteeRouter = {
    /**
     * Create a new committee for an association
     */
    create: orgProcedure
        .input(
            IdempotencyKeySchema.merge(
                z.object({
                    associationId: z.string(),
                    name: z.string().min(1).max(255),
                    description: z.string().max(2000).optional(),
                    committeeType: committeeTypeEnum,
                    isArcLinked: z.boolean().optional()
                })
            )
        )
        .output(
            z.object({
                ok: z.literal(true),
                data: z.object({ committee: CommitteeOutputSchema }),
                meta: ResponseMetaSchema
            })
        )
        .errors({
            NOT_FOUND: { message: 'Association not found' },
            INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
        })
        .handler(async ({ input, context, errors }) => {
            await context.cerbos.authorize('create', 'governance_committee', input.associationId);
            const { idempotencyKey, ...rest } = input;

            await getAssociationOrThrow(rest.associationId, context.organization.id, errors);

            // Use DBOS workflow for durable execution
            const result = await startGovernanceWorkflow(
                {
                    action: 'CREATE_COMMITTEE',
                    organizationId: context.organization.id,
                    userId: context.user!.id,
                    data: rest
                },
                idempotencyKey
            );

            if (!result.success) {
                throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create committee' });
            }

            const committee = await prisma.committee.findUniqueOrThrow({
                where: { id: result.entityId },
                include: { _count: { select: { members: true } } }
            });

            return successResponse(
                {
                    committee: {
                        id: committee.id,
                        associationId: committee.associationId,
                        name: committee.name,
                        description: committee.description,
                        committeeType: committee.committeeType,
                        isArcLinked: committee.isArcLinked,
                        isActive: committee.isActive,
                        createdAt: committee.createdAt.toISOString(),
                        updatedAt: committee.updatedAt.toISOString(),
                        memberCount: committee._count.members
                    }
                },
                context
            );
        }),

    /**
     * Get a committee by ID with members
     */
    get: orgProcedure
        .input(z.object({ id: z.string() }))
        .output(
            z.object({
                ok: z.literal(true),
                data: z.object({
                    committee: CommitteeOutputSchema,
                    members: z.array(CommitteeMemberOutputSchema)
                }),
                meta: ResponseMetaSchema
            })
        )
        .errors({
            NOT_FOUND: { message: 'Committee not found' }
        })
        .handler(async ({ input, context, errors }) => {
            const committee = await prisma.committee.findFirst({
                where: { id: input.id },
                include: {
                    association: true,
                    members: {
                        include: {
                            party: {
                                select: {
                                    id: true,
                                    partyType: true,
                                    firstName: true,
                                    lastName: true,
                                    entityName: true,
                                    email: true
                                }
                            }
                        },
                        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }]
                    },
                    _count: { select: { members: true } }
                }
            });
            if (!committee || committee.association.organizationId !== context.organization.id) {
                throw errors.NOT_FOUND({ message: 'Committee' });
            }
            await context.cerbos.authorize('view', 'governance_committee', committee.id);

            return successResponse({
                committee: {
                    id: committee.id,
                    associationId: committee.associationId,
                    name: committee.name,
                    description: committee.description,
                    committeeType: committee.committeeType,
                    isArcLinked: committee.isArcLinked,
                    isActive: committee.isActive,
                    createdAt: committee.createdAt.toISOString(),
                    updatedAt: committee.updatedAt.toISOString(),
                    memberCount: committee._count.members
                },
                members: committee.members.map(m => ({
                    id: m.id,
                    committeeId: m.committeeId,
                    partyId: m.partyId,
                    role: m.role,
                    termStart: m.termStart.toISOString(),
                    termEnd: m.termEnd?.toISOString() ?? null,
                    isActive: m.isActive,
                    createdAt: m.createdAt.toISOString(),
                    party: m.party
                }))
            }, context);
        }),

    /**
     * List committees for an association
     */
    list: orgProcedure
        .input(PaginationInputSchema.extend({
            associationId: z.string().optional(),
            committeeType: committeeTypeEnum.optional(),
            isActive: z.boolean().optional()
        }))
        .output(
            z.object({
                ok: z.literal(true),
                data: z.object({
                    committees: z.array(CommitteeOutputSchema),
                    pagination: PaginationOutputSchema
                }),
                meta: ResponseMetaSchema
            })
        )
        .handler(async ({ input, context }) => {
            const take = input.limit ?? 20;
            const where: any = {
                association: { organizationId: context.organization.id }
            };

            if (input.associationId) where.associationId = input.associationId;
            if (input.committeeType) where.committeeType = input.committeeType;
            if (input.isActive !== undefined) where.isActive = input.isActive;

            const items = await prisma.committee.findMany({
                where,
                take: take + 1,
                skip: input.cursor ? 1 : 0,
                cursor: input.cursor ? { id: input.cursor } : undefined,
                orderBy: { createdAt: 'desc' },
                include: { _count: { select: { members: true } } }
            });

            const hasMore = items.length > take;
            const data = hasMore ? items.slice(0, -1) : items;

            return successResponse(
                {
                    committees: data.map(c => ({
                        id: c.id,
                        associationId: c.associationId,
                        name: c.name,
                        description: c.description,
                        committeeType: c.committeeType,
                        isArcLinked: c.isArcLinked,
                        isActive: c.isActive,
                        createdAt: c.createdAt.toISOString(),
                        updatedAt: c.updatedAt.toISOString(),
                        memberCount: c._count.members
                    })),
                    pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
                },
                context
            );
        }),

    /**
     * Update committee details
     */
    update: orgProcedure
        .input(
            IdempotencyKeySchema.merge(
                z.object({
                    id: z.string(),
                    name: z.string().min(1).max(255).optional(),
                    description: z.string().max(2000).nullable().optional(),
                    committeeType: committeeTypeEnum.optional(),
                    isArcLinked: z.boolean().optional(),
                    isActive: z.boolean().optional()
                })
            )
        )
        .output(
            z.object({
                ok: z.literal(true),
                data: z.object({ committee: CommitteeOutputSchema }),
                meta: ResponseMetaSchema
            })
        )
        .errors({
            NOT_FOUND: { message: 'Committee not found' },
            INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
        })
        .handler(async ({ input, context, errors }) => {
            await context.cerbos.authorize('edit', 'governance_committee', input.id);
            const { idempotencyKey, id, ...updateData } = input;

            const committee = await prisma.committee.findFirst({
                where: { id },
                include: { association: true }
            });
            if (!committee || committee.association.organizationId !== context.organization.id) {
                throw errors.NOT_FOUND({ message: 'Committee' });
            }

            // Use DBOS workflow for durable execution
            const result = await startGovernanceWorkflow(
                {
                    action: 'UPDATE_COMMITTEE',
                    organizationId: context.organization.id,
                    userId: context.user.id,
                    entityId: id,
                    data: updateData
                },
                idempotencyKey
            );

            if (!result.success) {
                throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update committee' });
            }

            const updated = await prisma.committee.findUniqueOrThrow({
                where: { id },
                include: { _count: { select: { members: true } } }
            });

            return successResponse(
                {
                    committee: {
                        id: updated.id,
                        associationId: updated.associationId,
                        name: updated.name,
                        description: updated.description,
                        committeeType: updated.committeeType,
                        isArcLinked: updated.isArcLinked,
                        isActive: updated.isActive,
                        createdAt: updated.createdAt.toISOString(),
                        updatedAt: updated.updatedAt.toISOString(),
                        memberCount: updated._count.members
                    }
                },
                context
            );
        }),

    /**
     * Add a member to a committee
     */
    addMember: orgProcedure
        .input(
            IdempotencyKeySchema.merge(
                z.object({
                    committeeId: z.string(),
                    partyId: z.string(),
                    role: committeeRoleEnum,
                    termStart: z.string().datetime(),
                    termEnd: z.string().datetime().optional()
                })
            )
        )
        .output(
            z.object({
                ok: z.literal(true),
                data: z.object({ member: CommitteeMemberOutputSchema }),
                meta: ResponseMetaSchema
            })
        )
        .errors({
            NOT_FOUND: { message: 'Entity not found' },
            INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
        })
        .handler(async ({ input, context, errors }) => {
            await context.cerbos.authorize('edit', 'governance_committee', input.committeeId);
            const { idempotencyKey, ...rest } = input;

            const committee = await prisma.committee.findFirst({
                where: { id: rest.committeeId },
                include: { association: true }
            });
            if (!committee || committee.association.organizationId !== context.organization.id) {
                throw errors.NOT_FOUND({ message: 'Committee' });
            }
            await ensurePartyBelongs(rest.partyId, context.organization.id, errors);

            // Use DBOS workflow for durable execution
            const workflowResult = await startGovernanceWorkflow(
                {
                    action: 'ADD_COMMITTEE_MEMBER',
                    organizationId: context.organization.id,
                    userId: context.user.id,
                    data: {
                        committeeId: rest.committeeId,
                        partyId: rest.partyId,
                        role: rest.role,
                        termStart: rest.termStart,
                        termEnd: rest.termEnd
                    }
                },
                idempotencyKey
            );

            if (!workflowResult.success) {
                throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to add committee member' });
            }

            const member = await prisma.committeeMember.findUniqueOrThrow({
                where: { id: workflowResult.entityId },
                include: {
                    party: {
                        select: {
                            id: true,
                            partyType: true,
                            firstName: true,
                            lastName: true,
                            entityName: true,
                            email: true
                        }
                    }
                }
            });

            return successResponse(
                {
                    member: {
                        id: member.id,
                        committeeId: member.committeeId,
                        partyId: member.partyId,
                        role: member.role,
                        termStart: member.termStart.toISOString(),
                        termEnd: member.termEnd?.toISOString() ?? null,
                        isActive: member.isActive,
                        createdAt: member.createdAt.toISOString(),
                        party: member.party
                    }
                },
                context
            );
        }),

    /**
     * Remove a member from a committee
     */
    removeMember: orgProcedure
        .input(
            IdempotencyKeySchema.merge(
                z.object({
                    committeeId: z.string(),
                    memberId: z.string()
                })
            )
        )
        .output(
            z.object({
                ok: z.literal(true),
                data: z.object({ member: z.object({ id: z.string(), committeeId: z.string(), isActive: z.boolean() }) }),
                meta: ResponseMetaSchema
            })
        )
        .errors({
            NOT_FOUND: { message: 'Committee not found' },
            INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
        })
        .handler(async ({ input, context, errors }) => {
            await context.cerbos.authorize('edit', 'governance_committee', input.committeeId);
            const { idempotencyKey, ...rest } = input;

            const committee = await prisma.committee.findFirst({
                where: { id: rest.committeeId },
                include: { association: true }
            });
            if (!committee || committee.association.organizationId !== context.organization.id) {
                throw errors.NOT_FOUND({ message: 'Committee' });
            }

            // Use DBOS workflow for durable execution
            const workflowResult = await startGovernanceWorkflow(
                {
                    action: 'REMOVE_COMMITTEE_MEMBER',
                    organizationId: context.organization.id,
                    userId: context.user.id,
                    data: {
                        committeeId: rest.committeeId,
                        memberId: rest.memberId
                    }
                },
                idempotencyKey
            );

            if (!workflowResult.success) {
                throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to remove committee member' });
            }

            const member = await prisma.committeeMember.findUniqueOrThrow({ where: { id: rest.memberId } });

            return successResponse(
                { member: { id: member.id, committeeId: member.committeeId, isActive: member.isActive } },
                context
            );
        }),

    /**
     * List members of a committee
     */
    listMembers: orgProcedure
        .input(
            PaginationInputSchema.extend({
                committeeId: z.string(),
                isActive: z.boolean().optional()
            })
        )
        .output(
            z.object({
                ok: z.literal(true),
                data: z.object({
                    members: z.array(CommitteeMemberOutputSchema),
                    pagination: PaginationOutputSchema
                }),
                meta: ResponseMetaSchema
            })
        )
        .errors({
            NOT_FOUND: { message: 'Committee not found' }
        })
        .handler(async ({ input, context, errors }) => {
            await context.cerbos.authorize('view', 'governance_committee', input.committeeId);

            const take = input.limit ?? 20;
            const committee = await prisma.committee.findFirst({
                where: { id: input.committeeId },
                include: { association: true }
            });
            if (!committee || committee.association.organizationId !== context.organization.id) {
                throw errors.NOT_FOUND({ message: 'Committee' });
            }

            const where: any = { committeeId: input.committeeId };
            if (input.isActive !== undefined) where.isActive = input.isActive;

            const items = await prisma.committeeMember.findMany({
                where,
                take: take + 1,
                skip: input.cursor ? 1 : 0,
                cursor: input.cursor ? { id: input.cursor } : undefined,
                orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
                include: {
                    party: {
                        select: {
                            id: true,
                            partyType: true,
                            firstName: true,
                            lastName: true,
                            entityName: true,
                            email: true
                        }
                    }
                }
            });
            const hasMore = items.length > take;
            const data = hasMore ? items.slice(0, -1) : items;

            return successResponse(
                {
                    members: data.map(m => ({
                        id: m.id,
                        committeeId: m.committeeId,
                        partyId: m.partyId,
                        role: m.role,
                        termStart: m.termStart.toISOString(),
                        termEnd: m.termEnd?.toISOString() ?? null,
                        isActive: m.isActive,
                        createdAt: m.createdAt.toISOString(),
                        party: m.party
                    })),
                    pagination: { hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null }
                },
                context
            );
        })
};
