import { prisma } from '../db.js';

/**
 * Context for RLS operations - includes user info for audit logging
 */
export interface RLSContext {
	userId: string;
	associationId?: string | null;
	isStaff?: boolean;
	reason?: string;
	itemType?: string;
	itemId?: string;
}

/**
 * Sets the current organization context for RLS policies
 * Must be called before any tenant-scoped queries
 * 
 * @param organizationId - The organization ID to set as context
 * @param context - Optional context for audit logging (user ID, reason, etc.)
 */
export async function setOrgContext(
	organizationId: string,
	context?: RLSContext
): Promise<void> {
	if (context?.userId) {
		// Use audited version with logging (supports Phase 30 tiered RLS: Org + Assoc + Staff)
		await prisma.$executeRawUnsafe(
			`SELECT set_org_context_audited($1, $2, $3, $4, $5, $6, $7)`,
			context.userId,
			organizationId,
			context.associationId ?? null,
			context.isStaff ?? false,
			context.reason ?? null,
			context.itemType ?? null,
			context.itemId ?? null
		);
	} else {
		// Simple version without audit (updated to clear association context for safety)
		await prisma.$executeRawUnsafe(`SELECT set_current_org_id($1)`, organizationId);
		await prisma.$executeRawUnsafe(`SELECT set_config('app.current_assoc_id', '', false)`);
	}
}

/**
 * Clears the current organization context
 * 
 * @param userId - Optional user ID for audit logging
 */
export async function clearOrgContext(userId?: string): Promise<void> {
	if (userId) {
		// Use audited version with logging (updated for Phase 30)
		await prisma.$executeRawUnsafe(`SELECT clear_org_context_audited($1)`, userId);
	} else {
		// Simple version without audit
		await prisma.$executeRawUnsafe(`SELECT set_current_org_id(NULL)`);
		await prisma.$executeRawUnsafe(`SELECT set_config('app.current_assoc_id', '', false)`);
	}
}

/**
 * Gets the current organization ID from the session context
 */
export async function getCurrentOrgId(): Promise<string | null> {
	const result = await prisma.$queryRaw<[{ current_org_id: string | null }]>`SELECT current_org_id()`;
	return result[0]?.current_org_id ?? null;
}

/**
 * Gets the current association ID from the session context
 */
export async function getCurrentAssocId(): Promise<string | null> {
	const result = await prisma.$queryRaw<[{ current_assoc_id: string | null }]>`SELECT current_assoc_id()`;
	return result[0]?.current_assoc_id ?? null;
}

/**
 * Executes a callback within an organization context
 * Automatically sets and clears the RLS context
 * 
 * @param organizationId - The organization ID to set as context
 * @param callback - The async function to execute within the context
 * @param context - Optional context for audit logging
 */
export async function withOrgContext<T>(
	organizationId: string,
	callback: () => Promise<T>,
	context?: RLSContext
): Promise<T> {
	await setOrgContext(organizationId, context);
	try {
		return await callback();
	} finally {
		await clearOrgContext(context?.userId);
	}
}

/**
 * Creates a Prisma transaction with organization context set
 * 
 * @param organizationId - The organization ID to set as context
 * @param callback - The async function to execute within the transaction
 * @param context - Optional context for audit logging
 */
export async function orgTransaction<T>(
	organizationId: string,
	callback: (tx: typeof prisma) => Promise<T>,
	context?: RLSContext
): Promise<T> {
	return prisma.$transaction(async (tx) => {
		if (context?.userId) {
			await tx.$executeRawUnsafe(
				`SELECT set_org_context_audited($1, $2, $3, $4, $5, $6, $7)`,
				context.userId,
				organizationId,
				context.associationId ?? null,
				context.isStaff ?? false,
				context.reason ?? null,
				context.itemType ?? null,
				context.itemId ?? null
			);
		} else {
			await tx.$executeRawUnsafe(`SELECT set_current_org_id($1)`, organizationId);
			await tx.$executeRawUnsafe(`SELECT set_config('app.current_assoc_id', '', false)`);
		}
		return callback(tx as typeof prisma);
	});
}

/**
 * Looks up the organization ID for a work queue item
 * This uses a view without RLS to allow staff to determine context
 * 
 * @param itemType - The type of work item (CONCIERGE_CASE, WORK_ORDER, etc.)
 * @param itemId - The ID of the work item
 * @returns The organization ID or null if not found
 */
export async function lookupWorkItemOrgId(
	itemType: string,
	itemId: string
): Promise<string | null> {
	const result = await prisma.$queryRaw<[{ organization_id: string }]>`
		SELECT organization_id 
		FROM staff_work_queue_org_lookup 
		WHERE item_type = ${itemType} AND item_id = ${itemId}
		LIMIT 1
	`;
	return result[0]?.organization_id ?? null;
}

/**
 * Sets organization context for a work queue item with full audit trail
 * This is the recommended way for staff to access work items
 * 
 * @param userId - The staff user's ID
 * @param itemType - The type of work item (CONCIERGE_CASE, WORK_ORDER, etc.)
 * @param itemId - The ID of the work item
 * @returns The organization ID that was set, or null if item not found
 */
export async function setOrgContextForWorkItem(
	userId: string,
	itemType: string,
	itemId: string
): Promise<string | null> {
	// Look up the org ID for this work item
	const orgId = await lookupWorkItemOrgId(itemType, itemId);

	if (!orgId) {
		return null;
	}

	// Set context with full audit trail
	await setOrgContext(orgId, {
		userId,
		reason: `Accessing ${itemType}`,
		itemType,
		itemId
	});

	return orgId;
}
