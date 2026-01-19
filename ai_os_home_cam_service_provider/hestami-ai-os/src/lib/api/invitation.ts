/**
 * Phase 38: Invitation API client wrapper
 *
 * Provides a convenient wrapper around the oRPC invitation endpoints
 * with type exports and label mappings for UI usage.
 */

import { orpc } from './orpc.js';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Enum Value Constants - Client-safe copies for use in Svelte components
// =============================================================================

export const InvitationStatusValues = {
	PENDING: 'PENDING',
	ACCEPTED: 'ACCEPTED',
	EXPIRED: 'EXPIRED',
	REVOKED: 'REVOKED'
} as const;

export const JoinRequestStatusValues = {
	PENDING: 'PENDING',
	APPROVED: 'APPROVED',
	REJECTED: 'REJECTED',
	CANCELLED: 'CANCELLED'
} as const;

export const InvitationDeliveryMethodValues = {
	CODE: 'CODE',
	EMAIL: 'EMAIL',
	SMS: 'SMS'
} as const;

// =============================================================================
// Type Definitions
// =============================================================================

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
export type JoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type InvitationDeliveryMethod = 'CODE' | 'EMAIL' | 'SMS';

export interface Invitation {
	id: string;
	organizationId: string;
	email: string;
	role: string;
	invitedByUserId: string;
	status: InvitationStatus;
	deliveryMethod: InvitationDeliveryMethod;
	expiresAt: string;
	acceptedAt: string | null;
	acceptedByUserId: string | null;
	sentAt: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
	organization?: {
		id: string;
		name: string;
		slug: string;
		type: string;
	};
	invitedBy?: {
		id: string;
		email: string;
		name: string | null;
	};
}

export interface InvitationListItem {
	id: string;
	email: string;
	role: string;
	status: InvitationStatus;
	deliveryMethod: InvitationDeliveryMethod;
	expiresAt: string;
	sentAt: string | null;
	createdAt: string;
	invitedBy: {
		id: string;
		name: string | null;
	};
}

export interface PendingInvitation {
	id: string;
	organizationId: string;
	organizationName: string;
	organizationType: string;
	role: string;
	expiresAt: string;
	invitedByName: string | null;
}

export interface JoinRequest {
	id: string;
	organizationId: string;
	userId: string;
	requestedRole: string;
	status: JoinRequestStatus;
	verificationData: Record<string, unknown> | null;
	reviewedByUserId: string | null;
	reviewedAt: string | null;
	rejectionReason: string | null;
	createdAt: string;
	updatedAt: string;
	user?: {
		id: string;
		email: string;
		name: string | null;
	};
	organization?: {
		id: string;
		name: string;
		slug: string;
		type: string;
	};
}

export interface JoinRequestListItem {
	id: string;
	userId: string;
	requestedRole: string;
	status: JoinRequestStatus;
	verificationData: Record<string, unknown> | null;
	createdAt: string;
	user: {
		id: string;
		email: string;
		name: string | null;
	};
}

// =============================================================================
// Label Mappings for UI
// =============================================================================

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
	PENDING: 'Pending',
	ACCEPTED: 'Accepted',
	EXPIRED: 'Expired',
	REVOKED: 'Revoked'
};

export const INVITATION_STATUS_COLORS: Record<InvitationStatus, string> = {
	PENDING: 'warning',
	ACCEPTED: 'success',
	EXPIRED: 'surface',
	REVOKED: 'error'
};

export const JOIN_REQUEST_STATUS_LABELS: Record<JoinRequestStatus, string> = {
	PENDING: 'Pending Review',
	APPROVED: 'Approved',
	REJECTED: 'Rejected',
	CANCELLED: 'Cancelled'
};

export const JOIN_REQUEST_STATUS_COLORS: Record<JoinRequestStatus, string> = {
	PENDING: 'warning',
	APPROVED: 'success',
	REJECTED: 'error',
	CANCELLED: 'surface'
};

export const DELIVERY_METHOD_LABELS: Record<InvitationDeliveryMethod, string> = {
	CODE: 'Activation Code',
	EMAIL: 'Email Link',
	SMS: 'SMS Code'
};

// =============================================================================
// Invitation API Client
// =============================================================================

export interface CreateInvitationInput {
	email: string;
	role: string;
	deliveryMethod?: InvitationDeliveryMethod;
	expiresInHours?: number;
	metadata?: Record<string, unknown>;
}

export const invitationApi = {
	/**
	 * Create a new invitation to join the organization
	 */
	async create(input: CreateInvitationInput) {
		return orpc.invitation.create({
			email: input.email,
			role: input.role,
			deliveryMethod: input.deliveryMethod ?? 'CODE',
			expiresInHours: input.expiresInHours ?? 72,
			metadata: input.metadata,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * List invitations for the current organization
	 */
	async list(params?: { status?: InvitationStatus; limit?: number; cursor?: string }) {
		return orpc.invitation.list(params ?? {});
	},

	/**
	 * Get a single invitation by ID
	 */
	async get(invitationId: string) {
		return orpc.invitation.get({ invitationId });
	},

	/**
	 * Resend an invitation (regenerates code if expired)
	 */
	async resend(invitationId: string) {
		return orpc.invitation.resend({
			invitationId,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Revoke a pending invitation
	 */
	async revoke(invitationId: string) {
		return orpc.invitation.revoke({
			invitationId,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Accept an invitation using activation code (self-service)
	 */
	async accept(code: string) {
		return orpc.invitation.accept({
			code,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Get pending invitations for the current user
	 */
	async pending() {
		return orpc.invitation.pending();
	}
};

// =============================================================================
// Join Request API Client
// =============================================================================

export interface CreateJoinRequestInput {
	organizationId: string;
	requestedRole: string;
	verificationData?: Record<string, unknown>;
}

export const joinRequestApi = {
	/**
	 * Create a join request (self-service)
	 */
	async create(input: CreateJoinRequestInput) {
		return orpc.joinRequest.create({
			organizationId: input.organizationId,
			requestedRole: input.requestedRole,
			verificationData: input.verificationData,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * List join requests for the current organization (admin)
	 */
	async list(params?: { status?: JoinRequestStatus; limit?: number; cursor?: string }) {
		return orpc.joinRequest.list(params ?? {});
	},

	/**
	 * Approve a join request (admin)
	 */
	async approve(joinRequestId: string, role?: string) {
		return orpc.joinRequest.approve({
			joinRequestId,
			role,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Reject a join request (admin)
	 */
	async reject(joinRequestId: string, reason?: string) {
		return orpc.joinRequest.reject({
			joinRequestId,
			reason,
			idempotencyKey: uuidv4()
		});
	},

	/**
	 * Cancel own join request
	 */
	async cancel(joinRequestId: string) {
		return orpc.joinRequest.cancel({
			joinRequestId,
			idempotencyKey: uuidv4()
		});
	}
};
