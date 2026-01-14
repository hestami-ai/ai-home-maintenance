import { z } from 'zod';
import { ResponseMetaSchema } from '$lib/schemas/index.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';
import { createModuleLogger } from '../../../logger.js';
import { JournalEntryStatusSchema } from '../../schemas.js';
import { startJournalEntryWorkflow } from '../../../workflows/index.js';

const log = createModuleLogger('JournalEntryRoute');

const journalLineSchema = z.object({
	accountId: z.string(),
	debitAmount: z.number().min(0).optional(),
	creditAmount: z.number().min(0).optional(),
	description: z.string().max(255).optional(),
	referenceType: z.string().max(50).optional(),
	referenceId: z.string().optional()
});

/**
 * Journal Entry management procedures
 */
export const journalEntryRouter = {
	/**
	 * Create a journal entry
	 */
	create: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				entryDate: z.string().datetime(),
				description: z.string().min(1).max(500),
				memo: z.string().max(1000).optional(),
				lines: z.array(journalLineSchema).min(2)
			})
		)
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			BAD_REQUEST: { message: 'Bad request' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					journalEntry: z.object({
						id: z.string(),
						entryNumber: z.string(),
						entryDate: z.string(),
						description: z.string(),
						status: z.string(),
						totalDebits: z.string(),
						totalCredits: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('create', 'journal_entry', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			// Validate double-entry: debits must equal credits
			let totalDebits = 0;
			let totalCredits = 0;

			for (const line of input.lines) {
				if (line.debitAmount && line.creditAmount) {
					throw errors.BAD_REQUEST({ message: 'Line cannot have both debit and credit amounts' });
				}
				if (!line.debitAmount && !line.creditAmount) {
					throw errors.BAD_REQUEST({ message: 'Line must have either debit or credit amount' });
				}
				totalDebits += line.debitAmount || 0;
				totalCredits += line.creditAmount || 0;
			}

			// Allow small rounding differences (0.01)
			if (Math.abs(totalDebits - totalCredits) > 0.01) {
				throw errors.BAD_REQUEST({
					message: `Debits (${totalDebits.toFixed(2)}) must equal credits (${totalCredits.toFixed(2)})`
				});
			}

			// Validate all accounts exist and belong to this association
			const accountIds = input.lines.map((l) => l.accountId);
			const accounts = await prisma.gLAccount.findMany({
				where: { id: { in: accountIds }, associationId: association.id }
			});

			if (accounts.length !== new Set(accountIds).size) {
				throw errors.NOT_FOUND({ message: 'One or more GL Accounts not found' });
			}

			// Generate entry number
			const lastEntry = await prisma.journalEntry.findFirst({
				where: { associationId: association.id },
				orderBy: { createdAt: 'desc' }
			});

			const entryNumber = lastEntry
				? `JE-${String(parseInt(lastEntry.entryNumber.split('-')[1] || '0') + 1).padStart(6, '0')}`
				: 'JE-000001';

			// Use DBOS workflow for durable execution
			const workflowResult = await startJournalEntryWorkflow(
				{
					action: 'CREATE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					entryNumber,
					entryDate: input.entryDate,
					description: input.description,
					memo: input.memo,
					lines: input.lines,
					totalDebits,
					totalCredits
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to create journal entry' });
			}

			return successResponse(
				{
					journalEntry: {
						id: workflowResult.entryId!,
						entryNumber: workflowResult.entryNumber!,
						entryDate: workflowResult.entryDate!,
						description: workflowResult.description!,
						status: workflowResult.status!,
						totalDebits: workflowResult.totalDebits!,
						totalCredits: workflowResult.totalCredits!
					}
				},
				context
			);
		}),

	/**
	 * List journal entries
	 */
	list: orgProcedure
		.input(
			z.object({
				status: JournalEntryStatusSchema.optional(),
				fromDate: z.string().datetime().optional(),
				toDate: z.string().datetime().optional()
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
					entries: z.array(
						z.object({
							id: z.string(),
							entryNumber: z.string(),
							entryDate: z.string(),
							description: z.string(),
							status: z.string(),
							lineCount: z.number()
						})
					)
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'journal_entry', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const where: Prisma.JournalEntryWhereInput = {
				associationId: association.id
			};

			if (input?.status) where.status = input.status;
			if (input?.fromDate || input?.toDate) {
				where.entryDate = {};
				if (input.fromDate) where.entryDate.gte = new Date(input.fromDate);
				if (input.toDate) where.entryDate.lte = new Date(input.toDate);
			}

			const entries = await prisma.journalEntry.findMany({
				where,
				include: { _count: { select: { lines: true } } },
				orderBy: { entryDate: 'desc' }
			});

			return successResponse(
				{
					entries: entries.map((e) => ({
						id: e.id,
						entryNumber: e.entryNumber,
						entryDate: e.entryDate.toISOString(),
						description: e.description,
						status: e.status,
						lineCount: e._count.lines
					}))
				},
				context
			);
		}),

	/**
	 * Get journal entry details
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
					journalEntry: z.object({
						id: z.string(),
						entryNumber: z.string(),
						entryDate: z.string(),
						description: z.string(),
						memo: z.string().nullable(),
						status: z.string(),
						createdBy: z.string(),
						postedAt: z.string().nullable(),
						lines: z.array(
							z.object({
								id: z.string(),
								accountId: z.string(),
								accountNumber: z.string(),
								accountName: z.string(),
								debitAmount: z.string().nullable(),
								creditAmount: z.string().nullable(),
								description: z.string().nullable()
							})
						)
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('view', 'journal_entry', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const entry = await prisma.journalEntry.findFirst({
				where: { id: input.id, associationId: association.id },
				include: {
					lines: {
						include: { account: true },
						orderBy: { lineNumber: 'asc' }
					}
				}
			});

			if (!entry) {
				throw errors.NOT_FOUND({ message: 'Journal Entry not found' });
			}

			return successResponse(
				{
					journalEntry: {
						id: entry.id,
						entryNumber: entry.entryNumber,
						entryDate: entry.entryDate.toISOString(),
						description: entry.description,
						memo: entry.memo,
						status: entry.status,
						createdBy: entry.createdBy,
						postedAt: entry.postedAt?.toISOString() ?? null,
						lines: entry.lines.map((l) => ({
							id: l.id,
							accountId: l.accountId,
							accountNumber: l.account.accountNumber,
							accountName: l.account.name,
							debitAmount: l.debitAmount?.toString() ?? null,
							creditAmount: l.creditAmount?.toString() ?? null,
							description: l.description
						}))
					}
				},
				context
			);
		}),

	/**
	 * Post a journal entry (finalize it)
	 */
	post: orgProcedure
		.input(z.object({ idempotencyKey: z.string().uuid(), id: z.string() }))
		.errors({
			NOT_FOUND: { message: 'Resource not found' },
			CONFLICT: { message: 'Conflict' },
			FORBIDDEN: { message: 'Access denied' }
		})
		.output(
			z.object({
				ok: z.literal(true),
				data: z.object({
					journalEntry: z.object({
						id: z.string(),
						status: z.string(),
						postedAt: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('post', 'journal_entry', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const entry = await prisma.journalEntry.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { lines: true }
			});

			if (!entry) {
				throw errors.NOT_FOUND({ message: 'Journal Entry not found' });
			}

			if (entry.status !== 'DRAFT' && entry.status !== 'PENDING_APPROVAL') {
				throw errors.CONFLICT({ message: `Cannot post entry with status: ${entry.status}` });
			}

			// Use DBOS workflow for durable execution
			const workflowResult = await startJournalEntryWorkflow(
				{
					action: 'POST',
					organizationId: context.organization.id,
					userId: context.user!.id,
					entryId: input.id
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to post journal entry' });
			}

			return successResponse(
				{
					journalEntry: {
						id: entry.id,
						status: workflowResult.status!,
						postedAt: workflowResult.postedAt!
					}
				},
				context
			);
		}),

	/**
	 * Reverse a posted journal entry
	 */
	reverse: orgProcedure
		.input(
			z.object({
				idempotencyKey: z.string().uuid(),
				id: z.string(),
				reversalDate: z.string().datetime()
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
					reversalEntry: z.object({
						id: z.string(),
						entryNumber: z.string()
					})
				}),
				meta: ResponseMetaSchema
			})
		)
		.handler(async ({ input, context, errors }) => {
			await context.cerbos.authorize('reverse', 'journal_entry', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization.id, deletedAt: null }
			});

			if (!association) {
				throw errors.NOT_FOUND({ message: 'Association not found' });
			}

			const entry = await prisma.journalEntry.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { lines: true }
			});

			if (!entry) {
				throw errors.NOT_FOUND({ message: 'Journal Entry not found' });
			}

			if (entry.status !== 'POSTED') {
				throw errors.CONFLICT({ message: 'Can only reverse posted entries' });
			}

			// Generate reversal entry number
			const lastEntry = await prisma.journalEntry.findFirst({
				where: { associationId: association.id },
				orderBy: { createdAt: 'desc' }
			});

			const entryNumber = `JE-${String(parseInt(lastEntry!.entryNumber.split('-')[1] || '0') + 1).padStart(6, '0')}`;

			// Use DBOS workflow for durable execution
			const workflowResult = await startJournalEntryWorkflow(
				{
					action: 'REVERSE',
					organizationId: context.organization.id,
					userId: context.user!.id,
					associationId: association.id,
					entryNumber,
					reversalDate: input.reversalDate,
					originalEntry: {
						id: entry.id,
						entryNumber: entry.entryNumber,
						description: entry.description,
						lines: entry.lines.map((line) => ({
							accountId: line.accountId,
							debitAmount: line.debitAmount ? Number(line.debitAmount) : null,
							creditAmount: line.creditAmount ? Number(line.creditAmount) : null,
							description: line.description,
							referenceType: line.referenceType,
							referenceId: line.referenceId
						}))
					}
				},
				input.idempotencyKey
			);

			if (!workflowResult.success) {
				throw errors.FORBIDDEN({ message: workflowResult.error || 'Failed to reverse journal entry' });
			}

			return successResponse(
				{
					reversalEntry: {
						id: workflowResult.entryId!,
						entryNumber: workflowResult.entryNumber!
					}
				},
				context
			);
		})
};
