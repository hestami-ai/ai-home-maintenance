import type { User, Organization, UserRole } from '../../../../generated/prisma/client.js';

/**
 * Request context available to all oRPC procedures
 */
export interface RequestContext {
	/** Authenticated user (null if unauthenticated) */
	user: User | null;

	/** Active organization context (null if not selected) */
	organization: Organization | null;

	/** User's role in the active organization */
	role: UserRole | null;

	/**
	 * Map of all organization IDs to user's role in each
	 * Used by Cerbos for authorization decisions
	 */
	orgRoles: Record<string, UserRole>;

	/** Unique request ID for tracing */
	requestId: string;

	/** OpenTelemetry trace ID */
	traceId: string | null;

	/** OpenTelemetry span ID */
	spanId: string | null;

	/** Request timestamp */
	timestamp: Date;
}

/**
 * Creates an empty context for unauthenticated requests
 */
export function createEmptyContext(requestId: string): RequestContext {
	return {
		user: null,
		organization: null,
		role: null,
		orgRoles: {},
		requestId,
		traceId: null,
		spanId: null,
		timestamp: new Date()
	};
}
