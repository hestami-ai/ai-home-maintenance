// Server-side utilities and exports
// This module is only available in server-side code (+page.server.ts, +server.ts, hooks.server.ts)

export { prisma } from './db.js';
export * from './api/index.js';
export { initTelemetry, shutdownTelemetry } from './telemetry.js';
export { auth } from './auth/index.js';
export { setOrgContext, clearOrgContext, withOrgContext, orgTransaction } from './db/rls.js';
export { withIdempotency, cleanupExpiredIdempotencyKeys } from './api/middleware/idempotency.js';
export { logger, createLogger } from './logger.js';
export { generateOpenAPISpec } from './api/openapi.js';
