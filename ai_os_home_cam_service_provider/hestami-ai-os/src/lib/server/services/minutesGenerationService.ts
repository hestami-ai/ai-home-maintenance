/**
 * Minutes Generation Service
 * 
 * Phase 11.9: Infrastructure for AI-assisted meeting minutes generation.
 * LLM integration is deferred - this provides the interface and template-based generation.
 */

import { prisma } from '../db.js';

// ============================================================================
// Types
// ============================================================================

export interface MinutesGenerationInput {
	meetingId: string;
	transcript?: string;
	includeAttendance?: boolean;
	includeMotions?: boolean;
	includeVotes?: boolean;
}

export interface MinutesSection {
	title: string;
	content: string;
	order: number;
}

export interface GeneratedMinutes {
	meetingId: string;
	sections: MinutesSection[];
	fullText: string;
	generatedAt: string;
	method: 'template' | 'ai';
}

export interface MinutesTemplate {
	id: string;
	name: string;
	sections: Array<{
		title: string;
		placeholder: string;
		required: boolean;
	}>;
}

// ============================================================================
// Default Template
// ============================================================================

export const DEFAULT_MINUTES_TEMPLATE: MinutesTemplate = {
	id: 'default',
	name: 'Standard Meeting Minutes',
	sections: [
		{
			title: 'Call to Order',
			placeholder: 'The meeting was called to order at [TIME] by [PRESIDING OFFICER].',
			required: true
		},
		{
			title: 'Roll Call / Attendance',
			placeholder: 'Present: [ATTENDEES]\nAbsent: [ABSENT MEMBERS]\nQuorum: [MET/NOT MET]',
			required: true
		},
		{
			title: 'Approval of Previous Minutes',
			placeholder: 'Motion to approve minutes from [PREVIOUS MEETING DATE].\nMoved by: [MOVER]\nSeconded by: [SECONDER]\nResult: [APPROVED/TABLED]',
			required: false
		},
		{
			title: 'Reports',
			placeholder: '[COMMITTEE/OFFICER REPORTS]',
			required: false
		},
		{
			title: 'Old Business',
			placeholder: '[ITEMS FROM PREVIOUS MEETINGS]',
			required: false
		},
		{
			title: 'New Business',
			placeholder: '[NEW AGENDA ITEMS AND DISCUSSIONS]',
			required: false
		},
		{
			title: 'Motions and Votes',
			placeholder: '[LIST OF MOTIONS WITH OUTCOMES]',
			required: true
		},
		{
			title: 'Announcements',
			placeholder: '[ANY ANNOUNCEMENTS MADE]',
			required: false
		},
		{
			title: 'Adjournment',
			placeholder: 'The meeting was adjourned at [TIME].\nNext meeting: [DATE/TIME/LOCATION]',
			required: true
		}
	]
};

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Generate meeting minutes from structured data using templates.
 * This is the non-AI fallback that creates a structured draft from meeting data.
 */
export async function generateMinutesDraft(input: MinutesGenerationInput): Promise<GeneratedMinutes> {
	const { meetingId, includeAttendance = true, includeMotions = true, includeVotes = true } = input;

	// Fetch meeting base data
	const meeting = await prisma.meeting.findUnique({
		where: { id: meetingId }
	});

	if (!meeting) {
		throw new Error(`Meeting not found: ${meetingId}`);
	}

	const sections: MinutesSection[] = [];
	let order = 0;

	// Call to Order
	sections.push({
		title: 'Call to Order',
		content: `The ${meeting.type.toLowerCase().replace('_', ' ')} meeting was called to order at ${formatTime(meeting.scheduledFor)}.`,
		order: order++
	});

	// Attendance - fetch separately
	if (includeAttendance) {
		const attendance = await prisma.meetingAttendance.findMany({
			where: { meetingId },
			include: { party: true }
		});

		if (attendance.length > 0) {
			const getPartyName = (party: { firstName?: string | null; lastName?: string | null; entityName?: string | null } | null) => {
				if (!party) return 'Unknown';
				if (party.entityName) return party.entityName;
				if (party.firstName || party.lastName) return `${party.firstName || ''} ${party.lastName || ''}`.trim();
				return 'Unknown';
			};
			const present = attendance
				.filter(a => a.status === 'PRESENT')
				.map(a => getPartyName(a.party))
				.join(', ');
			const absent = attendance
				.filter(a => a.status === 'ABSENT' || a.status === 'EXCUSED')
				.map(a => getPartyName(a.party))
				.join(', ');
			const quorumMet = meeting.quorumRequired 
				? attendance.filter(a => a.status !== 'ABSENT' && a.status !== 'EXCUSED').length >= meeting.quorumRequired
				: true;

			sections.push({
				title: 'Roll Call / Attendance',
				content: `Present: ${present || 'None recorded'}\nAbsent: ${absent || 'None'}\nQuorum: ${quorumMet ? 'Met' : 'Not Met'}`,
				order: order++
			});
		}
	}

	// Agenda Items - fetch separately
	const agendaItems = await prisma.meetingAgendaItem.findMany({
		where: { meetingId },
		orderBy: { order: 'asc' }
	});

	if (agendaItems.length > 0) {
		const agendaContent = agendaItems
			.map((item, idx) => 
				`${idx + 1}. ${item.title}${item.description ? `\n   ${item.description}` : ''}`)
			.join('\n');
		
		sections.push({
			title: 'Agenda Items',
			content: agendaContent,
			order: order++
		});
	}

	// Motions - fetch separately
	if (includeMotions) {
		const motions = await prisma.boardMotion.findMany({
			where: { meetingId }
		});

		if (motions.length > 0) {
			const motionsContent = motions.map(motion => {
				let text = `Motion ${motion.motionNumber}: ${motion.title}\n`;
				text += `  Status: ${motion.status}`;
				if (motion.outcome) {
					text += ` - ${motion.outcome}`;
				}
				return text;
			}).join('\n\n');

			sections.push({
				title: 'Motions and Votes',
				content: motionsContent,
				order: order++
			});
		}
	}

	// Vote Results - fetch separately
	if (includeVotes) {
		const votes = await prisma.vote.findMany({
			where: { meetingId },
			include: { ballots: true }
		});

		if (votes.length > 0) {
			const votesContent = votes.map(vote => {
				const yes = vote.ballots.filter(b => b.choice === 'YES').length;
				const no = vote.ballots.filter(b => b.choice === 'NO').length;
				const abstain = vote.ballots.filter(b => b.choice === 'ABSTAIN').length;
				const result = vote.closedAt ? (yes > no ? 'Passed' : 'Failed') : 'Pending';
				return `${vote.question}\n  Yes: ${yes}, No: ${no}, Abstain: ${abstain}\n  Result: ${result}`;
			}).join('\n\n');

			sections.push({
				title: 'Vote Results',
				content: votesContent,
				order: order++
			});
		}
	}

	// Adjournment
	sections.push({
		title: 'Adjournment',
		content: `The meeting was adjourned.\n\nMinutes prepared by: [SECRETARY NAME]\nDate approved: [DATE]`,
		order: order++
	});

	// Combine into full text
	const fullText = sections
		.map(s => `## ${s.title}\n\n${s.content}`)
		.join('\n\n---\n\n');

	return {
		meetingId,
		sections,
		fullText,
		generatedAt: new Date().toISOString(),
		method: 'template'
	};
}

/**
 * Placeholder for AI-enhanced minutes generation.
 * Will be implemented when LLM integration is ready.
 */
export async function generateMinutesWithAI(input: MinutesGenerationInput): Promise<GeneratedMinutes> {
	// For now, fall back to template-based generation
	console.log('AI minutes generation not yet implemented, using template-based generation');
	return generateMinutesDraft(input);
}

/**
 * Get available minutes templates
 */
export function getMinutesTemplates(): MinutesTemplate[] {
	return [DEFAULT_MINUTES_TEMPLATE];
}

// ============================================================================
// Helpers
// ============================================================================

function formatTime(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
