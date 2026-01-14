// IMPORTANT: Import telemetry-init FIRST to register the OTel SDK
// before any other modules that might use @opentelemetry/api
import '$server/telemetry-init';

import type { Handle } from '@sveltejs/kit';
import { trace, context as otelContext, SpanStatusCode } from '@opentelemetry/api';
import type { Organization, UserRole } from '../generated/prisma/client';
import { auth } from '$server/auth';
import { prisma } from '$server/db';
import { initDBOS } from '$server/dbos';
import { createModuleLogger } from '$server/logger';
import { registerShutdownHandlers } from '$server/shutdown';
import { nanoid } from 'nanoid';

const log = createModuleLogger('Hooks');

// Register graceful shutdown handlers (SIGTERM, SIGINT)
registerShutdownHandlers();

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

// Type for association membership lookup
interface AssocMembershipRow {
	association_id: string;
	association_name: string;
	role: string;
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
	// Ensure DBOS is fully initialized before processing any requests
	// This prevents workflow registration after DBOS.launch()
	await dbosReady;
	// Generate unique request ID for correlation
	const requestId = nanoid();

	// Check if auto-instrumentation already created a span (from HTTP instrumentation)
	let span = trace.getActiveSpan();
	const isAutoInstrumented = !!span;

	// If no active span, create one manually (SvelteKit may not be auto-instrumented)
	if (!span) {
		span = tracer.startSpan(`${event.request.method} ${event.url.pathname}`, {
			attributes: {
				'http.method': event.request.method,
				'http.url': event.url.href,
				'http.target': event.url.pathname,
				'hestami.request_id': requestId
			}
		});
	} else {
		// Add request ID to existing span
		span.setAttribute('hestami.request_id', requestId);
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
				if (activeSpan) {
					activeSpan.setAttribute('user.id', session.user.id);
					activeSpan.setAttribute('user.email', session.user.email);
					activeSpan.setAttribute('hestami.session_id', session.session.id);
					if (session.user.name) activeSpan.setAttribute('user.name', session.user.name);
				}

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
						if (activeSpan) {
							activeSpan.setAttribute('org.id', orgId);
							activeSpan.setAttribute('org.slug', membership.org_slug);
							activeSpan.setAttribute('org.type', membership.org_type);
							activeSpan.setAttribute('user.role', membership.role);
						}

						log.debug('Organization context resolved', {
							orgId,
							orgSlug: membership.org_slug,
							role: membership.role,
							userId: session.user.id
						});

						// Check for association context
						const assocId = event.request.headers.get('X-Assoc-Id');
						if (assocId) {
							// Validate association access
							const assocRows = await prisma.$queryRaw<AssocMembershipRow[]>`
								SELECT * FROM get_user_associations(${session.user.id}, ${orgId})
								WHERE association_id = ${assocId}
								LIMIT 1
							`;

							const assoc = assocRows[0];
							if (assoc) {
								event.locals.association = {
									id: assoc.association_id,
									name: assoc.association_name,
									organizationId: orgId
								} as any; // Cast as we don't need full model here

								if (activeSpan) {
									activeSpan.setAttribute('assoc.id', assocId);
									activeSpan.setAttribute('assoc.name', assoc.association_name);
								}

								log.debug('Association context resolved', {
									assocId,
									assocName: assoc.association_name,
									userId: session.user.id
								});
							} else {
								log.warn('Association access denied', {
									userId: session.user.id,
									requestedAssocId: assocId,
									orgId
								});
							}
						}

						// Determine if user is platform staff
						// This could be enhanced to check role types or staff model
						event.locals.isStaff = membership.org_type === 'PLATFORM_OPERATOR' ||
							membership.org_type === 'MANAGEMENT_COMPANY';

						// Set SQL session context for RLS
						await prisma.$executeRaw`
							SELECT set_org_context_audited(
								${session.user.id}, 
								${orgId}, 
								${event.locals.association?.id || null},
								${event.locals.isStaff},
								'hook_init'
							)
						`;

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

					// Ensure RLS context is cleared if no org ID provided
					await prisma.$executeRaw`SELECT clear_org_context_audited(${session.user.id})`;
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

			if (activeSpan) {
				activeSpan.setAttribute('http.status_code', response.status);

				// Set error status for HTTP error responses
				if (response.status >= 400) {
					activeSpan.setStatus({
						code: SpanStatusCode.ERROR,
						message: `HTTP ${response.status}`
					});
				}
			}

			return response;
		} catch (error) {
			if (activeSpan) {
				activeSpan.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
				activeSpan.recordException(error instanceof Error ? error : new Error(String(error)));
			}
			throw error;
		} finally {
			// Only end the span if we created it (not auto-instrumented)
			if (!isAutoInstrumented && activeSpan) {
				activeSpan.end();
			}
		}
	});
};
