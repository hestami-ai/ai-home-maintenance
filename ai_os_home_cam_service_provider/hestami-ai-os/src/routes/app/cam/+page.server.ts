import { createDirectClient, buildServerContext } from '$lib/server/api/serverClient';
import type { PageServerLoad } from './$types';
import { MeetingStatus } from '../../../../generated/prisma/enums.js';

export const load: PageServerLoad = async ({ parent, locals }) => {
	// Get organization, memberships, and staff from parent layout (fetched via SECURITY DEFINER)
	const { organization, currentAssociation, memberships, staff } = await parent();

	if (!organization || !currentAssociation) {
		return {
			dashboardData: null,
			reports: [],
			meetings: []
		, association: null};
	}

	// Build context using data from parent layout
	const orgRoles: Record<string, any> = {};
	for (const m of memberships ?? []) {
		orgRoles[m.organization.id] = m.role;
	}
	const staffRoles = staff?.roles ?? [];
	const pillarAccess = staff?.pillarAccess ?? [];
	const role = orgRoles[organization.id];
	
	const context = buildServerContext(locals, { orgRoles, staffRoles, pillarAccess, organization, role });
	const client = createDirectClient(context);

	try {
		const [dashboardRes, reportsRes, meetingsRes] = await Promise.all([
			// Pass associationId to filter properly (if router supports it)
			client.dashboard.getData({ associationId: currentAssociation.id }),

			// Fetch definitions
			client.reportDefinition.list({}),

			// Fetch scheduled meetings
			client.governanceMeeting.list({ status: MeetingStatus.SCHEDULED })
		]);

		let dashboardData = null;
		if (dashboardRes.ok && dashboardRes.data?.dashboard) {
			dashboardData = dashboardRes.data.dashboard;
		}

		let reports: any[] = [];
		if (reportsRes.ok && reportsRes.data?.reports) {
			reports = reportsRes.data.reports.slice(0, 5).map((r: any) => ({
				id: r.id,
				name: r.name,
				category: r.category,
				lastRun: undefined // server data doesn't have lastRun in list view usually
			}));
		}

		let meetings: any[] = [];
		if (meetingsRes.ok && meetingsRes.data?.meetings) {
			meetings = meetingsRes.data.meetings.slice(0, 4).map((m: any) => ({
				id: m.id,
				title: m.title,
				type: m.type,
				date: new Date(m.scheduledFor).toISOString(),
				time: '',
				location: undefined
			}));
		}

		return {
			dashboardData,
			reports,
			meetings
		, association: null};

	} catch (err) {
		console.error('Failed to load dashboard data:', err);
		return {
			dashboardData: null,
			reports: [],
			meetings: []
		, association: null};
	}
};
