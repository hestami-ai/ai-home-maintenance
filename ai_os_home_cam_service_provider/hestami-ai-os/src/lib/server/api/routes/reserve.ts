import { z } from 'zod';
import { ResponseMetaSchema } from '../schemas.js';
import { orgProcedure, successResponse, PaginationInputSchema, PaginationOutputSchema } from '../router.js';
import { prisma } from '../../db.js';
import { startReserveWorkflow } from '../../workflows/reserveWorkflow.js';
import type { Prisma } from '../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('ReserveRoute');

const ComponentCategoryEnum = z.enum([
	'ROOFING',
	'PAVING',
	'PAINTING',
	'PLUMBING',
	'ELECTRICAL',
	'HVAC',
	'POOL_SPA',
	'LANDSCAPING',
	'FENCING',
	'STRUCTURAL',
	'ELEVATOR',
	'COMMON_AREA',
	'EQUIPMENT',
	'OTHER'
]);

const StudyTypeEnum = z.enum(['FULL', 'UPDATE_WITH_SITE', 'UPDATE_NO_SITE']);

const FundingPlanTypeEnum = z.enum(['BASELINE', 'THRESHOLD', 'FULL_FUNDING', 'STATUTORY']);

export const reserveRouter = {
	// =========================================================================
	// Reserve Component APIs
	// =========================================================================

	createComponent: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				associationId: z.string(),
				name: z.string().max(255),
				description: z.string().optional(),
				category: ComponentCategoryEnum,
				location: z.string().optional(),
				usefulLife: z.number().int().positive(),
				remainingLife: z.number().int().min(0),
				placedInServiceDate: z.string().datetime().optional(),
				currentReplacementCost: z.number().positive(),
				inflationRate: z.number().min(0).max(20).optional(),
				quantity: z.number().int().positive().optional(),
				unitOfMeasure: z.string().optional(),
				conditionRating: z.number().int().min(1).max(10).optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					component: z.object({
						id: z.string(),
						name: z.string(),
						category: ComponentCategoryEnum,
						usefulLife: z.number(),
						remainingLife: z.number(),
						currentReplacementCost: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'reserveComponent', 'new');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			// Use DBOS workflow for durable execution
			const result = await startReserveWorkflow(
				{
					action: 'CREATE_COMPONENT',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data: {
						associationId: input.associationId,
						name: input.name,
						description: input.description,
						category: input.category,
						location: input.location,
						usefulLife: input.usefulLife,
						remainingLife: input.remainingLife,
						placedInServiceDate: input.placedInServiceDate,
						currentReplacementCost: input.currentReplacementCost,
						inflationRate: input.inflationRate,
						quantity: input.quantity,
						unitOfMeasure: input.unitOfMeasure,
						conditionRating: input.conditionRating,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create component' });
			}

			const component = await prisma.reserveComponent.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse(
				{
					component: {
						id: component.id,
						name: component.name,
						category: component.category,
						usefulLife: component.usefulLife,
						remainingLife: component.remainingLife,
						currentReplacementCost: component.currentReplacementCost.toString(),
						createdAt: component.createdAt.toISOString()
					}
				},
				context
			);
		}),

	getComponent: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					component: z.object({
						id: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						category: ComponentCategoryEnum,
						location: z.string().nullable(),
						usefulLife: z.number(),
						remainingLife: z.number(),
						placedInServiceDate: z.string().nullable(),
						currentReplacementCost: z.string(),
						futureReplacementCost: z.string().nullable(),
						inflationRate: z.string(),
						quantity: z.number(),
						unitOfMeasure: z.string().nullable(),
						conditionRating: z.number().nullable(),
						lastInspectionDate: z.string().nullable(),
						notes: z.string().nullable(),
						createdAt: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Reserve component not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const component = await prisma.reserveComponent.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { association: true }
			});

			if (!component || component.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ReserveComponent' });
			}

			await context.cerbos.authorize('view', 'reserveComponent', component.id);

			return successResponse(
				{
					component: {
						id: component.id,
						name: component.name,
						description: component.description ?? null,
						category: component.category,
						location: component.location ?? null,
						usefulLife: component.usefulLife,
						remainingLife: component.remainingLife,
						placedInServiceDate: component.placedInServiceDate?.toISOString() ?? null,
						currentReplacementCost: component.currentReplacementCost.toString(),
						futureReplacementCost: component.futureReplacementCost?.toString() ?? null,
						inflationRate: component.inflationRate.toString(),
						quantity: component.quantity,
						unitOfMeasure: component.unitOfMeasure ?? null,
						conditionRating: component.conditionRating ?? null,
						lastInspectionDate: component.lastInspectionDate?.toISOString() ?? null,
						notes: component.notes ?? null,
						createdAt: component.createdAt.toISOString(),
						updatedAt: component.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	listComponents: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string(),
				category: ComponentCategoryEnum.optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					components: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							category: ComponentCategoryEnum,
							usefulLife: z.number(),
							remainingLife: z.number(),
							currentReplacementCost: z.string(),
							conditionRating: z.number().nullable()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'reserveComponent', 'list');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const components = await prisma.reserveComponent.findMany({
				where: {
					associationId: input.associationId,
					deletedAt: null,
					...(input.category && { category: input.category })
				},
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { name: 'asc' }
			});

			const hasMore = components.length > input.limit;
			const items = hasMore ? components.slice(0, -1) : components;

			return successResponse(
				{
					components: items.map((c) => ({
						id: c.id,
						name: c.name,
						category: c.category,
						usefulLife: c.usefulLife,
						remainingLife: c.remainingLife,
						currentReplacementCost: c.currentReplacementCost.toString(),
						conditionRating: c.conditionRating ?? null
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	updateComponent: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				name: z.string().max(255).optional(),
				description: z.string().optional(),
				category: ComponentCategoryEnum.optional(),
				location: z.string().optional(),
				usefulLife: z.number().int().positive().optional(),
				remainingLife: z.number().int().min(0).optional(),
				currentReplacementCost: z.number().positive().optional(),
				inflationRate: z.number().min(0).max(20).optional(),
				quantity: z.number().int().positive().optional(),
				unitOfMeasure: z.string().optional(),
				conditionRating: z.number().int().min(1).max(10).optional(),
				lastInspectionDate: z.string().datetime().optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					component: z.object({
						id: z.string(),
						updatedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Reserve component not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const component = await prisma.reserveComponent.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { association: true }
			});

			if (!component || component.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ReserveComponent' });
			}

			await context.cerbos.authorize('update', 'reserveComponent', component.id);

			// Use DBOS workflow for durable execution
			const result = await startReserveWorkflow(
				{
					action: 'UPDATE_COMPONENT',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entityId: input.id,
					data: {
						name: input.name,
						description: input.description,
						category: input.category,
						location: input.location,
						usefulLife: input.usefulLife,
						remainingLife: input.remainingLife,
						currentReplacementCost: input.currentReplacementCost,
						inflationRate: input.inflationRate,
						quantity: input.quantity,
						unitOfMeasure: input.unitOfMeasure,
						conditionRating: input.conditionRating,
						lastInspectionDate: input.lastInspectionDate,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update component' });
			}

			const updated = await prisma.reserveComponent.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse(
				{
					component: {
						id: updated.id,
						updatedAt: updated.updatedAt.toISOString()
					}
				},
				context
			);
		}),

	deleteComponent: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean(), deletedAt: z.string() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Reserve component not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const component = await prisma.reserveComponent.findFirst({
				where: { id: input.id, deletedAt: null },
				include: { association: true }
			});

			if (!component || component.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ReserveComponent' });
			}

			await context.cerbos.authorize('delete', 'reserveComponent', component.id);

			const now = new Date();
			await prisma.reserveComponent.update({
				where: { id: input.id },
				data: { deletedAt: now }
			});

			return successResponse({ success: true, deletedAt: now.toISOString() }, context);
		}),

	// =========================================================================
	// Reserve Study APIs
	// =========================================================================

	createStudy: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				associationId: z.string(),
				studyType: StudyTypeEnum,
				studyDate: z.string().datetime(),
				effectiveDate: z.string().datetime(),
				expirationDate: z.string().datetime().optional(),
				preparerName: z.string(),
				preparerCompany: z.string().optional(),
				preparerCredentials: z.string().optional(),
				reserveBalance: z.number(),
				percentFunded: z.number().min(0).max(100),
				fullyFundedBalance: z.number(),
				recommendedContribution: z.number(),
				fundingPlanType: FundingPlanTypeEnum,
				documentId: z.string().optional(),
				notes: z.string().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					study: z.object({
						id: z.string(),
						studyType: StudyTypeEnum,
						studyDate: z.string(),
						percentFunded: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Association not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'reserveStudy', 'new');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			// Use DBOS workflow for durable execution
			const result = await startReserveWorkflow(
				{
					action: 'CREATE_STUDY',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data: {
						associationId: input.associationId,
						studyType: input.studyType,
						studyDate: input.studyDate,
						effectiveDate: input.effectiveDate,
						preparerName: input.preparerName,
						preparerCompany: input.preparerCompany,
						preparerCredentials: input.preparerCredentials,
						reserveBalance: input.reserveBalance,
						percentFunded: input.percentFunded,
						fullyFundedBalance: input.fullyFundedBalance,
						recommendedContribution: input.recommendedContribution,
						fundingPlanType: input.fundingPlanType,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create study' });
			}

			const study = await prisma.reserveStudy.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse(
				{
					study: {
						id: study.id,
						studyType: study.studyType,
						studyDate: study.studyDate.toISOString(),
						percentFunded: study.percentFunded.toString(),
						createdAt: study.createdAt.toISOString()
					}
				},
				context
			);
		}),

	getStudy: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					study: z.object({
						id: z.string(),
						studyType: StudyTypeEnum,
						studyDate: z.string(),
						effectiveDate: z.string(),
						expirationDate: z.string().nullable(),
						preparerName: z.string(),
						preparerCompany: z.string().nullable(),
						preparerCredentials: z.string().nullable(),
						reserveBalance: z.string(),
						percentFunded: z.string(),
						fullyFundedBalance: z.string(),
						recommendedContribution: z.string(),
						fundingPlanType: FundingPlanTypeEnum,
						documentId: z.string().nullable(),
						notes: z.string().nullable(),
						createdAt: z.string()
					}),
					componentCount: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Reserve study not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const study = await prisma.reserveStudy.findFirst({
				where: { id: input.id, deletedAt: null },
				include: {
					association: true,
					_count: { select: { components: true } }
				}
			});

			if (!study || study.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ReserveStudy' });
			}

			await context.cerbos.authorize('view', 'reserveStudy', study.id);

			return successResponse(
				{
					study: {
						id: study.id,
						studyType: study.studyType,
						studyDate: study.studyDate.toISOString(),
						effectiveDate: study.effectiveDate.toISOString(),
						expirationDate: study.expirationDate?.toISOString() ?? null,
						preparerName: study.preparerName,
						preparerCompany: study.preparerCompany ?? null,
						preparerCredentials: study.preparerCredentials ?? null,
						reserveBalance: study.reserveBalance.toString(),
						percentFunded: study.percentFunded.toString(),
						fullyFundedBalance: study.fullyFundedBalance.toString(),
						recommendedContribution: study.recommendedContribution.toString(),
						fundingPlanType: study.fundingPlanType,
						documentId: study.documentId ?? null,
						notes: study.notes ?? null,
						createdAt: study.createdAt.toISOString()
					},
					componentCount: study._count.components
				},
				context
			);
		}),

	listStudies: orgProcedure
		.input(
			PaginationInputSchema.extend({
				associationId: z.string()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					studies: z.array(
						z.object({
							id: z.string(),
							studyType: StudyTypeEnum,
							studyDate: z.string(),
							percentFunded: z.string(),
							recommendedContribution: z.string(),
							preparerName: z.string()
						})
					),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Association not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'reserveStudy', 'list');

			const association = await prisma.association.findFirst({
				where: { id: input.associationId, organizationId: context.organization.id, deletedAt: null }
			});
			if (!association) throw errors.NOT_FOUND({ message: 'Association' });

			const studies = await prisma.reserveStudy.findMany({
				where: { associationId: input.associationId, deletedAt: null },
				take: input.limit + 1,
				...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
				orderBy: { studyDate: 'desc' }
			});

			const hasMore = studies.length > input.limit;
			const items = hasMore ? studies.slice(0, -1) : studies;

			return successResponse(
				{
					studies: items.map((s) => ({
						id: s.id,
						studyType: s.studyType,
						studyDate: s.studyDate.toISOString(),
						percentFunded: s.percentFunded.toString(),
						recommendedContribution: s.recommendedContribution.toString(),
						preparerName: s.preparerName
					})),
					pagination: {
						nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
						hasMore
					}
				},
				context
			);
		}),

	// =========================================================================
	// Study Component Snapshots
	// =========================================================================

	addStudyComponent: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				studyId: z.string(),
				componentId: z.string(),
				usefulLife: z.number().int().positive(),
				remainingLife: z.number().int().min(0),
				currentCost: z.number().positive(),
				futureCost: z.number().positive(),
				conditionRating: z.number().int().min(1).max(10).optional(),
				fundedAmount: z.number().min(0),
				percentFunded: z.number().min(0).max(100)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					snapshot: z.object({
						id: z.string(),
						createdAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Entity not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const study = await prisma.reserveStudy.findFirst({
				where: { id: input.studyId, deletedAt: null },
				include: { association: true }
			});

			if (!study || study.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ReserveStudy' });
			}

			await context.cerbos.authorize('update', 'reserveStudy', study.id);

			const component = await prisma.reserveComponent.findFirst({
				where: { id: input.componentId, associationId: study.associationId, deletedAt: null }
			});
			if (!component) throw errors.NOT_FOUND({ message: 'ReserveComponent' });

			// Use DBOS workflow for durable execution
			const result = await startReserveWorkflow(
				{
					action: 'ADD_STUDY_COMPONENT',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data: {
						studyId: input.studyId,
						componentId: input.componentId,
						futureCost: input.futureCost,
						fundedAmount: input.fundedAmount,
						percentFunded: input.percentFunded
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add study component' });
			}

			const snapshot = await prisma.reserveStudyComponent.findUniqueOrThrow({ where: { id: result.entityId } });

			return successResponse(
				{
					snapshot: {
						id: snapshot.id,
						createdAt: snapshot.createdAt.toISOString()
					}
				},
				context
			);
		}),

	getStudyComponents: orgProcedure
		.input(z.object({ studyId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					components: z.array(
						z.object({
							id: z.string(),
							componentId: z.string(),
							componentName: z.string(),
							category: ComponentCategoryEnum,
							usefulLife: z.number(),
							remainingLife: z.number(),
							currentCost: z.string(),
							futureCost: z.string(),
							fundedAmount: z.string(),
							percentFunded: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Reserve study not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const study = await prisma.reserveStudy.findFirst({
				where: { id: input.studyId, deletedAt: null },
				include: { association: true }
			});

			if (!study || study.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ReserveStudy' });
			}

			await context.cerbos.authorize('view', 'reserveStudy', study.id);

			const snapshots = await prisma.reserveStudyComponent.findMany({
				where: { studyId: input.studyId },
				include: { component: true },
				orderBy: { component: { name: 'asc' } }
			});

			return successResponse(
				{
					components: snapshots.map((s) => ({
						id: s.id,
						componentId: s.componentId,
						componentName: s.component.name,
						category: s.component.category,
						usefulLife: s.usefulLife,
						remainingLife: s.remainingLife,
						currentCost: s.currentCost.toString(),
						futureCost: s.futureCost.toString(),
						fundedAmount: s.fundedAmount.toString(),
						percentFunded: s.percentFunded.toString()
					}))
				},
				context
			);
		}),

	// =========================================================================
	// Funding Schedule
	// =========================================================================

	setFundingSchedule: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				studyId: z.string(),
				schedule: z.array(
					z.object({
						fiscalYear: z.number().int(),
						projectedBalance: z.number(),
						recommendedContribution: z.number(),
						projectedExpenditures: z.number(),
						percentFunded: z.number().min(0).max(100)
					})
				)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ count: z.number() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Reserve study not found' },
			INTERNAL_SERVER_ERROR: { message: 'Internal server error' }
		})
		.handler(async ({ input, context, errors }) => {
			const study = await prisma.reserveStudy.findFirst({
				where: { id: input.studyId, deletedAt: null },
				include: { association: true }
			});

			if (!study || study.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ReserveStudy' });
			}

			await context.cerbos.authorize('update', 'reserveStudy', study.id);

			// Use DBOS workflow for durable execution
			const result = await startReserveWorkflow(
				{
					action: 'GENERATE_FUNDING_SCHEDULE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					data: {
						studyId: input.studyId,
						planType: study.fundingPlanType,
						yearlyContributions: input.schedule
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to generate funding schedule' });
			}

			return successResponse({ count: input.schedule.length }, context);
		}),

	getFundingSchedule: orgProcedure
		.input(z.object({ studyId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					schedule: z.array(
						z.object({
							id: z.string(),
							fiscalYear: z.number(),
							projectedBalance: z.string(),
							recommendedContribution: z.string(),
							projectedExpenditures: z.string(),
							percentFunded: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Reserve study not found' }
		})
		.handler(async ({ input, context, errors }) => {
			const study = await prisma.reserveStudy.findFirst({
				where: { id: input.studyId, deletedAt: null },
				include: { association: true }
			});

			if (!study || study.association.organizationId !== context.organization.id) {
				throw errors.NOT_FOUND({ message: 'ReserveStudy' });
			}

			await context.cerbos.authorize('view', 'reserveStudy', study.id);

			const schedule = await prisma.reserveFundingSchedule.findMany({
				where: { studyId: input.studyId },
				orderBy: { fiscalYear: 'asc' }
			});

			return successResponse(
				{
					schedule: schedule.map((s) => ({
						id: s.id,
						fiscalYear: s.fiscalYear,
						projectedBalance: s.projectedBalance.toString(),
						recommendedContribution: s.recommendedContribution.toString(),
						projectedExpenditures: s.projectedExpenditures.toString(),
						percentFunded: s.percentFunded.toString()
					}))
				},
				context
			);
		})
};
