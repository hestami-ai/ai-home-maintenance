<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Calendar,
		ChevronLeft,
		ChevronRight,
		Loader2,
		RefreshCw,
		User,
		MapPin,
		Clock,
		Truck,
		AlertTriangle,
		Filter
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { jobApi, type Job, type JobStatus } from '$lib/api/cam';

	let jobs = $state<Job[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	
	// Calendar state
	let currentDate = $state(new Date());
	let viewMode = $state<'day' | 'week'>('week');
	
	// Filters
	let showUnscheduled = $state(true);
	let technicianFilter = $state('');

	const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 7 AM to 6 PM

	onMount(async () => {
		await loadJobs();
	});

	async function loadJobs() {
		isLoading = true;
		error = null;
		try {
			const response = await jobApi.list({ limit: 100 });
			if (response.ok && response.data) {
				jobs = response.data.jobs;
			} else {
				error = response.error?.message || 'Failed to load jobs';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load jobs';
		} finally {
			isLoading = false;
		}
	}

	// Get week dates
	function getWeekDates(date: Date): Date[] {
		const start = new Date(date);
		start.setDate(start.getDate() - start.getDay());
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(start);
			d.setDate(d.getDate() + i);
			return d;
		});
	}

	function navigateWeek(direction: number) {
		const newDate = new Date(currentDate);
		newDate.setDate(newDate.getDate() + (direction * 7));
		currentDate = newDate;
	}

	function navigateDay(direction: number) {
		const newDate = new Date(currentDate);
		newDate.setDate(newDate.getDate() + direction);
		currentDate = newDate;
	}

	function goToToday() {
		currentDate = new Date();
	}

	function formatDateHeader(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatWeekRange(date: Date): string {
		const dates = getWeekDates(date);
		const start = dates[0];
		const end = dates[6];
		return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
	}

	function isToday(date: Date): boolean {
		const today = new Date();
		return date.toDateString() === today.toDateString();
	}

	function isSameDay(date1: Date, date2: Date): boolean {
		return date1.toDateString() === date2.toDateString();
	}

	// Filter jobs
	const scheduledJobs = $derived(
		jobs.filter(j => j.scheduledStart && ['SCHEDULED', 'DISPATCHED', 'IN_PROGRESS'].includes(j.status))
	);

	const unscheduledJobs = $derived(
		jobs.filter(j => !j.scheduledStart && ['JOB_CREATED', 'ESTIMATE_APPROVED'].includes(j.status))
	);

	// Get jobs for a specific date
	function getJobsForDate(date: Date): Job[] {
		return scheduledJobs.filter(j => {
			if (!j.scheduledStart) return false;
			return isSameDay(new Date(j.scheduledStart), date);
		});
	}

	function getStatusColor(status: JobStatus): string {
		const colors: Record<string, string> = {
			JOB_CREATED: 'bg-primary-500',
			ESTIMATE_APPROVED: 'bg-success-500',
			SCHEDULED: 'bg-tertiary-500',
			DISPATCHED: 'bg-warning-500',
			IN_PROGRESS: 'bg-warning-600'
		};
		return colors[status] || 'bg-surface-500';
	}

	function getPriorityIndicator(priority: string): string {
		if (priority === 'EMERGENCY') return '🔴';
		if (priority === 'HIGH') return '🟠';
		return '';
	}

	function formatTime(dateString: string): string {
		return new Date(dateString).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	async function dispatchJob(jobId: string) {
		try {
			const response = await jobApi.transitionStatus({
				id: jobId,
				toStatus: 'DISPATCHED',
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok) {
				await loadJobs();
			}
		} catch (e) {
			console.error('Failed to dispatch job:', e);
		}
	}

	const weekDates = $derived(getWeekDates(currentDate));
</script>

<svelte:head>
	<title>Dispatch Board | Contractor Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="flex h-[calc(100vh-8rem)] flex-col">
		<!-- Header -->
		<div class="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Dispatch Board</h1>
				<p class="mt-1 text-surface-500">Schedule and dispatch jobs to technicians</p>
			</div>
			<div class="flex gap-2">
				<button onclick={loadJobs} class="btn preset-outlined-primary-500" disabled={isLoading}>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}
						<RefreshCw class="mr-2 h-4 w-4" />
					{/if}
					Refresh
				</button>
			</div>
		</div>

		<!-- Calendar Navigation -->
		<div class="flex items-center justify-between pb-4">
			<div class="flex items-center gap-2">
				<button onclick={goToToday} class="btn btn-sm preset-outlined-surface-500">
					Today
				</button>
				<div class="flex">
					<button
						onclick={() => viewMode === 'week' ? navigateWeek(-1) : navigateDay(-1)}
						class="btn btn-sm btn-icon preset-outlined-surface-500 rounded-r-none"
					>
						<ChevronLeft class="h-4 w-4" />
					</button>
					<button
						onclick={() => viewMode === 'week' ? navigateWeek(1) : navigateDay(1)}
						class="btn btn-sm btn-icon preset-outlined-surface-500 rounded-l-none border-l-0"
					>
						<ChevronRight class="h-4 w-4" />
					</button>
				</div>
				<span class="font-medium">
					{#if viewMode === 'week'}
						{formatWeekRange(currentDate)}
					{:else}
						{currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
					{/if}
				</span>
			</div>
			<div class="flex gap-2">
				<button
					onclick={() => viewMode = 'day'}
					class="btn btn-sm {viewMode === 'day' ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
				>
					Day
				</button>
				<button
					onclick={() => viewMode = 'week'}
					class="btn btn-sm {viewMode === 'week' ? 'preset-filled-primary-500' : 'preset-outlined-surface-500'}"
				>
					Week
				</button>
			</div>
		</div>

		<!-- Main Content -->
		<div class="flex flex-1 gap-4 overflow-hidden">
			<!-- Calendar View -->
			<div class="flex-1 overflow-auto rounded-lg border border-surface-300-700 bg-surface-50-950">
				{#if isLoading && jobs.length === 0}
					<div class="flex items-center justify-center py-12">
						<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
					</div>
				{:else if error}
					<div class="p-6 text-center text-error-500">
						<p>{error}</p>
						<button onclick={loadJobs} class="btn preset-outlined-primary-500 mt-4">
							Try Again
						</button>
					</div>
				{:else if viewMode === 'week'}
					<!-- Week View -->
					<div class="min-w-[800px]">
						<!-- Day Headers -->
						<div class="grid grid-cols-7 border-b border-surface-300-700 bg-surface-100-900">
							{#each weekDates as date, i}
								<div class="border-r border-surface-300-700 p-2 text-center last:border-r-0 {isToday(date) ? 'bg-primary-500/10' : ''}">
									<div class="text-xs text-surface-500">{weekDays[i]}</div>
									<div class="text-lg font-medium {isToday(date) ? 'text-primary-500' : ''}">{date.getDate()}</div>
								</div>
							{/each}
						</div>
						
						<!-- Day Columns -->
						<div class="grid grid-cols-7 min-h-[400px]">
							{#each weekDates as date, i}
								{@const dayJobs = getJobsForDate(date)}
								<div class="border-r border-surface-300-700 p-2 last:border-r-0 {isToday(date) ? 'bg-primary-500/5' : ''}">
									{#if dayJobs.length === 0}
										<p class="text-xs text-surface-400 text-center py-4">No jobs</p>
									{:else}
										<div class="space-y-2">
											{#each dayJobs as job}
												<a
													href="/app/contractor/jobs/{job.id}"
													class="block rounded-lg p-2 text-xs {getStatusColor(job.status)} text-white hover:opacity-90 transition-opacity"
												>
													<div class="font-medium truncate">
														{getPriorityIndicator(job.priority)} {job.title}
													</div>
													{#if job.scheduledStart}
														<div class="opacity-80">{formatTime(job.scheduledStart)}</div>
													{/if}
													<div class="opacity-80 truncate">{job.jobNumber}</div>
												</a>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<!-- Day View -->
					<div class="p-4">
						{#if getJobsForDate(currentDate).length === 0}
							<EmptyState
								title="No jobs scheduled"
								description="No jobs are scheduled for this day."
							/>
						{:else}
							<div class="space-y-3">
								{#each getJobsForDate(currentDate) as job}
									<Card variant="outlined" padding="md">
										<div class="flex items-start justify-between">
											<div class="flex items-start gap-3">
												<div class="flex h-10 w-10 items-center justify-center rounded-lg {getStatusColor(job.status)}">
													<Calendar class="h-5 w-5 text-white" />
												</div>
												<div>
													<div class="flex items-center gap-2">
														<span class="font-medium">{job.title}</span>
														{#if job.priority === 'EMERGENCY' || job.priority === 'HIGH'}
															<span class="badge preset-filled-error-500 text-xs">{job.priority}</span>
														{/if}
													</div>
													<div class="text-sm text-surface-500">{job.jobNumber}</div>
													{#if job.scheduledStart}
														<div class="mt-1 flex items-center gap-1 text-sm text-surface-400">
															<Clock class="h-3 w-3" />
															{formatTime(job.scheduledStart)}
															{#if job.scheduledEnd}
																- {formatTime(job.scheduledEnd)}
															{/if}
														</div>
													{/if}
													{#if job.addressLine1}
														<div class="mt-1 flex items-center gap-1 text-sm text-surface-400">
															<MapPin class="h-3 w-3" />
															{job.addressLine1}
														</div>
													{/if}
												</div>
											</div>
											<div class="flex gap-2">
												{#if job.status === 'SCHEDULED' && job.assignedTechnicianId}
													<button
														onclick={() => dispatchJob(job.id)}
														class="btn btn-sm preset-filled-primary-500"
													>
														<Truck class="mr-2 h-4 w-4" />
														Dispatch
													</button>
												{/if}
												<a href="/app/contractor/jobs/{job.id}" class="btn btn-sm preset-outlined-surface-500">
													View
												</a>
											</div>
										</div>
									</Card>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Unscheduled Jobs Queue -->
			{#if showUnscheduled}
				<div class="w-80 flex-shrink-0 overflow-y-auto rounded-lg border border-surface-300-700 bg-surface-50-950">
					<div class="sticky top-0 border-b border-surface-300-700 bg-surface-100-900 px-4 py-3">
						<div class="flex items-center justify-between">
							<h3 class="font-medium">Unscheduled Jobs</h3>
							<span class="badge preset-filled-warning-500 text-xs">{unscheduledJobs.length}</span>
						</div>
					</div>
					
					{#if unscheduledJobs.length === 0}
						<div class="p-4">
							<p class="text-sm text-surface-400 text-center">All jobs are scheduled!</p>
						</div>
					{:else}
						<div class="divide-y divide-surface-200-800">
							{#each unscheduledJobs as job}
								<a
									href="/app/contractor/jobs/{job.id}"
									class="block p-3 hover:bg-surface-200-800 transition-colors"
								>
									<div class="flex items-start gap-2">
										{#if job.priority === 'EMERGENCY'}
											<AlertTriangle class="h-4 w-4 text-error-500 flex-shrink-0 mt-0.5" />
										{:else if job.priority === 'HIGH'}
											<AlertTriangle class="h-4 w-4 text-warning-500 flex-shrink-0 mt-0.5" />
										{/if}
										<div class="min-w-0 flex-1">
											<div class="font-medium text-sm truncate">{job.title}</div>
											<div class="text-xs text-surface-500">{job.jobNumber}</div>
											{#if job.addressLine1}
												<div class="text-xs text-surface-400 truncate mt-1">
													{job.addressLine1}
												</div>
											{/if}
											<div class="mt-1">
												<span class="badge preset-outlined-{job.priority === 'EMERGENCY' ? 'error' : job.priority === 'HIGH' ? 'warning' : 'surface'}-500 text-xs">
													{job.priority}
												</span>
											</div>
										</div>
									</div>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</PageContainer>
