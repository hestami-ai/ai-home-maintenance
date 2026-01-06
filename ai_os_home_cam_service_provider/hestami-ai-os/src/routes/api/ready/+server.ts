import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$server/db';
import { isShutdownInProgress } from '$server/shutdown';
import { createModuleLogger } from '$server/logger';

const log = createModuleLogger('ReadinessProbe');

// Control verbose readiness probe logging via env var (noisy every 10s)
const LOG_READINESS_PROBE = process.env.LOG_READINESS_PROBE === 'true';

/**
 * Readiness probe endpoint
 *
 * Returns 200 OK only if the application is fully ready to serve traffic:
 * - Application process is running
 * - Database connection is healthy
 * - DBOS workflow engine is initialized
 *
 * Traefik uses this endpoint to determine if the container should receive traffic.
 * Containers that fail readiness checks are removed from the load balancer rotation.
 */
export const GET: RequestHandler = async () => {
	const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; error?: string }> = {};
	const startTime = Date.now();

	// Check 1: Shutdown status
	if (isShutdownInProgress()) {
		log.warn('Readiness check failed: shutdown in progress');
		return json(
			{
				status: 'not_ready',
				reason: 'shutdown_in_progress',
				timestamp: new Date().toISOString(),
				checks: {}
			},
			{ status: 503 }
		);
	}

	// Check 2: Database connectivity
	const dbStart = Date.now();
	try {
		await prisma.$queryRaw`SELECT 1`;
		const dbLatency = Date.now() - dbStart;
		checks.database = {
			status: 'ok',
			latencyMs: dbLatency
		};
		if (LOG_READINESS_PROBE) {
			log.debug('Database health check passed', { latencyMs: dbLatency });
		}
	} catch (error) {
		const dbLatency = Date.now() - dbStart;
		const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
		checks.database = {
			status: 'error',
			latencyMs: dbLatency,
			error: errorMessage
		};
		log.error('Database health check failed', { latencyMs: dbLatency, error: errorMessage });
	}

	// Check 3: DBOS status (check if system database is accessible)
	const dbosStart = Date.now();
	try {
		const dbosSystemUrl = process.env.DBOS_SYSTEM_DATABASE_URL;
		if (dbosSystemUrl) {
			const dbosLatency = Date.now() - dbosStart;
			checks.dbos = {
				status: 'ok',
				latencyMs: dbosLatency
			};
			if (LOG_READINESS_PROBE) {
				log.debug('DBOS health check passed', { latencyMs: dbosLatency });
			}
		} else {
			const dbosLatency = Date.now() - dbosStart;
			checks.dbos = {
				status: 'error',
				latencyMs: dbosLatency,
				error: 'DBOS_SYSTEM_DATABASE_URL not configured'
			};
			log.warn('DBOS health check failed: DBOS_SYSTEM_DATABASE_URL not configured');
		}
	} catch (error) {
		const dbosLatency = Date.now() - dbosStart;
		const errorMessage = error instanceof Error ? error.message : 'Unknown DBOS error';
		checks.dbos = {
			status: 'error',
			latencyMs: dbosLatency,
			error: errorMessage
		};
		log.error('DBOS health check failed', { latencyMs: dbosLatency, error: errorMessage });
	}

	// Determine overall readiness
	const allChecksOk = Object.values(checks).every((check) => check.status === 'ok');
	const totalLatencyMs = Date.now() - startTime;

	if (allChecksOk) {
		if (LOG_READINESS_PROBE) {
			log.debug('Readiness probe passed', { latencyMs: totalLatencyMs, checks });
		}
		return json({
			status: 'ready',
			timestamp: new Date().toISOString(),
			latencyMs: totalLatencyMs,
			checks
		});
	} else {
		log.warn('Readiness probe failed', { latencyMs: totalLatencyMs, checks });
		return json(
			{
				status: 'not_ready',
				timestamp: new Date().toISOString(),
				latencyMs: totalLatencyMs,
				checks
			},
			{ status: 503 }
		);
	}
};
