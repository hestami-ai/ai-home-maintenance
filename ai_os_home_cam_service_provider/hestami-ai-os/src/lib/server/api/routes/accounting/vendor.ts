import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';
import { startVendorWorkflow } from '../../../workflows/index.js';

const log = createModuleLogger('VendorRoute');

/**
 * Vendor management procedures (Accounts Payable)
 */
export const vendorRouter = {
	/**
	 * Create a new vendor
	 */
	create: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				name: z.string().min(1).max(255),
				dba: z.string().max(255).optional(),
				contactName: z.string().max(255).optional(),
				email: z.string().email().optional(),
				phone: z.string().max(20).optional(),
				addressLine1: z.string().max(255).optional(),
				addressLine2: z.string().max(255).optional(),
				city: z.string().max(100).optional(),
				state: z.string().max(50).optional(),
				postalCode: z.string().max(20).optional(),
				taxId: z.string().max(20).optional(),
				w9OnFile: z.boolean().default(false),
				is1099Eligible: z.boolean().default(false),
				paymentTerms: z.number().int().min(0).max(365).default(30),
				defaultGLAccountId: z.string().optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vendor: z.object({
						id: z.string(),
						name: z.string(),
						email: z.string().nullable(),
						isActive: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'vendor', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			// Validate GL account if provided
			if (input.defaultGLAccountId) {
				const glAccount = await prisma.gLAccount.findFirst({
					where: { id: input.defaultGLAccountId, associationId: association.id }
				});
				if (!glAccount) {
					throw errors.NOT_FOUND({ message: 'GL Account not found' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startVendorWorkflow(
				{
					action: 'CREATE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					name: input.name,
					dba: input.dba,
					contactName: input.contactName,
					email: input.email,
					phone: input.phone,
					addressLine1: input.addressLine1,
					addressLine2: input.addressLine2,
					city: input.city,
					state: input.state,
					postalCode: input.postalCode,
					taxId: input.taxId,
					w9OnFile: input.w9OnFile,
					is1099Eligible: input.is1099Eligible,
					paymentTerms: input.paymentTerms,
					defaultGLAccountId: input.defaultGLAccountId
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create vendor' });
			}

			return successResponse(
				{
					vendor: {
						id: workflowResult.vendorId!,
						name: workflowResult.name!,
						email: workflowResult.email ?? null,
						isActive: workflowResult.isActive!
					}
				},
				context
			);
		}),

	/**
	 * List vendors
	 */
	list: orgProcedure
		.input(
			z.object({
				isActive: z.boolean().optional(),
				search: z.string().optional()
			}).optional()
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vendors: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							dba: z.string().nullable(),
							contactName: z.string().nullable(),
							email: z.string().nullable(),
							phone: z.string().nullable(),
							isActive: z.boolean(),
							is1099Eligible: z.boolean()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'vendor', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const where: Prisma.VendorWhereInput = {
				organizationId: context.organization.id,
				associationId: association.id,
				deletedAt: null
			};

			if (input?.isActive !== undefined) where.isActive = input.isActive;
			if (input?.search) {
				where.OR = [
					{ name: { contains: input.search, mode: 'insensitive' } },
					{ dba: { contains: input.search, mode: 'insensitive' } },
					{ email: { contains: input.search, mode: 'insensitive' } }
				];
			}

			const vendors = await prisma.vendor.findMany({
				where,
				orderBy: { name: 'asc' }
			});

			return successResponse(
				{
					vendors: vendors.map((v) => ({
						id: v.id,
						name: v.name,
						dba: v.dba,
						contactName: v.contactName,
						email: v.email,
						phone: v.phone,
						isActive: v.isActive,
						is1099Eligible: v.is1099Eligible
					}))
				},
				context
			);
		}),

	/**
	 * Get vendor by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vendor: z.object({
						id: z.string(),
						name: z.string(),
						dba: z.string().nullable(),
						contactName: z.string().nullable(),
						email: z.string().nullable(),
						phone: z.string().nullable(),
						addressLine1: z.string().nullable(),
						addressLine2: z.string().nullable(),
						city: z.string().nullable(),
						state: z.string().nullable(),
						postalCode: z.string().nullable(),
						w9OnFile: z.boolean(),
						is1099Eligible: z.boolean(),
						paymentTerms: z.number(),
						isActive: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'vendor', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const vendor = await prisma.vendor.findFirst({
				where: { id: input.id, organizationId: context.organization.id, associationId: association.id, deletedAt: null }
			});

			if (!vendor) {
				throw errors.NOT_FOUND({ message: 'Vendor not found' });
			}

			return successResponse(
				{
					vendor: {
						id: vendor.id,
						name: vendor.name,
						dba: vendor.dba,
						contactName: vendor.contactName,
						email: vendor.email,
						phone: vendor.phone,
						addressLine1: vendor.addressLine1,
						addressLine2: vendor.addressLine2,
						city: vendor.city,
						state: vendor.state,
						postalCode: vendor.postalCode,
						w9OnFile: vendor.w9OnFile,
						is1099Eligible: vendor.is1099Eligible,
						paymentTerms: vendor.paymentTerms,
						isActive: vendor.isActive
					}
				},
				context
			);
		}),

	/**
	 * Update vendor
	 */
	update: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				name: z.string().min(1).max(255).optional(),
				dba: z.string().max(255).nullable().optional(),
				contactName: z.string().max(255).nullable().optional(),
				email: z.string().email().nullable().optional(),
				phone: z.string().max(20).nullable().optional(),
				addressLine1: z.string().max(255).nullable().optional(),
				addressLine2: z.string().max(255).nullable().optional(),
				city: z.string().max(100).nullable().optional(),
				state: z.string().max(50).nullable().optional(),
				postalCode: z.string().max(20).nullable().optional(),
				w9OnFile: z.boolean().optional(),
				is1099Eligible: z.boolean().optional(),
				paymentTerms: z.number().int().min(0).max(365).optional(),
				isActive: z.boolean().optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					vendor: z.object({
						id: z.string(),
						name: z.string(),
						isActive: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'vendor', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const existing = await prisma.vendor.findFirst({
				where: { id: input.id, organizationId: context.organization.id, associationId: association.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Vendor not found' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startVendorWorkflow(
				{
					action: 'UPDATE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					vendorId: input.id,
					name: input.name,
					dba: input.dba,
					contactName: input.contactName,
					email: input.email,
					phone: input.phone,
					addressLine1: input.addressLine1,
					addressLine2: input.addressLine2,
					city: input.city,
					state: input.state,
					postalCode: input.postalCode,
					w9OnFile: input.w9OnFile,
					is1099Eligible: input.is1099Eligible,
					paymentTerms: input.paymentTerms,
					isActive: input.isActive
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to update vendor' });
			}

			return successResponse(
				{
					vendor: {
						id: workflowResult.vendorId!,
						name: workflowResult.name!,
						isActive: workflowResult.isActive!
					}
				},
				context
			);
		}),

	/**
	 * Soft delete vendor
	 */
	delete: orgProcedure
		.input(z.object({ idempotencyKey: z.string().uuid(), id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('delete', 'vendor', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const vendor = await prisma.vendor.findFirst({
				where: { id: input.id, organizationId: context.organization.id, associationId: association.id, deletedAt: null }
			});

			if (!vendor) {
				throw errors.NOT_FOUND({ message: 'Vendor not found' });
			}

			// Check for unpaid invoices
			const unpaidInvoices = await prisma.aPInvoice.findFirst({
				where: {
					vendorId: input.id,
					status: { notIn: ['PAID', 'VOIDED'] }
				}
			});

			if (unpaidInvoices) {
				throw errors.CONFLICT({ message: 'Cannot delete vendor with unpaid invoices' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startVendorWorkflow(
				{
					action: 'DELETE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					vendorId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to delete vendor' });
			}

			return successResponse({ success: true }, context);
		})
};
