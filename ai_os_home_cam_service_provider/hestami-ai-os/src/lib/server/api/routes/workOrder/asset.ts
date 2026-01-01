import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('AssetRoute');

const assetCategoryEnum = z.enum([
	'HVAC', 'PLUMBING', 'ELECTRICAL', 'STRUCTURAL', 'LANDSCAPING',
	'POOL_SPA', 'ELEVATOR', 'SECURITY', 'FIRE_SAFETY', 'COMMON_AREA',
	'EQUIPMENT', 'VEHICLE', 'OTHER'
]);

const assetStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'UNDER_REPAIR', 'DISPOSED']);

/**
 * Asset management procedures
 */
export const assetRouter = {
	/**
	 * Create a new asset
	 */
	create: orgProcedure
		.input(
			z.object({
				name: z.string().min(1).max(255),
				description: z.string().max(1000).optional(),
				category: assetCategoryEnum,
				// Location - either unit or common area
				unitId: z.string().optional(),
				commonAreaName: z.string().max(255).optional(),
				locationDetails: z.string().max(500).optional(),
				// Asset details
				manufacturer: z.string().max(255).optional(),
				model: z.string().max(255).optional(),
				serialNumber: z.string().max(100).optional(),
				// Dates
				purchaseDate: z.string().datetime().optional(),
				installDate: z.string().datetime().optional(),
				// Warranty
				warrantyExpires: z.string().datetime().optional(),
				warrantyDetails: z.string().max(500).optional(),
				// Financial
				purchaseCost: z.number().min(0).optional(),
				currentValue: z.number().min(0).optional(),
				// Maintenance
				maintenanceFrequencyDays: z.number().int().min(1).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					asset: z.object({
						id: z.string(),
						assetNumber: z.string(),
						name: z.string(),
						category: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'asset', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			// Validate unit if provided
			if (input.unitId) {
				const unit = await prisma.unit.findFirst({
					where: { id: input.unitId },
					include: { property: { include: { association: true } } }
				});
				if (!unit || unit.property.association.organizationId !== context.organization!.id) {
					throw errors.NOT_FOUND({ message: 'Unit' });
				}
			}

			// Generate asset number
			const lastAsset = await prisma.asset.findFirst({
				where: { associationId: association.id },
				orderBy: { createdAt: 'desc' }
			});

			const assetNumber = lastAsset
				? `AST-${String(parseInt(lastAsset.assetNumber.split('-')[1] || '0') + 1).padStart(6, '0')}`
				: 'AST-000001';

			const asset = await prisma.asset.create({
				data: {
					organizationId: context.organization!.id,
					associationId: association.id,
					assetNumber,
					name: input.name,
					description: input.description,
					category: input.category,
					unitId: input.unitId,
					commonAreaName: input.commonAreaName,
					locationDetails: input.locationDetails,
					manufacturer: input.manufacturer,
					model: input.model,
					serialNumber: input.serialNumber,
					purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
					installDate: input.installDate ? new Date(input.installDate) : null,
					warrantyExpires: input.warrantyExpires ? new Date(input.warrantyExpires) : null,
					warrantyDetails: input.warrantyDetails,
					purchaseCost: input.purchaseCost,
					currentValue: input.currentValue,
					maintenanceFrequencyDays: input.maintenanceFrequencyDays
				}
			});

			return successResponse(
				{
					asset: {
						id: asset.id,
						assetNumber: asset.assetNumber,
						name: asset.name,
						category: asset.category,
						status: asset.status
					}
				},
				context
			);
		}),

	/**
	 * List assets
	 */
	list: orgProcedure
		.input(
			z.object({
				category: assetCategoryEnum.optional(),
				status: assetStatusEnum.optional(),
				unitId: z.string().optional(),
				search: z.string().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					assets: z.array(
						z.object({
							id: z.string(),
							assetNumber: z.string(),
							name: z.string(),
							category: z.string(),
							status: z.string(),
							unitId: z.string().nullable(),
							commonAreaName: z.string().nullable(),
							manufacturer: z.string().nullable(),
							model: z.string().nullable(),
							warrantyExpires: z.string().nullable(),
							nextMaintenanceDate: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'asset', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const where: Prisma.AssetWhereInput = {
				associationId: association.id,
				deletedAt: null
			};

			if (input?.category) where.category = input.category;
			if (input?.status) where.status = input.status;
			if (input?.unitId) where.unitId = input.unitId;
			if (input?.search) {
				where.OR = [
					{ name: { contains: input.search, mode: 'insensitive' } },
					{ assetNumber: { contains: input.search, mode: 'insensitive' } },
					{ serialNumber: { contains: input.search, mode: 'insensitive' } }
				];
			}

			const assets = await prisma.asset.findMany({
				where,
				orderBy: [{ category: 'asc' }, { name: 'asc' }]
			});

			return successResponse(
				{
					assets: assets.map((a) => ({
						id: a.id,
						assetNumber: a.assetNumber,
						name: a.name,
						category: a.category,
						status: a.status,
						unitId: a.unitId,
						commonAreaName: a.commonAreaName,
						manufacturer: a.manufacturer,
						model: a.model,
						warrantyExpires: a.warrantyExpires?.toISOString() ?? null,
						nextMaintenanceDate: a.nextMaintenanceDate?.toISOString() ?? null
					}))
				},
				context
			);
		}),

	/**
	 * Get asset by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					asset: z.object({
						id: z.string(),
						assetNumber: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						category: z.string(),
						status: z.string(),
						unitId: z.string().nullable(),
						commonAreaName: z.string().nullable(),
						locationDetails: z.string().nullable(),
						manufacturer: z.string().nullable(),
						model: z.string().nullable(),
						serialNumber: z.string().nullable(),
						purchaseDate: z.string().nullable(),
						installDate: z.string().nullable(),
						warrantyExpires: z.string().nullable(),
						warrantyDetails: z.string().nullable(),
						purchaseCost: z.string().nullable(),
						currentValue: z.string().nullable(),
						maintenanceFrequencyDays: z.number().nullable(),
						lastMaintenanceDate: z.string().nullable(),
						nextMaintenanceDate: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'asset', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const asset = await prisma.asset.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null }
			});

			if (!asset) {
				throw errors.NOT_FOUND({ message: 'Asset' });
			}

			return successResponse(
				{
					asset: {
						id: asset.id,
						assetNumber: asset.assetNumber,
						name: asset.name,
						description: asset.description,
						category: asset.category,
						status: asset.status,
						unitId: asset.unitId,
						commonAreaName: asset.commonAreaName,
						locationDetails: asset.locationDetails,
						manufacturer: asset.manufacturer,
						model: asset.model,
						serialNumber: asset.serialNumber,
						purchaseDate: asset.purchaseDate?.toISOString() ?? null,
						installDate: asset.installDate?.toISOString() ?? null,
						warrantyExpires: asset.warrantyExpires?.toISOString() ?? null,
						warrantyDetails: asset.warrantyDetails,
						purchaseCost: asset.purchaseCost?.toString() ?? null,
						currentValue: asset.currentValue?.toString() ?? null,
						maintenanceFrequencyDays: asset.maintenanceFrequencyDays,
						lastMaintenanceDate: asset.lastMaintenanceDate?.toISOString() ?? null,
						nextMaintenanceDate: asset.nextMaintenanceDate?.toISOString() ?? null
					}
				},
				context
			);
		}),

	/**
	 * Update asset
	 */
	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(255).optional(),
				description: z.string().max(1000).nullable().optional(),
				status: assetStatusEnum.optional(),
				unitId: z.string().nullable().optional(),
				commonAreaName: z.string().max(255).nullable().optional(),
				locationDetails: z.string().max(500).nullable().optional(),
				manufacturer: z.string().max(255).nullable().optional(),
				model: z.string().max(255).nullable().optional(),
				serialNumber: z.string().max(100).nullable().optional(),
				warrantyExpires: z.string().datetime().nullable().optional(),
				warrantyDetails: z.string().max(500).nullable().optional(),
				currentValue: z.number().min(0).nullable().optional(),
				maintenanceFrequencyDays: z.number().int().min(1).nullable().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					asset: z.object({
						id: z.string(),
						name: z.string(),
						status: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'asset', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const existing = await prisma.asset.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Asset' });
			}

			const { id, warrantyExpires, ...rest } = input;

			const asset = await prisma.asset.update({
				where: { id },
				data: {
					...rest,
					warrantyExpires: warrantyExpires === null ? null : warrantyExpires ? new Date(warrantyExpires) : undefined
				}
			});

			return successResponse(
				{
					asset: {
						id: asset.id,
						name: asset.name,
						status: asset.status
					}
				},
				context
			);
		}),

	/**
	 * Delete asset (soft delete)
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Conflict' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('delete', 'asset', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const asset = await prisma.asset.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null }
			});

			if (!asset) {
				throw errors.NOT_FOUND({ message: 'Asset' });
			}

			// Check for open work orders
			const openWorkOrders = await prisma.workOrder.findFirst({
				where: {
					assetId: input.id,
					status: { notIn: ['CLOSED', 'CANCELLED'] }
				}
			});

			if (openWorkOrders) {
				throw errors.CONFLICT({ message: 'Cannot delete asset with open work orders' });
			}

			await prisma.asset.update({
				where: { id: input.id },
				data: { deletedAt: new Date(), status: 'DISPOSED' }
			});

			return successResponse({ success: true }, context);
		}),

	/**
	 * Log maintenance for an asset
	 */
	logMaintenance: orgProcedure
		.input(
			z.object({
				assetId: z.string(),
				maintenanceDate: z.string().datetime(),
				maintenanceType: z.string().min(1).max(100),
				description: z.string().min(1).max(1000),
				performedBy: z.string().max(255).optional(),
				cost: z.number().min(0).optional(),
				workOrderId: z.string().optional(),
				notes: z.string().max(1000).optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					maintenanceLog: z.object({
						id: z.string(),
						maintenanceDate: z.string(),
						maintenanceType: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'asset', input.assetId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const asset = await prisma.asset.findFirst({
				where: { id: input.assetId, associationId: association.id, deletedAt: null }
			});

			if (!asset) {
				throw errors.NOT_FOUND({ message: 'Asset' });
			}

			const maintenanceDate = new Date(input.maintenanceDate);

			// Create maintenance log and update asset's last maintenance date
			const [log] = await prisma.$transaction([
				prisma.assetMaintenanceLog.create({
					data: {
						assetId: input.assetId,
						maintenanceDate,
						maintenanceType: input.maintenanceType,
						description: input.description,
						performedBy: input.performedBy,
						cost: input.cost,
						workOrderId: input.workOrderId,
						notes: input.notes,
						createdBy: context.user!.id
					}
				}),
				prisma.asset.update({
					where: { id: input.assetId },
					data: {
						lastMaintenanceDate: maintenanceDate,
						nextMaintenanceDate: asset.maintenanceFrequencyDays
							? new Date(maintenanceDate.getTime() + asset.maintenanceFrequencyDays * 24 * 60 * 60 * 1000)
							: null
					}
				})
			]);

			return successResponse(
				{
					maintenanceLog: {
						id: log.id,
						maintenanceDate: log.maintenanceDate.toISOString(),
						maintenanceType: log.maintenanceType
					}
				},
				context
			);
		}),

	/**
	 * Get maintenance history for an asset
	 */
	getMaintenanceHistory: orgProcedure
		.input(z.object({ assetId: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					logs: z.array(
						z.object({
							id: z.string(),
							maintenanceDate: z.string(),
							maintenanceType: z.string(),
							description: z.string(),
							performedBy: z.string().nullable(),
							cost: z.string().nullable(),
							workOrderId: z.string().nullable()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' }
		})
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'asset', input.assetId);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association' });
			}

			const asset = await prisma.asset.findFirst({
				where: { id: input.assetId, associationId: association.id }
			});

			if (!asset) {
				throw errors.NOT_FOUND({ message: 'Asset' });
			}

			const logs = await prisma.assetMaintenanceLog.findMany({
				where: { assetId: input.assetId },
				orderBy: { maintenanceDate: 'desc' }
			});

			return successResponse(
				{
					logs: logs.map((l) => ({
						id: l.id,
						maintenanceDate: l.maintenanceDate.toISOString(),
						maintenanceType: l.maintenanceType,
						description: l.description,
						performedBy: l.performedBy,
						cost: l.cost?.toString() ?? null,
						workOrderId: l.workOrderId
					}))
				},
				context
			);
		})
};
