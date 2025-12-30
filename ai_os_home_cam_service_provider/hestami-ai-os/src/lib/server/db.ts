import { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
	prismaAdmin: PrismaClient | undefined;
};

/**
 * Create the regular Prisma client (RLS-enabled user)
 * This client is used for all normal application queries.
 * RLS policies will filter data based on app.organization_id session variable.
 */
function createPrismaClient() {
	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
	return new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
	});
}

/**
 * Create the admin Prisma client (bypasses RLS)
 * This client uses a superuser/admin connection that bypasses RLS policies.
 * Use ONLY for:
 * - Database migrations
 * - Seeding operations
 * - Cross-organization admin tasks
 * - Background jobs that need to access all data
 */
function createPrismaAdminClient() {
	const adminUrl = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;
	const adapter = new PrismaPg({ connectionString: adminUrl });
	return new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
	});
}

// Regular client - subject to RLS policies
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Admin client - bypasses RLS (use sparingly)
export const prismaAdmin = globalForPrisma.prismaAdmin ?? createPrismaAdminClient();

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
	globalForPrisma.prismaAdmin = prismaAdmin;
}
