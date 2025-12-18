<script lang="ts">
	import { ArrowLeft, Calendar, Plus, Search, MapPin, Clock } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { SplitView, ListPanel, DetailPanel, ScheduleMeetingModal } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation } from '$lib/stores';

	interface Meeting {
		id: string;
		title: string;
		type: 'BOARD' | 'ANNUAL' | 'SPECIAL' | 'COMMITTEE';
		date: string;
		time: string;
		location?: string;
		status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
		agenda?: string;
		minutes?: string;
		attendeeCount?: number;
	}

	let meetings = $state<Meeting[]>([]);
	let selectedMeeting = $state<Meeting | null>(null);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let typeFilter = $state('all');
	let showScheduleModal = $state(false);
	let isScheduling = $state(false);

	const typeOptions = [
		{ value: 'all', label: 'All Types' },
		{ value: 'BOARD', label: 'Board' },
		{ value: 'ANNUAL', label: 'Annual' },
		{ value: 'SPECIAL', label: 'Special' },
		{ value: 'COMMITTEE', label: 'Committee' }
	];

	async function loadMeetings() {
		if (!$currentAssociation?.id) return;

		isLoading = true;
		try {
			const params = new URLSearchParams({ associationId: $currentAssociation.id });
			if (typeFilter !== 'all') params.append('type', typeFilter);
			if (searchQuery) params.append('search', searchQuery);

			const response = await fetch(`/api/governance/meeting?${params}`);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data?.items) {
					meetings = data.data.items;
				}
			}
		} catch (e) {
			console.error('Failed to load meetings:', e);
		} finally {
			isLoading = false;
		}
	}

	function selectMeeting(meeting: Meeting) {
		selectedMeeting = meeting;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'SCHEDULED': return 'text-primary-500 bg-primary-500/10';
			case 'IN_PROGRESS': return 'text-warning-500 bg-warning-500/10';
			case 'COMPLETED': return 'text-success-500 bg-success-500/10';
			case 'CANCELLED': return 'text-error-500 bg-error-500/10';
			default: return 'text-surface-500 bg-surface-500/10';
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
			const response = await fetch('/api/governance/meeting', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					associationId: $currentAssociation.id,
					...data
				})
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

	$effect(() => {
		if ($currentAssociation?.id) {
			loadMeetings();
		}
	});

	$effect(() => {
		typeFilter;
		searchQuery;
		if ($currentAssociation?.id) {
			loadMeetings();
		}
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
								<button class="btn btn-sm preset-filled-primary-500">
									Start Meeting
								</button>
							{/if}
							{#if m.status === 'COMPLETED' && !m.minutes}
								<button class="btn btn-sm preset-filled-primary-500">
									Add Minutes
								</button>
							{/if}
						{/snippet}

						{#snippet content()}
							<div class="space-y-6 p-6">
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
												<p class="mt-1">{m.time}</p>
											</div>
										</div>
										{#if m.location}
											<div class="flex items-start gap-3 sm:col-span-2">
												<MapPin class="mt-0.5 h-5 w-5 text-surface-400" />
												<div>
													<h4 class="text-sm font-medium text-surface-500">Location</h4>
													<p class="mt-1">{m.location}</p>
												</div>
											</div>
										{/if}
									</div>
								</Card>

								{#if m.agenda}
									<Card variant="outlined" padding="lg">
										<h3 class="mb-4 font-semibold">Agenda</h3>
										<div class="prose prose-sm max-w-none">
											<pre class="whitespace-pre-wrap text-sm">{m.agenda}</pre>
										</div>
									</Card>
								{/if}

								{#if m.minutes}
									<Card variant="outlined" padding="lg">
										<h3 class="mb-4 font-semibold">Minutes</h3>
										<div class="prose prose-sm max-w-none">
											<pre class="whitespace-pre-wrap text-sm">{m.minutes}</pre>
										</div>
									</Card>
								{/if}

								{#if m.attendeeCount !== undefined}
									<Card variant="outlined" padding="lg">
										<h3 class="mb-4 font-semibold">Attendance</h3>
										<p class="text-2xl font-bold">{m.attendeeCount}</p>
										<p class="text-sm text-surface-500">attendees</p>
									</Card>
								{/if}
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
