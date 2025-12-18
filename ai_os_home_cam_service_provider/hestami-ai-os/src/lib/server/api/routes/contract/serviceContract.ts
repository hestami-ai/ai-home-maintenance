import { z } from 'zod';
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
import {
	ServiceContractStatus,
	ServiceContractType,
	RecurrenceFrequency
} from '../../../../../../generated/prisma/client.js';

const serviceItemOutput = z.object({
	id: z.string(),
	contractId: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	pricebookItemId: z.string().nullable(),
	frequency: z.nativeEnum(RecurrenceFrequency),
	visitsPerPeriod: z.number(),
	unitPrice: z.string(),
	quantity: z.number(),
	lineTotal: z.string(),
	estimatedDurationMinutes: z.number().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const contractOutput = z.object({
	id: z.string(),
	organizationId: z.string(),
	contractNumber: z.string(),
	name: z.string(),
	type: z.nativeEnum(ServiceContractType),
	status: z.nativeEnum(ServiceContractStatus),
	customerId: z.string().nullable(),
	associationId: z.string().nullable(),
	propertyId: z.string().nullable(),
	unitId: z.string().nullable(),
	startDate: z.string(),
	endDate: z.string(),
	autoRenew: z.boolean(),
	renewalTermDays: z.number().nullable(),
	contractValue: z.string(),
	billingFrequency: z.nativeEnum(RecurrenceFrequency),
	billingAmount: z.string(),
	nextBillingDate: z.string().nullable(),
	description: z.string().nullable(),
	scopeOfWork: z.string().nullable(),
	exclusions: z.string().nullable(),
	responseTimeHours: z.number().nullable(),
	resolutionTimeHours: z.number().nullable(),
	emergencyCoverage: z.boolean(),
	primaryTechnicianId: z.string().nullable(),
	assignedBranchId: z.string().nullable(),
	documentUrl: z.string().nullable(),
	signedAt: z.string().nullable(),
	notes: z.string().nullable(),
	createdBy: z.string(),
	createdAt: z.string(),
	updatedAt: z.string(),
	serviceItems: z.array(serviceItemOutput).optional()
});

const formatServiceItem = (i: any) => ({
	id: i.id,
	contractId: i.contractId,
	name: i.name,
	description: i.description,
	pricebookItemId: i.pricebookItemId,
	frequency: i.frequency,
	visitsPerPeriod: i.visitsPerPeriod,
	unitPrice: i.unitPrice.toString(),
	quantity: i.quantity,
	lineTotal: i.lineTotal.toString(),
	estimatedDurationMinutes: i.estimatedDurationMinutes,
	notes: i.notes,
	createdAt: i.createdAt.toISOString(),
	updatedAt: i.updatedAt.toISOString()
});

const formatContract = (c: any, includeItems = false) => ({
	id: c.id,
	organizationId: c.organizationId,
	contractNumber: c.contractNumber,
	name: c.name,
	type: c.type,
	status: c.status,
	customerId: c.customerId,
	associationId: c.associationId,
	propertyId: c.propertyId,
	unitId: c.unitId,
	startDate: c.startDate.toISOString().split('T')[0],
	endDate: c.endDate.toISOString().split('T')[0],
	autoRenew: c.autoRenew,
	renewalTermDays: c.renewalTermDays,
	contractValue: c.contractValue.toString(),
	billingFrequency: c.billingFrequency,
	billingAmount: c.billingAmount.toString(),
	nextBillingDate: c.nextBillingDate?.toISOString().split('T')[0] ?? null,
	description: c.description,
	scopeOfWork: c.scopeOfWork,
	exclusions: c.exclusions,
	responseTimeHours: c.responseTimeHours,
	resolutionTimeHours: c.resolutionTimeHours,
	emergencyCoverage: c.emergencyCoverage,
	primaryTechnicianId: c.primaryTechnicianId,
	assignedBranchId: c.assignedBranchId,
	documentUrl: c.documentUrl,
	signedAt: c.signedAt?.toISOString() ?? null,
	notes: c.notes,
	createdBy: c.createdBy,
	createdAt: c.createdAt.toISOString(),
	updatedAt: c.updatedAt.toISOString(),
	...(includeItems && c.serviceItems && { serviceItems: c.serviceItems.map(formatServiceItem) })
});

async function generateContractNumber(organizationId: string): Promise<string> {
	const year = new Date().getFullYear();
	const count = await prisma.serviceContract.count({
		where: {
			organizationId,
			contractNumber: { startsWith: `SC-${year}-` }
		}
	});
	return `SC-${year}-${String(count + 1).padStart(6, '0')}`;
}

export const serviceContractRouter = {
	create: orgProcedure
		.input(
			z
				.object({
					name: z.string().min(1),
					type: z.nativeEnum(ServiceContractType),
					customerId: z.string().optional(),
					associationId: z.string().optional(),
					propertyId: z.string().optional(),
					unitId: z.string().optional(),
					startDate: z.string(),
					endDate: z.string(),
					autoRenew: z.boolean().default(false),
					renewalTermDays: z.number().int().positive().optional(),
					contractValue: z.number().nonnegative(),
					billingFrequency: z.nativeEnum(RecurrenceFrequency),
					billingAmount: z.number().nonnegative(),
					description: z.string().optional(),
					scopeOfWork: z.string().optional(),
					exclusions: z.string().optional(),
					responseTimeHours: z.number().int().positive().optional(),
					resolutionTimeHours: z.number().int().positive().optional(),
					emergencyCoverage: z.boolean().default(false),
					primaryTechnicianId: z.string().optional(),
					assignedBranchId: z.string().optional(),
					notes: z.string().optional(),
					serviceItems: z.array(
						z.object({
							name: z.string().min(1),
							description: z.string().optional(),
							pricebookItemId: z.string().optional(),
							frequency: z.nativeEnum(RecurrenceFrequency),
							visitsPerPeriod: z.number().int().positive().default(1),
							unitPrice: z.number().nonnegative(),
							quantity: z.number().int().positive().default(1),
							estimatedDurationMinutes: z.number().int().positive().optional(),
							notes: z.string().optional()
						})
					).optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('create', 'service_contract', 'new');

			const createContract = async () => {
				const contractNumber = await generateContractNumber(context.organization!.id);

				return prisma.$transaction(async (tx) => {
					const contract = await tx.serviceContract.create({
						data: {
							organizationId: context.organization!.id,
							contractNumber,
							name: input.name,
							type: input.type,
							customerId: input.customerId,
							associationId: input.associationId,
							propertyId: input.propertyId,
							unitId: input.unitId,
							startDate: new Date(input.startDate),
							endDate: new Date(input.endDate),
							autoRenew: input.autoRenew,
							renewalTermDays: input.renewalTermDays,
							contractValue: input.contractValue,
							billingFrequency: input.billingFrequency,
							billingAmount: input.billingAmount,
							description: input.description,
							scopeOfWork: input.scopeOfWork,
							exclusions: input.exclusions,
							responseTimeHours: input.responseTimeHours,
							resolutionTimeHours: input.resolutionTimeHours,
							emergencyCoverage: input.emergencyCoverage,
							primaryTechnicianId: input.primaryTechnicianId,
							assignedBranchId: input.assignedBranchId,
							notes: input.notes,
							createdBy: context.user!.id
						}
					});

					if (input.serviceItems && input.serviceItems.length > 0) {
						await tx.contractServiceItem.createMany({
							data: input.serviceItems.map((item) => ({
								contractId: contract.id,
								name: item.name,
								description: item.description,
								pricebookItemId: item.pricebookItemId,
								frequency: item.frequency,
								visitsPerPeriod: item.visitsPerPeriod,
								unitPrice: item.unitPrice,
								quantity: item.quantity,
								lineTotal: item.unitPrice * item.quantity,
								estimatedDurationMinutes: item.estimatedDurationMinutes,
								notes: item.notes
							}))
						});
					}

					return tx.serviceContract.findUnique({
						where: { id: contract.id },
						include: { serviceItems: true }
					});
				});
			};

			const contract = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, createContract)).result
				: await createContract();

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'service_contract', input.id);

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null },
				include: { serviceItems: true }
			});

			if (!contract) throw ApiException.notFound('Service contract');

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	list: orgProcedure
		.input(
			z
				.object({
					status: z.nativeEnum(ServiceContractStatus).optional(),
					type: z.nativeEnum(ServiceContractType).optional(),
					customerId: z.string().optional(),
					associationId: z.string().optional(),
					expiringWithinDays: z.number().int().positive().optional()
				})
				.merge(PaginationInputSchema)
				.optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					contracts: z.array(contractOutput),
					pagination: PaginationOutputSchema
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('view', 'service_contract', 'list');

			const limit = input?.limit ?? 20;
			const cursor = input?.cursor;

			const where: any = {
				organizationId: context.organization!.id,
				deletedAt: null,
				...(input?.status && { status: input.status }),
				...(input?.type && { type: input.type }),
				...(input?.customerId && { customerId: input.customerId }),
				...(input?.associationId && { associationId: input.associationId })
			};

			if (input?.expiringWithinDays) {
				const futureDate = new Date();
				futureDate.setDate(futureDate.getDate() + input.expiringWithinDays);
				where.endDate = { lte: futureDate };
				where.status = 'ACTIVE';
			}

			const contracts = await prisma.serviceContract.findMany({
				where,
				take: limit + 1,
				...(cursor && { cursor: { id: cursor }, skip: 1 }),
				orderBy: { createdAt: 'desc' }
			});

			const hasMore = contracts.length > limit;
			if (hasMore) contracts.pop();

			const nextCursor = hasMore ? contracts[contracts.length - 1]?.id ?? null : null;

			return successResponse(
				{
					contracts: contracts.map((c) => formatContract(c)),
					pagination: { nextCursor, hasMore }
				},
				context
			);
		}),

	update: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					name: z.string().min(1).optional(),
					description: z.string().nullable().optional(),
					scopeOfWork: z.string().nullable().optional(),
					exclusions: z.string().nullable().optional(),
					responseTimeHours: z.number().int().positive().nullable().optional(),
					resolutionTimeHours: z.number().int().positive().nullable().optional(),
					emergencyCoverage: z.boolean().optional(),
					primaryTechnicianId: z.string().nullable().optional(),
					assignedBranchId: z.string().nullable().optional(),
					autoRenew: z.boolean().optional(),
					renewalTermDays: z.number().int().positive().nullable().optional(),
					notes: z.string().nullable().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Service contract');

			if (!['DRAFT', 'ACTIVE'].includes(existing.status)) {
				throw ApiException.badRequest('Can only edit DRAFT or ACTIVE contracts');
			}

			const updateContract = async () => {
				const { id, idempotencyKey, ...data } = input;
				return prisma.serviceContract.update({
					where: { id: input.id },
					data,
					include: { serviceItems: true }
				});
			};

			const contract = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, updateContract)).result
				: await updateContract();

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	activate: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('activate', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Service contract');

			if (!['DRAFT', 'PENDING_APPROVAL', 'SUSPENDED'].includes(existing.status)) {
				throw ApiException.badRequest('Cannot activate contract in current status');
			}

			const activateContract = async () => {
				return prisma.serviceContract.update({
					where: { id: input.id },
					data: { status: 'ACTIVE' },
					include: { serviceItems: true }
				});
			};

			const contract = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, activateContract)).result
				: await activateContract();

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	suspend: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('suspend', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Service contract');

			if (existing.status !== 'ACTIVE') {
				throw ApiException.badRequest('Can only suspend ACTIVE contracts');
			}

			const suspendContract = async () => {
				return prisma.serviceContract.update({
					where: { id: input.id },
					data: {
						status: 'SUSPENDED',
						notes: input.reason
							? `${existing.notes ?? ''}\nSuspended: ${input.reason}`.trim()
							: existing.notes
					},
					include: { serviceItems: true }
				});
			};

			const contract = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, suspendContract)).result
				: await suspendContract();

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	cancel: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('cancel', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Service contract');

			if (['CANCELLED', 'EXPIRED'].includes(existing.status)) {
				throw ApiException.badRequest('Contract is already cancelled or expired');
			}

			const cancelContract = async () => {
				return prisma.$transaction(async (tx) => {
					// Cancel any pending scheduled visits
					await tx.scheduledVisit.updateMany({
						where: {
							contractId: input.id,
							status: { in: ['SCHEDULED', 'CONFIRMED'] }
						},
						data: { status: 'CANCELLED' }
					});

					return tx.serviceContract.update({
						where: { id: input.id },
						data: {
							status: 'CANCELLED',
							notes: input.reason
								? `${existing.notes ?? ''}\nCancelled: ${input.reason}`.trim()
								: existing.notes
						},
						include: { serviceItems: true }
					});
				});
			};

			const contract = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, cancelContract)).result
				: await cancelContract();

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	renew: orgProcedure
		.input(
			z
				.object({
					id: z.string(),
					newEndDate: z.string(),
					newContractValue: z.number().nonnegative().optional(),
					newBillingAmount: z.number().nonnegative().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('renew', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Service contract');

			if (!['ACTIVE', 'EXPIRED'].includes(existing.status)) {
				throw ApiException.badRequest('Can only renew ACTIVE or EXPIRED contracts');
			}

			const renewContract = async () => {
				return prisma.$transaction(async (tx) => {
					// Get renewal count
					const renewalCount = await tx.contractRenewal.count({
						where: { contractId: input.id }
					});

					const newValue = input.newContractValue ?? Number(existing.contractValue);
					const previousValue = Number(existing.contractValue);
					const changePercent = previousValue > 0
						? ((newValue - previousValue) / previousValue) * 100
						: 0;

					// Create renewal record
					await tx.contractRenewal.create({
						data: {
							contractId: input.id,
							renewalNumber: renewalCount + 1,
							previousEndDate: existing.endDate,
							newEndDate: new Date(input.newEndDate),
							previousValue: existing.contractValue,
							newValue,
							changePercent,
							renewedAt: new Date(),
							renewedBy: context.user!.id
						}
					});

					// Update contract
					return tx.serviceContract.update({
						where: { id: input.id },
						data: {
							status: 'ACTIVE',
							endDate: new Date(input.newEndDate),
							contractValue: newValue,
							billingAmount: input.newBillingAmount ?? existing.billingAmount
						},
						include: { serviceItems: true }
					});
				});
			};

			const contract = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, renewContract)).result
				: await renewContract();

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('delete', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw ApiException.notFound('Service contract');

			if (existing.status !== 'DRAFT') {
				throw ApiException.badRequest('Can only delete DRAFT contracts');
			}

			const deleteContract = async () => {
				await prisma.serviceContract.update({
					where: { id: input.id },
					data: { deletedAt: new Date() }
				});
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, deleteContract)).result
				: await deleteContract();

			return successResponse(result, context);
		}),

	addServiceItem: orgProcedure
		.input(
			z
				.object({
					contractId: z.string(),
					name: z.string().min(1),
					description: z.string().optional(),
					pricebookItemId: z.string().optional(),
					frequency: z.nativeEnum(RecurrenceFrequency),
					visitsPerPeriod: z.number().int().positive().default(1),
					unitPrice: z.number().nonnegative(),
					quantity: z.number().int().positive().default(1),
					estimatedDurationMinutes: z.number().int().positive().optional(),
					notes: z.string().optional()
				})
				.merge(IdempotencyKeySchema)
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ serviceItem: serviceItemOutput }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);
			await context.cerbos.authorize('edit', 'service_contract', input.contractId);

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.contractId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!contract) throw ApiException.notFound('Service contract');

			if (!['DRAFT', 'ACTIVE'].includes(contract.status)) {
				throw ApiException.badRequest('Can only add items to DRAFT or ACTIVE contracts');
			}

			const addItem = async () => {
				return prisma.contractServiceItem.create({
					data: {
						contractId: input.contractId,
						name: input.name,
						description: input.description,
						pricebookItemId: input.pricebookItemId,
						frequency: input.frequency,
						visitsPerPeriod: input.visitsPerPeriod,
						unitPrice: input.unitPrice,
						quantity: input.quantity,
						lineTotal: input.unitPrice * input.quantity,
						estimatedDurationMinutes: input.estimatedDurationMinutes,
						notes: input.notes
					}
				});
			};

			const serviceItem = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, addItem)).result
				: await addItem();

			return successResponse({ serviceItem: formatServiceItem(serviceItem) }, context);
		}),

	removeServiceItem: orgProcedure
		.input(z.object({ itemId: z.string() }).merge(IdempotencyKeySchema))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await assertContractorOrg(context.organization!.id);

			const item = await prisma.contractServiceItem.findUnique({
				where: { id: input.itemId },
				include: { contract: true }
			});
			if (!item || item.contract.organizationId !== context.organization!.id) {
				throw ApiException.notFound('Service item');
			}

			await context.cerbos.authorize('edit', 'service_contract', item.contractId);

			if (!['DRAFT', 'ACTIVE'].includes(item.contract.status)) {
				throw ApiException.badRequest('Can only remove items from DRAFT or ACTIVE contracts');
			}

			const removeItem = async () => {
				await prisma.contractServiceItem.delete({ where: { id: input.itemId } });
				return { deleted: true };
			};

			const result = input.idempotencyKey
				? (await withIdempotency(input.idempotencyKey, context, removeItem)).result
				: await removeItem();

			return successResponse(result, context);
		})
};
