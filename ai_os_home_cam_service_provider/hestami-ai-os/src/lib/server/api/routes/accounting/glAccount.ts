import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { seedDefaultChartOfAccounts } from '../../../accounting/index.js';
import { createModuleLogger } from '../../../logger.js';
import { AccountTypeSchema, AccountCategorySchema, FundTypeSchema } from '../../schemas.js';
import { startGLAccountWorkflow, GLAccountWorkflowAction } from '../../../workflows/index.js';

const log = createModuleLogger('GLAccountRoute');

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
				idempotencyKey: z.string().uuid(),
				accountNumber: z.string().min(1).max(20),
				name: z.string().min(1).max(255),
				description: z.string().max(500).optional(),
				accountType: AccountTypeSchema,
				category: AccountCategorySchema,
				fundType: FundTypeSchema.default('OPERATING'),
				parentId: z.string().optional(),
				isActive: z.boolean().default(true)
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization - use 'new' as placeholder ID for create operations
			await context.cerbos.authorize('create', 'gl_account', 'new');

			// Get association from current org context
			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
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
				throw errors.CONFLICT({ message: 'Account number already exists' });
			}

			// Validate parent account if provided
			if (input.parentId) {
				const parent = await prisma.gLAccount.findFirst({
					where: { id: input.parentId, associationId: association.id }
				});
				if (!parent) {
					throw errors.NOT_FOUND({ message: 'Parent account not found' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startGLAccountWorkflow(
				{
					action: GLAccountWorkflowAction.CREATE,
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					accountNumber: input.accountNumber,
					name: input.name,
					description: input.description,
					accountType: input.accountType,
					category: input.category,
					fundType: input.fundType,
					parentId: input.parentId,
					isActive: input.isActive
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create GL account' });
			}

			return successResponse(
				{
					account: {
						id: workflowResult.accountId!,
						accountNumber: workflowResult.accountNumber!,
						name: workflowResult.name!,
						accountType: workflowResult.accountType!,
						category: workflowResult.category!,
						fundType: workflowResult.fundType!,
						isActive: workflowResult.isActive!
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
				accountType: AccountTypeSchema.optional(),
				fundType: FundTypeSchema.optional(),
				isActive: z.boolean().optional(),
				parentId: z.string().nullable().optional()
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			// Cerbos authorization - use '*' for list operations
			await context.cerbos.authorize('view', 'gl_account', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
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
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'gl_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
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
				throw errors.NOT_FOUND({ message: 'GL Account not found' });
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
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				name: z.string().min(1).max(255).optional(),
				description: z.string().max(500).optional(),
				isActive: z.boolean().optional(),
				parentId: z.string().nullable().optional()
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' },
			BAD_REQUEST: { message: 'Bad request' }
		})
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
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('edit', 'gl_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const existing = await prisma.gLAccount.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null }
			});

			if (!existing) {
				throw errors.NOT_FOUND({ message: 'GL Account not found' });
			}

			if (existing.isSystemAccount) {
				throw errors.FORBIDDEN({ message: 'Cannot modify system accounts' });
			}

			// Validate parent if changing
			if (input.parentId !== undefined && input.parentId !== null) {
				if (input.parentId === input.id) {
					throw errors.BAD_REQUEST({ message: 'Account cannot be its own parent' });
				}
				const parent = await prisma.gLAccount.findFirst({
					where: { id: input.parentId, associationId: association.id }
				});
				if (!parent) {
					throw errors.NOT_FOUND({ message: 'Parent account not found' });
				}
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startGLAccountWorkflow(
				{
					action: GLAccountWorkflowAction.UPDATE,
					organizationId: context.organization.id,
					userId: context.user!.id,
					accountId: input.id,
					name: input.name,
					description: input.description,
					isActive: input.isActive,
					parentId: input.parentId
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to update GL account' });
			}

			return successResponse(
				{
					account: {
						id: workflowResult.accountId!,
						accountNumber: workflowResult.accountNumber!,
						name: workflowResult.name!,
						isActive: workflowResult.isActive!
					}
				},
				context
			);
		}),

	/**
	 * Soft delete a GL account
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
			await context.cerbos.authorize('delete', 'gl_account', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const account = await prisma.gLAccount.findFirst({
				where: { id: input.id, associationId: association.id, deletedAt: null }
			});

			if (!account) {
				throw errors.NOT_FOUND({ message: 'GL Account not found' });
			}

			if (account.isSystemAccount) {
				throw errors.FORBIDDEN({ message: 'Cannot delete system accounts' });
			}

			// Check if account has any journal entries
			const hasEntries = await prisma.journalEntryLine.findFirst({
				where: { accountId: input.id }
			});

			if (hasEntries) {
				throw errors.CONFLICT({ message: 'Cannot delete account with journal entries' });
			}

			// Check for child accounts
			const hasChildren = await prisma.gLAccount.findFirst({
				where: { parentId: input.id, deletedAt: null }
			});

			if (hasChildren) {
				throw errors.CONFLICT({ message: 'Cannot delete account with child accounts' });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startGLAccountWorkflow(
				{
					action: GLAccountWorkflowAction.DELETE,
					organizationId: context.organization.id,
					userId: context.user!.id,
					accountId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to delete GL account' });
			}

			return successResponse({ success: true }, context);
		}),

	/**
	 * Seed default chart of accounts for the association
	 * Only works if no accounts exist yet
	 */
	seedDefaults: orgProcedure
		.input(z.object({}).optional())
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					seeded: z.boolean(),
					accountCount: z.number()
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ context, errors }) => {
			await context.cerbos.authorize('create', 'gl_account', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
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

			await seedDefaultChartOfAccounts(context.organization.id, association.id);

			const newCount = await prisma.gLAccount.count({
				where: { associationId: association.id }
			});

			return successResponse(
				{ seeded: true, accountCount: newCount },
				context
			);
		})
};
