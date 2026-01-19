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
import { meetingSubscribers, type MeetingEvent } from '$lib/server/meeting-events';

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
					type: 'heartbeat' as const,
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
