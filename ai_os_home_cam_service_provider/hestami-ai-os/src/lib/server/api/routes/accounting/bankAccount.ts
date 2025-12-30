import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';

const log = createModuleLogger('BankAccountRoute');

/**
 * Bank Account management procedures
 */
export const bankAccountRouter = {
	/**
	 * Create a new bank account
	 */
	create: orgProcedure
		.input(
			z.object({
				glAccountId: z.string(),
				bankName: z.string().min(1).max(255),
				accountName: z.string().min(1).max(255),
				accountNumber: z.string().min(1).max(20), // Last 4 digits for display
				routingNumber: z.string().max(20).optional(),
				accountType: z.enum(['CHECKING', 'SAVINGS', 'MONEY_MARKET']),
				fundType: z.enum(['OPERATING', 'RESERVE', 'SPECIAL']).default('OPERATING'),
				isPrimary: z.boolean().default(false)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					bankAccount: z.object({
						id: z.string(),
						bankName: z.string(),
						accountName: z.string(),
						accountNumber: z.string(),
						accountType: z.string(),
						fundType: z.string(),
						isPrimary: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'bank_account', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			// Validate GL account exists and is a cash account
			const glAccount = await prisma.gLAccount.findFirst({
				where: {
					id: input.glAccountId,
					associationId: association.id,
					accountType: 'ASSET',
					category: 'CASH',
					deletedAt: null
				}
			});

			if (!glAccount) {
				throw errors.NOT_FOUND({ message: 'GL Cash Account not found' });
			}

			// Check if GL account is already linked to another bank account
			const existingLink = await prisma.bankAccount.findFirst({
				where: { glAccountId: input.glAccountId, isActive: true }
			});

			if (existingLink) {
				throw errors.CONFLICT({ message: 'GL account is already linked to a bank account' });
			}

			// If setting as primary, unset other primary accounts of same fund type
			if (input.isPrimary) {
				await prisma.bankAccount.updateMany({
					where: {
						associationId: association.id,
						fundType: input.fundType,
						isPrimary: true
					},
					data: { isPrimary: false }
				});
			}

			const bankAccount = await prisma.bankAccount.create({
				data: {
					organizationId: context.organization.id,
					associationId: association.id,
					glAccountId: input.glAccountId,
					bankName: input.bankName,
					accountName: input.accountName,
					accountNumber: input.accountNumber,
					routingNumber: input.routingNumber,
					accountType: input.accountType,
					fundType: input.fundType,
					isPrimary: input.isPrimary
				}
			});

			return successResponse(
				{
					bankAccount: {
						id: bankAccount.id,
						bankName: bankAccount.bankName,
						accountName: bankAccount.accountName,
						accountNumber: bankAccount.accountNumber,
						accountType: bankAccount.accountType,
						fundType: bankAccount.fundType,
						isPrimary: bankAccount.isPrimary
					}
				},
				context
			);
		}),

	/**
	 * List bank accounts
	 */
	list: orgProcedure
		.input(
			z.object({
				fundType: z.enum(['OPERATING', 'RESERVE', 'SPECIAL']).optional(),
				isActive: z.boolean().optional()
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
					bankAccounts: z.array(
						z.object({
							id: z.string(),
							bankName: z.string(),
							accountName: z.string(),
							accountNumber: z.string(),
							accountType: z.string(),
							fundType: z.string(),
							bookBalance: z.string(),
							bankBalance: z.string(),
							lastReconciled: z.string().nullable(),
							isPrimary: z.boolean(),
							isActive: z.boolean(),
							glAccountId: z.string(),
							glAccountNumber: z.string(),
							glAccountName: z.string()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'bank_account', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const where: Prisma.BankAccountWhereInput = {
				associationId: association.id
			};

			if (input?.fundType) where.fundType = input.fundType;
			if (input?.isActive !== undefined) where.isActive = input.isActive;

			const bankAccounts = await prisma.bankAccount.findMany({
				where,
				include: { glAccount: true },
				orderBy: [{ fundType: 'asc' }, { isPrimary: 'desc' }, { bankName: 'asc' }]
			});

			return successResponse(
				{
					bankAccounts: bankAccounts.map((ba) => ({
						id: ba.id,
						bankName: ba.bankName,
						accountName: ba.accountName,
						accountNumber: ba.accountNumber,
						accountType: ba.accountType,
						fundType: ba.fundType,
						bookBalance: ba.bookBalance.toString(),
						bankBalance: ba.bankBalance.toString(),
						lastReconciled: ba.lastReconciled?.toISOString() ?? null,
						isPrimary: ba.isPrimary,
						isActive: ba.isActive,
						glAccountId: ba.glAccountId,
						glAccountNumber: ba.glAccount.accountNumber,
						glAccountName: ba.glAccount.name
					}))
				},
				context
			);
		}),

	/**
	 * Get bank account by ID
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
					bankAccount: z.object({
						id: z.string(),
						bankName: z.string(),
						accountName: z.string(),
						accountNumber: z.string(),
						routingNumber: z.string().nullable(),
						accountType: z.string(),
						fundType: z.string(),
						bookBalance: z.string(),
						bankBalance: z.string(),
						lastReconciled: z.string().nullable(),
						isPrimary: z.boolean(),
						isActive: z.boolean(),
						glAccountId: z.string(),
						glAccountNumber: z.string(),
						glAccountName: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'bank_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const bankAccount = await prisma.bankAccount.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { glAccount: true }
			});

			if (!bankAccount) {
				throw errors.NOT_FOUND({ message: 'Bank Account not found' });
			}

			return successResponse(
				{
					bankAccount: {
						id: bankAccount.id,
						bankName: bankAccount.bankName,
						accountName: bankAccount.accountName,
						accountNumber: bankAccount.accountNumber,
						routingNumber: bankAccount.routingNumber,
						accountType: bankAccount.accountType,
						fundType: bankAccount.fundType,
						bookBalance: bankAccount.bookBalance.toString(),
						bankBalance: bankAccount.bankBalance.toString(),
						lastReconciled: bankAccount.lastReconciled?.toISOString() ?? null,
						isPrimary: bankAccount.isPrimary,
						isActive: bankAccount.isActive,
						glAccountId: bankAccount.glAccountId,
						glAccountNumber: bankAccount.glAccount.accountNumber,
						glAccountName: bankAccount.glAccount.name
					}
				},
				context
			);
		}),

	/**
	 * Update bank account
	 */
	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				bankName: z.string().min(1).max(255).optional(),
				accountName: z.string().min(1).max(255).optional(),
				accountNumber: z.string().min(1).max(20).optional(),
				routingNumber: z.string().max(20).nullable().optional(),
				isPrimary: z.boolean().optional(),
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
					bankAccount: z.object({
						id: z.string(),
						bankName: z.string(),
						accountName: z.string(),
						isPrimary: z.boolean(),
						isActive: z.boolean()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'bank_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const existing = await prisma.bankAccount.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Bank Account not found' });
			}

			// If setting as primary, unset other primary accounts of same fund type
			if (input.isPrimary === true) {
				await prisma.bankAccount.updateMany({
					where: {
						associationId: association.id,
						fundType: existing.fundType,
						isPrimary: true,
						id: { not: input.id }
					},
					data: { isPrimary: false }
				});
			}

			const { id, ...updateData } = input;

			const bankAccount = await prisma.bankAccount.update({
				where: { id },
				data: updateData
			});

			return successResponse(
				{
					bankAccount: {
						id: bankAccount.id,
						bankName: bankAccount.bankName,
						accountName: bankAccount.accountName,
						isPrimary: bankAccount.isPrimary,
						isActive: bankAccount.isActive
					}
				},
				context
			);
		}),

	/**
	 * Deactivate bank account (soft delete)
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }))
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
			await context.cerbos.authorize('delete', 'bank_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const bankAccount = await prisma.bankAccount.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!bankAccount) {
				throw errors.NOT_FOUND({ message: 'Bank Account not found' });
			}

			if (!bankAccount.isActive) {
				throw errors.CONFLICT({ message: 'Bank account already deactivated' });
			}

			// Check for pending payments linked to this account
			const pendingPayments = await prisma.payment.findFirst({
				where: {
					bankAccountId: input.id,
					status: 'PENDING'
				}
			});

			if (pendingPayments) {
				throw errors.CONFLICT({ message: 'Cannot deactivate bank account with pending payments' });
			}

			await prisma.bankAccount.update({
				where: { id: input.id },
				data: { isActive: false, isPrimary: false }
			});

			return successResponse({ success: true }, context);
		}),

	/**
	 * Update bank balance (for reconciliation)
	 */
	updateBankBalance: orgProcedure
		.input(
			z.object({
				id: z.string(),
				bankBalance: z.number(),
				reconcileDate: z.string().datetime().optional()
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
					bankAccount: z.object({
						id: z.string(),
						bookBalance: z.string(),
						bankBalance: z.string(),
						difference: z.string(),
						lastReconciled: z.string().nullable()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'bank_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const existing = await prisma.bankAccount.findFirst({
				where: { id: input.id, associationId: association.id }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'Bank Account not found' });
			}

			const bankAccount = await prisma.bankAccount.update({
				where: { id: input.id },
				data: {
					bankBalance: input.bankBalance,
					lastReconciled: input.reconcileDate ? new Date(input.reconcileDate) : new Date()
				}
			});

			const difference = Number(bankAccount.bookBalance) - Number(bankAccount.bankBalance);

			return successResponse(
				{
					bankAccount: {
						id: bankAccount.id,
						bookBalance: bankAccount.bookBalance.toString(),
						bankBalance: bankAccount.bankBalance.toString(),
						difference: difference.toFixed(2),
						lastReconciled: bankAccount.lastReconciled?.toISOString() ?? null
					}
				},
				context
			);
		})
};
