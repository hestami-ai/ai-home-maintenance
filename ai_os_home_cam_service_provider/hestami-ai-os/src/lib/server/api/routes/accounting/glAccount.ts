import { z } from 'zod';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { seedDefaultChartOfAccounts } from '../../../accounting/index.js';

/**
 * GL Account management procedures
 */
export const glAccountRouter = {
	/**
	 * Create a new GL account
	 */
	create: orgProcedure
		.input(
			z.object({
				accountNumber: z.string().min(1).max(20),
				name: z.string().min(1).max(255),
				description: z.string().max(500).optional(),
				accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
				category: z.enum([
					'CASH', 'ACCOUNTS_RECEIVABLE', 'PREPAID', 'FIXED_ASSET', 'OTHER_ASSET',
					'ACCOUNTS_PAYABLE', 'ACCRUED_LIABILITY', 'DEFERRED_REVENUE', 'LONG_TERM_LIABILITY', 'OTHER_LIABILITY',
					'RETAINED_EARNINGS', 'FUND_BALANCE', 'RESERVE_FUND',
					'ASSESSMENT_INCOME', 'LATE_FEE_INCOME', 'INTEREST_INCOME', 'OTHER_INCOME',
					'ADMINISTRATIVE', 'UTILITIES', 'MAINTENANCE', 'INSURANCE', 'PROFESSIONAL_FEES', 'RESERVE_CONTRIBUTION', 'OTHER_EXPENSE'
				]),
				fundType: z.enum(['OPERATING', 'RESERVE', 'SPECIAL']).default('OPERATING'),
				parentId: z.string().optional(),
				isActive: z.boolean().default(true)
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					account: z.object({
						id: z.string(),
						accountNumber: z.string(),
						name: z.string(),
						accountType: z.string(),
						category: z.string(),
						fundType: z.string(),
						isActive: z.boolean()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization - use 'new' as placeholder ID for create operations
			await context.cerbos.authorize('create', 'gl_account', 'new');

			// Get association from current org context
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Check for duplicate account number
			const existing = await prisma.gLAccount.findUnique({
				where: {
					associationId_accountNumber: {
						associationId: association.id,
						accountNumber: input.accountNumber
					}
				}
			});

			if (existing) {
				throw ApiException.conflict('Account number already exists');
			}

			// Validate parent account if provided
			if (input.parentId) {
				const parent = await prisma.gLAccount.findFirst({
					where: { id: input.parentId, associationId: association.id }
				});
				if (!parent) {
					throw ApiException.notFound('Parent account');
				}
			}

			// Determine normal balance based on account type
			const normalDebit = ['ASSET', 'EXPENSE'].includes(input.accountType);

			const account = await prisma.gLAccount.create({
				data: {
					associationId: association.id,
					accountNumber: input.accountNumber,
					name: input.name,
					description: input.description,
					accountType: input.accountType,
					category: input.category,
					fundType: input.fundType,
					parentId: input.parentId,
					isActive: input.isActive,
					normalDebit
				}
			});

			return successResponse(
				{
					account: {
						id: account.id,
						accountNumber: account.accountNumber,
						name: account.name,
						accountType: account.accountType,
						category: account.category,
						fundType: account.fundType,
						isActive: account.isActive
					}
				},
				context
			);
		}),

	/**
	 * List GL accounts for the current association
	 */
	list: orgProcedure
		.input(
			z.object({
				accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']).optional(),
				fundType: z.enum(['OPERATING', 'RESERVE', 'SPECIAL']).optional(),
				isActive: z.boolean().optional(),
				parentId: z.string().nullable().optional()
			}).optional()
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					accounts: z.array(
						z.object({
							id: z.string(),
							accountNumber: z.string(),
							name: z.string(),
							description: z.string().nullable(),
							accountType: z.string(),
							category: z.string(),
							fundType: z.string(),
							parentId: z.string().nullable(),
							isActive: z.boolean(),
							currentBalance: z.string()
						})
					)
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			// Cerbos authorization - use '*' for list operations
			await context.cerbos.authorize('view', 'gl_account', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const where: Prisma.GLAccountWhereInput = {
				associationId: association.id,
				deletedAt: null
			};

			if (input?.accountType) where.accountType = input.accountType;
			if (input?.fundType) where.fundType = input.fundType;
			if (input?.isActive !== undefined) where.isActive = input.isActive;
			if (input?.parentId !== undefined) where.parentId = input.parentId;

			const accounts = await prisma.gLAccount.findMany({
				where,
				orderBy: { accountNumber: 'asc' }
			});

			return successResponse(
				{
					accounts: accounts.map((a) => ({
						id: a.id,
						accountNumber: a.accountNumber,
						name: a.name,
						description: a.description,
						accountType: a.accountType,
						category: a.category,
						fundType: a.fundType,
						parentId: a.parentId,
						isActive: a.isActive,
						currentBalance: a.currentBalance.toString()
					}))
				},
				context
			);
		}),

	/**
	 * Get a single GL account by ID
	 */
	get: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					account: z.object({
						id: z.string(),
						accountNumber: z.string(),
						name: z.string(),
						description: z.string().nullable(),
						accountType: z.string(),
						category: z.string(),
						fundType: z.string(),
						parentId: z.string().nullable(),
						isActive: z.boolean(),
						isSystemAccount: z.boolean(),
						normalDebit: z.boolean(),
						currentBalance: z.string(),
						children: z.array(z.object({
							id: z.string(),
							accountNumber: z.string(),
							name: z.string()
						}))
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'gl_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const account = await prisma.gLAccount.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null },
				include: {
					children: {
						where: { deletedAt: null },
						select: { id: true, accountNumber: true, name: true }
					}
				}
			});

			if (!account) {
				throw ApiException.notFound('GL Account');
			}

			return successResponse(
				{
					account: {
						id: account.id,
						accountNumber: account.accountNumber,
						name: account.name,
						description: account.description,
						accountType: account.accountType,
						category: account.category,
						fundType: account.fundType,
						parentId: account.parentId,
						isActive: account.isActive,
						isSystemAccount: account.isSystemAccount,
						normalDebit: account.normalDebit,
						currentBalance: account.currentBalance.toString(),
						children: account.children
					}
				},
				context
			);
		}),

	/**
	 * Update a GL account
	 */
	update: orgProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(255).optional(),
				description: z.string().max(500).optional(),
				isActive: z.boolean().optional(),
				parentId: z.string().nullable().optional()
			})
		)
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					account: z.object({
						id: z.string(),
						accountNumber: z.string(),
						name: z.string(),
						isActive: z.boolean()
					})
				}),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('edit', 'gl_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const existing = await prisma.gLAccount.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null }
			});

			if (!existing) {
				throw ApiException.notFound('GL Account');
			}

			if (existing.isSystemAccount) {
				throw ApiException.forbidden('Cannot modify system accounts');
			}

			// Validate parent if changing
			if (input.parentId !== undefined && input.parentId !== null) {
				if (input.parentId === input.id) {
					throw ApiException.badRequest('Account cannot be its own parent');
				}
				const parent = await prisma.gLAccount.findFirst({
					where: { id: input.parentId, associationId: association.id }
				});
				if (!parent) {
					throw ApiException.notFound('Parent account');
				}
			}

			const account = await prisma.gLAccount.update({
				where: { id: input.id },
				data: {
					...(input.name && { name: input.name }),
					...(input.description !== undefined && { description: input.description }),
					...(input.isActive !== undefined && { isActive: input.isActive }),
					...(input.parentId !== undefined && { parentId: input.parentId })
				}
			});

			return successResponse(
				{
					account: {
						id: account.id,
						accountNumber: account.accountNumber,
						name: account.name,
						isActive: account.isActive
					}
				},
				context
			);
		}),

	/**
	 * Soft delete a GL account
	 */
	delete: orgProcedure
		.input(z.object({ id: z.string() }))
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({ success: z.boolean() }),
				meta: z.any()
			})
		)
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('delete', 'gl_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const account = await prisma.gLAccount.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null }
			});

			if (!account) {
				throw ApiException.notFound('GL Account');
			}

			if (account.isSystemAccount) {
				throw ApiException.forbidden('Cannot delete system accounts');
			}

			// Check if account has any journal entries
			const hasEntries = await prisma.journalEntryLine.findFirst({
				where: { accountId: input.id }
			});

			if (hasEntries) {
				throw ApiException.conflict('Cannot delete account with journal entries');
			}

			// Check for child accounts
			const hasChildren = await prisma.gLAccount.findFirst({
				where: { parentId: input.id, deletedAt: null }
			});

			if (hasChildren) {
				throw ApiException.conflict('Cannot delete account with child accounts');
			}

			await prisma.gLAccount.update({
				where: { id: input.id },
				data: { deletedAt: new Date() }
			});

			return successResponse({ success: true }, context);
		}),

	/**
	 * Seed default chart of accounts for the association
	 * Only works if no accounts exist yet
	 */
	seedDefaults: orgProcedure
		.input(z.object({}).optional())
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					seeded: z.boolean(),
					accountCount: z.number()
				}),
				meta: z.any()
			})
		)
		.handler(async ({ context }) => {
			await context.cerbos.authorize('create', 'gl_account', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Check if accounts already exist
			const existingCount = await prisma.gLAccount.count({
				where: { associationId: association.id }
			});

			if (existingCount > 0) {
				return successResponse(
					{ seeded: false, accountCount: existingCount },
					context
				);
			}

			await seedDefaultChartOfAccounts(association.id);

			const newCount = await prisma.gLAccount.count({
				where: { associationId: association.id }
			});

			return successResponse(
				{ seeded: true, accountCount: newCount },
				context
			);
		})
};
