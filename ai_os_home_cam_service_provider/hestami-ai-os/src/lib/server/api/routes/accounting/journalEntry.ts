import { z } from 'zod';
import { ResponseMetaSchema } from '../../schemas.js';
import { orgProcedure, successResponse } from '../../router.js';
import { prisma } from '../../../db.js';
import { ApiException } from '../../errors.js';
import type { Prisma } from '../../../../../../generated/prisma/client.js';

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
				entryDate: z.string().datetime(),
				description: z.string().min(1).max(500),
				memo: z.string().max(1000).optional(),
				lines: z.array(journalLineSchema).min(2)
			})
		)
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('create', 'journal_entry', 'new');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			// Validate double-entry: debits must equal credits
			let totalDebits = 0;
			let totalCredits = 0;

			for (const line of input.lines) {
				if (line.debitAmount && line.creditAmount) {
					throw ApiException.badRequest('Line cannot have both debit and credit amounts');
				}
				if (!line.debitAmount && !line.creditAmount) {
					throw ApiException.badRequest('Line must have either debit or credit amount');
				}
				totalDebits += line.debitAmount || 0;
				totalCredits += line.creditAmount || 0;
			}

			// Allow small rounding differences (0.01)
			if (Math.abs(totalDebits - totalCredits) > 0.01) {
				throw ApiException.badRequest(
					`Debits (${totalDebits.toFixed(2)}) must equal credits (${totalCredits.toFixed(2)})`
				);
			}

			// Validate all accounts exist and belong to this association
			const accountIds = input.lines.map((l) => l.accountId);
			const accounts = await prisma.gLAccount.findMany({
				where: { id: { in: accountIds }, associationId: association.id }
			});

			if (accounts.length !== new Set(accountIds).size) {
				throw ApiException.notFound('One or more GL Accounts');
			}

			// Generate entry number
			const lastEntry = await prisma.journalEntry.findFirst({
				where: { associationId: association.id },
				orderBy: { createdAt: 'desc' }
			});

			const entryNumber = lastEntry
				? `JE-${String(parseInt(lastEntry.entryNumber.split('-')[1] || '0') + 1).padStart(6, '0')}`
				: 'JE-000001';

			const journalEntry = await prisma.journalEntry.create({
				data: {
					associationId: association.id,
					entryNumber,
					entryDate: new Date(input.entryDate),
					description: input.description,
					memo: input.memo,
					createdBy: context.user!.id,
					status: 'DRAFT',
					lines: {
						create: input.lines.map((line, index) => ({
							accountId: line.accountId,
							debitAmount: line.debitAmount,
							creditAmount: line.creditAmount,
							description: line.description,
							referenceType: line.referenceType,
							referenceId: line.referenceId,
							lineNumber: index + 1
						}))
					}
				},
				include: { lines: true }
			});

			return successResponse(
				{
					journalEntry: {
						id: journalEntry.id,
						entryNumber: journalEntry.entryNumber,
						entryDate: journalEntry.entryDate.toISOString(),
						description: journalEntry.description,
						status: journalEntry.status,
						totalDebits: totalDebits.toFixed(2),
						totalCredits: totalCredits.toFixed(2)
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
				status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'POSTED', 'REVERSED']).optional(),
				fromDate: z.string().datetime().optional(),
				toDate: z.string().datetime().optional()
			}).optional()
		)
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'journal_entry', '*');

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('view', 'journal_entry', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
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
				throw ApiException.notFound('Journal Entry');
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
		.input(z.object({ id: z.string() }))
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('post', 'journal_entry', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const entry = await prisma.journalEntry.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { lines: true }
			});

			if (!entry) {
				throw ApiException.notFound('Journal Entry');
			}

			if (entry.status !== 'DRAFT' && entry.status !== 'PENDING_APPROVAL') {
				throw ApiException.conflict(`Cannot post entry with status: ${entry.status}`);
			}

			// Update GL account balances
			await prisma.$transaction(async (tx) => {
				for (const line of entry.lines) {
					const account = await tx.gLAccount.findUnique({
						where: { id: line.accountId }
					});

					if (account) {
						const debit = Number(line.debitAmount || 0);
						const credit = Number(line.creditAmount || 0);
						// For normal debit accounts: debits increase, credits decrease
						// For normal credit accounts: credits increase, debits decrease
						const change = account.normalDebit ? debit - credit : credit - debit;

						await tx.gLAccount.update({
							where: { id: line.accountId },
							data: {
								currentBalance: { increment: change }
							}
						});
					}
				}

				await tx.journalEntry.update({
					where: { id: input.id },
					data: {
						status: 'POSTED',
						postedAt: new Date(),
						approvedBy: context.user!.id,
						approvedAt: new Date()
					}
				});
			});

			return successResponse(
				{
					journalEntry: {
						id: entry.id,
						status: 'POSTED',
						postedAt: new Date().toISOString()
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
				id: z.string(),
				reversalDate: z.string().datetime()
			})
		)
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
		.handler(async ({ input, context }) => {
			await context.cerbos.authorize('reverse', 'journal_entry', input.id);

			const association = await prisma.association.findFirst({
				where: { organizationId: context.organization!.id, deletedAt: null }
			});

			if (!association) {
				throw ApiException.notFound('Association');
			}

			const entry = await prisma.journalEntry.findFirst({
				where: { id: input.id, associationId: association.id },
				include: { lines: true }
			});

			if (!entry) {
				throw ApiException.notFound('Journal Entry');
			}

			if (entry.status !== 'POSTED') {
				throw ApiException.conflict('Can only reverse posted entries');
			}

			// Generate reversal entry number
			const lastEntry = await prisma.journalEntry.findFirst({
				where: { associationId: association.id },
				orderBy: { createdAt: 'desc' }
			});

			const entryNumber = `JE-${String(parseInt(lastEntry!.entryNumber.split('-')[1] || '0') + 1).padStart(6, '0')}`;

			// Create reversal entry with swapped debits/credits
			const reversalEntry = await prisma.$transaction(async (tx) => {
				const reversal = await tx.journalEntry.create({
					data: {
						associationId: association.id,
						entryNumber,
						entryDate: new Date(input.reversalDate),
						description: `Reversal of ${entry.entryNumber}: ${entry.description}`,
						createdBy: context.user!.id,
						status: 'POSTED',
						isReversal: true,
						reversedEntryId: entry.id,
						postedAt: new Date(),
						approvedBy: context.user!.id,
						approvedAt: new Date(),
						lines: {
							create: entry.lines.map((line, index) => ({
								accountId: line.accountId,
								// Swap debits and credits
								debitAmount: line.creditAmount,
								creditAmount: line.debitAmount,
								description: `Reversal: ${line.description || ''}`,
								referenceType: line.referenceType,
								referenceId: line.referenceId,
								lineNumber: index + 1
							}))
						}
					}
				});

				// Update original entry status
				await tx.journalEntry.update({
					where: { id: entry.id },
					data: { status: 'REVERSED' }
				});

				// Update GL balances (reverse the original posting)
				for (const line of entry.lines) {
					const account = await tx.gLAccount.findUnique({
						where: { id: line.accountId }
					});

					if (account) {
						const debit = Number(line.debitAmount || 0);
						const credit = Number(line.creditAmount || 0);
						// Reverse: subtract what was added
						const change = account.normalDebit ? credit - debit : debit - credit;

						await tx.gLAccount.update({
							where: { id: line.accountId },
							data: {
								currentBalance: { increment: change }
							}
						});
					}
				}

				return reversal;
			});

			return successResponse(
				{
					reversalEntry: {
						id: reversalEntry.id,
						entryNumber: reversalEntry.entryNumber
					}
				},
				context
			);
		})
};
