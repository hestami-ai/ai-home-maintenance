/**
 * Vote Event Emitter
 *
 * Handles real-time event broadcasting for live votes.
 * Used by SSE endpoint and vote action handlers.
 */

import { VoteChoice } from '../../../generated/prisma/enums.js';
import { VoteEventType } from './workflows/schemas.js';

// Event types for vote updates - extends schema VoteEventType with heartbeat
export type VoteEventTypeExtended =
	| VoteEventType
	| 'heartbeat';

export interface VoteEvent {
	type: VoteEventTypeExtended;
	data: unknown;
	timestamp: string;
}

// In-memory event emitter for vote updates
// In production, this would be backed by Redis pub/sub or similar
export const voteSubscribers = new Map<string, Set<(event: VoteEvent) => void>>();

export function emitVoteEvent(voteId: string, event: VoteEvent): void {
	const subscribers = voteSubscribers.get(voteId);
	if (subscribers) {
		subscribers.forEach(callback => callback(event));
	}
}

// Helper functions to emit specific event types
export function emitBallotCast(voteId: string, data: {
	voterPartyId: string;
	choice: VoteChoice;
	hasConflictOfInterest: boolean;
}): void {
	emitVoteEvent(voteId, {
		type: VoteEventType.BALLOT_CAST,
		data,
		timestamp: new Date().toISOString()
	});
}

export function emitTallyUpdate(voteId: string, data: {
	yes: number;
	no: number;
	abstain: number;
	totalBallots: number;
	quorumMet: boolean;
}): void {
	emitVoteEvent(voteId, {
		type: VoteEventType.TALLY_UPDATE,
		data,
		timestamp: new Date().toISOString()
	});
}

export function emitVoteClosed(voteId: string, data: {
	yes: number;
	no: number;
	abstain: number;
	passed: boolean;
	closedAt: string;
}): void {
	emitVoteEvent(voteId, {
		type: VoteEventType.VOTE_CLOSED,
		data,
		timestamp: new Date().toISOString()
	});
}
