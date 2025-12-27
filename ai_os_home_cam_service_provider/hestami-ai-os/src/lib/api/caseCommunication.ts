/**
 * Case Communication API client
 * Provides typed functions for case communications management
 * 
 * Types are extracted from the generated OpenAPI types to follow
 * the type generation pipeline: Prisma → Zod → oRPC → OpenAPI → types.generated.ts
 */

import { orpc } from './orpc.js';
import { v4 as uuidv4 } from 'uuid';
import type { operations } from './types.generated.js';

// =============================================================================
// Type Definitions (extracted from generated types)
// =============================================================================

// Extract CaseCommunication type from get response
export type CaseCommunication = operations['caseCommunication.get']['responses']['200']['content']['application/json']['data']['communication'];

// Extract CaseCommunicationListItem from listByCase response
export type CaseCommunicationListItem = operations['caseCommunication.listByCase']['responses']['200']['content']['application/json']['data']['communications'][number];

// Extract CommunicationThread from getThreads response
export type CommunicationThread = operations['caseCommunication.getThreads']['responses']['200']['content']['application/json']['data']['threads'][number];

// Extract enum types from create request body
type CreateInput = operations['caseCommunication.create']['requestBody']['content']['application/json'];
export type CommunicationChannel = CreateInput['channel'];
export type CommunicationDirection = CreateInput['direction'];

// =============================================================================
// API Functions
// =============================================================================

export const caseCommunicationApi = {
	/**
	 * Create a new communication record
	 */
	create: (data: Omit<CreateInput, 'idempotencyKey'>) =>
		orpc.caseCommunication.create({
			...data,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Get communication by ID
	 */
	get: (id: string) =>
		orpc.caseCommunication.get({ id }),

	/**
	 * List communications for a case
	 */
	listByCase: (params: {
		caseId: string;
		channel?: CommunicationChannel;
		direction?: CommunicationDirection;
		threadId?: string;
		limit?: number;
		cursor?: string;
	}) => orpc.caseCommunication.listByCase(params),

	/**
	 * Update communication status
	 */
	update: (data: {
		id: string;
		deliveredAt?: string | null;
		readAt?: string | null;
		failedAt?: string | null;
		failureReason?: string | null;
	}) =>
		orpc.caseCommunication.update({
			...data,
			idempotencyKey: uuidv4()
		}),

	/**
	 * Get communication threads for a case
	 */
	getThreads: (caseId: string) =>
		orpc.caseCommunication.getThreads({ caseId })
};

// =============================================================================
// Helper Functions
// =============================================================================

export const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
	EMAIL: 'Email',
	SMS: 'SMS',
	LETTER: 'Letter'
};

export const CHANNEL_ICONS: Record<CommunicationChannel, string> = {
	EMAIL: 'mail',
	SMS: 'message-square',
	LETTER: 'file-text'
};

export const DIRECTION_LABELS: Record<CommunicationDirection, string> = {
	INBOUND: 'Received',
	OUTBOUND: 'Sent',
	INTERNAL: 'Internal'
};

export const DIRECTION_COLORS: Record<CommunicationDirection, string> = {
	INBOUND: 'preset-outlined-primary-500',
	OUTBOUND: 'preset-filled-success-500',
	INTERNAL: 'preset-outlined-surface-500'
};

export function generateIdempotencyKey(): string {
	return `comm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function formatCommunicationDate(dateString: string | null): string {
	if (!dateString) return '';
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
	});
}
