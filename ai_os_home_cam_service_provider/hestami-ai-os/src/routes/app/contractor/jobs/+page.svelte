<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Wrench,
		Search,
		Filter,
		Loader2,
		RefreshCw,
		Clock,
		User,
		MapPin,
		ChevronRight,
		Plus,
		Calendar,
		DollarSign,
		AlertTriangle,
		CheckCircle2,
		XCircle,
		Pause,
		Play,
		FileText,
		Truck
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { organizationStore } from '$lib/stores';
	import { jobApi, type Job, type JobStatus, type JobSourceType } from '$lib/api/cam';

	let jobs = $state<Job[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let statusFilter = $state<JobStatus | ''>('');
	let sourceFilter = $state<JobSourceType | ''>('');
	let selectedJobId = $state<string | null>(null);

	const organizationId = $derived($organizationStore.current?.organization.id || '');

	// Get selected job ID from URL
	$effect(() => {
		const urlJobId = $page.url.searchParams.get('id');
		if (urlJobId && urlJobId !== selectedJobId) {
			selectedJobId = urlJobId;
		}
	});

	onMount(async () => {
		await loadJobs();
	});

	async function loadJobs() {
		if (!organizationId) {
			isLoading = false;
			return;
		}
		isLoading = true;
		error = null;
		try {
			const response = await jobApi.list({
				status: statusFilter || undefined,
				sourceType: sourceFilter || undefined,
				search: searchQuery || undefined,
				limit: 50
			});
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

	function selectJob(jobId: string) {
		selectedJobId = jobId;
		goto(`/app/contractor/jobs?id=${jobId}`, { replaceState: true });
	}

	function getStatusLabel(status: JobStatus): string {
		const labels: Record<JobStatus, string> = {
			LEAD: 'Lead',
			TICKET: 'Ticket',
			ESTIMATE_REQUIRED: 'Estimate Required',
			ESTIMATE_SENT: 'Estimate Sent',
			ESTIMATE_APPROVED: 'Estimate Approved',
			JOB_CREATED: 'Job Created',
			SCHEDULED: 'Scheduled',
			DISPATCHED: 'Dispatched',
			IN_PROGRESS: 'In Progress',
			ON_HOLD: 'On Hold',
			COMPLETED: 'Completed',
			INVOICED: 'Invoiced',
			PAID: 'Paid',
			WARRANTY: 'Warranty',
			CLOSED: 'Closed',
			CANCELLED: 'Cancelled'
		};
		return labels[status] || status;
	}

	function getStatusColor(status: JobStatus): string {
		const colors: Record<JobStatus, string> = {
			LEAD: 'preset-filled-surface-500',
			TICKET: 'preset-filled-primary-500',
			ESTIMATE_REQUIRED: 'preset-filled-warning-500',
			ESTIMATE_SENT: 'preset-filled-secondary-500',
			ESTIMATE_APPROVED: 'preset-filled-success-500',
			JOB_CREATED: 'preset-filled-primary-500',
			SCHEDULED: 'preset-filled-tertiary-500',
			DISPATCHED: 'preset-filled-warning-500',
			IN_PROGRESS: 'preset-filled-warning-500',
			ON_HOLD: 'preset-filled-error-500',
			COMPLETED: 'preset-filled-success-500',
			INVOICED: 'preset-filled-secondary-500',
			PAID: 'preset-filled-success-500',
			WARRANTY: 'preset-filled-tertiary-500',
			CLOSED: 'preset-outlined-surface-500',
			CANCELLED: 'preset-outlined-error-500'
		};
		return colors[status] || 'preset-filled-surface-500';
	}

	function getStatusIcon(status: JobStatus) {
		const icons: Record<JobStatus, typeof Wrench> = {
			LEAD: FileText,
			TICKET: FileText,
			ESTIMATE_REQUIRED: DollarSign,
			ESTIMATE_SENT: DollarSign,
			ESTIMATE_APPROVED: CheckCircle2,
			JOB_CREATED: Wrench,
			SCHEDULED: Calendar,
			DISPATCHED: Truck,
			IN_PROGRESS: Play,
			ON_HOLD: Pause,
			COMPLETED: CheckCircle2,
			INVOICED: DollarSign,
			PAID: DollarSign,
			WARRANTY: AlertTriangle,
			CLOSED: CheckCircle2,
			CANCELLED: XCircle
		};
		return icons[status] || Wrench;
	}

	function getPriorityColor(priority: string): string {
		const colors: Record<string, string> = {
			LOW: 'preset-outlined-surface-500',
			MEDIUM: 'preset-outlined-primary-500',
			HIGH: 'preset-filled-warning-500',
			EMERGENCY: 'preset-filled-error-500'
		};
		return colors[priority] || 'preset-outlined-surface-500';
	}

	function getSourceLabel(source: JobSourceType): string {
		const labels: Record<JobSourceType, string> = {
			WORK_ORDER: 'Work Order',
			VIOLATION: 'Violation',
			ARC_REQUEST: 'ARC Request',
			DIRECT_CUSTOMER: 'Direct',
			LEAD: 'Lead',
			RECURRING: 'Recurring'
		};
		return labels[source] || source;
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatAddress(job: Job): string {
		const parts = [job.addressLine1, job.city, job.state].filter(Boolean);
		return parts.length > 0 ? parts.join(', ') : 'No address';
	}

	const filteredJobs = $derived(
		jobs.filter((j) => {
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				return (
					j.title.toLowerCase().includes(query) ||
					j.jobNumber.toLowerCase().includes(query) ||
					j.description?.toLowerCase().includes(query)
				);
			}
			return true;
		})
	);

	const selectedJob = $derived(jobs.find((j) => j.id === selectedJobId));

	const statuses: Array<{ value: JobStatus | ''; label: string }> = [
		{ value: '', label: 'All Statuses' },
		{ value: 'LEAD', label: 'Lead' },
		{ value: 'TICKET', label: 'Ticket' },
		{ value: 'ESTIMATE_REQUIRED', label: 'Estimate Required' },
		{ value: 'ESTIMATE_SENT', label: 'Estimate Sent' },
		{ value: 'ESTIMATE_APPROVED', label: 'Estimate Approved' },
		{ value: 'JOB_CREATED', label: 'Job Created' },
		{ value: 'SCHEDULED', label: 'Scheduled' },
		{ value: 'DISPATCHED', label: 'Dispatched' },
		{ value: 'IN_PROGRESS', label: 'In Progress' },
		{ value: 'ON_HOLD', label: 'On Hold' },
		{ value: 'COMPLETED', label: 'Completed' },
		{ value: 'INVOICED', label: 'Invoiced' },
		{ value: 'PAID', label: 'Paid' },
		{ value: 'WARRANTY', label: 'Warranty' },
		{ value: 'CLOSED', label: 'Closed' },
		{ value: 'CANCELLED', label: 'Cancelled' }
	];

	const sources: Array<{ value: JobSourceType | ''; label: string }> = [
		{ value: '', label: 'All Sources' },
		{ value: 'WORK_ORDER', label: 'Work Order' },
		{ value: 'VIOLATION', label: 'Violation' },
		{ value: 'ARC_REQUEST', label: 'ARC Request' },
		{ value: 'DIRECT_CUSTOMER', label: 'Direct Customer' },
		{ value: 'LEAD', label: 'Lead' },
		{ value: 'RECURRING', label: 'Recurring' }
	];
</script>

<svelte:head>
	<title>Jobs | Contractor Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="flex h-[calc(100vh-8rem)] flex-col">
		<!-- Header -->
		<div class="flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Jobs</h1>
				<p class="mt-1 text-surface-500">Manage your contractor jobs</p>
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
				<a href="/app/contractor/jobs/new" class="btn preset-filled-primary-500">
					<Plus class="mr-2 h-4 w-4" />
					New Job
				</a>
			</div>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap gap-4 pb-4">
			<div class="flex-1 min-w-[200px]">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search jobs..."
						class="input w-full pl-10"
					/>
				</div>
			</div>
			<div>
				<select bind:value={statusFilter} onchange={loadJobs} class="select">
					{#each statuses as status}
						<option value={status.value}>{status.label}</option>
					{/each}
				</select>
			</div>
			<div>
				<select bind:value={sourceFilter} onchange={loadJobs} class="select">
					{#each sources as source}
						<option value={source.value}>{source.label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Split View -->
		<div class="flex flex-1 gap-4 overflow-hidden">
			<!-- Jobs List (Left Pane) -->
			<div class="w-full lg:w-2/5 xl:w-1/3 overflow-y-auto rounded-lg border border-surface-300-700 bg-surface-50-950">
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
				{:else if filteredJobs.length === 0}
					<div class="p-6">
						<EmptyState
							title="No jobs found"
							description={searchQuery ? 'Try adjusting your search criteria.' : 'Create your first job to get started.'}
						>
							{#snippet actions()}
								<a href="/app/contractor/jobs/new" class="btn preset-filled-primary-500">
									<Plus class="mr-2 h-4 w-4" />
									New Job
								</a>
							{/snippet}
						</EmptyState>
					</div>
				{:else}
					<div class="divide-y divide-surface-300-700">
						{#each filteredJobs as job}
							{@const StatusIcon = getStatusIcon(job.status)}
							<button
								onclick={() => selectJob(job.id)}
								class="w-full p-4 text-left transition-colors hover:bg-surface-200-800 {selectedJobId === job.id ? 'bg-primary-500/10 border-l-4 border-l-primary-500' : ''}"
							>
								<div class="flex items-start gap-3">
									<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface-200-800">
										<StatusIcon class="h-5 w-5 text-surface-500" />
									</div>
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-2">
											<span class="text-xs font-medium text-surface-500">{job.jobNumber}</span>
											<span class="badge {getStatusColor(job.status)} text-xs">
												{getStatusLabel(job.status)}
											</span>
										</div>
										<h3 class="mt-1 font-medium truncate">{job.title}</h3>
										<div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-surface-400">
											<span class="flex items-center gap-1">
												<MapPin class="h-3 w-3" />
												<span class="truncate max-w-[150px]">{formatAddress(job)}</span>
											</span>
											{#if job.scheduledStart}
												<span class="flex items-center gap-1">
													<Calendar class="h-3 w-3" />
													{formatDate(job.scheduledStart)}
												</span>
											{/if}
										</div>
									</div>
									<span class="badge {getPriorityColor(job.priority)} text-xs">
										{job.priority}
									</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Job Detail (Right Pane) -->
			<div class="hidden lg:flex lg:flex-1 overflow-y-auto rounded-lg border border-surface-300-700 bg-surface-50-950">
				{#if selectedJob}
					{@const StatusIcon = getStatusIcon(selectedJob.status)}
					<div class="flex-1 p-6">
						<!-- Job Header -->
						<div class="flex items-start justify-between">
							<div>
								<div class="flex items-center gap-3">
									<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-200-800">
										<StatusIcon class="h-6 w-6 text-surface-500" />
									</div>
									<div>
										<span class="text-sm text-surface-500">{selectedJob.jobNumber}</span>
										<h2 class="text-xl font-bold">{selectedJob.title}</h2>
									</div>
								</div>
								<div class="mt-3 flex flex-wrap items-center gap-2">
									<span class="badge {getStatusColor(selectedJob.status)}">
										{getStatusLabel(selectedJob.status)}
									</span>
									<span class="badge {getPriorityColor(selectedJob.priority)}">
										{selectedJob.priority}
									</span>
									<span class="badge preset-outlined-surface-500">
										{getSourceLabel(selectedJob.sourceType)}
									</span>
								</div>
							</div>
							<a href="/app/contractor/jobs/{selectedJob.id}" class="btn preset-filled-primary-500">
								View Details
								<ChevronRight class="ml-2 h-4 w-4" />
							</a>
						</div>

						<!-- Job Info Grid -->
						<div class="mt-6 grid gap-6 sm:grid-cols-2">
							<!-- Location -->
							<Card variant="outlined" padding="md">
								<h3 class="text-sm font-medium text-surface-500">Location</h3>
								<div class="mt-2 flex items-start gap-2">
									<MapPin class="h-4 w-4 mt-0.5 text-surface-400" />
									<div class="text-sm">
										{#if selectedJob.addressLine1}
											<p>{selectedJob.addressLine1}</p>
											{#if selectedJob.addressLine2}
												<p>{selectedJob.addressLine2}</p>
											{/if}
											<p>{[selectedJob.city, selectedJob.state, selectedJob.postalCode].filter(Boolean).join(', ')}</p>
										{:else}
											<p class="text-surface-400">No address provided</p>
										{/if}
									</div>
								</div>
							</Card>

							<!-- Schedule -->
							<Card variant="outlined" padding="md">
								<h3 class="text-sm font-medium text-surface-500">Schedule</h3>
								<div class="mt-2 flex items-start gap-2">
									<Calendar class="h-4 w-4 mt-0.5 text-surface-400" />
									<div class="text-sm">
										{#if selectedJob.scheduledStart}
											<p><span class="text-surface-500">Start:</span> {formatDate(selectedJob.scheduledStart)}</p>
											{#if selectedJob.scheduledEnd}
												<p><span class="text-surface-500">End:</span> {formatDate(selectedJob.scheduledEnd)}</p>
											{/if}
										{:else}
											<p class="text-surface-400">Not scheduled</p>
										{/if}
									</div>
								</div>
							</Card>

							<!-- Assignment -->
							<Card variant="outlined" padding="md">
								<h3 class="text-sm font-medium text-surface-500">Assignment</h3>
								<div class="mt-2 flex items-start gap-2">
									<User class="h-4 w-4 mt-0.5 text-surface-400" />
									<div class="text-sm">
										{#if selectedJob.assignedTechnicianId}
											<p>Technician assigned</p>
											{#if selectedJob.assignedAt}
												<p class="text-surface-400">Assigned {formatDate(selectedJob.assignedAt)}</p>
											{/if}
										{:else}
											<p class="text-warning-500">Unassigned</p>
										{/if}
									</div>
								</div>
							</Card>

							<!-- Financials -->
							<Card variant="outlined" padding="md">
								<h3 class="text-sm font-medium text-surface-500">Financials</h3>
								<div class="mt-2 flex items-start gap-2">
									<DollarSign class="h-4 w-4 mt-0.5 text-surface-400" />
									<div class="text-sm">
										{#if selectedJob.estimatedCost}
											<p><span class="text-surface-500">Estimated:</span> ${Number(selectedJob.estimatedCost).toLocaleString()}</p>
										{/if}
										{#if selectedJob.actualCost}
											<p><span class="text-surface-500">Actual:</span> ${Number(selectedJob.actualCost).toLocaleString()}</p>
										{/if}
										{#if !selectedJob.estimatedCost && !selectedJob.actualCost}
											<p class="text-surface-400">No cost data</p>
										{/if}
									</div>
								</div>
							</Card>
						</div>

						<!-- Description -->
						{#if selectedJob.description}
							<div class="mt-6">
								<h3 class="text-sm font-medium text-surface-500">Description</h3>
								<p class="mt-2 text-sm whitespace-pre-wrap">{selectedJob.description}</p>
							</div>
						{/if}

						<!-- Timeline -->
						<div class="mt-6">
							<h3 class="text-sm font-medium text-surface-500 mb-3">Timeline</h3>
							<div class="space-y-2 text-sm">
								<div class="flex items-center gap-2 text-surface-400">
									<Clock class="h-4 w-4" />
									<span>Created {formatDate(selectedJob.createdAt)}</span>
								</div>
								{#if selectedJob.startedAt}
									<div class="flex items-center gap-2 text-surface-400">
										<Play class="h-4 w-4" />
										<span>Started {formatDate(selectedJob.startedAt)}</span>
									</div>
								{/if}
								{#if selectedJob.completedAt}
									<div class="flex items-center gap-2 text-success-500">
										<CheckCircle2 class="h-4 w-4" />
										<span>Completed {formatDate(selectedJob.completedAt)}</span>
									</div>
								{/if}
								{#if selectedJob.paidAt}
									<div class="flex items-center gap-2 text-success-500">
										<DollarSign class="h-4 w-4" />
										<span>Paid {formatDate(selectedJob.paidAt)}</span>
									</div>
								{/if}
								{#if selectedJob.closedAt}
									<div class="flex items-center gap-2 text-surface-400">
										<CheckCircle2 class="h-4 w-4" />
										<span>Closed {formatDate(selectedJob.closedAt)}</span>
									</div>
								{/if}
								{#if selectedJob.cancelledAt}
									<div class="flex items-center gap-2 text-error-500">
										<XCircle class="h-4 w-4" />
										<span>Cancelled {formatDate(selectedJob.cancelledAt)}</span>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<div class="flex flex-1 items-center justify-center">
						<div class="text-center">
							<Wrench class="mx-auto h-12 w-12 text-surface-300" />
							<p class="mt-4 text-surface-500">Select a job to view details</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</PageContainer>
