/**
 * Case Communication API client
 * Provides typed functions for case communications management
 */

import { apiCall } from './client';

// =============================================================================
// Types
// =============================================================================

export type CommunicationChannel = 'EMAIL' | 'SMS' | 'LETTER';
export type CommunicationDirection = 'INBOUND' | 'OUTBOUND' | 'INTERNAL';

export interface CaseCommunication {
	id: string;
	caseId: string;
	channel: CommunicationChannel;
	direction: CommunicationDirection;
	subject: string | null;
	content: string;
	fromUserId: string | null;
	fromUserName: string | null;
	toRecipient: string | null;
	ccRecipients: string | null;
	externalMessageId: string | null;
	threadId: string | null;
	sentAt: string | null;
	deliveredAt: string | null;
	readAt: string | null;
	failedAt: string | null;
	failureReason: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CaseCommunicationListItem {
	id: string;
	channel: CommunicationChannel;
	direction: CommunicationDirection;
	subject: string | null;
	contentPreview: string;
	fromUserName: string | null;
	toRecipient: string | null;
	sentAt: string | null;
	createdAt: string;
}

export interface CommunicationThread {
	threadId: string | null;
	messageCount: number;
	lastMessageAt: string;
	subject: string | null;
}

// =============================================================================
// API Functions
// =============================================================================

export const caseCommunicationApi = {
	/**
	 * Create a new communication record
	 */
	create: (data: {
		caseId: string;
		channel: CommunicationChannel;
		direction: CommunicationDirection;
		subject?: string;
		content: string;
		toRecipient?: string;
		ccRecipients?: string;
		threadId?: string;
		sentAt?: string;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ communication: CaseCommunication }>('caseCommunication/create', {
			body: data,
			organizationId
		}),

	/**
	 * Get communication by ID
	 */
	get: (id: string, organizationId: string) =>
		apiCall<{ communication: CaseCommunication }>('caseCommunication/get', {
			body: { id },
			organizationId
		}),

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
	}, organizationId: string) =>
		apiCall<{
			communications: CaseCommunicationListItem[];
			pagination: { hasMore: boolean; nextCursor: string | null };
		}>('caseCommunication/listByCase', {
			body: params,
			organizationId
		}),

	/**
	 * Update communication status
	 */
	update: (data: {
		id: string;
		deliveredAt?: string | null;
		readAt?: string | null;
		failedAt?: string | null;
		failureReason?: string | null;
		idempotencyKey: string;
	}, organizationId: string) =>
		apiCall<{ communication: CaseCommunication }>('caseCommunication/update', {
			body: data,
			organizationId
		}),

	/**
	 * Get communication threads for a case
	 */
	getThreads: (caseId: string, organizationId: string) =>
		apiCall<{ threads: CommunicationThread[] }>('caseCommunication/getThreads', {
			body: { caseId },
			organizationId
		})
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
