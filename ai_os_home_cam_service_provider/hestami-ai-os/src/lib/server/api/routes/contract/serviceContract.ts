import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import {
	orgProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from '../../router.js';
import { prisma } from '../../../db.js';
import { assertContractorOrg } from '../contractor/utils.js';
import {
	ServiceContractStatus,
	ServiceContractType,
	RecurrenceFrequency
} from '../../../../../../generated/prisma/client.js';
import { startServiceContractWorkflow, ContractAction } from '../../../workflows/contractWorkflow.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('ServiceContractRoute');

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
		.errors({
			FORBIDDEN: { message: 'Access denied' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('create', 'service_contract', 'new');

			// Use DBOS workflow for durable execution
			const result = await startServiceContractWorkflow(
				{
					action: ContractAction.CREATE_CONTRACT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					data: {
						name: input.name,
						type: input.type,
						customerId: input.customerId,
						associationId: input.associationId,
						propertyId: input.propertyId,
						unitId: input.unitId,
						startDate: input.startDate,
						endDate: input.endDate,
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
						serviceItems: input.serviceItems
					}
				},
				input.idempotencyKey || `create-contract-${Date.now()}`
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to create contract' });
			}

			const contract = await prisma.serviceContract.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { serviceItems: true }
			});

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('view', 'service_contract', input.id);

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null },
				include: { serviceItems: true }
			});

			if (!contract) throw errors.NOT_FOUND({ message: 'Service contract not found' });

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
		.errors({
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					contracts: z.array(contractOutput),
					pagination: PaginationOutputSchema
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
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
				where.status = ServiceContractStatus.ACTIVE;
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Service contract not found' });

			if (!([ServiceContractStatus.DRAFT, ServiceContractStatus.ACTIVE] as ServiceContractStatus[]).includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Can only edit DRAFT or ACTIVE contracts' });
			}

			const { id, idempotencyKey, ...data } = input;

			// Use DBOS workflow for durable execution
			const result = await startServiceContractWorkflow(
				{
					action: ContractAction.UPDATE_CONTRACT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					contractId: id,
					data
				},
				idempotencyKey || `update-contract-${id}-${Date.now()}`
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to update contract' });
			}

			const contract = await prisma.serviceContract.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { serviceItems: true }
			});

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	activate: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('activate', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Service contract not found' });

			if (!([ServiceContractStatus.DRAFT, ServiceContractStatus.PENDING_APPROVAL, ServiceContractStatus.SUSPENDED] as ServiceContractStatus[]).includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Cannot activate contract in current status' });
			}

			// Use DBOS workflow for durable execution
			const result = await startServiceContractWorkflow(
				{
					action: ContractAction.ACTIVATE_CONTRACT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					contractId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to activate contract' });
			}

			const contract = await prisma.serviceContract.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { serviceItems: true }
			});

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	suspend: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('suspend', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Service contract not found' });

			if (existing.status !== ServiceContractStatus.ACTIVE) {
				throw errors.BAD_REQUEST({ message: 'Can only suspend ACTIVE contracts' });
			}

			// Use DBOS workflow for durable execution
			const result = await startServiceContractWorkflow(
				{
					action: ContractAction.SUSPEND_CONTRACT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					contractId: input.id,
					data: { reason: input.reason }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to suspend contract' });
			}

			const contract = await prisma.serviceContract.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { serviceItems: true }
			});

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	cancel: orgProcedure
		.input(z.object({ id: z.string(), reason: z.string().optional() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('cancel', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Service contract not found' });

			if (([ServiceContractStatus.CANCELLED, ServiceContractStatus.EXPIRED] as ServiceContractStatus[]).includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Contract is already cancelled or expired' });
			}

			// Use DBOS workflow for durable execution
			const result = await startServiceContractWorkflow(
				{
					action: ContractAction.CANCEL_CONTRACT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					contractId: input.id,
					data: { reason: input.reason }
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to cancel contract' });
			}

			const contract = await prisma.serviceContract.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { serviceItems: true }
			});

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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ contract: contractOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('renew', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Service contract not found' });

			if (!([ServiceContractStatus.ACTIVE, ServiceContractStatus.EXPIRED] as ServiceContractStatus[]).includes(existing.status)) {
				throw errors.BAD_REQUEST({ message: 'Can only renew ACTIVE or EXPIRED contracts' });
			}

			// Use DBOS workflow for durable execution
			const result = await startServiceContractWorkflow(
				{
					action: ContractAction.RENEW_CONTRACT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					contractId: input.id,
					data: {
						newStartDate: existing.endDate.toISOString(),
						newEndDate: input.newEndDate
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to renew contract' });
			}

			const contract = await prisma.serviceContract.findFirstOrThrow({
				where: { id: result.entityId, organizationId: context.organization.id },
				include: { serviceItems: true }
			});

			return successResponse({ contract: formatContract(contract, true) }, context);
		}),

	delete: orgProcedure
		.input(z.object({ id: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('delete', 'service_contract', input.id);

			const existing = await prisma.serviceContract.findFirst({
				where: { id: input.id, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!existing) throw errors.NOT_FOUND({ message: 'Service contract not found' });

			if (existing.status !== ServiceContractStatus.DRAFT) {
				throw errors.BAD_REQUEST({ message: 'Can only delete DRAFT contracts' });
			}

			// Use DBOS workflow for durable execution
			const result = await startServiceContractWorkflow(
				{
					action: ContractAction.DELETE_CONTRACT,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					contractId: input.id,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to delete contract' });
			}

			return successResponse({ deleted: true }, context);
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ serviceItem: serviceItemOutput }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);
			await context.cerbos.authorize('edit', 'service_contract', input.contractId);

			const contract = await prisma.serviceContract.findFirst({
				where: { id: input.contractId, organizationId: context.organization!.id, deletedAt: null }
			});
			if (!contract) throw errors.NOT_FOUND({ message: 'Service contract not found' });

			if (!([ServiceContractStatus.DRAFT, ServiceContractStatus.ACTIVE] as ServiceContractStatus[]).includes(contract.status)) {
				throw errors.BAD_REQUEST({ message: 'Can only add items to DRAFT or ACTIVE contracts' });
			}

			// Use DBOS workflow for durable execution
			const result = await startServiceContractWorkflow(
				{
					action: ContractAction.ADD_SERVICE_ITEM,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					contractId: input.contractId,
					data: {
						name: input.name,
						description: input.description,
						pricebookItemId: input.pricebookItemId,
						frequency: input.frequency,
						unitPrice: input.unitPrice,
						quantity: input.quantity,
						lineTotal: input.unitPrice * input.quantity,
						notes: input.notes
					}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to add service item' });
			}

			const serviceItem = await prisma.contractServiceItem.findFirstOrThrow({
				where: { id: result.entityId, contract: { organizationId: context.organization.id } }
			});

			return successResponse({ serviceItem: formatServiceItem(serviceItem) }, context);
		}),

	removeServiceItem: orgProcedure
		.input(z.object({ itemId: z.string() }).merge(IdempotencyKeySchema))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' },
			INTERNAL_SERVER_ERROR: { message: 'Internal error' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ deleted: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await assertContractorOrg(context.organization!.id, errors);

			const item = await prisma.contractServiceItem.findUnique({
				where: { id: input.itemId },
				include: { contract: true }
			});
			if (!item || item.contract.organizationId !== context.organization!.id) {
				throw errors.NOT_FOUND({ message: 'Service item not found' });
			}

			await context.cerbos.authorize('edit', 'service_contract', item.contractId);

			if (!([ServiceContractStatus.DRAFT, ServiceContractStatus.ACTIVE] as ServiceContractStatus[]).includes(item.contract.status)) {
				throw errors.BAD_REQUEST({ message: 'Can only remove items from DRAFT or ACTIVE contracts' });
			}

			// Use DBOS workflow for durable execution
			const result = await startServiceContractWorkflow(
				{
					action: ContractAction.REMOVE_SERVICE_ITEM,
					organizationId: context.organization!.id,
					userId: context.user!.id,
					serviceItemId: input.itemId,
					data: {}
				},
				input.idempotencyKey
			);

			if (!result.success) {
				throw errors.INTERNAL_SERVER_ERROR({ message: result.error || 'Failed to remove service item' });
			}

			return successResponse({ deleted: true }, context);
		})
};
