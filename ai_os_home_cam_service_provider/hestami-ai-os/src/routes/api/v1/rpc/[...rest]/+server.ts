import { RPCHandler } from '@orpc/server/fetch';
import { nanoid } from 'nanoid';
import { trace } from '@opentelemetry/api';
import type { RequestHandler } from './$types';
import { appRouter, createEmptyContext } from '$server/api';
import { prisma } from '$server/db';
import { auth } from '$server/auth';
import {
	createORPCLogContext,
	logRequestStart,
	logRequestEnd,
	logRequestError
} from '$server/api/middleware/logging';
import { recordSpanError } from '$server/api/middleware/tracing';

/**
 * oRPC handler for /api/v1/rpc/*
 */
const handler = new RPCHandler(appRouter);

// Type for the raw membership row from SECURITY DEFINER function
interface MembershipRow {
	id: string;
	user_id: string;
	organization_id: string;
	role: string;
	is_default: boolean;
	created_at: Date;
	updated_at: Date;
	org_id: string;
	org_name: string;
	org_slug: string;
	org_type: string;
	org_status: string;
}

// Type for the raw staff profile row from SECURITY DEFINER function
interface StaffProfileRow {
	id: string;
	user_id: string;
	status: string;
	roles: string[];
	pillar_access: string[];
	activated_at: Date | null;
	suspended_at: Date | null;
	deactivated_at: Date | null;
	created_at: Date;
	updated_at: Date;
}

/**
 * Creates request context from SvelteKit request and locals
 * Uses SECURITY DEFINER functions to bypass RLS for context bootstrapping
 */
async function createContext(
	request: Request,
	locals: App.Locals
): Promise<ReturnType<typeof createEmptyContext>> {
	const requestId = nanoid();
	const context = createEmptyContext(requestId);

	// Get trace context from locals (set by hooks.server.ts)
	context.traceId = locals.traceId;
	context.spanId = locals.spanId;

	// If no trace context from locals, try to get from active span
	if (!context.traceId) {
		const activeSpan = trace.getActiveSpan();
		if (activeSpan) {
			const spanContext = activeSpan.spanContext();
			context.traceId = spanContext.traceId;
			context.spanId = spanContext.spanId;
		}
	}

	// Validate session with Better-Auth
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (session?.user) {
		context.user = {
			...session.user,
			name: session.user.name ?? null,
			image: session.user.image ?? null
		};
	}

	// Get organization context from header
	const orgId = request.headers.get('X-Org-Id');
	if (context.user) {
		// Get ALL user's organization memberships and staff profile using SECURITY DEFINER functions
		// This bypasses RLS to solve the chicken-and-egg bootstrap problem
		// 
		// Note: get_staff_profile is called for ALL users but only returns data for Hestami staff.
		// For regular platform users (e.g., Concierge homeowners), it returns an empty result set,
		// and staffRoles/pillarAccess remain empty. The critical query for regular users is
		// get_user_memberships, which returns their organization membership and role.
		const [membershipRows, staffRows] = await Promise.all([
			prisma.$queryRaw<MembershipRow[]>`SELECT * FROM get_user_memberships(${context.user.id})`,
			prisma.$queryRaw<StaffProfileRow[]>`SELECT * FROM get_staff_profile(${context.user.id})`
		]);

		// Build orgRoles map for Cerbos principal
		for (const membership of membershipRows) {
			context.orgRoles[membership.organization_id] = membership.role as any;
		}

		// Set staff roles and pillar access if user is active Hestami staff
		// For non-staff users (e.g., Concierge homeowners), staffRows is empty and this is skipped
		const staffProfile = staffRows.find((s) => s.status === 'ACTIVE');
		if (staffProfile) {
			context.staffRoles = staffProfile.roles as any[];
			context.pillarAccess = staffProfile.pillar_access as any[];
		}

		// Set current organization context if X-Org-Id header is provided
		if (orgId) {
			const currentMembership = membershipRows.find((m) => m.organization_id === orgId);
			if (currentMembership) {
				context.organization = {
					id: currentMembership.org_id,
					name: currentMembership.org_name,
					slug: currentMembership.org_slug,
					type: currentMembership.org_type,
					status: currentMembership.org_status
				} as any;
				context.role = currentMembership.role as any;
			}
		}
	}

	return context;
}

/**
 * Handle all HTTP methods for oRPC
 */
const handleRequest: RequestHandler = async ({ request, locals }) => {
	const startTime = Date.now();
	let context = createEmptyContext(nanoid());
	let logContext = createORPCLogContext(request, context);

	try {
		context = await createContext(request, locals);
		logContext = createORPCLogContext(request, context);

		logRequestStart(logContext);

		const result = await handler.handle(request, {
			prefix: '/api/v1/rpc',
			context
		});

		const durationMs = Date.now() - startTime;

		if (result.matched) {
			const statusCode = result.response.status;

			// Log error responses with body for debugging and record on span
			if (statusCode >= 400) {
				const clonedResponse = result.response.clone();
				try {
					const body = await clonedResponse.json();
					// Extract oRPC error structure for better logging
					const errorInfo = body?.json || body;
					const errorMessage = errorInfo.message || 'Unknown error';
					const error = new Error(errorMessage);
					
					logRequestError(logContext, error, {
						errorCode: errorInfo.code,
						errorDefined: errorInfo.defined,
						errorData: errorInfo.data
					});
					
					// Record error on the active span for trace visibility
					await recordSpanError(error, {
						errorCode: errorInfo.code,
						httpStatus: statusCode,
						errorType: errorInfo.code || 'API_ERROR'
					});
				} catch {
					// Non-JSON error response
				}
			}

			logRequestEnd(logContext, statusCode, durationMs);
			return result.response;
		}

		logRequestEnd(logContext, 404, durationMs);
		return new Response('Not Found', { status: 404 });
	} catch (error) {
		const durationMs = Date.now() - startTime;
		const errorObj = error instanceof Error ? error : new Error(String(error));
		
		logRequestError(logContext, errorObj);
		
		// Record unhandled error on span
		await recordSpanError(errorObj, {
			errorCode: 'INTERNAL_SERVER_ERROR',
			httpStatus: 500,
			errorType: 'UNHANDLED_ERROR'
		});
		
		logRequestEnd(logContext, 500, durationMs);
		throw error;
	}
};

export const GET = handleRequest;
export const POST = handleRequest;
