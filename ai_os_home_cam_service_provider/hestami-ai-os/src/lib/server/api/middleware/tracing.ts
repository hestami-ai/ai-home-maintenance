/**
 * OpenTelemetry Tracing Helpers
 *
 * Provides utilities for enriching spans with tenant and domain context.
 */

import type { RequestContext } from '../context.js';
import { createModuleLogger } from '../../logger.js';

const log = createModuleLogger('TracingMiddleware');

/**
 * Span attribute keys for observability
 */
export const SpanAttributes = {
	// Organization context
	ORG_ID: 'hestami.org_id',
	ORG_TYPE: 'hestami.org_type',
	USER_ID: 'hestami.user_id',
	
	// RPC context
	RPC_METHOD: 'rpc.method',
	RPC_SERVICE: 'rpc.service',
	IDEMPOTENCY_KEY: 'hestami.idempotency_key',
	
	// Cerbos authorization
	CERBOS_ACTION: 'cerbos.action',
	CERBOS_RESOURCE: 'cerbos.resource',
	CERBOS_RESOURCE_ID: 'cerbos.resource_id',
	CERBOS_DECISION: 'cerbos.decision',
	
	// DBOS workflow
	WORKFLOW_ID: 'hestami.workflow_id',
	WORKFLOW_NAME: 'hestami.workflow_name',
	WORKFLOW_ACTION: 'hestami.workflow_action',
	
	// Job/work order context
	JOB_ID: 'hestami.job_id',
	TECHNICIAN_ID: 'hestami.technician_id',
	WORK_ORDER_ID: 'hestami.work_order_id',
	
	// Resource context
	RESOURCE_TYPE: 'hestami.resource_type',
	RESOURCE_ID: 'hestami.resource_id',
	ACTION: 'hestami.action',
	
	// Request context
	REQUEST_ID: 'hestami.request_id',
	SESSION_ID: 'hestami.session_id'
} as const;

/**
 * Context for enriching spans
 */
export interface SpanContext {
	organizationId?: string;
	organizationType?: string;
	userId?: string;
	jobId?: string;
	technicianId?: string;
	workOrderId?: string;
	workflowId?: string;
	resourceType?: string;
	resourceId?: string;
	action?: string;
}

/**
 * Get the OpenTelemetry trace API (lazy loaded)
 */
async function getTraceApi() {
	try {
		const { trace } = await import('@opentelemetry/api');
		return trace;
	} catch {
		return null;
	}
}

/**
 * Set attributes on the current active span
 */
export async function setSpanAttributes(attributes: SpanContext): Promise<void> {
	const trace = await getTraceApi();
	if (!trace) return;

	const span = trace.getActiveSpan();
	if (!span) return;

	if (attributes.organizationId) {
		span.setAttribute(SpanAttributes.ORG_ID, attributes.organizationId);
	}
	if (attributes.organizationType) {
		span.setAttribute(SpanAttributes.ORG_TYPE, attributes.organizationType);
	}
	if (attributes.userId) {
		span.setAttribute(SpanAttributes.USER_ID, attributes.userId);
	}
	if (attributes.jobId) {
		span.setAttribute(SpanAttributes.JOB_ID, attributes.jobId);
	}
	if (attributes.technicianId) {
		span.setAttribute(SpanAttributes.TECHNICIAN_ID, attributes.technicianId);
	}
	if (attributes.workOrderId) {
		span.setAttribute(SpanAttributes.WORK_ORDER_ID, attributes.workOrderId);
	}
	if (attributes.workflowId) {
		span.setAttribute(SpanAttributes.WORKFLOW_ID, attributes.workflowId);
	}
	if (attributes.resourceType) {
		span.setAttribute(SpanAttributes.RESOURCE_TYPE, attributes.resourceType);
	}
	if (attributes.resourceId) {
		span.setAttribute(SpanAttributes.RESOURCE_ID, attributes.resourceId);
	}
	if (attributes.action) {
		span.setAttribute(SpanAttributes.ACTION, attributes.action);
	}
}

/**
 * Enrich the current span with request context
 */
export async function enrichSpanFromContext(context: RequestContext): Promise<void> {
	await setSpanAttributes({
		organizationId: context.organization?.id,
		organizationType: context.organization?.type,
		userId: context.user?.id
	});
}

/**
 * Enrich the current span with oRPC method context
 * Call this at the start of oRPC request handling
 */
export async function enrichSpanWithRPC(
	method: string,
	idempotencyKey?: string
): Promise<void> {
	const trace = await getTraceApi();
	if (!trace) return;

	const span = trace.getActiveSpan();
	if (!span) return;

	// Parse method into service and method (e.g., "association.create" -> service: "association", method: "create")
	const parts = method.split('.');
	const service = parts.length > 1 ? parts.slice(0, -1).join('.') : 'unknown';
	const rpcMethod = parts[parts.length - 1] || method;

	span.setAttribute(SpanAttributes.RPC_SERVICE, service);
	span.setAttribute(SpanAttributes.RPC_METHOD, method);

	if (idempotencyKey) {
		span.setAttribute(SpanAttributes.IDEMPOTENCY_KEY, idempotencyKey);
	}

	// Update span name to include RPC method
	span.updateName(`RPC ${method}`);
}

/**
 * Enrich the current span with Cerbos authorization context
 */
export async function enrichSpanWithCerbos(
	action: string,
	resource: string,
	resourceId: string,
	decision: 'ALLOW' | 'DENY'
): Promise<void> {
	const trace = await getTraceApi();
	if (!trace) return;

	const span = trace.getActiveSpan();
	if (!span) return;

	span.setAttribute(SpanAttributes.CERBOS_ACTION, action);
	span.setAttribute(SpanAttributes.CERBOS_RESOURCE, resource);
	span.setAttribute(SpanAttributes.CERBOS_RESOURCE_ID, resourceId);
	span.setAttribute(SpanAttributes.CERBOS_DECISION, decision);
}

/**
 * Enrich the current span with DBOS workflow context
 */
export async function enrichSpanWithDBOSWorkflow(
	workflowId: string,
	workflowName: string,
	workflowAction?: string
): Promise<void> {
	const trace = await getTraceApi();
	if (!trace) return;

	const span = trace.getActiveSpan();
	if (!span) return;

	span.setAttribute(SpanAttributes.WORKFLOW_ID, workflowId);
	span.setAttribute(SpanAttributes.WORKFLOW_NAME, workflowName);
	if (workflowAction) {
		span.setAttribute(SpanAttributes.WORKFLOW_ACTION, workflowAction);
	}
}

/**
 * Enrich the current span with request identification
 */
export async function enrichSpanWithRequestId(
	requestId: string,
	sessionId?: string
): Promise<void> {
	const trace = await getTraceApi();
	if (!trace) return;

	const span = trace.getActiveSpan();
	if (!span) return;

	span.setAttribute(SpanAttributes.REQUEST_ID, requestId);
	if (sessionId) {
		span.setAttribute(SpanAttributes.SESSION_ID, sessionId);
	}
}

/**
 * Enrich the current span with job context
 */
export async function enrichSpanWithJob(
	jobId: string,
	technicianId?: string,
	workOrderId?: string
): Promise<void> {
	await setSpanAttributes({
		jobId,
		technicianId,
		workOrderId
	});
}

/**
 * Enrich the current span with workflow context
 */
export async function enrichSpanWithWorkflow(
	workflowId: string,
	organizationId: string
): Promise<void> {
	await setSpanAttributes({
		workflowId,
		organizationId
	});
}

/**
 * Enrich the current span with resource context
 */
export async function enrichSpanWithResource(
	resourceType: string,
	resourceId: string,
	action?: string
): Promise<void> {
	await setSpanAttributes({
		resourceType,
		resourceId,
		action
	});
}

/**
 * Record an error on the current active span
 * This sets the span status to ERROR and records the exception details
 */
export async function recordSpanError(
	error: Error,
	attributes?: {
		errorCode?: string;
		httpStatus?: number;
		errorType?: string;
	}
): Promise<void> {
	const trace = await getTraceApi();
	if (!trace) return;

	const span = trace.getActiveSpan();
	if (!span) return;

	// Record the exception (adds exception.type, exception.message, exception.stacktrace)
	span.recordException(error);

	// Set span status to ERROR with the error message
	span.setStatus({ code: 2, message: error.message }); // SpanStatusCode.ERROR = 2

	// Add custom error attributes for better filtering in SigNoz
	if (attributes?.errorCode) {
		span.setAttribute('error.code', attributes.errorCode);
	}
	if (attributes?.httpStatus) {
		span.setAttribute('http.status_code', attributes.httpStatus);
	}
	if (attributes?.errorType) {
		span.setAttribute('error.type', attributes.errorType);
	}
}

/**
 * Get the current trace ID if available
 */
export async function getCurrentTraceId(): Promise<string | undefined> {
	const trace = await getTraceApi();
	if (!trace) return undefined;

	const span = trace.getActiveSpan();
	if (!span) return undefined;

	return span.spanContext().traceId;
}

/**
 * Get the current span ID if available
 */
export async function getCurrentSpanId(): Promise<string | undefined> {
	const trace = await getTraceApi();
	if (!trace) return undefined;

	const span = trace.getActiveSpan();
	if (!span) return undefined;

	return span.spanContext().spanId;
}

/**
 * Create a child span for an operation
 * Returns a function to end the span
 */
export async function startSpan(
	name: string,
	attributes?: SpanContext
): Promise<{ end: () => void; setError: (error: Error) => void } | null> {
	const trace = await getTraceApi();
	if (!trace) return null;

	const tracer = trace.getTracer('hestami-ai-os');
	const span = tracer.startSpan(name);

	if (attributes) {
		if (attributes.organizationId) {
			span.setAttribute(SpanAttributes.ORG_ID, attributes.organizationId);
		}
		if (attributes.userId) {
			span.setAttribute(SpanAttributes.USER_ID, attributes.userId);
		}
		if (attributes.jobId) {
			span.setAttribute(SpanAttributes.JOB_ID, attributes.jobId);
		}
		if (attributes.technicianId) {
			span.setAttribute(SpanAttributes.TECHNICIAN_ID, attributes.technicianId);
		}
		if (attributes.workOrderId) {
			span.setAttribute(SpanAttributes.WORK_ORDER_ID, attributes.workOrderId);
		}
		if (attributes.resourceType) {
			span.setAttribute(SpanAttributes.RESOURCE_TYPE, attributes.resourceType);
		}
		if (attributes.resourceId) {
			span.setAttribute(SpanAttributes.RESOURCE_ID, attributes.resourceId);
		}
		if (attributes.action) {
			span.setAttribute(SpanAttributes.ACTION, attributes.action);
		}
	}

	return {
		end: () => span.end(),
		setError: (error: Error) => {
			span.recordException(error);
			span.setStatus({ code: 2, message: error.message }); // SpanStatusCode.ERROR = 2
		}
	};
}

/**
 * Wrap an async operation in a span
 */
export async function withSpan<T>(
	name: string,
	operation: () => Promise<T>,
	attributes?: SpanContext
): Promise<T> {
	const spanHandle = await startSpan(name, attributes);
	if (!spanHandle) {
		return operation();
	}

	try {
		const result = await operation();
		spanHandle.end();
		return result;
	} catch (error) {
		if (error instanceof Error) {
			spanHandle.setError(error);
		}
		spanHandle.end();
		throw error;
	}
}
