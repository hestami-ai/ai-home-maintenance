import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isShutdownInProgress } from '$server/shutdown';
import { createModuleLogger } from '$server/logger';

const log = createModuleLogger('LivenessProbe');

/**
 * Liveness probe endpoint
 * 
 * Returns 200 OK if the application process is running and can handle requests.
 * This is a lightweight check - it does NOT verify database connectivity.
 * 
 * Use /api/ready for readiness checks that include dependency health.
 * 
 * Docker HEALTHCHECK and Traefik use this endpoint.
 */
export const GET: RequestHandler = async () => {
	// If shutdown is in progress, return unhealthy to stop new traffic
	if (isShutdownInProgress()) {
		log.warn('Liveness check failed: shutdown in progress');
		return json(
			{
				status: 'unhealthy',
				reason: 'shutdown_in_progress',
				timestamp: new Date().toISOString()
			},
			{ status: 503 }
		);
	}

	return json({
		status: 'healthy',
		timestamp: new Date().toISOString(),
		version: process.env.npm_package_version || '0.0.1',
		runtime: 'bun'
	});
};
