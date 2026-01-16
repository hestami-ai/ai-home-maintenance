import { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from '../../../generated/prisma/client.js';
import { trace } from '@opentelemetry/api';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createModuleLogger } from './logger.js';

const log = createModuleLogger('PrismaRLS');

/**
 * RLS Context for organization-scoped queries
 */
export interface RLSContext {
	organizationId: string;
	userId?: string;
	associationId?: string | null;
	isStaff?: boolean;
}

/**
 * Build Prisma log configuration based on environment variables
 * - PRISMA_LOG_QUERIES=true: Enable query logging (verbose, use for debugging)
 * - NODE_ENV=development: Enable warn level by default
 * - Always log errors
 */
function getPrismaLogConfig(): Prisma.LogLevel[] {
	const logs: Prisma.LogLevel[] = ['error'];
	
	if (process.env.PRISMA_LOG_QUERIES === 'true') {
		logs.push('query');
	}
	
	if (process.env.NODE_ENV === 'development') {
		logs.push('warn');
	}
	
	return logs;
}

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
	prismaAdmin: PrismaClient | undefined;
};

/**
 * Add OpenTelemetry tracing to Prisma client
 * Records db.operation, db.table, and db.duration_ms on the active span
 */
function withTracing<T extends PrismaClient>(client: T): T {
	return client.$extends({
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }) {
					const startTime = performance.now();
					const span = trace.getActiveSpan();

					// Add attributes to the active span (don't create a child span to reduce noise)
					if (span) {
						span.setAttribute('db.system', 'postgresql');
						span.setAttribute('db.operation', operation);
						if (model) {
							span.setAttribute('db.table', model);
						}
					}

					try {
						const result = await query(args);
						const durationMs = performance.now() - startTime;

						if (span) {
							span.setAttribute('db.duration_ms', Math.round(durationMs * 100) / 100);
						}

						return result;
					} catch (error) {
						const durationMs = performance.now() - startTime;

						if (span) {
							span.setAttribute('db.duration_ms', Math.round(durationMs * 100) / 100);
							span.setAttribute('db.error', true);
							if (error instanceof Error) {
								span.setAttribute('db.error_message', error.message);
							}
						}

						throw error;
					}
				}
			}
		}
	}) as T;
}

/**
 * Thread-local storage for RLS context
 * Uses AsyncLocalStorage to propagate context across async boundaries
 */
interface RLSContextWithFlag extends RLSContext {
	_inTransaction?: boolean;
}
const rlsContextStorage = new AsyncLocalStorage<RLSContextWithFlag>();

/**
 * Get the current RLS context from async local storage
 */
export function getCurrentRLSContext(): RLSContext | undefined {
	return rlsContextStorage.getStore();
}

/**
 * Run a callback with RLS context available
 * All Prisma queries within the callback will automatically have RLS context set
 */
export function withRLSContext<T>(context: RLSContext, callback: () => T): T {
	return rlsContextStorage.run(context, callback);
}

/**
 * Add RLS context injection to Prisma client
 * Wraps all queries in a transaction that sets the org context first
 * This ensures the SET command and query run on the same database connection
 *
 * Defense in depth:
 * 1. When RLS context exists: Set context, run query, clear context
 * 2. When no RLS context: Clear any stale context before running query
 *
 * This prevents connection pool contamination where a connection with stale
 * org context from a previous request could leak data to a different org.
 */
function withRLSInjection<T extends PrismaClient>(client: T): T {
	return client.$extends({
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }) {
					const rlsContext = rlsContextStorage.getStore();

					log.debug('withRLSInjection called', {
						model,
						operation,
						hasRlsContext: !!rlsContext,
						inTransaction: rlsContext?._inTransaction,
						orgId: rlsContext?.organizationId,
						userId: rlsContext?.userId
					});

					// If we're already inside a transaction with RLS context set, just run the query
					// This prevents infinite recursion when the transaction calls back into the extension
					if (rlsContext?._inTransaction) {
						log.debug('Already in transaction, running query directly');
						return query(args);
					}

					// Wrap the query in an interactive transaction to ensure
					// context management and query run on the same connection
					return client.$transaction(
						async (tx) => {
							if (rlsContext) {
								// Set the RLS context for authenticated org-scoped queries
								if (rlsContext.userId) {
									log.debug('Setting audited org context', {
										userId: rlsContext.userId,
										orgId: rlsContext.organizationId
									});
									await tx.$executeRaw`SELECT set_org_context_audited(
										${rlsContext.userId}::text,
										${rlsContext.organizationId}::text,
										${rlsContext.associationId ?? null}::text,
										${rlsContext.isStaff ?? false}::boolean,
										${'orgProcedure'}::text,
										${null}::text,
										${null}::text
									)`;
									// Verify the context was set correctly
									const verifyResult = await tx.$queryRaw<Array<{ org_id: string | null }>>`SELECT current_setting('app.current_org_id', true) as org_id`;
									log.debug('Verified org context after set', {
										expectedOrgId: rlsContext.organizationId,
										actualOrgId: verifyResult[0]?.org_id
									});
								} else {
									log.debug('Setting simple org context', {
										orgId: rlsContext.organizationId
									});
									await tx.$executeRaw`SELECT set_current_org_id(${rlsContext.organizationId}::text)`;
								}

								// Run query on the transaction client (tx), not the original client
								// The `query(args)` function runs on the original client's connection pool,
								// NOT on the transaction client `tx`. We must use `tx` directly.
								log.debug('Running query within transaction', { model, operation });

								// Access the model on the transaction client and call the operation
								// Model names in Prisma are PascalCase, but on the client they're camelCase
								const modelName = model!.charAt(0).toLowerCase() + model!.slice(1);
								// @ts-expect-error - dynamic model access
								const txModel = tx[modelName];
								if (!txModel || typeof txModel[operation] !== 'function') {
									// Fallback for operations we can't intercept (shouldn't happen)
									log.warn('Could not find model/operation on tx, falling back to query()', {
										model,
										operation,
										modelName
									});
									const result = await rlsContextStorage.run(
										{ ...rlsContext, _inTransaction: true },
										() => query(args)
									);
									return result;
								}

								// Run the operation on the transaction client
								const result = await txModel[operation](args);

								// Clear context before connection returns to pool (Option 1)
								log.debug('Clearing org context');
								if (rlsContext.userId) {
									await tx.$executeRaw`SELECT clear_org_context_audited(${rlsContext.userId}::text)`;
								} else {
									await tx.$executeRaw`SELECT set_current_org_id(NULL)`;
								}

								return result;
							} else {
								// No RLS context - clear any stale context from previous requests (Option 2)
								// This is defensive: ensures queries without explicit context
								// don't accidentally inherit org context from a previous request
								// that used the same pooled connection
								log.debug('No RLS context, clearing stale context');
								await tx.$executeRaw`SELECT set_current_org_id(NULL)`;
								await tx.$executeRaw`SELECT set_config('app.current_assoc_id', '', false)`;
								await tx.$executeRaw`SELECT set_config('app.is_staff', 'false', false)`;

								return query(args);
							}
						},
						{
							// Use ReadCommitted isolation - sufficient for RLS context
							isolationLevel: 'ReadCommitted'
						}
					);
				}
			}
		}
	}) as T;
}

/**
 * Create the regular Prisma client (RLS-enabled user)
 * This client is used for all normal application queries.
 * RLS policies will filter data based on app.organization_id session variable.
 *
 * The client is extended with:
 * 1. RLS injection - automatically sets org context in a transaction for each query
 * 2. OpenTelemetry tracing - records db operations on active span
 */
function createPrismaClient() {
	const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
	const client = new PrismaClient({
		adapter,
		log: getPrismaLogConfig()
	});
	// Apply RLS injection first, then tracing
	// This ensures the transaction wrapper is innermost
	return withTracing(withRLSInjection(client));
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
	const client = new PrismaClient({
		adapter,
		log: getPrismaLogConfig()
	});
	return withTracing(client);
}

// Regular client - subject to RLS policies
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Admin client - bypasses RLS (use sparingly)
export const prismaAdmin = globalForPrisma.prismaAdmin ?? createPrismaAdminClient();

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
	globalForPrisma.prismaAdmin = prismaAdmin;
}
