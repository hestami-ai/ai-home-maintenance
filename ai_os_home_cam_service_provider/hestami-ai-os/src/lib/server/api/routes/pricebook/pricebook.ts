import { z } from 'zod';
import { ResponseMetaSchema, JsonSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { ContractorTradeType, PricebookItemType, PricebookVersionStatus as PricebookVersionStatusType, PriceRuleType } from '../../../../../../generated/prisma/client.js';
import { PricebookVersionStatus } from '../../../../../../generated/prisma/enums.js';
import { startPricebookWorkflow, PricebookAction } from '../../../workflows/pricebookWorkflow.js';

const pricebookOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	currency: z.string(),
	isActive: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const pricebookVersionOutput = z.object({
	id: z.string(),
	pricebookId: z.string(),
	versionNumber: z.number(),
	status: z.nativeEnum(PricebookVersionStatus),
	effectiveStart: z.string().nullable(),
	effectiveEnd: z.string().nullable(),
	notes: z.string().nullable(),
	metadata: JsonSchema.nullable(),
	publishedAt: z.string().nullable(),
	publishedBy: z.string().nullable(),
	activatedAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const pricebookItemOutput = z.object({
	id: z.string(),
	pricebookVersionId: z.string(),
	type: z.nativeEnum(PricebookItemType),
	code: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	trade: z.nativeEnum(ContractorTradeType).nullable(),
	unitOfMeasure: z.string().nullable(),
	basePrice: z.string(),
	cost: z.string().nullable(),
	isTaxable: z.boolean(),
	serviceAreaId: z.string().nullable(),
	metadata: JsonSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const priceRuleOutput = z.object({
	id: z.string(),
	pricebookVersionId: z.string(),
	pricebookItemId: z.string().nullable(),
	ruleType: z.nativeEnum(PriceRuleType),
	name: z.string(),
	description: z.string().nullable(),
	priority: z.number(),
	associationId: z.string().nullable(),
	serviceAreaId: z.string().nullable(),
	minQuantity: z.string().nullable(),
	startsAt: z.string().nullable(),
	endsAt: z.string().nullable(),
	conditionJson: JsonSchema.nullable(),
	percentageAdjustment: z.string().nullable(),
	amountAdjustment: z.string().nullable(),
	adjustmentJson: JsonSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const jobTemplateItemOutput = z.object({
	id: z.string(),
	jobTemplateId: z.string(),
	pricebookItemId: z.string(),
	quantity: z.string(),
	lineNumber: z.number(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const jobTemplateOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	pricebookVersionId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	isActive: z.boolean(),
	defaultTrade: z.nativeEnum(ContractorTradeType).nullable(),
	defaultServiceAreaId: z.string().nullable(),
	metadata: JsonSchema.nullable(),
	items: z.array(jobTemplateItemOutput),
	createdAt: z.string(),
	updatedAt: z.string()
});

const ensureVersionMutable = async (versionId: string, orgId: string, errors: any) => {
	const version = await prisma.pricebookVersion.findFirst({
		where: { id: versionId, pricebook: { organizationId: orgId } }
	});
	if (!version) throw errors.NOT_FOUND({ message: 'Pricebook version not found' });
	if (version.status !== PricebookVersionStatus.DRAFT) {
		throw errors.CONFLICT({ message: 'Version is immutable after publish/activate' });
	}
	return version;
};

const ensureVersionScoped = async (versionId: string, orgId: string, errors: any) => {
	const version = await prisma.pricebookVersion.findFirst({
		where: { id: versionId, pricebook: { organizationId: orgId } }
	});
	if (!version) throw errors.NOT_FOUND({ message: 'Pricebook version not found' });
	return version;
};

const ensureServiceAreaOwned = async (serviceAreaId: string | null | undefined, orgId: string, errors: any) => {
	if (!serviceAreaId) return;
	const sa = await prisma.serviceArea.findFirst({
		where: { id: serviceAreaId, serviceProviderOrgId: orgId }
	});
	if (!sa) {
		throw errors.FORBIDDEN({ message: 'Service area not found for this organization' });
	}
};

export const pricebookRouter = {
	/**
	 * Pricebook CRUD
	 */
	createOrUpdate: orgProcedure
		.input(
			z
				.object({
					id: z.string().optional(),
					name: z.string().min(1),
					description: z.string().optional(),
					currency: z.string().optional(),
					isActive: z.boolean().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ pricebook: pricebookOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			await context.cerbos.authorize('edit', 'pricebook', input.id ?? 'new');

			const { id, idempotencyKey, ...data } = input;

			// Validate existing pricebook if updating
			if (id) {
				const existing = await prisma.pricebook.findFirst({
					where: { id, organizationId: context.organization.id }
				});
				if (!existing) throw errors.NOT_FOUND({ message: 'Pricebook not found' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPricebookWorkflow(
				{
					action: PricebookAction.UPSERT_PRICEBOOK,
					organizationId: context.organization.id,
					userId: context.user!.id,
					pricebookId: id,
					data
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to upsert pricebook' });
			}

			const pricebook = await prisma.pricebook.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id }
			});

			return successResponse({ pricebook: serializePricebook(pricebook) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(z.object({ ok: z.literal(true), data: z.object({ pricebook: pricebookOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context, errors }) => {
			const pb = await prisma.pricebook.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!pb) throw errors.NOT_FOUND({ message: 'Pricebook not found' });
			await context.cerbos.authorize('view', 'pricebook', pb.id);
			return successResponse({ pricebook: serializePricebook(pb) }, context);
		}),

	list: orgProcedure
		.input(PaginationInputSchema)
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					pricebooks: z.array(pricebookOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			const queryPlan = await context.cerbos.queryFilter('view', 'pricebook');
			if (queryPlan.kind === 'always_denied') {
				return successResponse(
					{ pricebooks: [], pagination: { nextCursor: null, hasMore: false } },
					context
				);
			}
			const filter = {
				organizationId: context.organization.id,
				...(queryPlan.kind === 'conditional' ? queryPlan.filter : {})
			};
			const take = input.limit ?? 50;
			const cursor = input.cursor ? { id: input.cursor } : undefined;
			const pricebooks = await prisma.pricebook.findMany({
				where: filter,
				take: take + 1,
				cursor,
				orderBy: { createdAt: 'desc' }
			});
			const hasMore = pricebooks.length > take;
			if (hasMore) pricebooks.pop();
			return successResponse(
				{
					pricebooks: pricebooks.map(serializePricebook),
					pagination: { nextCursor: hasMore ? pricebooks[pricebooks.length - 1]?.id ?? null : null, hasMore }
				},
				context
			);
		}),

	/**
	 * Version management
	 */
	createVersion: orgProcedure
		.input(
			z
				.object({
					pricebookId: z.string(),
					versionNumber: z.number().int().positive().optional(),
					effectiveStart: z.string().datetime().optional(),
					effectiveEnd: z.string().datetime().optional(),
					notes: z.string().optional(),
					metadata: JsonSchema.optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ version: pricebookVersionOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			const pb = await prisma.pricebook.findFirst({
				where: { id: input.pricebookId, organizationId: context.organization.id }
			});
			if (!pb) throw errors.NOT_FOUND({ message: 'Pricebook not found' });
			await context.cerbos.authorize('edit', 'pricebook_version', 'new');

			const nextNumber =
				input.versionNumber ??
				((await prisma.pricebookVersion.aggregate({
					where: { pricebookId: pb.id },
					_max: { versionNumber: true }
				}))._max?.versionNumber ?? 0) + 1;

			// Use DBOS workflow for durable execution
			const result = await startPricebookWorkflow(
				{
					action: PricebookAction.CREATE_VERSION,
					organizationId: context.organization.id,
					userId: context.user!.id,
					pricebookId: pb.id,
					data: {
						versionNumber: nextNumber,
						effectiveStart: input.effectiveStart,
						effectiveEnd: input.effectiveEnd,
						notes: input.notes,
						metadata: input.metadata
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create version' });
			}

			const version = await prisma.pricebookVersion.findFirstOrThrow({
				where: { id: result.entityId, pricebook: { organizationId: context.organization.id } }
			});

			return successResponse({ version: serializeVersion(version) }, context);
		}),

	publishVersion: orgProcedure
		.input(
			z
				.object({
					versionId: z.string(),
					effectiveStart: z.string().datetime().optional(),
					effectiveEnd: z.string().datetime().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ version: pricebookVersionOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			const version = await ensureVersionScoped(input.versionId, context.organization.id, errors);
			await context.cerbos.authorize('edit', 'pricebook_version', version.id);
			if (version.status !== PricebookVersionStatus.DRAFT) throw errors.CONFLICT({ message: 'Only draft versions can be published' });
			if (input.effectiveStart && input.effectiveEnd) {
				if (new Date(input.effectiveEnd) <= new Date(input.effectiveStart)) {
					throw errors.BAD_REQUEST({ message: 'effectiveEnd must be after effectiveStart' });
				}
			}
			const itemCount = await prisma.pricebookItem.count({ where: { pricebookVersionId: version.id } });
			if (itemCount === 0) {
				throw errors.BAD_REQUEST({ message: 'Cannot publish a version without items' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPricebookWorkflow(
				{
					action: PricebookAction.PUBLISH_VERSION,
					organizationId: context.organization.id,
					userId: context.user!.id,
					versionId: version.id,
					data: {
						effectiveStart: input.effectiveStart,
						effectiveEnd: input.effectiveEnd
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to publish version' });
			}

			const updatedVersion = await prisma.pricebookVersion.findFirstOrThrow({
				where: { id: result.entityId, pricebook: { organizationId: context.organization.id } }
			});

			return successResponse({ version: serializeVersion(updatedVersion) }, context);
		}),

	activateVersion: orgProcedure
		.input(z.object({ versionId: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ version: pricebookVersionOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			const version = await ensureVersionScoped(input.versionId, context.organization.id, errors);
			await context.cerbos.authorize('edit', 'pricebook_version', version.id);
			if (version.status !== PricebookVersionStatus.PUBLISHED) {
				throw errors.CONFLICT({ message: 'Only published versions can be activated' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPricebookWorkflow(
				{
					action: PricebookAction.ACTIVATE_VERSION,
					organizationId: context.organization.id,
					userId: context.user!.id,
					versionId: version.id,
					pricebookId: version.pricebookId,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to activate version' });
			}

			const updatedVersion = await prisma.pricebookVersion.findFirstOrThrow({
				where: { id: result.entityId, pricebook: { organizationId: context.organization.id } }
			});

			return successResponse({ version: serializeVersion(updatedVersion) }, context);
		}),

	listVersions: orgProcedure
		.input(z.object({ pricebookId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ versions: z.array(pricebookVersionOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			const pb = await prisma.pricebook.findFirst({
				where: { id: input.pricebookId, organizationId: context.organization.id }
			});
			if (!pb) throw errors.NOT_FOUND({ message: 'Pricebook not found' });
			await context.cerbos.authorize('view', 'pricebook', pb.id);
			const queryPlan = await context.cerbos.queryFilter('view', 'pricebook_version');
			if (queryPlan.kind === 'always_denied') {
				return successResponse({ versions: [] }, context);
			}
			const versions = await prisma.pricebookVersion.findMany({
				where: {
					pricebookId: pb.id,
					...(queryPlan.kind === 'conditional' ? queryPlan.filter : {})
				},
				orderBy: { versionNumber: 'desc' }
			});

			return successResponse({ versions: versions.map(serializeVersion) }, context);
		}),

	/**
	 * Items
	 */
	createOrUpdateItem: orgProcedure
		.input(
			z
				.object({
					id: z.string().optional(),
					pricebookVersionId: z.string(),
					type: z.nativeEnum(PricebookItemType),
					code: z.string().min(1),
					name: z.string().min(1),
					description: z.string().optional(),
					trade: z.nativeEnum(ContractorTradeType).optional(),
					unitOfMeasure: z.string().optional(),
					basePrice: z.number().nonnegative(),
					cost: z.number().nonnegative().optional(),
					isTaxable: z.boolean().optional(),
					serviceAreaId: z.string().optional(),
					metadata: JsonSchema.optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ item: pricebookItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			const version = await ensureVersionMutable(input.pricebookVersionId, context.organization.id, errors);
			await context.cerbos.authorize('edit', 'pricebook_item', input.id ?? 'new');
			await ensureServiceAreaOwned(input.serviceAreaId, context.organization.id, errors);

			const { id, idempotencyKey, pricebookVersionId: _versionId, ...data } = input;

			// Validate existing item if updating
			if (id) {
				const existing = await prisma.pricebookItem.findFirst({
					where: { id, pricebookVersionId: version.id }
				});
				if (!existing) throw errors.NOT_FOUND({ message: 'Pricebook item not found' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPricebookWorkflow(
				{
					action: PricebookAction.UPSERT_ITEM,
					organizationId: context.organization.id,
					userId: context.user!.id,
					versionId: version.id,
					itemId: id,
					data: {
						...data,
						trade: data.trade ?? null,
						serviceAreaId: data.serviceAreaId ?? null,
						metadata: data.metadata ?? null
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to upsert item' });
			}

			const item = await prisma.pricebookItem.findFirstOrThrow({
				where: { id: result.entityId, pricebookVersion: { pricebook: { organizationId: context.organization.id } } }
			});

			return successResponse({ item: serializeItem(item) }, context);
		}),

	listItems: orgProcedure
		.input(z.object({ pricebookVersionId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ items: z.array(pricebookItemOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const version = await ensureVersionScoped(input.pricebookVersionId, context.organization.id, errors);
			await context.cerbos.authorize('view', 'pricebook_version', version.id);
			const queryPlan = await context.cerbos.queryFilter('view', 'pricebook_item');
			if (queryPlan.kind === 'always_denied') {
				return successResponse({ items: [] }, context);
			}
			const items = await prisma.pricebookItem.findMany({
				where: {
					pricebookVersionId: version.id,
					...(queryPlan.kind === 'conditional' ? queryPlan.filter : {})
				},
				orderBy: { createdAt: 'desc' }
			});
			return successResponse({ items: items.map(serializeItem) }, context);
		}),

	/**
	 * Rules
	 */
	createOrUpdateRule: orgProcedure
		.input(
			z
				.object({
					id: z.string().optional(),
					pricebookVersionId: z.string(),
					pricebookItemId: z.string().optional(),
					ruleType: z.nativeEnum(PriceRuleType),
					name: z.string().min(1),
					description: z.string().optional(),
					priority: z.number().int().optional(),
					associationId: z.string().optional(),
					serviceAreaId: z.string().optional(),
					minQuantity: z.number().nonnegative().optional(),
					startsAt: z.string().datetime().optional(),
					endsAt: z.string().datetime().optional(),
					conditionJson: JsonSchema.optional(),
					percentageAdjustment: z.number().optional(),
					amountAdjustment: z.number().optional(),
					adjustmentJson: JsonSchema.optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ rule: priceRuleOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			const version = await ensureVersionMutable(input.pricebookVersionId, context.organization.id, errors);
			await context.cerbos.authorize('edit', 'price_rule', input.id ?? 'new');
			await ensureServiceAreaOwned(input.serviceAreaId, context.organization.id, errors);

			if (input.pricebookItemId) {
				const item = await prisma.pricebookItem.findFirst({
					where: { id: input.pricebookItemId, pricebookVersionId: version.id }
				});
				if (!item) throw errors.NOT_FOUND({ message: 'Pricebook item not found' });
			}

			const { id, idempotencyKey, pricebookVersionId: _versionId, ...data } = input;

			// Validate existing rule if updating
			if (id) {
				const existing = await prisma.priceRule.findFirst({
					where: { id, pricebookVersionId: version.id }
				});
				if (!existing) throw errors.NOT_FOUND({ message: 'Price rule not found' });
			}

			// Use DBOS workflow for durable execution
			const result = await startPricebookWorkflow(
				{
					action: PricebookAction.UPSERT_RULE,
					organizationId: context.organization.id,
					userId: context.user!.id,
					versionId: version.id,
					ruleId: id,
					data: {
						...data,
						pricebookItemId: data.pricebookItemId ?? null,
						associationId: data.associationId ?? null,
						serviceAreaId: data.serviceAreaId ?? null,
						minQuantity: data.minQuantity ?? null,
						startsAt: data.startsAt,
						endsAt: data.endsAt,
						conditionJson: data.conditionJson ?? null,
						percentageAdjustment: data.percentageAdjustment ?? null,
						amountAdjustment: data.amountAdjustment ?? null,
						adjustmentJson: data.adjustmentJson ?? null
					}
				},
				idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to upsert rule' });
			}

			const rule = await prisma.priceRule.findFirstOrThrow({
				where: { id: result.entityId, pricebookVersion: { pricebook: { organizationId: context.organization.id } } }
			});

			return successResponse({ rule: serializeRule(rule) }, context);
		}),

	listRules: orgProcedure
		.input(z.object({ pricebookVersionId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ rules: z.array(priceRuleOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const version = await ensureVersionScoped(input.pricebookVersionId, context.organization.id, errors);
			await context.cerbos.authorize('view', 'pricebook_version', version.id);
			const queryPlan = await context.cerbos.queryFilter('view', 'price_rule');
			if (queryPlan.kind === 'always_denied') {
				return successResponse({ rules: [] }, context);
			}
			const rules = await prisma.priceRule.findMany({
				where: {
					pricebookVersionId: version.id,
					...(queryPlan.kind === 'conditional' ? queryPlan.filter : {})
				},
				orderBy: { priority: 'asc' }
			});
			return successResponse({ rules: rules.map(serializeRule) }, context);
		}),

	/**
	 * Job templates
	 */
	createOrUpdateJobTemplate: orgProcedure
		.input(
			z
				.object({
					id: z.string().optional(),
					pricebookVersionId: z.string(),
					name: z.string().min(1),
					description: z.string().optional(),
					isActive: z.boolean().optional(),
					defaultTrade: z.nativeEnum(ContractorTradeType).optional(),
					defaultServiceAreaId: z.string().optional(),
					metadata: JsonSchema.optional(),
					items: z
						.array(
							z.object({
								id: z.string().optional(),
								pricebookItemId: z.string(),
								quantity: z.number().positive(),
								lineNumber: z.number().int().positive().optional(),
								notes: z.string().optional()
							})
						)
						.optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ jobTemplate: jobTemplateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization.id, errors);
			const version = await ensureVersionScoped(input.pricebookVersionId, context.organization.id, errors);
			if (version.status !== PricebookVersionStatus.DRAFT) throw errors.CONFLICT({ message: 'Job templates can only be modified on draft versions' });
			await context.cerbos.authorize('edit', 'job_template', input.id ?? 'new');
			await ensureServiceAreaOwned(input.defaultServiceAreaId, context.organization.id, errors);

			// Validate items belong to version
			const itemIds = (input.items ?? []).map((i) => i.pricebookItemId);
			if (itemIds.length) {
				const count = await prisma.pricebookItem.count({
					where: { id: { in: itemIds }, pricebookVersionId: version.id }
				});
				if (count !== itemIds.length) throw errors.BAD_REQUEST({ message: 'All items must belong to the version' });
			}

			const { id, idempotencyKey, items, pricebookVersionId: _versionId, ...data } = input;

			const workflowResult = await startPricebookWorkflow(
				{
					action: PricebookAction.UPSERT_TEMPLATE,
					organizationId: context.organization.id,
					userId: context.user!.id,
					versionId: version.id,
					templateId: id,
					data: {
						...data,
						defaultTrade: data.defaultTrade ?? null,
						defaultServiceAreaId: data.defaultServiceAreaId ?? null,
						metadata: data.metadata ?? null,
						items
					}
				},
				idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: workflowResult.error || 'Failed to upsert job template' });
			}

			const result = await prisma.jobTemplate.findFirstOrThrow({
				where: { id: workflowResult.entityId, organizationId: context.organization.id },
				include: { items: true }
			});

			return successResponse({ jobTemplate: serializeJobTemplate(result) }, context);
		}),

	listJobTemplates: orgProcedure
		.input(z.object({ pricebookVersionId: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ jobTemplates: z.array(jobTemplateOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			const version = await ensureVersionScoped(input.pricebookVersionId, context.organization.id, errors);
			await context.cerbos.authorize('view', 'pricebook_version', version.id);
			const queryPlan = await context.cerbos.queryFilter('view', 'job_template');
			if (queryPlan.kind === 'always_denied') {
				return successResponse({ jobTemplates: [] }, context);
			}
			const templates = await prisma.jobTemplate.findMany({
				where: {
					pricebookVersionId: version.id,
					organizationId: context.organization.id,
					...(queryPlan.kind === 'conditional' ? queryPlan.filter : {})
				},
				include: { items: true },
				orderBy: { createdAt: 'desc' }
			});

			return successResponse({ jobTemplates: templates.map(serializeJobTemplate) }, context);
		})
};

function serializePricebook(pb: any) {
	return {
		id: pb.id,
		organizationId: pb.organizationId,
		name: pb.name,
		description: pb.description,
		currency: pb.currency,
		isActive: pb.isActive,
		createdAt: pb.createdAt.toISOString(),
		updatedAt: pb.updatedAt.toISOString()
	};
}

function serializeVersion(version: any) {
	return {
		id: version.id,
		pricebookId: version.pricebookId,
		versionNumber: version.versionNumber,
		status: version.status,
		effectiveStart: version.effectiveStart ? version.effectiveStart.toISOString() : null,
		effectiveEnd: version.effectiveEnd ? version.effectiveEnd.toISOString() : null,
		notes: version.notes,
		metadata: version.metadata,
		publishedAt: version.publishedAt ? version.publishedAt.toISOString() : null,
		publishedBy: version.publishedBy,
		activatedAt: version.activatedAt ? version.activatedAt.toISOString() : null,
		createdAt: version.createdAt.toISOString(),
		updatedAt: version.updatedAt.toISOString()
	};
}

function serializeItem(item: any) {
	return {
		id: item.id,
		pricebookVersionId: item.pricebookVersionId,
		type: item.type,
		code: item.code,
		name: item.name,
		description: item.description,
		trade: item.trade,
		unitOfMeasure: item.unitOfMeasure,
		basePrice: item.basePrice.toString(),
		cost: item.cost?.toString() ?? null,
		isTaxable: item.isTaxable,
		serviceAreaId: item.serviceAreaId,
		metadata: item.metadata,
		createdAt: item.createdAt.toISOString(),
		updatedAt: item.updatedAt.toISOString()
	};
}

function serializeRule(rule: any) {
	return {
		id: rule.id,
		pricebookVersionId: rule.pricebookVersionId,
		pricebookItemId: rule.pricebookItemId,
		ruleType: rule.ruleType,
		name: rule.name,
		description: rule.description,
		priority: rule.priority,
		associationId: rule.associationId,
		serviceAreaId: rule.serviceAreaId,
		minQuantity: rule.minQuantity?.toString() ?? null,
		startsAt: rule.startsAt ? rule.startsAt.toISOString() : null,
		endsAt: rule.endsAt ? rule.endsAt.toISOString() : null,
		conditionJson: rule.conditionJson,
		percentageAdjustment: rule.percentageAdjustment?.toString() ?? null,
		amountAdjustment: rule.amountAdjustment?.toString() ?? null,
		adjustmentJson: rule.adjustmentJson,
		createdAt: rule.createdAt.toISOString(),
		updatedAt: rule.updatedAt.toISOString()
	};
}

function serializeJobTemplate(template: any) {
	return {
		id: template.id,
		organizationId: template.organizationId,
		pricebookVersionId: template.pricebookVersionId,
		name: template.name,
		description: template.description,
		isActive: template.isActive,
		defaultTrade: template.defaultTrade,
		defaultServiceAreaId: template.defaultServiceAreaId,
		metadata: template.metadata,
		items: (template.items ?? []).map(serializeJobTemplateItem),
		createdAt: template.createdAt.toISOString(),
		updatedAt: template.updatedAt.toISOString()
	};
}

function serializeJobTemplateItem(item: any) {
	return {
		id: item.id,
		jobTemplateId: item.jobTemplateId,
		pricebookItemId: item.pricebookItemId,
		quantity: item.quantity.toString(),
		lineNumber: item.lineNumber,
		notes: item.notes,
		createdAt: item.createdAt.toISOString(),
		updatedAt: item.updatedAt.toISOString()
	};
}
