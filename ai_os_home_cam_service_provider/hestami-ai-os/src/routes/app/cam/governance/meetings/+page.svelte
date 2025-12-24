<script lang="ts">
	import { ArrowLeft, Calendar, Plus, Search, MapPin, Clock, Users, FileText, Gavel, ScrollText, History, CheckCircle, Video } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { SplitView, ListPanel, DetailPanel, ScheduleMeetingModal } from '$lib/components/cam';
	import { 
		QuorumIndicator, 
		VoteTallyCard, 
		MotionCard, 
		AttendanceList, 
		AgendaItemRow,
		MinutesEditor,
		GovernanceAuditTimeline
	} from '$lib/components/cam/governance';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';
	import { meetingLive } from '$lib/stores/governanceLive';
	import { governanceApi } from '$lib/api/cam';

	interface Meeting {
		id: string;
		title: string;
		type: 'BOARD' | 'ANNUAL' | 'SPECIAL' | 'COMMITTEE';
		date: string;
		time: string;
		location?: string;
		virtualLink?: string;
		status: 'SCHEDULED' | 'IN_SESSION' | 'ADJOURNED' | 'MINUTES_DRAFT' | 'MINUTES_APPROVED' | 'ARCHIVED' | 'CANCELLED';
		quorumRequired?: number | null;
		quorumMet?: boolean;
		minutesStatus?: 'none' | 'draft' | 'approved';
		attendeeCount?: number;
	}

	interface AgendaItem {
		id: string;
		order: number;
		title: string;
		description?: string | null;
		timeAllotment?: number | null;
		linkedEntities?: Array<{ type: 'arc' | 'violation' | 'workOrder' | 'policy'; id: string; label: string }>;
	}

	interface Motion {
		id: string;
		motionNumber: string;
		title: string;
		status: string;
		category?: string;
		movedBy?: string;
		secondedBy?: string;
		outcome?: string | null;
		decidedAt?: string | null;
	}

	interface Attendee {
		partyId: string;
		name: string | null;
		status: string;
		proxyFor?: string | null;
	}

	interface AuditEvent {
		id: string;
		type: string;
		action: string;
		actor: string;
		actorRole?: string;
		timestamp: string;
		details?: Record<string, unknown>;
	}

	let meetings = $state<Meeting[]>([]);
	let selectedMeeting = $state<Meeting | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let typeFilter = $state('all');
	let statusFilter = $state('all');
	let showScheduleModal = $state(false);
	let isScheduling = $state(false);
	let activeTab = $state(0);

	// Detail data for selected meeting
	let agendaItems = $state<AgendaItem[]>([]);
	let motions = $state<Motion[]>([]);
	let attendees = $state<Attendee[]>([]);
	let auditEvents = $state<AuditEvent[]>([]);
	let minutesContent = $state('');
	let isLoadingDetail = $state(false);

	const typeOptions = [
		{ value: 'all', label: 'All Types' },
		{ value: 'BOARD', label: 'Board' },
		{ value: 'ANNUAL', label: 'Annual' },
		{ value: 'SPECIAL', label: 'Special' },
		{ value: 'COMMITTEE', label: 'Committee' }
	];

	const statusOptions = [
		{ value: 'all', label: 'All Status' },
		{ value: 'SCHEDULED', label: 'Scheduled' },
		{ value: 'IN_SESSION', label: 'In Session' },
		{ value: 'ADJOURNED', label: 'Adjourned' },
		{ value: 'MINUTES_DRAFT', label: 'Minutes Draft' },
		{ value: 'MINUTES_APPROVED', label: 'Approved' },
		{ value: 'ARCHIVED', label: 'Archived' }
	];

	const detailTabs = [
		{ label: 'Overview', icon: Calendar },
		{ label: 'Agenda', icon: FileText },
		{ label: 'Motions & Votes', icon: Gavel },
		{ label: 'Resolutions', icon: ScrollText },
		{ label: 'Minutes', icon: FileText },
		{ label: 'History', icon: History }
	];

	async function loadMeetings() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const response = await governanceApi.meetings.list({
				status: statusFilter !== 'all' ? statusFilter : undefined
			});
			if (response.ok && response.data?.meetings) {
				meetings = response.data.meetings
					.filter(m => typeFilter === 'all' || m.meetingType === typeFilter)
					.map(m => ({
						id: m.id,
						title: m.title,
						type: m.meetingType as Meeting['type'],
						date: m.scheduledDate,
						time: '',
						status: m.status as Meeting['status']
					}));
			}
		} catch (e) {
			console.error('Failed to load meetings:', e);
		} finally {
			isLoading = false;
		}
	}

	async function loadMeetingDetail(meetingId: string) {
		isLoadingDetail = true;
		try {
			const response = await governanceApi.meetings.get(meetingId);
			if (response.ok && response.data?.meeting) {
				const m = response.data.meeting as Record<string, unknown>;
				// Update selected meeting with full details
				if (selectedMeeting) {
					selectedMeeting = {
						...selectedMeeting,
						location: m.location as string | undefined,
						virtualLink: m.virtualLink as string | undefined,
						quorumRequired: m.quorumRequired as number | null | undefined,
						attendeeCount: (m.attendance as unknown[])?.length || 0
					};
				}
				// Load agenda items
				agendaItems = ((m.agendaItems as unknown[]) || []).map((item: unknown, idx: number) => {
					const a = item as Record<string, unknown>;
					return {
						id: a.id as string,
						order: (a.order as number) || idx + 1,
						title: a.title as string,
						description: a.description as string | null,
						timeAllotment: a.timeAllotment as number | null,
						linkedEntities: []
					};
				});
				// Load attendees
				attendees = ((m.attendance as unknown[]) || []).map((att: unknown) => {
					const a = att as Record<string, unknown>;
					return {
						partyId: a.partyId as string,
						name: (a.party as Record<string, unknown>)?.displayName as string | null,
						status: a.status as string,
						proxyFor: a.proxyForPartyId as string | null
					};
				});
				// Load motions
				motions = ((m.boardMotions as unknown[]) || []).map((mot: unknown) => {
					const mo = mot as Record<string, unknown>;
					return {
						id: mo.id as string,
						motionNumber: mo.motionNumber as string,
						title: mo.title as string,
						status: mo.status as string,
						outcome: mo.outcome as string | null,
						decidedAt: mo.decidedAt as string | null
					};
				});
				// Minutes content
				const minutes = m.minutes as Record<string, unknown> | null;
				minutesContent = minutes?.content as string || '';
			}
		} catch (e) {
			console.error('Failed to load meeting detail:', e);
		} finally {
			isLoadingDetail = false;
		}
	}

	async function selectMeeting(meeting: Meeting) {
		selectedMeeting = meeting;
		activeTab = 0;
		await loadMeetingDetail(meeting.id);
		// Connect to live updates if meeting is in session
		if (meeting.status === 'IN_SESSION') {
			meetingLive.connect(meeting.id);
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'SCHEDULED': return 'text-blue-500 bg-blue-500/10';
			case 'IN_SESSION': return 'text-green-500 bg-green-500/10';
			case 'ADJOURNED': return 'text-orange-500 bg-orange-500/10';
			case 'MINUTES_DRAFT': return 'text-yellow-500 bg-yellow-500/10';
			case 'MINUTES_APPROVED': return 'text-emerald-500 bg-emerald-500/10';
			case 'ARCHIVED': return 'text-gray-500 bg-gray-500/10';
			case 'CANCELLED': return 'text-red-500 bg-red-500/10';
			default: return 'text-gray-500 bg-gray-500/10';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'SCHEDULED': return 'Scheduled';
			case 'IN_SESSION': return 'In Session';
			case 'ADJOURNED': return 'Adjourned';
			case 'MINUTES_DRAFT': return 'Minutes Draft';
			case 'MINUTES_APPROVED': return 'Approved';
			case 'ARCHIVED': return 'Archived';
			case 'CANCELLED': return 'Cancelled';
			default: return status;
		}
	}

	function getTypeLabel(type: string): string {
		switch (type) {
			case 'BOARD': return 'Board Meeting';
			case 'ANNUAL': return 'Annual Meeting';
			case 'SPECIAL': return 'Special Meeting';
			case 'COMMITTEE': return 'Committee Meeting';
			default: return type;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function handleScheduleMeeting(data: { 
		title: string;
		meetingType: string;
		scheduledDate: string;
		scheduledTime: string;
		location?: string;
		virtualLink?: string;
		agenda?: string;
	}) {
		if (!$currentAssociation?.id) return;

		isScheduling = true;
		try {
			const response = await governanceApi.meetings.create({
				associationId: $currentAssociation.id,
				type: data.meetingType,
				title: data.title,
				scheduledFor: `${data.scheduledDate}T${data.scheduledTime}:00`,
				location: data.location,
				virtualLink: data.virtualLink,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				await loadMeetings();
				showScheduleModal = false;
			}
		} catch (e) {
			console.error('Failed to schedule meeting:', e);
		} finally {
			isScheduling = false;
		}
	}

	async function handleStartMeeting() {
		if (!selectedMeeting) return;
		try {
			const response = await governanceApi.meetings.startSession({
				meetingId: selectedMeeting.id,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				selectedMeeting = { ...selectedMeeting, status: 'IN_SESSION' };
				meetingLive.connect(selectedMeeting.id);
				await loadMeetings();
			}
		} catch (e) {
			console.error('Failed to start meeting:', e);
		}
	}

	async function handleAdjournMeeting() {
		if (!selectedMeeting) return;
		try {
			const response = await governanceApi.meetings.adjourn({
				meetingId: selectedMeeting.id,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				selectedMeeting = { ...selectedMeeting, status: 'ADJOURNED' };
				meetingLive.disconnect();
				await loadMeetings();
			}
		} catch (e) {
			console.error('Failed to adjourn meeting:', e);
		}
	}

	$effect(() => {
		if ($currentAssociation?.id) {
			loadMeetings();
		}
	});

	$effect(() => {
		typeFilter;
		statusFilter;
		searchQuery;
		if ($currentAssociation?.id) {
			loadMeetings();
		}
	});

	// Cleanup live connection on unmount
	$effect(() => {
		return () => {
			meetingLive.disconnect();
		};
	});
</script>

<svelte:head>
	<title>Meetings | Governance | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/governance')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<h1 class="text-xl font-semibold">Meetings</h1>
				<p class="mt-0.5 text-sm text-surface-500">
					{$currentAssociation?.name || 'Select an association'}
				</p>
			</div>
			<button 
				class="btn btn-sm preset-filled-primary-500"
				onclick={() => showScheduleModal = true}
			>
				<Plus class="mr-1 h-4 w-4" />
				Schedule Meeting
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-hidden">
		<SplitView hasSelection={!!selectedMeeting}>
			{#snippet listPanel()}
				<ListPanel loading={isLoading}>
					{#snippet header()}
						<div class="flex gap-2">
							<div class="relative flex-1">
								<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
								<input
									type="text"
									placeholder="Search meetings..."
									bind:value={searchQuery}
									class="w-full rounded-lg border border-surface-300-700 bg-surface-50-950 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none"
								/>
							</div>
							<select
								bind:value={typeFilter}
								class="rounded-lg border border-surface-300-700 bg-surface-50-950 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
							>
								{#each typeOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
						</div>
					{/snippet}

					{#snippet items()}
						{#if meetings.length === 0}
							<EmptyState
								title="No meetings"
								description="Scheduled meetings will appear here."
							/>
						{:else}
							{#each meetings as meeting}
								<button
									type="button"
									onclick={() => selectMeeting(meeting)}
									class="w-full px-4 py-3 text-left transition-colors hover:bg-surface-200-800 {selectedMeeting?.id === meeting.id ? 'bg-primary-500/10' : ''}"
								>
									<div class="flex items-start justify-between">
										<div>
											<p class="font-medium">{meeting.title}</p>
											<p class="text-sm text-surface-500">{getTypeLabel(meeting.type)}</p>
										</div>
										<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(meeting.status)}">
											{meeting.status}
										</span>
									</div>
									<div class="mt-2 flex items-center gap-3 text-xs text-surface-400">
										<span class="flex items-center gap-1">
											<Calendar class="h-3 w-3" />
											{formatDate(meeting.date)}
										</span>
										<span class="flex items-center gap-1">
											<Clock class="h-3 w-3" />
											{meeting.time}
										</span>
									</div>
								</button>
							{/each}
						{/if}
					{/snippet}
				</ListPanel>
			{/snippet}

			{#snippet detailPanel()}
				{#if selectedMeeting}
					{@const m = selectedMeeting}
					<DetailPanel>
						{#snippet header()}
							<div>
								<div class="flex items-center gap-2">
									<span class="text-sm text-surface-500">{getTypeLabel(m.type)}</span>
									<span class="rounded-full px-2 py-0.5 text-xs font-medium {getStatusColor(m.status)}">
										{m.status}
									</span>
								</div>
								<h2 class="mt-1 text-xl font-semibold">{m.title}</h2>
							</div>
						{/snippet}

						{#snippet actions()}
							{#if m.status === 'SCHEDULED'}
								<button class="btn btn-sm preset-tonal-surface">
									Edit
								</button>
								<button class="btn btn-sm preset-filled-primary-500" onclick={handleStartMeeting}>
									Start Meeting
								</button>
							{/if}
							{#if m.status === 'IN_SESSION'}
								<button class="btn btn-sm preset-filled-warning-500" onclick={handleAdjournMeeting}>
									Adjourn Meeting
								</button>
							{/if}
							{#if m.status === 'ADJOURNED'}
								<button class="btn btn-sm preset-filled-primary-500" onclick={() => activeTab = 4}>
									Draft Minutes
								</button>
							{/if}
						{/snippet}

						{#snippet content()}
							<div class="h-full flex flex-col">
								<!-- Tab Navigation -->
								<div class="border-b border-surface-300-700 px-4">
									<nav class="flex gap-1 -mb-px">
										{#each detailTabs as tab, idx}
											<button
												type="button"
												class="flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors {activeTab === idx ? 'border-primary-500 text-primary-500' : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'}"
												onclick={() => activeTab = idx}
											>
												<tab.icon class="h-4 w-4" />
												{tab.label}
											</button>
										{/each}
									</nav>
								</div>

								<!-- Tab Content -->
								<div class="flex-1 overflow-y-auto p-6">
									{#if activeTab === 0}
										<!-- Overview Tab -->
										<div class="space-y-6">
											<Card variant="outlined" padding="lg">
												<h3 class="mb-4 font-semibold">Meeting Details</h3>
												<div class="grid gap-4 sm:grid-cols-2">
													<div class="flex items-start gap-3">
														<Calendar class="mt-0.5 h-5 w-5 text-surface-400" />
														<div>
															<h4 class="text-sm font-medium text-surface-500">Date</h4>
															<p class="mt-1">{formatDate(m.date)}</p>
														</div>
													</div>
													<div class="flex items-start gap-3">
														<Clock class="mt-0.5 h-5 w-5 text-surface-400" />
														<div>
															<h4 class="text-sm font-medium text-surface-500">Time</h4>
															<p class="mt-1">{m.time || 'TBD'}</p>
														</div>
													</div>
													{#if m.location}
														<div class="flex items-start gap-3">
															<MapPin class="mt-0.5 h-5 w-5 text-surface-400" />
															<div>
																<h4 class="text-sm font-medium text-surface-500">Location</h4>
																<p class="mt-1">{m.location}</p>
															</div>
														</div>
													{/if}
													{#if m.virtualLink}
														<div class="flex items-start gap-3">
															<Video class="mt-0.5 h-5 w-5 text-surface-400" />
															<div>
																<h4 class="text-sm font-medium text-surface-500">Virtual Link</h4>
																<a href={m.virtualLink} target="_blank" class="mt-1 text-primary-500 hover:underline">Join Meeting</a>
															</div>
														</div>
													{/if}
												</div>
											</Card>

											<Card variant="outlined" padding="lg">
												<div class="flex items-center justify-between mb-4">
													<h3 class="font-semibold">Quorum & Attendance</h3>
													<QuorumIndicator 
														required={m.quorumRequired ?? null} 
														present={attendees.filter(a => a.status !== 'ABSENT').length}
														met={$meetingLive.quorum.met || (m.quorumRequired ? attendees.filter(a => a.status !== 'ABSENT').length >= m.quorumRequired : true)}
													/>
												</div>
												<AttendanceList {attendees} editable={m.status === 'IN_SESSION'} />
											</Card>
										</div>

									{:else if activeTab === 1}
										<!-- Agenda Tab -->
										<div class="space-y-3">
											<div class="flex items-center justify-between mb-4">
												<h3 class="font-semibold">Agenda Items</h3>
												{#if m.status === 'SCHEDULED'}
													<button class="btn btn-sm preset-tonal-primary">
														<Plus class="h-4 w-4 mr-1" />
														Add Item
													</button>
												{/if}
											</div>
											{#if agendaItems.length === 0}
												<EmptyState title="No agenda items" description="Add agenda items to this meeting." />
											{:else}
												{#each agendaItems as item (item.id)}
													<AgendaItemRow 
														id={item.id}
														order={item.order}
														title={item.title}
														description={item.description}
														timeAllotment={item.timeAllotment}
														linkedEntities={item.linkedEntities}
													/>
												{/each}
											{/if}
										</div>

									{:else if activeTab === 2}
										<!-- Motions & Votes Tab -->
										<div class="space-y-4">
											<div class="flex items-center justify-between mb-4">
												<h3 class="font-semibold">Motions</h3>
												{#if m.status === 'IN_SESSION'}
													<button class="btn btn-sm preset-tonal-primary">
														<Gavel class="h-4 w-4 mr-1" />
														Propose Motion
													</button>
												{/if}
											</div>
											{#if motions.length === 0}
												<EmptyState title="No motions" description="Motions proposed during this meeting will appear here." />
											{:else}
												{#each motions as motion (motion.id)}
													<MotionCard 
														id={motion.id}
														motionNumber={motion.motionNumber}
														title={motion.title}
														status={motion.status}
														category={motion.category}
														movedBy={motion.movedBy}
														secondedBy={motion.secondedBy}
														outcome={motion.outcome}
														decidedAt={motion.decidedAt}
													/>
												{/each}
											{/if}
										</div>

									{:else if activeTab === 3}
										<!-- Resolutions Tab -->
										<div class="space-y-4">
											<h3 class="font-semibold mb-4">Resolutions & Outcomes</h3>
											{#if motions.filter(m => m.status === 'APPROVED').length === 0}
												<EmptyState title="No resolutions" description="Approved motions will generate resolutions here." />
											{:else}
												{#each motions.filter(m => m.status === 'APPROVED') as motion (motion.id)}
													<Card variant="outlined" padding="md">
														<div class="flex items-center justify-between">
															<div>
																<p class="text-xs text-surface-500">{motion.motionNumber}</p>
																<p class="font-medium">{motion.title}</p>
															</div>
															<span class="badge px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
																<CheckCircle class="h-3 w-3 mr-1 inline" />
																Approved
															</span>
														</div>
													</Card>
												{/each}
											{/if}
										</div>

									{:else if activeTab === 4}
										<!-- Minutes Tab -->
										<MinutesEditor 
											meetingId={m.id}
											initialContent={minutesContent}
											status={m.status === 'MINUTES_APPROVED' ? 'approved' : m.status === 'MINUTES_DRAFT' ? 'submitted' : 'draft'}
											readonly={m.status === 'MINUTES_APPROVED' || m.status === 'ARCHIVED'}
										/>

									{:else if activeTab === 5}
										<!-- History Tab -->
										<div>
											<h3 class="font-semibold mb-4">Activity History</h3>
											<GovernanceAuditTimeline events={auditEvents} />
										</div>
									{/if}
								</div>
							</div>
						{/snippet}
					</DetailPanel>
				{/if}
			{/snippet}

			{#snippet emptyDetail()}
				<div class="text-center">
					<Calendar class="mx-auto h-12 w-12 text-surface-300" />
					<p class="mt-2 text-surface-500">Select a meeting to view details</p>
				</div>
			{/snippet}
		</SplitView>
	</div>
</div>

<ScheduleMeetingModal
	open={showScheduleModal}
	loading={isScheduling}
	onConfirm={handleScheduleMeeting}
	onCancel={() => showScheduleModal = false}
/>
