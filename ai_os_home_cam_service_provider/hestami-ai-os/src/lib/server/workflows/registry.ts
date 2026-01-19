/**
 * DBOS Workflow Version Registry
 * 
 * This registry documents all workflow versions, their status, and migration paths.
 * Use this to track which workflows are current, deprecated, or retired.
 */

export const WorkflowStatus = {
	CURRENT: 'current',
	DEPRECATED: 'deprecated',
	RETIRED: 'retired'
} as const;

export type WorkflowStatus = (typeof WorkflowStatus)[keyof typeof WorkflowStatus];

export interface WorkflowVersion {
	name: string;
	version: string;
	status: WorkflowStatus;
	phase: string;
	description: string;
	deprecatedAt?: string;
	retiredAt?: string;
	migratesTo?: string;
	breakingChanges?: string[];
}

/**
 * All registered workflow versions
 */
export const WORKFLOW_REGISTRY: WorkflowVersion[] = [
	// Phase 1 Workflows (HOA/CAM)
	{
		name: 'workOrderLifecycle',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'Phase 4',
		description: 'Work order state machine: DRAFT → SUBMITTED → TRIAGED → ASSIGNED → SCHEDULED → IN_PROGRESS → COMPLETED → CLOSED'
	},
	{
		name: 'violationLifecycle',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'Phase 5',
		description: 'Violation state machine: DRAFT → OPEN → NOTICE_SENT → HEARING_SCHEDULED → RESOLVED/ESCALATED'
	},
	{
		name: 'arcReviewLifecycle',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'Phase 6',
		description: 'ARC request review: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/DENIED/CONDITIONALLY_APPROVED'
	},
	{
		name: 'assessmentPosting',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'Phase 13',
		description: 'Assessment batch posting workflow with ledger entries and notifications'
	},
	{
		name: 'meetingLifecycle',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'Phase 13',
		description: 'Meeting lifecycle: DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED with agenda/minutes management'
	},

	// Phase 2 Workflows (Contractor Operations)
	{
		name: 'jobLifecycle',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P2.10',
		description: 'Job state machine: TICKET → JOB_CREATED → SCHEDULED → DISPATCHED → IN_PROGRESS → COMPLETED → INVOICED → CLOSED'
	},
	{
		name: 'estimateGeneration',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P2.10',
		description: 'Estimate creation workflow with pricebook lookup, line item generation, and approval flow'
	},
	{
		name: 'dispatchAssignment',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P2.10',
		description: 'Technician dispatch with eligibility checks, availability validation, and notification'
	},
	{
		name: 'invoicePayment',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P2.10',
		description: 'Invoice lifecycle: DRAFT → SENT → VIEWED → PAID/OVERDUE with payment processing'
	},
	{
		name: 'maintenanceContract',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P2.10',
		description: 'Recurring service contract management with visit scheduling and renewal'
	},
	{
		name: 'complianceWorkflow',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P2.10',
		description: 'License/insurance compliance monitoring with expiration alerts and renewal tracking'
	},
	{
		name: 'inventoryWorkflow',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P2.10',
		description: 'Inventory management: stock tracking, reorder alerts, purchase orders, and material usage'
	},

	// Phase 3 Workflows (Concierge Platform)
	{
		name: 'caseLifecycleWorkflow',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P3.10',
		description: 'Concierge case lifecycle: INTAKE → ASSESSMENT → IN_PROGRESS → RESOLVED → CLOSED with intent conversion'
	},
	{
		name: 'externalApprovalWorkflow',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P3.10',
		description: 'External HOA approval tracking: submission, response handling, expiration alerts'
	},
	{
		name: 'conciergeActionWorkflow',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P3.10',
		description: 'Concierge action execution: PLANNED → IN_PROGRESS → COMPLETED with blocking/resume support'
	},
	{
		name: 'resolutionCloseoutWorkflow',
		version: 'v1',
		status: WorkflowStatus.CURRENT,
		phase: 'P3.10',
		description: 'Case resolution and closeout: validation, decision recording, closure, owner notification'
	}
];

/**
 * Get current version of a workflow by name
 */
export function getCurrentWorkflowVersion(workflowName: string): WorkflowVersion | undefined {
	return WORKFLOW_REGISTRY.find(
		(w) => w.name === workflowName && w.status === WorkflowStatus.CURRENT
	);
}

/**
 * Get all versions of a workflow by name
 */
export function getWorkflowVersions(workflowName: string): WorkflowVersion[] {
	return WORKFLOW_REGISTRY.filter((w) => w.name === workflowName);
}

/**
 * Get all current workflows
 */
export function getCurrentWorkflows(): WorkflowVersion[] {
	return WORKFLOW_REGISTRY.filter((w) => w.status === WorkflowStatus.CURRENT);
}

/**
 * Get all deprecated workflows that need migration
 */
export function getDeprecatedWorkflows(): WorkflowVersion[] {
	return WORKFLOW_REGISTRY.filter((w) => w.status === WorkflowStatus.DEPRECATED);
}

/**
 * Get workflows by phase
 */
export function getWorkflowsByPhase(phase: string): WorkflowVersion[] {
	return WORKFLOW_REGISTRY.filter((w) => w.phase === phase);
}

/**
 * Workflow version summary for API/documentation
 */
export function getWorkflowSummary(): {
	total: number;
	current: number;
	deprecated: number;
	retired: number;
	byPhase: Record<string, number>;
} {
	const byPhase: Record<string, number> = {};
	
	for (const workflow of WORKFLOW_REGISTRY) {
		byPhase[workflow.phase] = (byPhase[workflow.phase] ?? 0) + 1;
	}

	return {
		total: WORKFLOW_REGISTRY.length,
		current: WORKFLOW_REGISTRY.filter((w) => w.status === WorkflowStatus.CURRENT).length,
		deprecated: WORKFLOW_REGISTRY.filter((w) => w.status === WorkflowStatus.DEPRECATED).length,
		retired: WORKFLOW_REGISTRY.filter((w) => w.status === WorkflowStatus.RETIRED).length,
		byPhase
	};
}
