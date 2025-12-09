import { prisma } from '../db.js';

/**
 * Sets the current organization context for RLS policies
 * Must be called before any tenant-scoped queries
 */
export async function setOrgContext(organizationId: string): Promise<void> {
	await prisma.$executeRawUnsafe(`SELECT set_current_org_id($1)`, organizationId);
}

/**
 * Clears the current organization context
 */
export async function clearOrgContext(): Promise<void> {
	await prisma.$executeRawUnsafe(`SELECT set_current_org_id(NULL)`);
}

/**
 * Executes a callback within an organization context
 * Automatically sets and clears the RLS context
 */
export async function withOrgContext<T>(
	organizationId: string,
	callback: () => Promise<T>
): Promise<T> {
	await setOrgContext(organizationId);
	try {
		return await callback();
	} finally {
		await clearOrgContext();
	}
}

/**
 * Creates a Prisma transaction with organization context set
 */
export async function orgTransaction<T>(
	organizationId: string,
	callback: (tx: typeof prisma) => Promise<T>
): Promise<T> {
	return prisma.$transaction(async (tx) => {
		await tx.$executeRawUnsafe(`SELECT set_current_org_id($1)`, organizationId);
		return callback(tx as typeof prisma);
	});
}
