/**
 * Initialize Platform Admin Script
 * 
 * This script sets up the initial Hestami Staff organization and platform admin user
 * after a clean database installation or reset.
 * 
 * Usage:
 *   npx tsx scripts/init-platform-admin.ts <email>
 * 
 * Example:
 *   npx tsx scripts/init-platform-admin.ts admin@hestami-ai.com
 * 
 * Prerequisites:
 *   - User must already exist in the database (registered via Better Auth)
 *   - User email should be @hestami-ai.com domain
 * 
 * What this script does:
 *   1. Creates the Hestami Staff organization (PLATFORM_OPERATOR type) if it doesn't exist
 *   2. Looks up the user by email
 *   3. Adds the user to the Hestami Staff organization with ADMIN role
 *   4. Creates a Staff record for the user if it doesn't exist
 */

import { PrismaClient } from '../generated/prisma/client.js';

const HESTAMI_STAFF_ORG_ID = 'hestami-staff-org';
const HESTAMI_STAFF_ORG_NAME = 'Hestami AI';
const HESTAMI_STAFF_ORG_SLUG = 'hestami-ai';

const prisma = new PrismaClient();

async function main() {
	const email = process.argv[2];

	if (!email) {
		console.error('❌ Usage: npx tsx scripts/init-platform-admin.ts <email>');
		console.error('   Example: npx tsx scripts/init-platform-admin.ts admin@hestami-ai.com');
		process.exit(1);
	}

	if (!email.endsWith('@hestami-ai.com')) {
		console.warn('⚠️  Warning: Email does not end with @hestami-ai.com');
		console.warn('   Platform admins should typically use @hestami-ai.com emails.');
		console.warn('   Continuing anyway...\n');
	}

	console.log('🚀 Initializing Platform Admin...\n');

	// Step 1: Create or verify Hestami Staff organization
	console.log('📦 Step 1: Checking Hestami Staff organization...');
	let organization = await prisma.organization.findUnique({
		where: { id: HESTAMI_STAFF_ORG_ID }
	});

	if (!organization) {
		console.log('   Creating Hestami Staff organization...');
		organization = await prisma.organization.create({
			data: {
				id: HESTAMI_STAFF_ORG_ID,
				name: HESTAMI_STAFF_ORG_NAME,
				slug: HESTAMI_STAFF_ORG_SLUG,
				type: 'PLATFORM_OPERATOR',
				status: 'ACTIVE'
			}
		});
		console.log(`   ✅ Created organization: ${organization.name} (${organization.id})`);
	} else {
		console.log(`   ✅ Organization exists: ${organization.name} (${organization.id})`);
	}

	// Step 2: Look up user by email
	console.log(`\n👤 Step 2: Looking up user by email: ${email}`);
	const user = await prisma.user.findUnique({
		where: { email }
	});

	if (!user) {
		console.error(`\n❌ User not found with email: ${email}`);
		console.error('   The user must register first via the web application.');
		console.error('   After registration, run this script again.');
		process.exit(1);
	}
	console.log(`   ✅ Found user: ${user.name || user.email} (${user.id})`);

	// Step 3: Add user to organization
	console.log('\n🔗 Step 3: Adding user to Hestami Staff organization...');
	const existingMembership = await prisma.userOrganization.findFirst({
		where: {
			userId: user.id,
			organizationId: HESTAMI_STAFF_ORG_ID
		}
	});

	if (existingMembership) {
		console.log(`   ✅ User already a member with role: ${existingMembership.role}`);
		
		// Ensure it's set as default
		if (!existingMembership.isDefault) {
			await prisma.userOrganization.update({
				where: { id: existingMembership.id },
				data: { isDefault: true }
			});
			console.log('   ✅ Set as default organization');
		}
	} else {
		// Clear any existing default org for this user
		await prisma.userOrganization.updateMany({
			where: { userId: user.id, isDefault: true },
			data: { isDefault: false }
		});

		await prisma.userOrganization.create({
			data: {
				userId: user.id,
				organizationId: HESTAMI_STAFF_ORG_ID,
				role: 'ADMIN',
				isDefault: true
			}
		});
		console.log('   ✅ Added user to organization with ADMIN role');
	}

	// Step 4: Create Staff record if needed
	console.log('\n👔 Step 4: Checking Staff record...');
	const existingStaff = await prisma.staff.findUnique({
		where: { userId: user.id }
	});

	if (existingStaff) {
		console.log(`   ✅ Staff record exists with status: ${existingStaff.status}`);
		
		// Ensure staff is ACTIVE
		if (existingStaff.status !== 'ACTIVE') {
			await prisma.staff.update({
				where: { id: existingStaff.id },
				data: { status: 'ACTIVE' }
			});
			console.log('   ✅ Updated staff status to ACTIVE');
		}
	} else {
		await prisma.staff.create({
			data: {
				userId: user.id,
				status: 'ACTIVE'
			}
		});
		console.log('   ✅ Created Staff record with ACTIVE status');
	}

	console.log('\n✅ Platform Admin initialization complete!');
	console.log(`\n   User: ${user.name || user.email}`);
	console.log(`   Email: ${user.email}`);
	console.log(`   Organization: ${HESTAMI_STAFF_ORG_NAME}`);
	console.log(`   Role: ADMIN`);
	console.log(`   Staff Status: ACTIVE`);
	console.log('\n   The user can now log in and access the admin dashboard.');
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error('\n❌ Initialization failed:', e);
		await prisma.$disconnect();
		process.exit(1);
	});
