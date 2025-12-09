import type { Handle } from '@sveltejs/kit';
import { trace, context as otelContext, SpanStatusCode } from '@opentelemetry/api';
import { auth } from '$server/auth';
import { prisma } from '$server/db';
import { initDBOS } from '$server/dbos';

// Initialize DBOS workflow engine
const dbosReady = initDBOS().catch((err) => {
	console.error('[DBOS] Failed to initialize:', err);
});

// OpenTelemetry is initialized via --require ./telemetry.cjs in PM2 config
const tracer = trace.getTracer('hestami-ai-os');

/**
 * SvelteKit server hooks
 * Handles session validation, organization context, and OpenTelemetry tracing
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Create a span for this request
	const span = tracer.startSpan(`${event.request.method} ${event.url.pathname}`, {
		attributes: {
			'http.method': event.request.method,
			'http.url': event.url.href,
			'http.target': event.url.pathname
		}
	});

	// Store span context in locals for route handlers
	const spanContext = span.spanContext();
	event.locals.traceId = spanContext.traceId;
	event.locals.spanId = spanContext.spanId;

	try {
		// Run the rest of the request within this span's context
		return await otelContext.with(trace.setSpan(otelContext.active(), span), async () => {
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
					}
				}
			}

			const response = await resolve(event);
			span.setAttribute('http.status_code', response.status);
			return response;
		});
	} catch (error) {
		span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
		throw error;
	} finally {
		span.end();
	}
};
