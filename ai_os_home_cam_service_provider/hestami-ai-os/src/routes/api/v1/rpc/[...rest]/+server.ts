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

/**
 * oRPC handler for /api/v1/rpc/*
 */
const handler = new RPCHandler(appRouter);

/**
 * Creates request context from SvelteKit request and locals
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
		// Get ALL user's organization memberships for Cerbos authorization
		const memberships = await prisma.userOrganization.findMany({
			where: { userId: context.user.id },
			include: { organization: true }
		});

		// Build orgRoles map for Cerbos principal
		for (const membership of memberships) {
			context.orgRoles[membership.organizationId] = membership.role;
		}

		// Set current organization context if X-Org-Id header is provided
		if (orgId) {
			const currentMembership = memberships.find((m) => m.organizationId === orgId);
			if (currentMembership) {
				context.organization = currentMembership.organization;
				context.role = currentMembership.role;
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

			// Log error responses with body for debugging
			if (statusCode >= 400) {
				const clonedResponse = result.response.clone();
				try {
					const body = await clonedResponse.json();
					logRequestError(logContext, new Error(JSON.stringify(body)));
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
		logRequestError(logContext, error);
		logRequestEnd(logContext, 500, durationMs);
		throw error;
	}
};

export const GET = handleRequest;
export const POST = handleRequest;
