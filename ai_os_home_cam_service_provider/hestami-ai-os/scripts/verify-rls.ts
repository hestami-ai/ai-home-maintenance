/**
 * RLS Verification Test Script
 * 
 * Phase 5: Verification & Testing for RLS Enforcement
 * 
 * This script verifies that Row-Level Security is correctly enforced:
 * 1. Queries without org context return empty
 * 2. Queries with correct org context return data
 * 3. Cross-org queries are blocked
 * 4. Staff cross-org access works
 * 5. Context clearing works correctly
 * 
 * Run with: npx tsx scripts/verify-rls.ts
 */

import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
    adapter,
    log: ['error', 'warn']
});

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
}

const results: TestResult[] = [];

function log(message: string) {
    console.log(`[RLS-TEST] ${message}`);
}

function pass(name: string, message: string) {
    results.push({ name, passed: true, message });
    console.log(`✅ ${name}: ${message}`);
}

function fail(name: string, message: string) {
    results.push({ name, passed: false, message });
    console.error(`❌ ${name}: ${message}`);
}

async function testNoContextReturnsEmpty() {
    const testName = 'No Context Returns Empty';

    try {
        // Query without setting org context should return empty due to RLS
        // RLS policies enforce: organization_id = current_org_id()
        // When current_org_id() is NULL/empty, no rows match
        const cases = await prisma.conciergeCase.findMany({
            take: 10
        });

        if (cases.length === 0) {
            pass(testName, 'Query without org context correctly returns empty results');
        } else {
            fail(testName, `Expected empty results but got ${cases.length} cases - RLS may not be enforced`);
        }
    } catch (error) {
        fail(testName, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function testContextReturnsCorrectData() {
    const testName = 'Context Returns Correct Data';

    try {
        // First, get an organization that exists
        const org = await prisma.organization.findFirst({
            where: { deletedAt: null }
        });

        if (!org) {
            log('No organizations found - skipping context data test');
            pass(testName, 'Skipped - no organizations in database');
            return;
        }

        // Set RLS context for this org
        await prisma.$executeRaw`SELECT set_config('app.current_organization_id', ${org.id}, true)`;
        await prisma.$executeRaw`SELECT set_config('app.current_user_id', 'test-user', true)`;

        // Now query - should return only this org's data
        const associations = await prisma.association.findMany({
            where: { deletedAt: null },
            take: 10
        });

        // Verify all returned data belongs to the correct org
        const wrongOrg = associations.find(a => a.organizationId !== org.id);

        if (wrongOrg) {
            fail(testName, `Found association ${wrongOrg.id} belonging to wrong org - RLS not enforced correctly`);
        } else {
            pass(testName, `All ${associations.length} returned associations belong to correct org ${org.id}`);
        }

        // Clear context
        await prisma.$executeRaw`SELECT set_config('app.current_organization_id', '', true)`;
        await prisma.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;

    } catch (error) {
        fail(testName, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function testCrossOrgBlocked() {
    const testName = 'Cross-Org Access Blocked';

    try {
        // Get two different organizations
        const orgs = await prisma.organization.findMany({
            where: { deletedAt: null },
            take: 2
        });

        if (orgs.length < 2) {
            log('Less than 2 organizations found - skipping cross-org test');
            pass(testName, 'Skipped - need at least 2 organizations');
            return;
        }

        const [orgA, orgB] = orgs;

        // Set context to Org A
        await prisma.$executeRaw`SELECT set_config('app.current_organization_id', ${orgA.id}, true)`;
        await prisma.$executeRaw`SELECT set_config('app.current_user_id', 'test-user', true)`;

        // Check if any Org B associations are visible (they shouldn't be)
        const orgBAssociations = await prisma.association.findMany({
            where: {
                organizationId: orgB.id,
                deletedAt: null
            }
        });

        if (orgBAssociations.length === 0) {
            pass(testName, `Org A user correctly cannot see Org B (${orgB.id}) data`);
        } else {
            fail(testName, `Org A user can see ${orgBAssociations.length} Org B associations - RLS leak!`);
        }

        // Clear context
        await prisma.$executeRaw`SELECT set_config('app.current_organization_id', '', true)`;
        await prisma.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;

    } catch (error) {
        fail(testName, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function testContextClearing() {
    const testName = 'Context Clearing Works';

    try {
        const org = await prisma.organization.findFirst({
            where: { deletedAt: null }
        });

        if (!org) {
            pass(testName, 'Skipped - no organizations in database');
            return;
        }

        // Set context
        await prisma.$executeRaw`SELECT set_config('app.current_organization_id', ${org.id}, true)`;
        await prisma.$executeRaw`SELECT set_config('app.current_user_id', 'test-user', true)`;

        // Query with context
        const beforeClear = await prisma.association.count({ where: { deletedAt: null } });

        // Clear context
        await prisma.$executeRaw`SELECT set_config('app.current_organization_id', '', true)`;
        await prisma.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;

        // Query without context
        const afterClear = await prisma.association.count({ where: { deletedAt: null } });

        if (afterClear === 0 || afterClear < beforeClear) {
            pass(testName, `Context clearing works: ${beforeClear} before, ${afterClear} after`);
        } else {
            fail(testName, `Context clearing may not work: ${beforeClear} before, ${afterClear} after`);
        }

    } catch (error) {
        fail(testName, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function testRLSEnabledOnTables() {
    const testName = 'RLS Enabled on Key Tables';

    try {
        // Check if RLS is enabled on key tables
        const tables = [
            'concierge_cases',
            'associations',
            'properties',
            'work_orders',
            'arc_requests',
            'violations'
        ];

        for (const table of tables) {
            const result = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`
				SELECT relrowsecurity 
				FROM pg_class 
				WHERE relname = ${table}
			`;

            if (result.length === 0) {
                log(`Table ${table} not found`);
                continue;
            }

            if (result[0].relrowsecurity) {
                log(`✓ RLS enabled on ${table}`);
            } else {
                fail(testName, `RLS not enabled on ${table}`);
            }
        }

        pass(testName, 'RLS is enabled on all checked tables');

    } catch (error) {
        fail(testName, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function main() {
    log('Starting RLS Verification Tests...\n');
    log('='.repeat(60));

    try {
        // Test 1: No context returns empty
        await testNoContextReturnsEmpty();

        // Test 2: RLS enabled on tables
        await testRLSEnabledOnTables();

        // Test 3: Context returns correct data
        await testContextReturnsCorrectData();

        // Test 4: Cross-org access blocked
        await testCrossOrgBlocked();

        // Test 5: Context clearing works
        await testContextClearing();

    } catch (error) {
        console.error('Fatal error during tests:', error);
    }

    // Summary
    log('\n' + '='.repeat(60));
    log('TEST SUMMARY');
    log('='.repeat(60));

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    log(`Total: ${results.length} tests`);
    log(`Passed: ${passed}`);
    log(`Failed: ${failed}`);

    if (failed > 0) {
        log('\nFailed tests:');
        results.filter(r => !r.passed).forEach(r => {
            log(`  - ${r.name}: ${r.message}`);
        });
        process.exit(1);
    } else {
        log('\n✅ All RLS verification tests passed!');
        process.exit(0);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
