/**
 * Service Call Terminology Mapping
 * 
 * This module provides a presentation layer abstraction that maps backend
 * ConciergeCase terminology to user-friendly "Service Call" terminology
 * for property owner views.
 * 
 * Backend Model: ConciergeCase
 * UI Term: Service Call
 */

import type { ConciergeCaseStatus, ConciergeCasePriority } from '$lib/api/cam';

// =============================================================================
// Status Mapping
// =============================================================================

/**
 * Maps ConciergeCase status to user-friendly Service Call status labels
 */
export const SERVICE_CALL_STATUS_LABELS: Record<ConciergeCaseStatus, string> = {
	INTAKE: 'Submitted',
	ASSESSMENT: 'Under Review',
	IN_PROGRESS: 'In Progress',
	PENDING_EXTERNAL: 'Awaiting Response',
	PENDING_OWNER: 'Action Required',
	ON_HOLD: 'On Hold',
	RESOLVED: 'Completed',
	CLOSED: 'Closed',
	CANCELLED: 'Cancelled'
};

/**
 * Maps ConciergeCase status to color classes for badges
 */
export const SERVICE_CALL_STATUS_COLORS: Record<ConciergeCaseStatus, string> = {
	INTAKE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
	ASSESSMENT: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
	IN_PROGRESS: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
	PENDING_EXTERNAL: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
	PENDING_OWNER: 'bg-red-500/10 text-red-600 dark:text-red-400',
	ON_HOLD: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
	RESOLVED: 'bg-green-500/10 text-green-600 dark:text-green-400',
	CLOSED: 'bg-surface-500/10 text-surface-600 dark:text-surface-400',
	CANCELLED: 'bg-surface-500/10 text-surface-500'
};

/**
 * Maps ConciergeCase status to dot indicator colors
 */
export const SERVICE_CALL_STATUS_DOT_COLORS: Record<ConciergeCaseStatus, string> = {
	INTAKE: 'bg-blue-500',
	ASSESSMENT: 'bg-purple-500',
	IN_PROGRESS: 'bg-amber-500',
	PENDING_EXTERNAL: 'bg-orange-500',
	PENDING_OWNER: 'bg-red-500',
	ON_HOLD: 'bg-gray-500',
	RESOLVED: 'bg-green-500',
	CLOSED: 'bg-surface-500',
	CANCELLED: 'bg-surface-400'
};

// =============================================================================
// Priority/Urgency Mapping
// =============================================================================

/**
 * Service Call urgency levels (user-facing)
 */
export type ServiceCallUrgency = 'ROUTINE' | 'SOON' | 'URGENT' | 'EMERGENCY';

/**
 * Maps Service Call urgency to ConciergeCase priority
 */
export const URGENCY_TO_PRIORITY: Record<ServiceCallUrgency, ConciergeCasePriority> = {
	ROUTINE: 'LOW',
	SOON: 'NORMAL',
	URGENT: 'HIGH',
	EMERGENCY: 'EMERGENCY'
};

/**
 * Maps ConciergeCase priority back to Service Call urgency
 */
export const PRIORITY_TO_URGENCY: Record<ConciergeCasePriority, ServiceCallUrgency> = {
	LOW: 'ROUTINE',
	NORMAL: 'SOON',
	HIGH: 'URGENT',
	URGENT: 'URGENT',
	EMERGENCY: 'EMERGENCY'
};

/**
 * User-friendly urgency labels
 */
export const SERVICE_CALL_URGENCY_LABELS: Record<ServiceCallUrgency, string> = {
	ROUTINE: 'Routine',
	SOON: 'Soon',
	URGENT: 'Urgent',
	EMERGENCY: 'Emergency'
};

/**
 * Urgency descriptions for the submission form
 */
export const SERVICE_CALL_URGENCY_DESCRIPTIONS: Record<ServiceCallUrgency, string> = {
	ROUTINE: 'Schedule at your convenience',
	SOON: 'Within a few days',
	URGENT: 'Same day if possible',
	EMERGENCY: 'Immediate - safety or damage risk'
};

/**
 * Urgency color classes
 */
export const SERVICE_CALL_URGENCY_COLORS: Record<ServiceCallUrgency, string> = {
	ROUTINE: 'text-surface-500',
	SOON: 'text-blue-500',
	URGENT: 'text-amber-500',
	EMERGENCY: 'text-red-500'
};

// =============================================================================
// Category Mapping
// =============================================================================

/**
 * Service Call categories
 */
export type ServiceCallCategory =
	| 'PLUMBING'
	| 'ELECTRICAL'
	| 'HVAC'
	| 'GENERAL_REPAIRS'
	| 'PEST_CONTROL'
	| 'LANDSCAPING'
	| 'SECURITY'
	| 'ROOFING'
	| 'APPLIANCES'
	| 'OTHER';

/**
 * Category labels for display
 */
export const SERVICE_CALL_CATEGORY_LABELS: Record<ServiceCallCategory, string> = {
	PLUMBING: 'Plumbing',
	ELECTRICAL: 'Electrical',
	HVAC: 'HVAC',
	GENERAL_REPAIRS: 'General Repairs',
	PEST_CONTROL: 'Pest Control',
	LANDSCAPING: 'Landscaping',
	SECURITY: 'Security',
	ROOFING: 'Roofing',
	APPLIANCES: 'Appliances',
	OTHER: 'Other'
};

/**
 * Category descriptions
 */
export const SERVICE_CALL_CATEGORY_DESCRIPTIONS: Record<ServiceCallCategory, string> = {
	PLUMBING: 'Leaks, clogs, water heater, fixtures',
	ELECTRICAL: 'Outlets, wiring, lighting, panels',
	HVAC: 'Heating, cooling, ventilation',
	GENERAL_REPAIRS: 'Doors, windows, drywall, painting',
	PEST_CONTROL: 'Insects, rodents, wildlife',
	LANDSCAPING: 'Lawn, trees, irrigation',
	SECURITY: 'Locks, alarms, cameras',
	ROOFING: 'Roof repairs, gutters',
	APPLIANCES: 'Washer, dryer, dishwasher, etc.',
	OTHER: 'Other maintenance needs'
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get user-friendly status label for a ConciergeCase status
 */
export function getServiceCallStatusLabel(status: ConciergeCaseStatus): string {
	return SERVICE_CALL_STATUS_LABELS[status] || status;
}

/**
 * Get status badge color classes
 */
export function getServiceCallStatusColor(status: ConciergeCaseStatus): string {
	return SERVICE_CALL_STATUS_COLORS[status] || 'bg-surface-500/10 text-surface-500';
}

/**
 * Get status dot color class
 */
export function getServiceCallStatusDotColor(status: ConciergeCaseStatus): string {
	return SERVICE_CALL_STATUS_DOT_COLORS[status] || 'bg-surface-500';
}

/**
 * Convert urgency to backend priority
 */
export function urgencyToPriority(urgency: ServiceCallUrgency): ConciergeCasePriority {
	return URGENCY_TO_PRIORITY[urgency];
}

/**
 * Convert backend priority to urgency
 */
export function priorityToUrgency(priority: ConciergeCasePriority): ServiceCallUrgency {
	return PRIORITY_TO_URGENCY[priority];
}

/**
 * Get urgency label
 */
export function getUrgencyLabel(urgency: ServiceCallUrgency): string {
	return SERVICE_CALL_URGENCY_LABELS[urgency];
}

/**
 * Get category label
 */
export function getCategoryLabel(category: ServiceCallCategory): string {
	return SERVICE_CALL_CATEGORY_LABELS[category] || category;
}

/**
 * Check if a service call needs owner attention
 */
export function needsOwnerAttention(status: ConciergeCaseStatus): boolean {
	return status === 'INTAKE' || status === 'PENDING_OWNER';
}

/**
 * Check if a service call is active (not closed/cancelled/resolved)
 */
export function isActiveServiceCall(status: ConciergeCaseStatus): boolean {
	return !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(status);
}

/**
 * Get active statuses for filtering
 */
export function getActiveStatuses(): ConciergeCaseStatus[] {
	return ['INTAKE', 'ASSESSMENT', 'IN_PROGRESS', 'PENDING_EXTERNAL', 'PENDING_OWNER', 'ON_HOLD'];
}

/**
 * Get completed statuses for filtering
 */
export function getCompletedStatuses(): ConciergeCaseStatus[] {
	return ['RESOLVED', 'CLOSED', 'CANCELLED'];
}
