import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { withIdempotency } from '../../middleware/idempotency.js';
import { ApiException } from '../../errors.js';
import { assertContractorOrg } from '../contractor/utils.js';
import { ContractorTradeType, PricebookItemType, PricebookVersionStatus, PriceRuleType } from '../../../../../../generated/prisma/client.js';

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
	metadata: z.any().nullable(),
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
	metadata: z.any().nullable(),
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
	conditionJson: z.any().nullable(),
	percentageAdjustment: z.string().nullable(),
	amountAdjustment: z.string().nullable(),
	adjustmentJson: z.any().nullable(),
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
	metadata: z.any().nullable(),
	items: z.array(jobTemplateItemOutput),
	createdAt: z.string(),
	updatedAt: z.string()
});

const ensureVersionMutable = async (versionId: string, orgId: string) => {
	const version = await prisma.pricebookVersion.findFirst({
		where: { id: versionId, pricebook: { organizationId: orgId } }
	});
	if (!version) throw ApiException.notFound('PricebookVersion');
	if (version.status !== 'DRAFT') {
		throw ApiException.conflict('Version is immutable after publish/activate');
	}
	return version;
};

const ensureVersionScoped = async (versionId: string, orgId: string) => {
	const version = await prisma.pricebookVersion.findFirst({
		where: { id: versionId, pricebook: { organizationId: orgId } }
	});
	if (!version) throw ApiException.notFound('PricebookVersion');
	return version;
};

const ensureServiceAreaOwned = async (serviceAreaId: string | null | undefined, orgId: string) => {
	if (!serviceAreaId) return;
	const sa = await prisma.serviceArea.findFirst({
		where: { id: serviceAreaId, serviceProviderOrgId: orgId }
	});
	if (!sa) {
		throw ApiException.forbidden('Service area not found for this organization');
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
		.output(z.object({ ok: z.literal(true), data: z.object({ pricebook: pricebookOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			await context.cerbos.authorize('edit', 'pricebook', input.id ?? 'new');

			const { id, idempotencyKey, ...data } = input;
			const result = await withIdempotency(idempotencyKey, context, async () => {
				if (id) {
					const existing = await prisma.pricebook.findFirst({
						where: { id, organizationId: context.organization.id }
					});
					if (!existing) throw ApiException.notFound('Pricebook');
					return prisma.pricebook.update({
						where: { id },
						data
					});
				}
				return prisma.pricebook.create({
					data: { organizationId: context.organization.id, ...data }
				});
			});

			return successResponse({ pricebook: serializePricebook(result.result) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(z.object({ ok: z.literal(true), data: z.object({ pricebook: pricebookOutput }), meta: ResponseMetaSchema }))
		.handler(async ({ input, context }) => {
			const pb = await prisma.pricebook.findFirst({
				where: { id: input.id, organizationId: context.organization.id }
			});
			if (!pb) throw ApiException.notFound('Pricebook');
			await context.cerbos.authorize('view', 'pricebook', pb.id);
			return successResponse({ pricebook: serializePricebook(pb) }, context);
		}),

	list: orgProcedure
		.input(PaginationInputSchema)
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
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
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
					metadata: z.any().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ version: pricebookVersionOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const pb = await prisma.pricebook.findFirst({
				where: { id: input.pricebookId, organizationId: context.organization.id }
			});
			if (!pb) throw ApiException.notFound('Pricebook');
			await context.cerbos.authorize('edit', 'pricebook_version', 'new');

			const nextNumber =
				input.versionNumber ??
				((await prisma.pricebookVersion.aggregate({
					where: { pricebookId: pb.id },
					_max: { versionNumber: true }
				}))._max?.versionNumber ?? 0) + 1;

			const result = await withIdempotency(input.idempotencyKey, context, async () =>
				prisma.pricebookVersion.create({
					data: {
						pricebookId: pb.id,
						versionNumber: nextNumber,
						status: 'DRAFT',
						effectiveStart: input.effectiveStart ? new Date(input.effectiveStart) : null,
						effectiveEnd: input.effectiveEnd ? new Date(input.effectiveEnd) : null,
						notes: input.notes,
						metadata: input.metadata ?? null
					}
				})
			);

			return successResponse({ version: serializeVersion(result.result) }, context);
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ version: pricebookVersionOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const version = await ensureVersionScoped(input.versionId, context.organization.id);
			await context.cerbos.authorize('edit', 'pricebook_version', version.id);
			if (version.status !== 'DRAFT') throw ApiException.conflict('Only draft versions can be published');
			if (input.effectiveStart && input.effectiveEnd) {
				if (new Date(input.effectiveEnd) <= new Date(input.effectiveStart)) {
					throw ApiException.badRequest('effectiveEnd must be after effectiveStart');
				}
			}
			const itemCount = await prisma.pricebookItem.count({ where: { pricebookVersionId: version.id } });
			if (itemCount === 0) {
				throw ApiException.badRequest('Cannot publish a version without items');
			}

			const result = await withIdempotency(input.idempotencyKey, context, async () =>
				prisma.pricebookVersion.update({
					where: { id: version.id },
					data: {
						status: 'PUBLISHED',
						effectiveStart: input.effectiveStart ? new Date(input.effectiveStart) : version.effectiveStart,
						effectiveEnd: input.effectiveEnd ? new Date(input.effectiveEnd) : version.effectiveEnd,
						publishedAt: new Date(),
						publishedBy: context.user?.id ?? null
					}
				})
			);

			return successResponse({ version: serializeVersion(result.result) }, context);
		}),

	activateVersion: orgProcedure
		.input(z.object({ versionId: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ version: pricebookVersionOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const version = await ensureVersionScoped(input.versionId, context.organization.id);
			await context.cerbos.authorize('edit', 'pricebook_version', version.id);
			if (version.status !== 'PUBLISHED') {
				throw ApiException.conflict('Only published versions can be activated');
			}

			const result = await withIdempotency(input.idempotencyKey, context, async () => {
				// Deactivate other active versions for this pricebook
				await prisma.pricebookVersion.updateMany({
					where: { pricebookId: version.pricebookId, status: 'ACTIVE', NOT: { id: version.id } },
					data: { status: 'ARCHIVED' }
				});

				return prisma.pricebookVersion.update({
					where: { id: version.id },
					data: { status: 'ACTIVE', activatedAt: new Date() }
				});
			});

			return successResponse({ version: serializeVersion(result.result) }, context);
		}),

	listVersions: orgProcedure
		.input(z.object({ pricebookId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ versions: z.array(pricebookVersionOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const pb = await prisma.pricebook.findFirst({
				where: { id: input.pricebookId, organizationId: context.organization.id }
			});
			if (!pb) throw ApiException.notFound('Pricebook');
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
					metadata: z.any().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ item: pricebookItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const version = await ensureVersionMutable(input.pricebookVersionId, context.organization.id);
			await context.cerbos.authorize('edit', 'pricebook_item', input.id ?? 'new');
			await ensureServiceAreaOwned(input.serviceAreaId, context.organization.id);

			const { id, idempotencyKey, pricebookVersionId: _versionId, ...data } = input;
			const payload = {
				...data,
				trade: data.trade ?? null,
				serviceAreaId: data.serviceAreaId ?? null,
				metadata: data.metadata ?? null
			};
			const result = await withIdempotency(idempotencyKey, context, async () => {
				if (id) {
					const existing = await prisma.pricebookItem.findFirst({
						where: { id, pricebookVersionId: version.id }
					});
					if (!existing) throw ApiException.notFound('PricebookItem');
					return prisma.pricebookItem.update({ where: { id }, data: payload });
				}

				return prisma.pricebookItem.create({
					data: {
						pricebookVersionId: version.id,
						...payload
					}
				});
			});

			return successResponse({ item: serializeItem(result.result) }, context);
		}),

	listItems: orgProcedure
		.input(z.object({ pricebookVersionId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ items: z.array(pricebookItemOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const version = await ensureVersionScoped(input.pricebookVersionId, context.organization.id);
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
					conditionJson: z.any().optional(),
					percentageAdjustment: z.number().optional(),
					amountAdjustment: z.number().optional(),
					adjustmentJson: z.any().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ rule: priceRuleOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const version = await ensureVersionMutable(input.pricebookVersionId, context.organization.id);
			await context.cerbos.authorize('edit', 'price_rule', input.id ?? 'new');
			await ensureServiceAreaOwned(input.serviceAreaId, context.organization.id);

			if (input.pricebookItemId) {
				const item = await prisma.pricebookItem.findFirst({
					where: { id: input.pricebookItemId, pricebookVersionId: version.id }
				});
				if (!item) throw ApiException.notFound('PricebookItem');
			}

			const { id, idempotencyKey, pricebookVersionId: _versionId, ...data } = input;
			const payload = {
				...data,
				pricebookItemId: data.pricebookItemId ?? null,
				associationId: data.associationId ?? null,
				serviceAreaId: data.serviceAreaId ?? null,
				minQuantity: data.minQuantity ?? null,
				startsAt: data.startsAt ? new Date(data.startsAt) : null,
				endsAt: data.endsAt ? new Date(data.endsAt) : null,
				conditionJson: data.conditionJson ?? null,
				percentageAdjustment: data.percentageAdjustment ?? null,
				amountAdjustment: data.amountAdjustment ?? null,
				adjustmentJson: data.adjustmentJson ?? null
			};
			const result = await withIdempotency(idempotencyKey, context, async () => {
				if (id) {
					const existing = await prisma.priceRule.findFirst({
						where: { id, pricebookVersionId: version.id }
					});
					if (!existing) throw ApiException.notFound('PriceRule');
					return prisma.priceRule.update({ where: { id }, data: payload });
				}

				return prisma.priceRule.create({
					data: {
						pricebookVersionId: version.id,
						...payload
					}
				});
			});

			return successResponse({ rule: serializeRule(result.result) }, context);
		}),

	listRules: orgProcedure
		.input(z.object({ pricebookVersionId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ rules: z.array(priceRuleOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const version = await ensureVersionScoped(input.pricebookVersionId, context.organization.id);
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
					metadata: z.any().optional(),
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
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ jobTemplate: jobTemplateOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization.id);
			const version = await ensureVersionScoped(input.pricebookVersionId, context.organization.id);
			if (version.status !== 'DRAFT') throw ApiException.conflict('Job templates can only be modified on draft versions');
			await context.cerbos.authorize('edit', 'job_template', input.id ?? 'new');
			await ensureServiceAreaOwned(input.defaultServiceAreaId, context.organization.id);

			// Validate items belong to version
			const itemIds = (input.items ?? []).map((i) => i.pricebookItemId);
			if (itemIds.length) {
				const count = await prisma.pricebookItem.count({
					where: { id: { in: itemIds }, pricebookVersionId: version.id }
				});
				if (count !== itemIds.length) throw ApiException.badRequest('All items must belong to the version');
			}

			const { id, idempotencyKey, items, pricebookVersionId: _versionId, ...data } = input;
			const baseTemplateData = {
				...data,
				defaultTrade: data.defaultTrade ?? null,
				defaultServiceAreaId: data.defaultServiceAreaId ?? null,
				metadata: data.metadata ?? null
			};
			const result = await withIdempotency(idempotencyKey, context, async () => {
				if (id) {
					const existing = await prisma.jobTemplate.findFirst({
						where: { id, organizationId: context.organization.id, pricebookVersionId: version.id },
						include: { items: true }
					});
					if (!existing) throw ApiException.notFound('JobTemplate');

					const updated = await prisma.jobTemplate.update({
						where: { id },
						data: {
							...baseTemplateData,
							items: items
								? {
										deleteMany: { jobTemplateId: id, id: { notIn: items.filter((i) => i.id).map((i) => i.id!) } },
										upsert: items.map((i, idx) => ({
											where: { id: i.id ?? '' },
											create: {
												pricebookItemId: i.pricebookItemId,
												quantity: i.quantity,
												lineNumber: i.lineNumber ?? idx + 1,
												notes: i.notes ?? null
											},
											update: {
												pricebookItemId: i.pricebookItemId,
												quantity: i.quantity,
												lineNumber: i.lineNumber ?? idx + 1,
												notes: i.notes ?? null
											}
										}))
									}
								: undefined
						},
						include: { items: true }
					});

					return updated;
				}

				return prisma.jobTemplate.create({
					data: {
						organizationId: context.organization.id,
						pricebookVersionId: version.id,
						...baseTemplateData,
						items: items
							? {
									create: items.map((i, idx) => ({
										pricebookItemId: i.pricebookItemId,
										quantity: i.quantity,
										lineNumber: i.lineNumber ?? idx + 1,
										notes: i.notes ?? null
									}))
								}
							: undefined
					},
					include: { items: true }
				});
			});

			return successResponse({ jobTemplate: serializeJobTemplate(result.result) }, context);
		}),

	listJobTemplates: orgProcedure
		.input(z.object({ pricebookVersionId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ jobTemplates: z.array(jobTemplateOutput) }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context }) => {
			const version = await ensureVersionScoped(input.pricebookVersionId, context.organization.id);
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
