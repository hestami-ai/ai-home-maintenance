/**
 * Activity Event Middleware (Phase 4)
 *
 * Provides functions for recording business activity events across the platform.
 * This is the trust spine for audit, accountability, and reconstruction.
 *
 * Key features:
 * - Intent vs Decision vs Execution event categorization
 * - Human, AI, and System actor tracking
 * - Cross-pillar context (CAM, Contractor, Concierge)
 * - OpenTelemetry trace correlation
 * - Typed metadata schemas
 */

import { z } from 'zod';
import { prisma } from '../../db.js';
import type { RequestContext } from '../context.js';
import type {
	ActivityEntityType,
	ActivityActionType,
	ActivityActorType,
	ActivityEventCategory
} from '../../../../../generated/prisma/client.js';

// =============================================================================
// TYPED METADATA SCHEMAS
// =============================================================================

/**
 * Document reference for document-driven decisions
 */
export const DocumentReferenceSchema = z.object({
	documentId: z.string(),
	version: z.number().optional()
});

/**
 * Authorization context for Cerbos policy decisions
 */
export const AuthorizationContextSchema = z.object({
	policyVersion: z.string().optional(),
	resource: z.string(),
	action: z.string(),
	role: z.string(),
	decision: z.enum(['ALLOW', 'DENY'])
});

/**
 * Workflow context for DBOS workflow events
 */
export const WorkflowContextSchema = z.object({
	workflowId: z.string(),
	workflowStep: z.string().optional(),
	workflowVersion: z.string().optional()
});

/**
 * Base metadata schema with common optional fields
 * Uses passthrough() to allow additional fields
 */
export const ActivityMetadataSchema = z
	.object({
		// Document references
		documentsReferenced: z.array(DocumentReferenceSchema).optional(),

		// Authorization context (required when delegated authority or AI acts)
		authorization: AuthorizationContextSchema.optional(),

		// AI reasoning (required when performedByType = AI)
		agentReasoningSummary: z.string().optional(),

		// Workflow context
		workflow: WorkflowContextSchema.optional(),

		// Related events (for event chains)
		relatedEventIds: z.array(z.string()).optional(),

		// Error context (for failed operations)
		error: z
			.object({
				code: z.string(),
				message: z.string(),
				stack: z.string().optional()
			})
			.optional()
	})
	.passthrough();

export type ActivityMetadata = z.infer<typeof ActivityMetadataSchema>;

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Core input for creating an activity event
 */
export interface ActivityEventInput {
	organizationId: string;
	entityType: ActivityEntityType;
	entityId: string;
	action: ActivityActionType;
	eventCategory: ActivityEventCategory;
	summary: string;

	// Actor
	performedById?: string;
	performedByType: ActivityActorType;

	// Request context
	ipAddress?: string;
	userAgent?: string;

	// Phase 1 context
	associationId?: string;
	unitId?: string;
	violationId?: string;
	arcRequestId?: string;

	// Phase 2 context
	jobId?: string;
	workOrderId?: string;
	technicianId?: string;

	// Phase 3 context
	caseId?: string;
	intentId?: string;
	propertyId?: string;
	decisionId?: string;

	// Change tracking
	previousState?: Record<string, unknown>;
	newState?: Record<string, unknown>;

	// Metadata
	metadata?: ActivityMetadata;

	// Tracing
	traceId?: string;
}

/**
 * Simplified input for context-aware recording
 */
export type ActivityEventFromContextInput = Omit<
	ActivityEventInput,
	'organizationId' | 'performedById' | 'performedByType' | 'ipAddress' | 'userAgent' | 'traceId'
>;

/**
 * Input for workflow-initiated events
 */
export interface ActivityEventFromWorkflowInput
	extends Omit<ActivityEventInput, 'performedById' | 'performedByType' | 'ipAddress' | 'userAgent'> {
	workflowId: string;
	workflowStep?: string;
}

/**
 * Input for AI-initiated events
 */
export interface ActivityEventFromAIInput
	extends Omit<ActivityEventInput, 'performedById' | 'performedByType'> {
	agentId: string;
	agentReasoningSummary: string;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Create an activity event
 */
export async function recordActivityEvent(input: ActivityEventInput): Promise<string> {
	const event = await prisma.activityEvent.create({
		data: {
			organizationId: input.organizationId,
			entityType: input.entityType,
			entityId: input.entityId,
			action: input.action,
			eventCategory: input.eventCategory,
			summary: input.summary,
			performedById: input.performedById,
			performedByType: input.performedByType,
			ipAddress: input.ipAddress,
			userAgent: input.userAgent,
			associationId: input.associationId,
			unitId: input.unitId,
			violationId: input.violationId,
			arcRequestId: input.arcRequestId,
			jobId: input.jobId,
			workOrderId: input.workOrderId,
			technicianId: input.technicianId,
			caseId: input.caseId,
			intentId: input.intentId,
			propertyId: input.propertyId,
			decisionId: input.decisionId,
			previousState: input.previousState as object | undefined,
			newState: input.newState as object | undefined,
			metadata: input.metadata as object | undefined,
			traceId: input.traceId
		}
	});
	return event.id;
}

/**
 * Create an activity event from request context
 * Automatically extracts actor info, IP, user agent, and trace ID
 */
export async function recordActivityFromContext(
	context: RequestContext,
	input: ActivityEventFromContextInput
): Promise<string> {
	const performedById = context.user?.id;
	const performedByType: ActivityActorType = 'HUMAN';
	const organizationId = context.organization?.id;

	if (!organizationId) {
		throw new Error('Organization context required for activity event');
	}

	// Note: IP and user agent should be passed via metadata if needed
	// RequestContext doesn't include raw request headers
	const ipAddress: string | undefined = undefined;
	const userAgent: string | undefined = undefined;

	// Try to get trace ID from OpenTelemetry context
	let traceId: string | undefined;
	try {
		const { trace } = await import('@opentelemetry/api');
		const span = trace.getActiveSpan();
		if (span) {
			traceId = span.spanContext().traceId;
		}
	} catch {
		// OpenTelemetry not available, skip trace ID
	}

	return recordActivityEvent({
		...input,
		organizationId,
		performedById,
		performedByType,
		ipAddress,
		userAgent,
		traceId
	});
}

/**
 * Create an activity event from a DBOS workflow context
 */
export async function recordActivityFromWorkflow(input: ActivityEventFromWorkflowInput): Promise<string> {
	const metadata: ActivityMetadata = {
		...(input.metadata || {}),
		workflow: {
			workflowId: input.workflowId,
			workflowStep: input.workflowStep
		}
	};

	return recordActivityEvent({
		...input,
		performedById: input.workflowId,
		performedByType: 'SYSTEM',
		metadata
	});
}

/**
 * Create an activity event from an AI agent
 * Requires reasoning summary for accountability
 */
export async function recordActivityFromAI(input: ActivityEventFromAIInput): Promise<string> {
	const metadata: ActivityMetadata = {
		...(input.metadata || {}),
		agentReasoningSummary: input.agentReasoningSummary
	};

	return recordActivityEvent({
		...input,
		performedById: `ai:${input.agentId}`,
		performedByType: 'AI',
		metadata
	});
}

// =============================================================================
// CONVENIENCE FUNCTIONS BY EVENT CATEGORY
// =============================================================================

/**
 * Record an INTENT event (user requested/expressed desire)
 */
export async function recordIntent(
	context: RequestContext,
	input: Omit<ActivityEventFromContextInput, 'eventCategory'>
): Promise<string> {
	return recordActivityFromContext(context, {
		...input,
		eventCategory: 'INTENT'
	});
}

/**
 * Record a DECISION event (determination made by human or AI)
 */
export async function recordDecision(
	context: RequestContext,
	input: Omit<ActivityEventFromContextInput, 'eventCategory'>
): Promise<string> {
	return recordActivityFromContext(context, {
		...input,
		eventCategory: 'DECISION'
	});
}

/**
 * Record an EXECUTION event (action taken)
 */
export async function recordExecution(
	context: RequestContext,
	input: Omit<ActivityEventFromContextInput, 'eventCategory'>
): Promise<string> {
	return recordActivityFromContext(context, {
		...input,
		eventCategory: 'EXECUTION'
	});
}

/**
 * Record a SYSTEM event (background/automated)
 */
export async function recordSystemEvent(
	organizationId: string,
	input: Omit<ActivityEventInput, 'organizationId' | 'performedByType' | 'eventCategory'>
): Promise<string> {
	return recordActivityEvent({
		...input,
		organizationId,
		performedByType: 'SYSTEM',
		eventCategory: 'SYSTEM'
	});
}

// =============================================================================
// CONVENIENCE FUNCTIONS BY ACTION TYPE
// =============================================================================

/**
 * Record a CREATE action
 */
export async function recordCreate(
	context: RequestContext,
	entityType: ActivityEntityType,
	entityId: string,
	summary: string,
	options?: {
		eventCategory?: ActivityEventCategory;
		newState?: Record<string, unknown>;
		metadata?: ActivityMetadata;
		// Context fields
		associationId?: string;
		unitId?: string;
		jobId?: string;
		workOrderId?: string;
		caseId?: string;
		intentId?: string;
		propertyId?: string;
	}
): Promise<string> {
	return recordActivityFromContext(context, {
		entityType,
		entityId,
		action: 'CREATE',
		eventCategory: options?.eventCategory ?? 'EXECUTION',
		summary,
		newState: options?.newState,
		metadata: options?.metadata,
		associationId: options?.associationId,
		unitId: options?.unitId,
		jobId: options?.jobId,
		workOrderId: options?.workOrderId,
		caseId: options?.caseId,
		intentId: options?.intentId,
		propertyId: options?.propertyId
	});
}

/**
 * Record an UPDATE action
 */
export async function recordUpdate(
	context: RequestContext,
	entityType: ActivityEntityType,
	entityId: string,
	summary: string,
	options?: {
		eventCategory?: ActivityEventCategory;
		previousState?: Record<string, unknown>;
		newState?: Record<string, unknown>;
		metadata?: ActivityMetadata;
		// Context fields
		associationId?: string;
		unitId?: string;
		jobId?: string;
		workOrderId?: string;
		caseId?: string;
		intentId?: string;
		propertyId?: string;
	}
): Promise<string> {
	return recordActivityFromContext(context, {
		entityType,
		entityId,
		action: 'UPDATE',
		eventCategory: options?.eventCategory ?? 'EXECUTION',
		summary,
		previousState: options?.previousState,
		newState: options?.newState,
		metadata: options?.metadata,
		associationId: options?.associationId,
		unitId: options?.unitId,
		jobId: options?.jobId,
		workOrderId: options?.workOrderId,
		caseId: options?.caseId,
		intentId: options?.intentId,
		propertyId: options?.propertyId
	});
}

/**
 * Record a STATUS_CHANGE action
 */
export async function recordStatusChange(
	context: RequestContext,
	entityType: ActivityEntityType,
	entityId: string,
	fromStatus: string,
	toStatus: string,
	summary: string,
	options?: {
		eventCategory?: ActivityEventCategory;
		metadata?: ActivityMetadata;
		// Context fields
		associationId?: string;
		unitId?: string;
		jobId?: string;
		workOrderId?: string;
		caseId?: string;
		intentId?: string;
		propertyId?: string;
	}
): Promise<string> {
	return recordActivityFromContext(context, {
		entityType,
		entityId,
		action: 'STATUS_CHANGE',
		eventCategory: options?.eventCategory ?? 'EXECUTION',
		summary,
		previousState: { status: fromStatus },
		newState: { status: toStatus },
		metadata: options?.metadata,
		associationId: options?.associationId,
		unitId: options?.unitId,
		jobId: options?.jobId,
		workOrderId: options?.workOrderId,
		caseId: options?.caseId,
		intentId: options?.intentId,
		propertyId: options?.propertyId
	});
}

/**
 * Record an ASSIGN action
 */
export async function recordAssignment(
	context: RequestContext,
	entityType: ActivityEntityType,
	entityId: string,
	assigneeId: string,
	assigneeName: string,
	summary: string,
	options?: {
		eventCategory?: ActivityEventCategory;
		metadata?: ActivityMetadata;
		// Context fields
		associationId?: string;
		jobId?: string;
		workOrderId?: string;
		technicianId?: string;
		caseId?: string;
	}
): Promise<string> {
	return recordActivityFromContext(context, {
		entityType,
		entityId,
		action: 'ASSIGN',
		eventCategory: options?.eventCategory ?? 'EXECUTION',
		summary,
		newState: { assigneeId, assigneeName },
		metadata: options?.metadata,
		associationId: options?.associationId,
		jobId: options?.jobId,
		workOrderId: options?.workOrderId,
		technicianId: options?.technicianId,
		caseId: options?.caseId
	});
}

// =============================================================================
// WORKFLOW FUNCTIONS (for DBOS integration)
// =============================================================================

/**
 * Input for workflow activity events
 */
export interface WorkflowActivityEventInput {
	organizationId: string;
	entityType: ActivityEntityType;
	entityId: string;
	action: ActivityActionType;
	eventCategory: ActivityEventCategory;
	summary: string;
	performedById?: string;
	performedByType?: ActivityActorType;
	workflowId: string;
	workflowStep?: string;
	workflowVersion?: string;
	previousState?: Record<string, unknown>;
	newState?: Record<string, unknown>;
	// Context fields
	caseId?: string;
	intentId?: string;
	propertyId?: string;
	decisionId?: string;
	jobId?: string;
	workOrderId?: string;
	technicianId?: string;
	associationId?: string;
	unitId?: string;
	violationId?: string;
	arcRequestId?: string;
}

/**
 * Record an activity event from a DBOS workflow step.
 * This is designed to be called from within workflow transactions.
 */
export async function recordWorkflowEvent(input: WorkflowActivityEventInput): Promise<string> {
	const event = await prisma.activityEvent.create({
		data: {
			organizationId: input.organizationId,
			entityType: input.entityType,
			entityId: input.entityId,
			action: input.action,
			eventCategory: input.eventCategory,
			summary: input.summary,
			performedById: input.performedById ?? null,
			performedByType: input.performedByType ?? 'SYSTEM',
			previousState: (input.previousState ?? {}) as object,
			newState: (input.newState ?? {}) as object,
			metadata: {
				workflow: {
					workflowId: input.workflowId,
					workflowStep: input.workflowStep,
					workflowVersion: input.workflowVersion
				}
			},
			// Context fields
			caseId: input.caseId,
			intentId: input.intentId,
			propertyId: input.propertyId,
			decisionId: input.decisionId,
			jobId: input.jobId,
			workOrderId: input.workOrderId,
			technicianId: input.technicianId,
			associationId: input.associationId,
			unitId: input.unitId,
			violationId: input.violationId,
			arcRequestId: input.arcRequestId
		}
	});

	return event.id;
}

/**
 * Record workflow lifecycle events (started, completed, failed)
 */
export async function recordWorkflowLifecycleEvent(
	organizationId: string,
	workflowId: string,
	workflowVersion: string,
	lifecycle: 'STARTED' | 'COMPLETED' | 'FAILED',
	summary: string,
	options?: {
		entityType?: ActivityEntityType;
		entityId?: string;
		error?: { code: string; message: string };
		caseId?: string;
		jobId?: string;
		workOrderId?: string;
	}
): Promise<string> {
	const actionMap: Record<string, ActivityActionType> = {
		STARTED: 'CREATE',
		COMPLETED: 'COMPLETE',
		FAILED: 'STATUS_CHANGE'
	};

	const event = await prisma.activityEvent.create({
		data: {
			organizationId,
			entityType: options?.entityType ?? 'OTHER',
			entityId: options?.entityId ?? workflowId,
			action: actionMap[lifecycle],
			eventCategory: 'SYSTEM',
			summary,
			performedById: null,
			performedByType: 'SYSTEM',
			previousState: {},
			newState: { workflowLifecycle: lifecycle },
			metadata: {
				workflow: {
					workflowId,
					workflowVersion,
					lifecycle
				},
				...(options?.error && { error: options.error })
			},
			caseId: options?.caseId,
			jobId: options?.jobId,
			workOrderId: options?.workOrderId
		}
	});

	return event.id;
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Query activity events for a specific entity
 */
export async function getActivityEventsForEntity(
	organizationId: string,
	entityType: ActivityEntityType,
	entityId: string,
	options?: { limit?: number; offset?: number }
): Promise<
	Array<{
		id: string;
		action: ActivityActionType;
		eventCategory: ActivityEventCategory;
		summary: string;
		performedById: string | null;
		performedByType: ActivityActorType;
		performedAt: Date;
		previousState: unknown;
		newState: unknown;
		metadata: unknown;
	}>
> {
	return prisma.activityEvent.findMany({
		where: { organizationId, entityType, entityId },
		select: {
			id: true,
			action: true,
			eventCategory: true,
			summary: true,
			performedById: true,
			performedByType: true,
			performedAt: true,
			previousState: true,
			newState: true,
			metadata: true
		},
		orderBy: { performedAt: 'desc' },
		take: options?.limit ?? 50,
		skip: options?.offset ?? 0
	});
}

/**
 * Query activity events for an organization
 */
export async function getActivityEventsForOrganization(
	organizationId: string,
	options?: {
		entityType?: ActivityEntityType;
		action?: ActivityActionType;
		eventCategory?: ActivityEventCategory;
		performedByType?: ActivityActorType;
		performedById?: string;
		startDate?: Date;
		endDate?: Date;
		limit?: number;
		offset?: number;
	}
): Promise<
	Array<{
		id: string;
		entityType: ActivityEntityType;
		entityId: string;
		action: ActivityActionType;
		eventCategory: ActivityEventCategory;
		summary: string;
		performedById: string | null;
		performedByType: ActivityActorType;
		performedAt: Date;
	}>
> {
	return prisma.activityEvent.findMany({
		where: {
			organizationId,
			...(options?.entityType && { entityType: options.entityType }),
			...(options?.action && { action: options.action }),
			...(options?.eventCategory && { eventCategory: options.eventCategory }),
			...(options?.performedByType && { performedByType: options.performedByType }),
			...(options?.performedById && { performedById: options.performedById }),
			...(options?.startDate || options?.endDate
				? {
						performedAt: {
							...(options?.startDate && { gte: options.startDate }),
							...(options?.endDate && { lte: options.endDate })
						}
					}
				: {})
		},
		select: {
			id: true,
			entityType: true,
			entityId: true,
			action: true,
			eventCategory: true,
			summary: true,
			performedById: true,
			performedByType: true,
			performedAt: true
		},
		orderBy: { performedAt: 'desc' },
		take: options?.limit ?? 100,
		skip: options?.offset ?? 0
	});
}

/**
 * Query activity events for a concierge case (including related entities)
 */
export async function getActivityEventsForCase(
	organizationId: string,
	caseId: string,
	options?: { limit?: number; offset?: number }
): Promise<
	Array<{
		id: string;
		entityType: ActivityEntityType;
		entityId: string;
		action: ActivityActionType;
		eventCategory: ActivityEventCategory;
		summary: string;
		performedById: string | null;
		performedByType: ActivityActorType;
		performedAt: Date;
	}>
> {
	return prisma.activityEvent.findMany({
		where: { organizationId, caseId },
		select: {
			id: true,
			entityType: true,
			entityId: true,
			action: true,
			eventCategory: true,
			summary: true,
			performedById: true,
			performedByType: true,
			performedAt: true
		},
		orderBy: { performedAt: 'desc' },
		take: options?.limit ?? 100,
		skip: options?.offset ?? 0
	});
}

/**
 * Query activity events for a job (including related work orders)
 */
export async function getActivityEventsForJob(
	organizationId: string,
	jobId: string,
	options?: { limit?: number; offset?: number }
): Promise<
	Array<{
		id: string;
		entityType: ActivityEntityType;
		entityId: string;
		action: ActivityActionType;
		eventCategory: ActivityEventCategory;
		summary: string;
		performedById: string | null;
		performedByType: ActivityActorType;
		performedAt: Date;
	}>
> {
	return prisma.activityEvent.findMany({
		where: { organizationId, jobId },
		select: {
			id: true,
			entityType: true,
			entityId: true,
			action: true,
			eventCategory: true,
			summary: true,
			performedById: true,
			performedByType: true,
			performedAt: true
		},
		orderBy: { performedAt: 'desc' },
		take: options?.limit ?? 100,
		skip: options?.offset ?? 0
	});
}

// =============================================================================
// DOCUMENT-SPECIFIC CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Record a document classification/reclassification event
 */
export async function recordDocumentClassify(
	context: RequestContext,
	documentId: string,
	fromCategory: string,
	toCategory: string,
	reason: string
): Promise<string> {
	return recordActivityFromContext(context, {
		entityType: 'DOCUMENT',
		entityId: documentId,
		action: 'CLASSIFY',
		eventCategory: 'EXECUTION',
		summary: `Document reclassified from ${fromCategory} to ${toCategory}: ${reason}`,
		previousState: { category: fromCategory },
		newState: { category: toCategory },
		metadata: { reason }
	});
}

/**
 * Record a new document version creation event
 */
export async function recordDocumentVersion(
	context: RequestContext,
	documentId: string,
	newVersion: number,
	parentDocumentId?: string
): Promise<string> {
	return recordActivityFromContext(context, {
		entityType: 'DOCUMENT',
		entityId: documentId,
		action: 'VERSION',
		eventCategory: 'EXECUTION',
		summary: `New document version ${newVersion} created`,
		newState: { version: newVersion, parentDocumentId },
		metadata: {
			documentsReferenced: [{ documentId, version: newVersion }]
		}
	});
}

/**
 * Record a document supersede event
 */
export async function recordDocumentSupersede(
	context: RequestContext,
	documentId: string,
	supersededById: string
): Promise<string> {
	return recordActivityFromContext(context, {
		entityType: 'DOCUMENT',
		entityId: documentId,
		action: 'SUPERSEDE',
		eventCategory: 'EXECUTION',
		summary: `Document superseded by ${supersededById}`,
		newState: { status: 'SUPERSEDED', supersededById }
	});
}

/**
 * Record a document reference event (when document is linked to a decision)
 */
export async function recordDocumentReferenced(
	context: RequestContext,
	documentId: string,
	documentVersion: number,
	referencingEntityType: string,
	referencingEntityId: string
): Promise<string> {
	return recordActivityFromContext(context, {
		entityType: 'DOCUMENT',
		entityId: documentId,
		action: 'REFERENCED',
		eventCategory: 'EXECUTION',
		summary: `Document referenced in ${referencingEntityType} ${referencingEntityId}`,
		newState: { referencingEntityType, referencingEntityId },
		metadata: {
			documentsReferenced: [{ documentId, version: documentVersion }]
		}
	});
}
