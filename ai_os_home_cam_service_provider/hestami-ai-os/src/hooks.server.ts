import type { Handle } from '@sveltejs/kit';
import { trace, context as otelContext, SpanStatusCode } from '@opentelemetry/api';
import { auth } from '$server/auth';
import { prisma } from '$server/db';
import { initDBOS } from '$server/dbos';
import { createModuleLogger } from '$server/logger';

const log = createModuleLogger('Hooks');

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
	const spanContext = span.spanContext();
	event.locals.traceId = spanContext.traceId;
	event.locals.spanId = spanContext.spanId;

	// Run the request within the span's context using context.with()
	// This ensures DBOS workflows and Prisma queries inherit this trace context
	return otelContext.with(trace.setSpan(otelContext.active(), span), async () => {
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
				span.setAttribute('user.id', session.user.id);

				log.debug('Session validated', {
					userId: session.user.id,
					email: session.user.email,
					sessionId: session.session.id,
					expiresAt: session.session.expiresAt.toISOString()
				});

				// Check for organization context header
				const orgId = event.request.headers.get('X-Org-Id');
				if (orgId) {
					// Validate user has access to this organization
					const membership = await prisma.userOrganization.findUnique({
						where: {
							userId_organizationId: {
								userId: session.user.id,
								organizationId: orgId
							}
						},
						include: {
							organization: true
						}
					});

					if (membership) {
						event.locals.organization = membership.organization;
						event.locals.role = membership.role;
						span.setAttribute('org.id', orgId);
						
						log.debug('Organization context resolved', {
							orgId,
							orgSlug: membership.organization.slug,
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
			span.setAttribute('http.status_code', response.status);
			return response;
		} catch (error) {
			span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
			throw error;
		} finally {
			// Only end the span if we created it (not auto-instrumented)
			if (!isAutoInstrumented) {
				span.end();
			}
		}
	});
};
