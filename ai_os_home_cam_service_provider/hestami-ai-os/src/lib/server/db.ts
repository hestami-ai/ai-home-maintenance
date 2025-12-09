import { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

function createPrismaClient() {
	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
	return new PrismaClient({
		adapter,
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
	});
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}
