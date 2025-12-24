import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

async function main() {
	console.log('🌱 Starting database seed...');

	// Seed data will be added as models are created
	// Example structure:
	// await seedOrganizations(prisma);
	// await seedUsers(prisma);
	// await seedAssociations(prisma);

	console.log('✅ Database seed completed.');
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error('❌ Seed failed:', e);
		await prisma.$disconnect();
		process.exit(1);
	});
