/**
 * Meeting Event Emitter
 *
 * Handles real-time event broadcasting for live meetings.
 * Used by SSE endpoint and meeting action handlers.
 */

import { MeetingAttendanceStatus, BoardMotionStatus, BoardMotionOutcome, MeetingStatus } from '../../../generated/prisma/enums.js';
import { MeetingEventType } from './workflows/schemas.js';

export interface MeetingEvent {
	type: MeetingEventType;
	data: unknown;
	timestamp: string;
}

// In-memory event emitter for meeting updates
// In production, this would be backed by Redis pub/sub or similar
export const meetingSubscribers = new Map<string, Set<(event: MeetingEvent) => void>>();

export function emitMeetingEvent(meetingId: string, event: MeetingEvent): void {
	const subscribers = meetingSubscribers.get(meetingId);
	if (subscribers) {
		subscribers.forEach(callback => callback(event));
	}
}

// Helper functions to emit specific event types
export function emitAttendanceUpdate(meetingId: string, data: {
	partyId: string;
	status: MeetingAttendanceStatus;
	presentCount: number;
	quorumMet: boolean;
}): void {
	emitMeetingEvent(meetingId, {
		type: MeetingEventType.ATTENDANCE_UPDATE,
		data,
		timestamp: new Date().toISOString()
	});
}

export function emitVoteUpdate(meetingId: string, data: {
	voteId: string;
	yes: number;
	no: number;
	abstain: number;
	totalBallots: number;
	quorumMet: boolean;
}): void {
	emitMeetingEvent(meetingId, {
		type: MeetingEventType.VOTE_UPDATE,
		data,
		timestamp: new Date().toISOString()
	});
}

export function emitMotionUpdate(meetingId: string, data: {
	motionId: string;
	motionNumber: string;
	status: BoardMotionStatus;
	outcome?: BoardMotionOutcome;
}): void {
	emitMeetingEvent(meetingId, {
		type: MeetingEventType.MOTION_UPDATE,
		data,
		timestamp: new Date().toISOString()
	});
}

export function emitMeetingStateChange(meetingId: string, data: {
	fromStatus: MeetingStatus;
	toStatus: MeetingStatus;
}): void {
	emitMeetingEvent(meetingId, {
		type: MeetingEventType.MEETING_STATE,
		data,
		timestamp: new Date().toISOString()
	});
}

export function emitQuorumUpdate(meetingId: string, data: {
	required: number | null;
	present: number;
	met: boolean;
}): void {
	emitMeetingEvent(meetingId, {
		type: MeetingEventType.QUORUM_UPDATE,
		data,
		timestamp: new Date().toISOString()
	});
}
