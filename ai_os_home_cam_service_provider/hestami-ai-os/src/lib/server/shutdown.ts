/**
 * Graceful shutdown handler for Bun runtime
 *
 * Handles SIGTERM and SIGINT signals to cleanly shut down:
 * - DBOS workflow engine
 * - Prisma database connections
 * - OpenTelemetry SDK (handled by preload script)
 *
 * This module should be imported early in the application lifecycle.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from './db.js';
import { createModuleLogger } from './logger.js';

const log = createModuleLogger('Shutdown');

// Shutdown timeout in milliseconds (configurable via env)
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);

let isShuttingDown = false;

/**
 * Perform graceful shutdown of all services
 */
async function gracefulShutdown(signal: string): Promise<void> {
	if (isShuttingDown) {
		log.warn('Shutdown already in progress, ignoring signal', { signal });
		return;
	}

	isShuttingDown = true;
	log.info('Graceful shutdown initiated', { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS });

	// Set a hard timeout to force exit if graceful shutdown takes too long
	const forceExitTimeout = setTimeout(() => {
		log.error('Graceful shutdown timeout exceeded, forcing exit');
		process.exit(1);
	}, SHUTDOWN_TIMEOUT_MS);

	try {
		// 1. Stop accepting new requests (handled by Bun/SvelteKit server)
		log.info('Stopping new request acceptance...');

		// 2. Wait for in-flight requests to complete (brief delay)
		await new Promise((resolve) => setTimeout(resolve, 1000));

		// 3. Shutdown DBOS workflow engine
		log.info('Shutting down DBOS workflow engine...');
		try {
			// DBOS.shutdown() gracefully stops the workflow executor
			// Pending workflows will be recovered on next startup
			await DBOS.shutdown();
			log.info('DBOS shutdown complete');
		} catch (error) {
			log.error('DBOS shutdown error', {
				error: error instanceof Error ? error.message : String(error)
			});
		}

		// 4. Disconnect Prisma
		log.info('Disconnecting Prisma...');
		try {
			await prisma.$disconnect();
			log.info('Prisma disconnected');
		} catch (error) {
			log.error('Prisma disconnect error', {
				error: error instanceof Error ? error.message : String(error)
			});
		}

		// 5. Clear the force exit timeout
		clearTimeout(forceExitTimeout);

		log.info('Graceful shutdown complete');
		process.exit(0);
	} catch (error) {
		log.error('Graceful shutdown failed', {
			error: error instanceof Error ? error.message : String(error)
		});
		clearTimeout(forceExitTimeout);
		process.exit(1);
	}
}

/**
 * Register shutdown signal handlers
 * Call this once at application startup
 */
export function registerShutdownHandlers(): void {
	// SIGTERM - sent by Docker/Kubernetes for graceful shutdown
	process.on('SIGTERM', () => {
		gracefulShutdown('SIGTERM');
	});

	// SIGINT - sent by Ctrl+C in development
	process.on('SIGINT', () => {
		gracefulShutdown('SIGINT');
	});

	// Handle uncaught exceptions
	process.on('uncaughtException', (error) => {
		log.error('Uncaught exception', {
			error: error.message,
			stack: error.stack
		});
		gracefulShutdown('uncaughtException');
	});

	// Handle unhandled promise rejections
	process.on('unhandledRejection', (reason, promise) => {
		log.error('Unhandled promise rejection', {
			reason: reason instanceof Error ? reason.message : String(reason),
			promise: String(promise)
		});
		// Don't exit on unhandled rejection, just log it
		// The application can continue running
	});

	log.info('Shutdown handlers registered', { timeoutMs: SHUTDOWN_TIMEOUT_MS });
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
	return isShuttingDown;
}
