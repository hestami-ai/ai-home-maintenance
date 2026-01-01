import type { Handle } from '@sveltejs/kit';
import { trace, context as otelContext, SpanStatusCode } from '@opentelemetry/api';
import type { Organization, UserRole } from '../generated/prisma/client';
import { auth } from '$server/auth';
import { prisma } from '$server/db';
import { initDBOS } from '$server/dbos';
import { createModuleLogger } from '$server/logger';

const log = createModuleLogger('Hooks');

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

// Initialize DBOS workflow engine
const dbosReady = initDBOS().catch((err) => {
	log.error('DBOS initialization failed', { error: err instanceof Error ? err.message : String(err) });
});

// Get tracer for creating spans
const tracer = trace.getTracer('hestami-ai-os');

/**
 * SvelteKit server hooks
 * Handles session validation, organization context, and OpenTelemetry tracing.
 * 
 * IMPORTANT: We use context.with() to ensure DBOS workflows started within
 * HTTP request handlers are attached to the same trace. This is critical for
 * correlating workflow spans with their originating HTTP requests.
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Check if auto-instrumentation already created a span (from HTTP instrumentation)
	let span = trace.getActiveSpan();
	const isAutoInstrumented = !!span;

	// If no active span, create one manually (SvelteKit may not be auto-instrumented)
	if (!span) {
		span = tracer.startSpan(`${event.request.method} ${event.url.pathname}`, {
			attributes: {
				'http.method': event.request.method,
				'http.url': event.url.href,
				'http.target': event.url.pathname
			}
		});
	}

	// Store span context in locals for route handlers to access
	if (span) {
		const spanContext = span.spanContext();
		event.locals.traceId = spanContext.traceId;
		event.locals.spanId = spanContext.spanId;
	} else {
		event.locals.traceId = null;
		event.locals.spanId = null;
	}

	const activeSpan = span;
	const context = activeSpan ? trace.setSpan(otelContext.active(), activeSpan) : otelContext.active();

	// Run the request within the span's context using context.with()
	// This ensures DBOS workflows and Prisma queries inherit this trace context
	return otelContext.with(context, async () => {
		try {
			// Get session from Better-Auth
			const session = await auth.api.getSession({
				headers: event.request.headers
			});

			if (session?.user) {
				// Attach user to locals (normalize undefined to null for Prisma compatibility)
				event.locals.user = {
					...session.user,
					name: session.user.name ?? null,
					image: session.user.image ?? null
				};
				event.locals.session = session.session;
				if (activeSpan) activeSpan.setAttribute('user.id', session.user.id);

				log.debug('Session validated', {
					userId: session.user.id,
					email: session.user.email,
					sessionId: session.session.id,
					expiresAt: session.session.expiresAt.toISOString()
				});

				// Check for organization context header
				const orgId = event.request.headers.get('X-Org-Id');
				if (orgId) {
					// Validate user has access to this organization using SECURITY DEFINER function
					// This bypasses RLS to solve the chicken-and-egg bootstrap problem
					const membershipRows = await prisma.$queryRaw<MembershipRow[]>`
						SELECT * FROM get_user_memberships(${session.user.id}) 
						WHERE organization_id = ${orgId} 
						LIMIT 1
					`;

					const membership = membershipRows[0];

					if (membership) {
						event.locals.organization = {
							id: membership.org_id,
							name: membership.org_name,
							slug: membership.org_slug,
							type: membership.org_type,
							status: membership.org_status
						} as Organization;
						event.locals.role = membership.role as UserRole;
						if (activeSpan) activeSpan.setAttribute('org.id', orgId);

						log.debug('Organization context resolved', {
							orgId,
							orgSlug: membership.org_slug,
							role: membership.role,
							userId: session.user.id
						});
					} else {
						log.warn('Organization access denied', {
							userId: session.user.id,
							requestedOrgId: orgId,
							reason: 'no_membership'
						});
					}
				} else {
					log.debug('No organization context in request', {
						userId: session.user.id,
						path: event.url.pathname
					});
				}
			} else {
				// No session - check if auth was expected
				const authHeader = event.request.headers.get('Authorization');
				const hasCookie = event.request.headers.get('Cookie')?.includes('better-auth');

				if (authHeader || hasCookie) {
					log.warn('Auth validation failed', {
						reason: 'invalid_or_expired',
						hasAuthHeader: !!authHeader,
						hasCookie: !!hasCookie,
						path: event.url.pathname
					});
				}
			}

			const response = await resolve(event);
			if (activeSpan) activeSpan.setAttribute('http.status_code', response.status);
			return response;
		} catch (error) {
			if (activeSpan) activeSpan.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
			throw error;
		} finally {
			// Only end the span if we created it (not auto-instrumented)
			if (!isAutoInstrumented && activeSpan) {
				activeSpan.end();
			}
		}
	});
};
