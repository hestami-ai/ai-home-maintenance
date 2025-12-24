import { prisma } from '../db.js';
import {
	defaultChartOfAccounts,
	SystemAccounts,
	type DefaultAccountDefinition
} from './defaultChartOfAccounts.js';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { createModuleLogger } from '../logger.js';

const log = createModuleLogger('GLService');

/**
 * GL Service - Handles chart of accounts initialization and GL posting
 */

/**
 * Seed the default chart of accounts for a new association
 */
export async function seedDefaultChartOfAccounts(associationId: string): Promise<void> {
	// Check if accounts already exist
	const existingCount = await prisma.gLAccount.count({
		where: { associationId }
	});

	if (existingCount > 0) {
		log.info('Association already has GL accounts, skipping seed', { associationId, existingCount });
		return;
	}

	log.info('Seeding default chart of accounts', { associationId });

	// Create accounts in a transaction
	await prisma.$transaction(async (tx) => {
		for (const parentDef of defaultChartOfAccounts) {
			// Create parent account
			const parent = await createAccountFromDefinition(tx, associationId, parentDef, null);

			// Create child accounts
			if (parentDef.children) {
				for (const childDef of parentDef.children) {
					await createAccountFromDefinition(tx, associationId, childDef, parent.id);
				}
			}
		}
	});

	const finalCount = await prisma.gLAccount.count({
		where: { associationId }
	});

	log.info('GL accounts created', { associationId, count: finalCount });
}

async function createAccountFromDefinition(
	tx: Prisma.TransactionClient,
	associationId: string,
	def: Omit<DefaultAccountDefinition, 'children'>,
	parentId: string | null
) {
	// Determine normal balance based on account type
	const normalDebit = ['ASSET', 'EXPENSE'].includes(def.accountType);

	return tx.gLAccount.create({
		data: {
			associationId,
			accountNumber: def.accountNumber,
			name: def.name,
			description: def.description,
			accountType: def.accountType,
			category: def.category,
			fundType: def.fundType,
			parentId,
			isSystemAccount: def.isSystemAccount,
			normalDebit,
			isActive: true
		}
	});
}

/**
 * Get a system account by its well-known account number
 */
export async function getSystemAccount(
	associationId: string,
	accountNumber: string
): Promise<{ id: string; accountNumber: string; name: string } | null> {
	return prisma.gLAccount.findUnique({
		where: {
			associationId_accountNumber: {
				associationId,
				accountNumber
			}
		},
		select: { id: true, accountNumber: true, name: true }
	});
}

/**
 * Generate the next journal entry number for an association
 */
export async function getNextJournalEntryNumber(associationId: string): Promise<string> {
	const lastEntry = await prisma.journalEntry.findFirst({
		where: { associationId },
		orderBy: { createdAt: 'desc' },
		select: { entryNumber: true }
	});

	if (!lastEntry) {
		return 'JE-000001';
	}

	const lastNum = parseInt(lastEntry.entryNumber.split('-')[1] || '0', 10);
	return `JE-${String(lastNum + 1).padStart(6, '0')}`;
}

/**
 * Create and post a journal entry for an assessment charge
 */
export async function postAssessmentChargeToGL(
	chargeId: string,
	userId: string
): Promise<string> {
	const charge = await prisma.assessmentCharge.findUnique({
		where: { id: chargeId },
		include: {
			assessmentType: true,
			unit: {
				include: {
					property: {
						include: { association: true }
					}
				}
			}
		}
	});

	if (!charge) {
		throw new Error(`Charge ${chargeId} not found`);
	}

	if (charge.journalEntryId) {
		throw new Error(`Charge ${chargeId} already posted to GL`);
	}

	const associationId = charge.unit.property.association.id;

	// Get the AR and Revenue accounts
	const arAccount = await getSystemAccount(associationId, SystemAccounts.AR_ASSESSMENTS);
	const revenueAccountId = charge.assessmentType.revenueAccountId;

	if (!arAccount) {
		throw new Error('AR Assessments account not found - run chart of accounts seed');
	}

	const entryNumber = await getNextJournalEntryNumber(associationId);
	const amount = Number(charge.totalAmount);

	// Create journal entry: Debit AR, Credit Revenue
	const journalEntry = await prisma.$transaction(async (tx) => {
		const entry = await tx.journalEntry.create({
			data: {
				associationId,
				entryNumber,
				entryDate: charge.chargeDate,
				description: `Assessment charge: ${charge.assessmentType.name} - Unit ${charge.unit.unitNumber}`,
				createdBy: userId,
				status: 'POSTED',
				postedAt: new Date(),
				sourceType: 'ASSESSMENT_CHARGE',
				sourceId: chargeId,
				lines: {
					create: [
						{
							accountId: arAccount.id,
							debitAmount: amount,
							creditAmount: null,
							description: `Unit ${charge.unit.unitNumber}`,
							referenceType: 'UNIT',
							referenceId: charge.unitId,
							lineNumber: 1
						},
						{
							accountId: revenueAccountId,
							debitAmount: null,
							creditAmount: amount,
							description: charge.assessmentType.name,
							referenceType: 'ASSESSMENT_TYPE',
							referenceId: charge.assessmentTypeId,
							lineNumber: 2
						}
					]
				}
			}
		});

		// Update GL account balances
		await tx.gLAccount.update({
			where: { id: arAccount.id },
			data: { currentBalance: { increment: amount } } // Debit increases AR
		});

		await tx.gLAccount.update({
			where: { id: revenueAccountId },
			data: { currentBalance: { increment: amount } } // Credit increases Revenue
		});

		// Link charge to journal entry
		await tx.assessmentCharge.update({
			where: { id: chargeId },
			data: { journalEntryId: entry.id }
		});

		return entry;
	});

	return journalEntry.id;
}

/**
 * Create and post a journal entry for a payment
 */
export async function postPaymentToGL(
	paymentId: string,
	userId: string
): Promise<string> {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: {
			unit: {
				include: {
					property: {
						include: { association: true }
					}
				}
			},
			bankAccount: true
		}
	});

	if (!payment) {
		throw new Error(`Payment ${paymentId} not found`);
	}

	if (payment.journalEntryId) {
		throw new Error(`Payment ${paymentId} already posted to GL`);
	}

	const associationId = payment.unit.property.association.id;

	// Get the Cash and AR accounts
	const cashAccountNumber = payment.bankAccount?.fundType === 'RESERVE'
		? SystemAccounts.RESERVE_CASH
		: SystemAccounts.OPERATING_CASH;

	const cashAccount = await getSystemAccount(associationId, cashAccountNumber);
	const arAccount = await getSystemAccount(associationId, SystemAccounts.AR_ASSESSMENTS);

	if (!cashAccount || !arAccount) {
		throw new Error('Required GL accounts not found - run chart of accounts seed');
	}

	const entryNumber = await getNextJournalEntryNumber(associationId);
	const amount = Number(payment.amount);

	// Create journal entry: Debit Cash, Credit AR
	const journalEntry = await prisma.$transaction(async (tx) => {
		const entry = await tx.journalEntry.create({
			data: {
				associationId,
				entryNumber,
				entryDate: payment.paymentDate,
				description: `Payment received - Unit ${payment.unit.unitNumber}`,
				memo: payment.memo,
				createdBy: userId,
				status: 'POSTED',
				postedAt: new Date(),
				sourceType: 'PAYMENT',
				sourceId: paymentId,
				lines: {
					create: [
						{
							accountId: cashAccount.id,
							debitAmount: amount,
							creditAmount: null,
							description: `${payment.paymentMethod} - ${payment.referenceNumber || 'N/A'}`,
							referenceType: 'UNIT',
							referenceId: payment.unitId,
							lineNumber: 1
						},
						{
							accountId: arAccount.id,
							debitAmount: null,
							creditAmount: amount,
							description: `Unit ${payment.unit.unitNumber}`,
							referenceType: 'UNIT',
							referenceId: payment.unitId,
							lineNumber: 2
						}
					]
				}
			}
		});

		// Update GL account balances
		await tx.gLAccount.update({
			where: { id: cashAccount.id },
			data: { currentBalance: { increment: amount } } // Debit increases Cash
		});

		await tx.gLAccount.update({
			where: { id: arAccount.id },
			data: { currentBalance: { decrement: amount } } // Credit decreases AR
		});

		// Link payment to journal entry
		await tx.payment.update({
			where: { id: paymentId },
			data: { journalEntryId: entry.id }
		});

		return entry;
	});

	return journalEntry.id;
}

/**
 * Reverse a payment's GL posting (for voided payments)
 */
export async function reversePaymentGL(
	paymentId: string,
	userId: string
): Promise<string | null> {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: {
			unit: {
				include: {
					property: {
						include: { association: true }
					}
				}
			}
		}
	});

	if (!payment || !payment.journalEntryId) {
		return null; // No GL entry to reverse
	}

	const associationId = payment.unit.property.association.id;

	// Get the original journal entry
	const originalEntry = await prisma.journalEntry.findUnique({
		where: { id: payment.journalEntryId },
		include: { lines: true }
	});

	if (!originalEntry || originalEntry.status === 'REVERSED') {
		return null;
	}

	const entryNumber = await getNextJournalEntryNumber(associationId);

	// Create reversal entry
	const reversalEntry = await prisma.$transaction(async (tx) => {
		const reversal = await tx.journalEntry.create({
			data: {
				associationId,
				entryNumber,
				entryDate: new Date(),
				description: `Reversal: ${originalEntry.description}`,
				createdBy: userId,
				status: 'POSTED',
				postedAt: new Date(),
				isReversal: true,
				reversedEntryId: originalEntry.id,
				sourceType: 'PAYMENT_VOID',
				sourceId: paymentId,
				lines: {
					create: originalEntry.lines.map((line, index) => ({
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
			where: { id: originalEntry.id },
			data: { status: 'REVERSED' }
		});

		// Reverse GL account balances
		for (const line of originalEntry.lines) {
			const debit = Number(line.debitAmount || 0);
			const credit = Number(line.creditAmount || 0);
			const change = credit - debit; // Reverse the original change

			await tx.gLAccount.update({
				where: { id: line.accountId },
				data: { currentBalance: { increment: change } }
			});
		}

		return reversal;
	});

	return reversalEntry.id;
}
