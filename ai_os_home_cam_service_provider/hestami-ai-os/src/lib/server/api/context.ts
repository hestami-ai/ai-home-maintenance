import type { User, Organization, Association, UserRole, StaffRole, PillarAccess } from '../../../../generated/prisma/client.js';

/**
 * Request context available to all oRPC procedures
 */
export interface RequestContext {
	/** Authenticated user (null if unauthenticated) */
	user: User | null;

	/** Active organization context (null if not selected) */
	organization: Organization | null;

	/** Active association context (null if not selected) */
	association: Association | null;

	/** Active association ID (shorthand for RLS) */
	associationId: string | null;

	/** User's role in the active organization */
	role: UserRole | null;

	/** Whether the user is a Hestami platform staff member */
	isStaff: boolean;

	/**
	 * Map of all organization IDs to user's role in each
	 * Used by Cerbos for authorization decisions
	 */
	orgRoles: Record<string, UserRole>;

	/** Staff roles for Hestami platform staff (empty if not staff) */
	staffRoles: StaffRole[];

	/** Pillar access for Hestami platform staff (empty if not staff) */
	pillarAccess: PillarAccess[];

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
		association: null,
		associationId: null,
		role: null,
		isStaff: false,
		orgRoles: {},
		staffRoles: [],
		pillarAccess: [],
		requestId,
		traceId: null,
		spanId: null,
		timestamp: new Date()
	};
}
