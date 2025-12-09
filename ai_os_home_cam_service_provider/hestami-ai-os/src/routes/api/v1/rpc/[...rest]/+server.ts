import { RPCHandler } from '@orpc/server/fetch';
import { nanoid } from 'nanoid';
import { trace } from '@opentelemetry/api';
import type { RequestHandler } from './$types';
import { appRouter, createEmptyContext } from '$server/api';
import { prisma } from '$server/db';
import { auth } from '$server/auth';

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
	try {
		const context = await createContext(request, locals);
		console.log('[oRPC] Request:', request.url, 'User:', context.user?.id ?? 'anonymous', 'Org:', context.organization?.slug ?? 'none');

		const result = await handler.handle(request, {
			prefix: '/api/v1/rpc',
			context
		});

		if (result.matched) {
			return result.response;
		}

		return new Response('Not Found', { status: 404 });
	} catch (error) {
		console.error('[oRPC] Unhandled error:', error);
		throw error;
	}
};

export const GET = handleRequest;
export const POST = handleRequest;
