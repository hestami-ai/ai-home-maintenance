/**
 * API Module Index
 * 
 * Re-exports the appRouter from appRouter.ts to maintain backwards compatibility.
 * The router is defined in a separate file to avoid circular dependencies with serverClient.ts.
 */

// Re-export appRouter from dedicated file
export { appRouter, type AppRouter } from './appRouter.js';

// Re-export utilities
export { createEmptyContext, type RequestContext } from './context.js';
export { ErrorCode, ErrorType } from './errors.js';
export {
	publicProcedure,
	authedProcedure,
	orgProcedure,
	adminProcedure,
	successResponse,
	IdempotencyKeySchema,
	PaginationInputSchema,
	PaginationOutputSchema
} from './router.js';

//permissions.ts is deprecated. We've implemented Cerbos.
//export {
//	Permission,
//	hasPermission,
//	hasAllPermissions,
//	hasAnyPermission,
//	requirePermission,
//	requireAllPermissions,
//	type PermissionType
//} from './permissions.js';
