/**
 * SSE Endpoint for Live Meeting Updates
 * 
 * Streams real-time updates for:
 * - Attendance changes
 * - Vote tallies
 * - Motion status changes
 * - Meeting state transitions
 */

import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

// Event types for meeting updates
type MeetingEventType = 
	| 'attendance_update'
	| 'vote_update'
	| 'motion_update'
	| 'meeting_state'
	| 'quorum_update'
	| 'heartbeat';

interface MeetingEvent {
	type: MeetingEventType;
	data: unknown;
	timestamp: string;
}

// In-memory event emitter for meeting updates
// In production, this would be backed by Redis pub/sub or similar
const meetingSubscribers = new Map<string, Set<(event: MeetingEvent) => void>>();

export function emitMeetingEvent(meetingId: string, event: MeetingEvent): void {
	const subscribers = meetingSubscribers.get(meetingId);
	if (subscribers) {
		subscribers.forEach(callback => callback(event));
	}
}

export const GET: RequestHandler = async ({ params, request }) => {
	const meetingId = params.id;

	// Verify meeting exists
	const meeting = await prisma.meeting.findUnique({
		where: { id: meetingId },
		select: { id: true, status: true, title: true }
	});

	if (!meeting) {
		return new Response('Meeting not found', { status: 404 });
	}

	// Set up SSE stream
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			// Helper to send SSE event
			const sendEvent = (event: MeetingEvent) => {
				const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
				controller.enqueue(encoder.encode(data));
			};

			// Subscribe to meeting events
			if (!meetingSubscribers.has(meetingId)) {
				meetingSubscribers.set(meetingId, new Set());
			}
			meetingSubscribers.get(meetingId)!.add(sendEvent);

			// Send initial state
			sendEvent({
				type: 'meeting_state',
				data: { 
					meetingId: meeting.id, 
					status: meeting.status,
					title: meeting.title,
					connected: true 
				},
				timestamp: new Date().toISOString()
			});

			// Heartbeat every 30 seconds to keep connection alive
			const heartbeatInterval = setInterval(() => {
				sendEvent({
					type: 'heartbeat',
					data: { meetingId },
					timestamp: new Date().toISOString()
				});
			}, 30000);

			// Clean up on close
			request.signal.addEventListener('abort', () => {
				clearInterval(heartbeatInterval);
				const subscribers = meetingSubscribers.get(meetingId);
				if (subscribers) {
					subscribers.delete(sendEvent);
					if (subscribers.size === 0) {
						meetingSubscribers.delete(meetingId);
					}
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no' // Disable nginx buffering
		}
	});
};

// Helper functions to emit specific event types
export function emitAttendanceUpdate(meetingId: string, data: {
	partyId: string;
	status: string;
	presentCount: number;
	quorumMet: boolean;
}): void {
	emitMeetingEvent(meetingId, {
		type: 'attendance_update',
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
		type: 'vote_update',
		data,
		timestamp: new Date().toISOString()
	});
}

export function emitMotionUpdate(meetingId: string, data: {
	motionId: string;
	motionNumber: string;
	status: string;
	outcome?: string;
}): void {
	emitMeetingEvent(meetingId, {
		type: 'motion_update',
		data,
		timestamp: new Date().toISOString()
	});
}

export function emitMeetingStateChange(meetingId: string, data: {
	fromStatus: string;
	toStatus: string;
}): void {
	emitMeetingEvent(meetingId, {
		type: 'meeting_state',
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
		type: 'quorum_update',
		data,
		timestamp: new Date().toISOString()
	});
}
