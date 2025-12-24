/**
 * Vote Event Emitter
 * 
 * Handles real-time event broadcasting for live votes.
 * Used by SSE endpoint and vote action handlers.
 */

// Event types for vote updates
export type VoteEventType = 
	| 'ballot_cast'
	| 'tally_update'
	| 'vote_closed'
	| 'heartbeat';

export interface VoteEvent {
	type: VoteEventType;
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
	choice: string;
	hasConflictOfInterest: boolean;
}): void {
	emitVoteEvent(voteId, {
		type: 'ballot_cast',
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
		type: 'tally_update',
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
		type: 'vote_closed',
		data,
		timestamp: new Date().toISOString()
	});
}
