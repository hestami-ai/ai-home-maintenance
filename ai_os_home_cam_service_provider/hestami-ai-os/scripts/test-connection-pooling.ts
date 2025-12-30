/**
 * Test script to verify Prisma connection pooling behavior with RLS context
 * Run with: npx tsx scripts/test-connection-pooling.ts
 */

import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Use localhost for running outside Docker
const connectionString = 'postgresql://<user>:<password>>g@localhost:5432/<database_name>';

// Create a pool with multiple connections to simulate real-world behavior
const pool = new pg.Pool({ 
	connectionString,
	min: 2,
	max: 5
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testConnectionPooling() {
	console.log('\n=== Testing Prisma Connection Pooling with RLS Context ===\n');

	try {
		// Test 1: Check if consecutive raw queries use the same connection
		console.log('--- Test 1: Consecutive raw queries ---');
		const pid1 = await prisma.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
		const pid2 = await prisma.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
		const pid3 = await prisma.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
		
		console.log('PID 1:', pid1[0].pid);
		console.log('PID 2:', pid2[0].pid);
		console.log('PID 3:', pid3[0].pid);
		console.log('All same connection?', pid1[0].pid === pid2[0].pid && pid2[0].pid === pid3[0].pid);

		// Test 2: Set context and check if it persists across queries
		console.log('\n--- Test 2: Context persistence across queries ---');
		
		// Set context
		await prisma.$executeRawUnsafe(`SELECT set_current_org_id($1)`, 'test-org-12345');
		const pidAfterSet = await prisma.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
		console.log('PID after setting context:', pidAfterSet[0].pid);
		
		// Check context immediately
		const context1 = await prisma.$queryRaw<[{ org_id: string | null }]>`SELECT current_setting('app.current_org_id', true) as org_id`;
		const pidAfterCheck1 = await prisma.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
		console.log('Context check 1:', context1[0].org_id, '| PID:', pidAfterCheck1[0].pid);
		
		// Do a regular Prisma query
		await prisma.organization.findFirst();
		const pidAfterFind = await prisma.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
		console.log('PID after findFirst:', pidAfterFind[0].pid);
		
		// Check context again
		const context2 = await prisma.$queryRaw<[{ org_id: string | null }]>`SELECT current_setting('app.current_org_id', true) as org_id`;
		const pidAfterCheck2 = await prisma.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
		console.log('Context check 2:', context2[0].org_id, '| PID:', pidAfterCheck2[0].pid);

		// Test 3: Context within a transaction
		console.log('\n--- Test 3: Context within transaction ---');
		
		await prisma.$transaction(async (tx) => {
			const txPid1 = await tx.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
			console.log('Transaction PID 1:', txPid1[0].pid);
			
			await tx.$executeRawUnsafe(`SELECT set_current_org_id($1)`, 'tx-org-67890');
			
			const txContext = await tx.$queryRaw<[{ org_id: string | null }]>`SELECT current_setting('app.current_org_id', true) as org_id`;
			const txPid2 = await tx.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
			console.log('Transaction context:', txContext[0].org_id, '| PID:', txPid2[0].pid);
			
			// Do a query within transaction
			await tx.organization.findFirst();
			
			const txPid3 = await tx.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
			const txContext2 = await tx.$queryRaw<[{ org_id: string | null }]>`SELECT current_setting('app.current_org_id', true) as org_id`;
			console.log('After findFirst in tx - context:', txContext2[0].org_id, '| PID:', txPid3[0].pid);
			
			console.log('All transaction PIDs same?', txPid1[0].pid === txPid2[0].pid && txPid2[0].pid === txPid3[0].pid);
		});

		// Test 4: Check context after transaction ends
		console.log('\n--- Test 4: Context after transaction ends ---');
		const contextAfterTx = await prisma.$queryRaw<[{ org_id: string | null }]>`SELECT current_setting('app.current_org_id', true) as org_id`;
		const pidAfterTx = await prisma.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() as pid`;
		console.log('Context after transaction:', contextAfterTx[0].org_id, '| PID:', pidAfterTx[0].pid);

		console.log('\n=== Test Complete ===\n');

	} catch (error) {
		console.error('Test failed:', error);
	} finally {
		await prisma.$disconnect();
		await pool.end();
	}
}

testConnectionPooling();
