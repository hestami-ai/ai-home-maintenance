/**
 * SSE Endpoint for Live Vote Updates
 *
 * Streams real-time updates for:
 * - Ballot counts (yes/no/abstain)
 * - Quorum status
 * - Vote closure
 */

import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';
import { voteSubscribers, type VoteEvent } from '$lib/server/vote-events';
import { MeetingAttendanceStatus, VoteChoice } from '../../../../../../../../generated/prisma/enums.js';

export const GET: RequestHandler = async ({ params, request }) => {
	const voteId = params.id;

	// Verify vote exists and get current tally
	const vote = await prisma.vote.findUnique({
		where: { id: voteId },
		include: {
			ballots: { select: { choice: true } },
			meeting: {
				select: {
					quorumRequired: true,
					attendance: { where: { status: { not: MeetingAttendanceStatus.ABSENT } } }
				}
			}
		}
	});

	if (!vote) {
		return new Response('Vote not found', { status: 404 });
	}

	// Calculate initial tally
	const yes = vote.ballots.filter(b => b.choice === VoteChoice.YES).length;
	const no = vote.ballots.filter(b => b.choice === VoteChoice.NO).length;
	const abstain = vote.ballots.filter(b => b.choice === VoteChoice.ABSTAIN).length;
	const totalBallots = vote.ballots.length;
	const presentCount = vote.meeting.attendance.length;
	const quorumRequired = vote.meeting.quorumRequired;
	const quorumMet = quorumRequired === null || presentCount >= quorumRequired;

	// Set up SSE stream
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			// Helper to send SSE event
			const sendEvent = (event: VoteEvent) => {
				const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
				controller.enqueue(encoder.encode(data));
			};

			// Subscribe to vote events
			if (!voteSubscribers.has(voteId)) {
				voteSubscribers.set(voteId, new Set());
			}
			voteSubscribers.get(voteId)!.add(sendEvent);

			// Send initial tally
			sendEvent({
				type: 'tally_update',
				data: {
					voteId: vote.id,
					question: vote.question,
					yes,
					no,
					abstain,
					totalBallots,
					presentCount,
					quorumRequired,
					quorumMet,
					isClosed: vote.closedAt !== null,
					connected: true
				},
				timestamp: new Date().toISOString()
			});

			// Heartbeat every 30 seconds
			const heartbeatInterval = setInterval(() => {
				sendEvent({
					type: 'heartbeat',
					data: { voteId },
					timestamp: new Date().toISOString()
				});
			}, 30000);

			// Clean up on close
			request.signal.addEventListener('abort', () => {
				clearInterval(heartbeatInterval);
				const subscribers = voteSubscribers.get(voteId);
				if (subscribers) {
					subscribers.delete(sendEvent);
					if (subscribers.size === 0) {
						voteSubscribers.delete(voteId);
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
			'X-Accel-Buffering': 'no'
		}
	});
};
