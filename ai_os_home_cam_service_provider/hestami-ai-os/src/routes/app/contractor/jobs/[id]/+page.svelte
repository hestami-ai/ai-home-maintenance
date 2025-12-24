<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import {
		Wrench,
		Loader2,
		ArrowLeft,
		Clock,
		User,
		MapPin,
		Calendar,
		DollarSign,
		AlertTriangle,
		CheckCircle2,
		XCircle,
		Pause,
		Play,
		FileText,
		Truck,
		MessageSquare,
		History,
		Paperclip,
		ClipboardList,
		Receipt,
		MoreVertical,
		Link,
		Timer,
		Camera,
		Package,
		ExternalLink
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { jobApi, estimateApi, invoiceApi, technicianApi, type Job, type JobStatus, type JobNote, type JobStatusHistoryItem, type Estimate, type JobInvoice, type Technician } from '$lib/api/cam';

	const jobId = $derived($page.params.id ?? '');
	
	// Tab state from URL params
	const validTabs = ['overview', 'estimate', 'schedule', 'execution', 'invoicing', 'documents', 'history'] as const;
	type TabType = typeof validTabs[number];
	const urlTab = $derived($page.url.searchParams.get('tab') as TabType | null);
	
	let job = $state<Job | null>(null);
	let notes = $state<JobNote[]>([]);
	let statusHistory = $state<JobStatusHistoryItem[]>([]);
	let estimates = $state<Estimate[]>([]);
	let invoices = $state<JobInvoice[]>([]);
	let technicians = $state<Technician[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let activeTab = $state<TabType>('overview');
	
	// Sync tab from URL on mount and URL changes
	$effect(() => {
		if (urlTab && validTabs.includes(urlTab)) {
			activeTab = urlTab;
		}
	});
	
	function setActiveTab(tab: TabType) {
		activeTab = tab;
		const url = new URL(window.location.href);
		url.searchParams.set('tab', tab);
		goto(url.toString(), { replaceState: true, noScroll: true });
	}
	
	// Note form
	let newNoteContent = $state('');
	let isNoteInternal = $state(false);
	let isAddingNote = $state(false);
	
	// Estimate form
	let isCreatingEstimate = $state(false);
	let isSendingEstimate = $state(false);
	
	// Invoice form
	let isCreatingInvoice = $state(false);
	
	// Scheduling form
	let showScheduleForm = $state(false);
	let scheduleStart = $state('');
	let scheduleEnd = $state('');
	let selectedTechnicianId = $state('');
	let isScheduling = $state(false);
	let isAssigningTechnician = $state(false);

	onMount(async () => {
		if (jobId) {
			await loadJob();
		}
	});

	async function loadJob() {
		if (!jobId) return;
		isLoading = true;
		error = null;
		try {
			const [jobRes, notesRes, historyRes, estimatesRes, invoicesRes, techniciansRes] = await Promise.all([
				jobApi.get(jobId),
				jobApi.listNotes({ jobId: jobId, includeInternal: true }),
				jobApi.getStatusHistory(jobId),
				estimateApi.list({ jobId: jobId }),
				invoiceApi.list({ jobId: jobId }),
				technicianApi.list({ isActive: true })
			]);
			
			if (jobRes.ok && jobRes.data) {
				job = jobRes.data.job;
				selectedTechnicianId = job.assignedTechnicianId || '';
			} else {
				error = jobRes.error?.message || 'Failed to load job';
			}
			
			if (notesRes.ok && notesRes.data) {
				notes = notesRes.data.notes;
			}
			
			if (historyRes.ok && historyRes.data) {
				statusHistory = historyRes.data.history;
			}
			
			if (estimatesRes.ok && estimatesRes.data) {
				estimates = estimatesRes.data.estimates;
			}
			
			if (invoicesRes.ok && invoicesRes.data) {
				invoices = invoicesRes.data.invoices;
			}
			
			if (techniciansRes.ok && techniciansRes.data) {
				technicians = techniciansRes.data.technicians;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load job';
		} finally {
			isLoading = false;
		}
	}

	async function addNote() {
		if (!newNoteContent.trim()) return;
		isAddingNote = true;
		try {
			const response = await jobApi.addNote({
				jobId: jobId,
				content: newNoteContent,
				isInternal: isNoteInternal,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok && response.data) {
				notes = [response.data.note, ...notes];
				newNoteContent = '';
				isNoteInternal = false;
			}
		} catch (e) {
			console.error('Failed to add note:', e);
		} finally {
			isAddingNote = false;
		}
	}

	async function transitionStatus(toStatus: JobStatus) {
		if (!job) return;
		try {
			const response = await jobApi.transitionStatus({
				id: jobId as string,
				toStatus,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok && response.data) {
				job = response.data.job;
				// Reload history
				const historyRes = await jobApi.getStatusHistory(jobId as string);
				if (historyRes.ok && historyRes.data) {
					statusHistory = historyRes.data.history;
				}
			}
		} catch (e) {
			console.error('Failed to transition status:', e);
		}
	}

	async function createEstimate() {
		if (!job) return;
		isCreatingEstimate = true;
		try {
			const response = await estimateApi.create({
				jobId: jobId,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok && response.data) {
				estimates = [response.data.estimate, ...estimates];
				// Navigate to estimate builder
				goto(`/app/contractor/jobs/${jobId}/estimate/${response.data.estimate.id}`);
			}
		} catch (e) {
			console.error('Failed to create estimate:', e);
		} finally {
			isCreatingEstimate = false;
		}
	}

	async function sendEstimate(estimateId: string) {
		isSendingEstimate = true;
		try {
			const response = await estimateApi.send({ id: estimateId, idempotencyKey: crypto.randomUUID() });
			if (response.ok && response.data) {
				estimates = estimates.map(e => e.id === estimateId ? response.data!.estimate : e);
				// Reload job to get updated status
				await loadJob();
			}
		} catch (e) {
			console.error('Failed to send estimate:', e);
		} finally {
			isSendingEstimate = false;
		}
	}

	async function createInvoiceFromEstimate(estimateId: string) {
		isCreatingInvoice = true;
		try {
			const response = await invoiceApi.createFromEstimate({
				estimateId,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok && response.data) {
				invoices = [response.data.invoice, ...invoices];
				// Reload job to get updated status
				await loadJob();
			}
		} catch (e) {
			console.error('Failed to create invoice:', e);
		} finally {
			isCreatingInvoice = false;
		}
	}

	async function sendInvoice(invoiceId: string) {
		try {
			const response = await invoiceApi.send({ id: invoiceId, idempotencyKey: crypto.randomUUID() });
			if (response.ok && response.data) {
				invoices = invoices.map(i => i.id === invoiceId ? response.data!.invoice : i);
			}
		} catch (e) {
			console.error('Failed to send invoice:', e);
		}
	}

	async function assignTechnician() {
		if (!job) return;
		isAssigningTechnician = true;
		try {
			const response = await jobApi.assignTechnician({
				id: jobId,
				technicianId: selectedTechnicianId || null,
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok && response.data) {
				job = response.data.job;
			}
		} catch (e) {
			console.error('Failed to assign technician:', e);
		} finally {
			isAssigningTechnician = false;
		}
	}

	async function scheduleJob() {
		if (!job || !scheduleStart || !scheduleEnd) return;
		isScheduling = true;
		try {
			const response = await jobApi.schedule({
				id: jobId,
				scheduledStart: new Date(scheduleStart).toISOString(),
				scheduledEnd: new Date(scheduleEnd).toISOString(),
				idempotencyKey: crypto.randomUUID()
			});
			if (response.ok && response.data) {
				job = response.data.job;
				showScheduleForm = false;
				// Auto-transition to SCHEDULED if in JOB_CREATED or ESTIMATE_APPROVED
				if (['JOB_CREATED', 'ESTIMATE_APPROVED'].includes(job.status)) {
					await transitionStatus('SCHEDULED');
				}
			}
		} catch (e) {
			console.error('Failed to schedule job:', e);
		} finally {
			isScheduling = false;
		}
	}

	function getTechnicianName(techId: string | null): string {
		if (!techId) return 'Unassigned';
		const tech = technicians.find(t => t.id === techId);
		return tech ? `${tech.firstName} ${tech.lastName}` : 'Unknown';
	}

	function getEstimateStatusColor(status: string): string {
		const colors: Record<string, string> = {
			DRAFT: 'preset-filled-surface-500',
			SENT: 'preset-filled-primary-500',
			VIEWED: 'preset-filled-secondary-500',
			ACCEPTED: 'preset-filled-success-500',
			DECLINED: 'preset-filled-error-500',
			EXPIRED: 'preset-outlined-surface-500',
			REVISED: 'preset-filled-warning-500'
		};
		return colors[status] || 'preset-filled-surface-500';
	}

	function getInvoiceStatusColor(status: string): string {
		const colors: Record<string, string> = {
			DRAFT: 'preset-filled-surface-500',
			SENT: 'preset-filled-primary-500',
			VIEWED: 'preset-filled-secondary-500',
			PARTIAL: 'preset-filled-warning-500',
			PAID: 'preset-filled-success-500',
			OVERDUE: 'preset-filled-error-500',
			VOID: 'preset-outlined-surface-500',
			REFUNDED: 'preset-outlined-error-500'
		};
		return colors[status] || 'preset-filled-surface-500';
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

	function getPriorityColor(priority: string): string {
		const colors: Record<string, string> = {
			LOW: 'preset-outlined-surface-500',
			MEDIUM: 'preset-outlined-primary-500',
			HIGH: 'preset-filled-warning-500',
			EMERGENCY: 'preset-filled-error-500'
		};
		return colors[priority] || 'preset-outlined-surface-500';
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatShortDate(dateString: string | null): string {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	// Get available transitions based on current status
	function getAvailableTransitions(status: JobStatus): JobStatus[] {
		const transitions: Record<JobStatus, JobStatus[]> = {
			LEAD: ['TICKET', 'CANCELLED'],
			TICKET: ['ESTIMATE_REQUIRED', 'JOB_CREATED', 'CANCELLED'],
			ESTIMATE_REQUIRED: ['ESTIMATE_SENT', 'JOB_CREATED', 'CANCELLED'],
			ESTIMATE_SENT: ['ESTIMATE_APPROVED', 'ESTIMATE_REQUIRED', 'CANCELLED'],
			ESTIMATE_APPROVED: ['JOB_CREATED', 'CANCELLED'],
			JOB_CREATED: ['SCHEDULED', 'CANCELLED'],
			SCHEDULED: ['DISPATCHED', 'ON_HOLD', 'CANCELLED'],
			DISPATCHED: ['IN_PROGRESS', 'SCHEDULED', 'ON_HOLD', 'CANCELLED'],
			IN_PROGRESS: ['ON_HOLD', 'COMPLETED', 'CANCELLED'],
			ON_HOLD: ['SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'CANCELLED'],
			COMPLETED: ['INVOICED', 'WARRANTY', 'CLOSED', 'CANCELLED'],
			INVOICED: ['PAID', 'CANCELLED'],
			PAID: ['WARRANTY', 'CLOSED'],
			WARRANTY: ['CLOSED', 'IN_PROGRESS'],
			CLOSED: [],
			CANCELLED: []
		};
		return transitions[status] || [];
	}

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: FileText },
		{ id: 'estimate', label: 'Scope & Estimate', icon: DollarSign },
		{ id: 'schedule', label: 'Scheduling', icon: Calendar },
		{ id: 'execution', label: 'Execution', icon: ClipboardList },
		{ id: 'invoicing', label: 'Invoicing', icon: Receipt },
		{ id: 'documents', label: 'Documents', icon: Paperclip },
		{ id: 'history', label: 'History', icon: History }
	] as const;
</script>

<svelte:head>
	<title>{job?.title || 'Job'} | Contractor Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
		</div>
	{:else if error || !job}
		<Card variant="outlined" padding="lg">
			<div class="text-center">
				<p class="text-error-500">{error || 'Job not found'}</p>
				<a href="/app/contractor/jobs" class="btn preset-outlined-primary-500 mt-4">
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back to Jobs
				</a>
			</div>
		</Card>
	{:else}
		<div class="space-y-6">
			<!-- Header -->
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="flex items-start gap-4">
					<a href="/app/contractor/jobs" class="btn btn-icon preset-outlined-surface-500 mt-1">
						<ArrowLeft class="h-4 w-4" />
					</a>
					<div>
						<div class="flex items-center gap-2">
							<span class="text-sm text-surface-500">{job.jobNumber}</span>
							<span class="badge {getStatusColor(job.status)}">{getStatusLabel(job.status)}</span>
							<span class="badge {getPriorityColor(job.priority)}">{job.priority}</span>
						</div>
						<h1 class="mt-1 text-2xl font-bold">{job.title}</h1>
						{#if job.addressLine1}
							<p class="mt-1 text-surface-500 flex items-center gap-1">
								<MapPin class="h-4 w-4" />
								{job.addressLine1}{job.city ? `, ${job.city}` : ''}{job.state ? `, ${job.state}` : ''}
							</p>
						{/if}
					</div>
				</div>
				
				<!-- Quick Actions -->
				<div class="flex gap-2">
					{#if getAvailableTransitions(job.status).length > 0}
						<div class="dropdown">
							<button class="btn preset-filled-primary-500">
								Actions
								<MoreVertical class="ml-2 h-4 w-4" />
							</button>
							<div class="dropdown-content mt-2 w-48 rounded-lg border border-surface-300-700 bg-surface-50-950 p-2 shadow-lg">
								{#each getAvailableTransitions(job.status) as toStatus}
									<button
										onclick={() => transitionStatus(toStatus)}
										class="w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-200-800"
									>
										→ {getStatusLabel(toStatus)}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Tabs -->
			<div class="border-b border-surface-300-700">
				<nav class="flex gap-1 overflow-x-auto">
					{#each tabs as tab}
						{@const Icon = tab.icon}
						<button
							onclick={() => setActiveTab(tab.id)}
							class="flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === tab.id ? 'border-primary-500 text-primary-500' : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}"
						>
							<Icon class="h-4 w-4" />
							{tab.label}
						</button>
					{/each}
				</nav>
			</div>

			<!-- Tab Content -->
			<div class="min-h-[400px]">
				{#if activeTab === 'overview'}
					<div class="grid gap-6 lg:grid-cols-3">
						<!-- Main Info -->
						<div class="lg:col-span-2 space-y-6">
							<!-- Description -->
							<Card variant="outlined" padding="md">
								<h3 class="font-medium">Description</h3>
								<p class="mt-2 text-sm whitespace-pre-wrap text-surface-600 dark:text-surface-400">
									{job.description || 'No description provided.'}
								</p>
							</Card>

							<!-- Notes -->
							<Card variant="outlined" padding="md">
								<h3 class="font-medium mb-4">Notes</h3>
								
								<!-- Add Note Form -->
								<div class="mb-4 space-y-2">
									<textarea
										bind:value={newNoteContent}
										placeholder="Add a note..."
										rows="2"
										class="textarea w-full"
									></textarea>
									<div class="flex items-center justify-between">
										<label class="flex items-center gap-2 text-sm">
											<input type="checkbox" bind:checked={isNoteInternal} class="checkbox" />
											Internal note (not visible to customer)
										</label>
										<button
											onclick={addNote}
											disabled={!newNoteContent.trim() || isAddingNote}
											class="btn btn-sm preset-filled-primary-500"
										>
											{#if isAddingNote}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
											{:else}
												<MessageSquare class="mr-2 h-4 w-4" />
											{/if}
											Add Note
										</button>
									</div>
								</div>

								<!-- Notes List -->
								{#if notes.length === 0}
									<p class="text-sm text-surface-400">No notes yet.</p>
								{:else}
									<div class="space-y-3">
										{#each notes as note}
											<div class="rounded-lg border border-surface-200-800 p-3 {note.isInternal ? 'bg-warning-500/5' : ''}">
												<div class="flex items-center gap-2 text-xs text-surface-400">
													<span>{formatShortDate(note.createdAt)}</span>
													{#if note.isInternal}
														<span class="badge preset-outlined-warning-500 text-xs">Internal</span>
													{/if}
												</div>
												<p class="mt-1 text-sm">{note.content}</p>
											</div>
										{/each}
									</div>
								{/if}
							</Card>
						</div>

						<!-- Sidebar -->
						<div class="space-y-4">
							<!-- Origin Reference Card -->
							{#if job.workOrderId || job.violationId || job.arcRequestId}
								<Card variant="outlined" padding="md" class="border-primary-500/30 bg-primary-500/5">
									<h3 class="font-medium mb-3 flex items-center gap-2">
										<Link class="h-4 w-4 text-primary-500" />
										Origin Reference
									</h3>
									<div class="space-y-2 text-sm">
										{#if job.workOrderId}
											<a 
												href="/app/cam/work-orders/{job.workOrderId}"
												class="flex items-center gap-2 text-primary-500 hover:underline"
											>
												<ExternalLink class="h-3 w-3" />
												View Work Order
											</a>
										{/if}
										{#if job.violationId}
											<a 
												href="/app/cam/violations/{job.violationId}"
												class="flex items-center gap-2 text-primary-500 hover:underline"
											>
												<ExternalLink class="h-3 w-3" />
												View Violation
											</a>
										{/if}
										{#if job.arcRequestId}
											<a 
												href="/app/cam/arc/{job.arcRequestId}"
												class="flex items-center gap-2 text-primary-500 hover:underline"
											>
												<ExternalLink class="h-3 w-3" />
												View ARC Request
											</a>
										{/if}
									</div>
								</Card>
							{/if}

							<!-- SLA Indicators Card -->
							{#if job.scheduledStart}
								{@const now = new Date()}
								{@const scheduledDate = new Date(job.scheduledStart)}
								{@const isOverdue = now > scheduledDate && !['COMPLETED', 'CLOSED', 'CANCELLED', 'PAID', 'INVOICED'].includes(job.status)}
								{@const hoursUntil = Math.round((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60))}
								<Card variant="outlined" padding="md" class={isOverdue ? 'border-error-500/50 bg-error-500/5' : hoursUntil <= 24 && hoursUntil > 0 ? 'border-warning-500/50 bg-warning-500/5' : ''}>
									<h3 class="font-medium mb-3 flex items-center gap-2">
										<Timer class="h-4 w-4 {isOverdue ? 'text-error-500' : hoursUntil <= 24 && hoursUntil > 0 ? 'text-warning-500' : 'text-surface-500'}" />
										SLA Status
									</h3>
									<div class="text-sm">
										{#if isOverdue}
											<div class="flex items-center gap-2 text-error-500">
												<AlertTriangle class="h-4 w-4" />
												<span class="font-medium">Overdue</span>
											</div>
											<p class="mt-1 text-surface-500">Scheduled for {formatShortDate(job.scheduledStart)}</p>
										{:else if hoursUntil <= 24 && hoursUntil > 0}
											<div class="flex items-center gap-2 text-warning-500">
												<Clock class="h-4 w-4" />
												<span class="font-medium">Due Soon</span>
											</div>
											<p class="mt-1 text-surface-500">{hoursUntil} hours remaining</p>
										{:else if hoursUntil > 0}
											<div class="flex items-center gap-2 text-success-500">
												<CheckCircle2 class="h-4 w-4" />
												<span class="font-medium">On Track</span>
											</div>
											<p class="mt-1 text-surface-500">{Math.round(hoursUntil / 24)} days until scheduled</p>
										{:else}
											<div class="flex items-center gap-2 text-success-500">
												<CheckCircle2 class="h-4 w-4" />
												<span class="font-medium">Completed</span>
											</div>
										{/if}
									</div>
								</Card>
							{/if}

							<!-- Details Card -->
							<Card variant="outlined" padding="md">
								<h3 class="font-medium mb-3">Details</h3>
								<dl class="space-y-3 text-sm">
									<div>
										<dt class="text-surface-500">Category</dt>
										<dd class="font-medium">{job.category || '-'}</dd>
									</div>
									<div>
										<dt class="text-surface-500">Source</dt>
										<dd class="font-medium">{job.sourceType.replace('_', ' ')}</dd>
									</div>
									{#if job.assignedTechnicianId}
										<div>
											<dt class="text-surface-500">Assigned</dt>
											<dd class="font-medium flex items-center gap-1">
												<User class="h-4 w-4" />
												{getTechnicianName(job.assignedTechnicianId)}
											</dd>
										</div>
									{/if}
								</dl>
							</Card>

							<!-- Schedule Card -->
							<Card variant="outlined" padding="md">
								<h3 class="font-medium mb-3">Schedule</h3>
								<dl class="space-y-3 text-sm">
									{#if job.scheduledStart}
										<div>
											<dt class="text-surface-500">Scheduled Start</dt>
											<dd class="font-medium">{formatDate(job.scheduledStart)}</dd>
										</div>
									{/if}
									{#if job.scheduledEnd}
										<div>
											<dt class="text-surface-500">Scheduled End</dt>
											<dd class="font-medium">{formatDate(job.scheduledEnd)}</dd>
										</div>
									{/if}
									{#if job.estimatedHours}
										<div>
											<dt class="text-surface-500">Estimated Hours</dt>
											<dd class="font-medium">{job.estimatedHours} hrs</dd>
										</div>
									{/if}
									{#if !job.scheduledStart && !job.estimatedHours}
										<p class="text-surface-400">Not scheduled</p>
									{/if}
								</dl>
							</Card>

							<!-- Financials Card -->
							<Card variant="outlined" padding="md">
								<h3 class="font-medium mb-3">Financials</h3>
								<dl class="space-y-3 text-sm">
									{#if job.estimatedCost}
										<div>
											<dt class="text-surface-500">Estimated Cost</dt>
											<dd class="font-medium">${Number(job.estimatedCost).toLocaleString()}</dd>
										</div>
									{/if}
									{#if job.actualCost}
										<div>
											<dt class="text-surface-500">Actual Cost</dt>
											<dd class="font-medium">${Number(job.actualCost).toLocaleString()}</dd>
										</div>
									{/if}
									{#if job.actualHours}
										<div>
											<dt class="text-surface-500">Actual Hours</dt>
											<dd class="font-medium">{job.actualHours} hrs</dd>
										</div>
									{/if}
									{#if !job.estimatedCost && !job.actualCost}
										<p class="text-surface-400">No cost data</p>
									{/if}
								</dl>
							</Card>
						</div>
					</div>

				{:else if activeTab === 'estimate'}
					<div class="space-y-4">
						<!-- Header -->
						<div class="flex items-center justify-between">
							<h3 class="font-medium">Estimates</h3>
							<button
								onclick={createEstimate}
								disabled={isCreatingEstimate}
								class="btn btn-sm preset-filled-primary-500"
							>
								{#if isCreatingEstimate}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{:else}
									<DollarSign class="mr-2 h-4 w-4" />
								{/if}
								Create Estimate
							</button>
						</div>

						{#if estimates.length === 0}
							<Card variant="outlined" padding="lg">
								<EmptyState
									title="No estimates yet"
									description="Create an estimate to define the scope and cost of this job."
								>
									{#snippet actions()}
										<button
											onclick={createEstimate}
											disabled={isCreatingEstimate}
											class="btn preset-filled-primary-500"
										>
											<DollarSign class="mr-2 h-4 w-4" />
											Create Estimate
										</button>
									{/snippet}
								</EmptyState>
							</Card>
						{:else}
							<div class="space-y-3">
								{#each estimates as estimate}
									<Card variant="outlined" padding="md">
										<div class="flex items-start justify-between">
											<div>
												<div class="flex items-center gap-2">
													<span class="font-medium">{estimate.estimateNumber}</span>
													<span class="badge {getEstimateStatusColor(estimate.status)} text-xs">
														{estimate.status}
													</span>
													{#if estimate.version > 1}
														<span class="text-xs text-surface-400">v{estimate.version}</span>
													{/if}
												</div>
												<div class="mt-2 text-2xl font-bold">
													${Number(estimate.totalAmount).toLocaleString()}
												</div>
												<div class="mt-1 text-sm text-surface-500">
													{#if estimate.lines && estimate.lines.length > 0}
														{estimate.lines.length} line item{estimate.lines.length !== 1 ? 's' : ''}
													{:else}
														No line items
													{/if}
												</div>
												{#if estimate.validUntil}
													<div class="mt-1 text-xs text-surface-400">
														Valid until {formatShortDate(estimate.validUntil)}
													</div>
												{/if}
											</div>
											<div class="flex gap-2">
												{#if estimate.status === 'DRAFT'}
													<button
														onclick={() => sendEstimate(estimate.id)}
														disabled={isSendingEstimate}
														class="btn btn-sm preset-filled-primary-500"
													>
														{#if isSendingEstimate}
															<Loader2 class="mr-2 h-4 w-4 animate-spin" />
														{/if}
														Send
													</button>
												{/if}
												{#if estimate.status === 'ACCEPTED'}
													<button
														onclick={() => createInvoiceFromEstimate(estimate.id)}
														disabled={isCreatingInvoice}
														class="btn btn-sm preset-filled-success-500"
													>
														{#if isCreatingInvoice}
															<Loader2 class="mr-2 h-4 w-4 animate-spin" />
														{/if}
														Create Invoice
													</button>
												{/if}
												<a
													href="/app/contractor/jobs/{jobId}/estimate/{estimate.id}"
													class="btn btn-sm preset-outlined-surface-500"
												>
													View
												</a>
											</div>
										</div>
										{#if estimate.notes}
											<p class="mt-3 text-sm text-surface-500 border-t border-surface-200-800 pt-3">
												{estimate.notes}
											</p>
										{/if}
									</Card>
								{/each}
							</div>

							<!-- Estimate Version History -->
							{#if estimates.length > 0}
								<Card variant="outlined" padding="md" class="mt-6">
									<h3 class="font-medium mb-4 flex items-center gap-2">
										<History class="h-4 w-4" />
										Estimate History
									</h3>
									<div class="space-y-3">
										{#each estimates.sort((a, b) => b.version - a.version) as estimate}
											<div class="flex items-center justify-between py-2 border-b border-surface-200-800 last:border-0">
												<div class="flex items-center gap-3">
													<div class="flex h-8 w-8 items-center justify-center rounded-full bg-surface-200-800 text-sm font-medium">
														v{estimate.version}
													</div>
													<div>
														<div class="text-sm font-medium">{estimate.estimateNumber}</div>
														<div class="text-xs text-surface-500">{formatShortDate(estimate.createdAt)}</div>
													</div>
												</div>
												<div class="flex items-center gap-3">
													<span class="text-sm font-medium">${Number(estimate.totalAmount).toLocaleString()}</span>
													<span class="badge {getEstimateStatusColor(estimate.status)} text-xs">{estimate.status}</span>
												</div>
											</div>
										{/each}
									</div>
								</Card>
							{/if}
						{/if}
					</div>

				{:else if activeTab === 'schedule'}
					<div class="space-y-6">
						<!-- Current Schedule -->
						<Card variant="outlined" padding="md">
							<div class="flex items-center justify-between mb-4">
								<h3 class="font-medium">Current Schedule</h3>
								{#if !job.scheduledStart && ['JOB_CREATED', 'ESTIMATE_APPROVED'].includes(job.status)}
									<button
										onclick={() => showScheduleForm = !showScheduleForm}
										class="btn btn-sm preset-filled-primary-500"
									>
										<Calendar class="mr-2 h-4 w-4" />
										Schedule Job
									</button>
								{/if}
							</div>
							
							<!-- Schedule Form -->
							{#if showScheduleForm}
								<div class="mb-4 p-4 rounded-lg bg-surface-100-900 border border-surface-300-700">
									<h4 class="font-medium mb-3">Set Schedule</h4>
									<div class="grid gap-4 sm:grid-cols-2">
										<div>
											<label for="scheduleStart" class="label mb-1 text-sm">Start Date & Time</label>
											<input
												id="scheduleStart"
												type="datetime-local"
												bind:value={scheduleStart}
												class="input w-full"
											/>
										</div>
										<div>
											<label for="scheduleEnd" class="label mb-1 text-sm">End Date & Time</label>
											<input
												id="scheduleEnd"
												type="datetime-local"
												bind:value={scheduleEnd}
												class="input w-full"
											/>
										</div>
									</div>
									<div class="mt-4 flex justify-end gap-2">
										<button onclick={() => showScheduleForm = false} class="btn btn-sm preset-outlined-surface-500">
											Cancel
										</button>
										<button
											onclick={scheduleJob}
											disabled={!scheduleStart || !scheduleEnd || isScheduling}
											class="btn btn-sm preset-filled-primary-500"
										>
											{#if isScheduling}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" />
											{/if}
											Save Schedule
										</button>
									</div>
								</div>
							{/if}

							{#if job.scheduledStart}
								<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
									<div class="p-3 rounded-lg bg-surface-100-900">
										<div class="text-xs text-surface-500 uppercase tracking-wide">Start</div>
										<div class="mt-1 font-medium">{formatDate(job.scheduledStart)}</div>
									</div>
									{#if job.scheduledEnd}
										<div class="p-3 rounded-lg bg-surface-100-900">
											<div class="text-xs text-surface-500 uppercase tracking-wide">End</div>
											<div class="mt-1 font-medium">{formatDate(job.scheduledEnd)}</div>
										</div>
									{/if}
									{#if job.estimatedHours}
										<div class="p-3 rounded-lg bg-surface-100-900">
											<div class="text-xs text-surface-500 uppercase tracking-wide">Duration</div>
											<div class="mt-1 font-medium">{job.estimatedHours} hours</div>
										</div>
									{/if}
									<div class="p-3 rounded-lg bg-surface-100-900">
										<div class="text-xs text-surface-500 uppercase tracking-wide">Status</div>
										<div class="mt-1">
											{#if job.completedAt}
												<span class="badge preset-filled-success-500 text-xs">Completed</span>
											{:else if job.startedAt}
												<span class="badge preset-filled-warning-500 text-xs">In Progress</span>
											{:else if job.dispatchedAt}
												<span class="badge preset-filled-primary-500 text-xs">Dispatched</span>
											{:else}
												<span class="badge preset-filled-tertiary-500 text-xs">Scheduled</span>
											{/if}
										</div>
									</div>
								</div>

								<!-- Mini Calendar View -->
								<div class="mt-4 p-4 rounded-lg border border-surface-300-700">
									<div class="flex items-center gap-2 mb-3">
										<Calendar class="h-4 w-4 text-primary-500" />
										<span class="text-sm font-medium">Calendar View</span>
									</div>
									{#if job.scheduledStart}
										{@const startDate = new Date(job.scheduledStart)}
										{@const endDate = job.scheduledEnd ? new Date(job.scheduledEnd) : startDate}
										{@const weekStart = new Date(startDate)}
										{@const _ = weekStart.setDate(weekStart.getDate() - weekStart.getDay())}
										<div class="grid grid-cols-7 gap-1 text-center text-xs">
											{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
												<div class="py-1 text-surface-500 font-medium">{day}</div>
											{/each}
											{#each Array(7) as _, i}
												{@const cellDate = new Date(weekStart)}
												{@const __ = cellDate.setDate(weekStart.getDate() + i)}
												{@const isScheduled = cellDate >= new Date(startDate.toDateString()) && cellDate <= new Date(endDate.toDateString())}
												{@const isToday = cellDate.toDateString() === new Date().toDateString()}
												<div class="py-2 rounded {isScheduled ? 'bg-primary-500 text-white' : isToday ? 'bg-surface-200-800 font-bold' : ''}">
													{cellDate.getDate()}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{:else}
								<p class="text-surface-400">This job has not been scheduled yet.</p>
							{/if}
						</Card>

						<!-- Route Notes -->
						<Card variant="outlined" padding="md">
							<h3 class="font-medium mb-4">Route Notes</h3>
							{#if job.locationNotes}
								<div class="p-3 rounded-lg bg-surface-100-900">
									<p class="text-sm whitespace-pre-wrap">{job.locationNotes}</p>
								</div>
							{:else}
								<p class="text-sm text-surface-400">No route notes provided.</p>
							{/if}
							{#if job.addressLine1}
								<div class="mt-4">
									<h4 class="text-sm font-medium mb-2">Location</h4>
									<div class="flex items-start gap-2 text-sm">
										<MapPin class="h-4 w-4 text-surface-400 mt-0.5" />
										<div>
											<p>{job.addressLine1}</p>
											{#if job.addressLine2}<p>{job.addressLine2}</p>{/if}
											<p>{job.city || ''}{job.city && job.state ? ', ' : ''}{job.state || ''} {job.postalCode || ''}</p>
										</div>
									</div>
								</div>
							{/if}
						</Card>

						<!-- Assignment -->
						<Card variant="outlined" padding="md">
							<h3 class="font-medium mb-4">Assignment</h3>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-full {job.assignedTechnicianId ? 'bg-primary-500/10' : 'bg-surface-200-800'}">
										<User class="h-5 w-5 {job.assignedTechnicianId ? 'text-primary-500' : 'text-surface-400'}" />
									</div>
									<div>
										<div class="font-medium">{getTechnicianName(job.assignedTechnicianId)}</div>
										{#if job.assignedAt}
											<div class="text-sm text-surface-500">Assigned {formatShortDate(job.assignedAt)}</div>
										{/if}
									</div>
								</div>
							</div>
							{#if technicians.length > 0}
								<div class="mt-4 flex items-center gap-2">
									<select
										bind:value={selectedTechnicianId}
										class="select flex-1"
									>
										<option value="">-- Select Technician --</option>
										{#each technicians as tech}
											<option value={tech.id}>{tech.firstName} {tech.lastName}</option>
										{/each}
									</select>
									<button
										onclick={assignTechnician}
										disabled={isAssigningTechnician || selectedTechnicianId === (job.assignedTechnicianId || '')}
										class="btn btn-sm preset-filled-primary-500"
									>
										{#if isAssigningTechnician}
											<Loader2 class="h-4 w-4 animate-spin" />
										{:else}
											Assign
										{/if}
									</button>
								</div>
							{:else}
								<p class="mt-4 text-sm text-surface-400">No technicians available. Add technicians in settings.</p>
							{/if}
						</Card>

						<!-- Dispatch Status -->
						<Card variant="outlined" padding="md">
							<h3 class="font-medium mb-4">Dispatch Status</h3>
							{#if job.dispatchedAt}
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-full bg-success-500/10">
										<Truck class="h-5 w-5 text-success-500" />
									</div>
									<div>
										<div class="font-medium text-success-600">Dispatched</div>
										<div class="text-sm text-surface-500">{formatDate(job.dispatchedAt)}</div>
									</div>
								</div>
							{:else if job.scheduledStart && job.assignedTechnicianId}
								<div class="flex items-center justify-between">
									<p class="text-surface-500">Ready to dispatch</p>
									<button
										onclick={() => transitionStatus('DISPATCHED')}
										class="btn btn-sm preset-filled-primary-500"
									>
										<Truck class="mr-2 h-4 w-4" />
										Dispatch Now
									</button>
								</div>
							{:else}
								<p class="text-surface-400">
									{#if !job.scheduledStart}
										Schedule the job first before dispatching.
									{:else if !job.assignedTechnicianId}
										Assign a technician before dispatching.
									{/if}
								</p>
							{/if}
						</Card>

						<!-- Quick Actions -->
						<div class="flex gap-3">
							{#if !job.scheduledStart && ['JOB_CREATED', 'ESTIMATE_APPROVED'].includes(job.status)}
								<a href="/app/contractor/dispatch" class="btn preset-filled-primary-500">
									<Calendar class="mr-2 h-4 w-4" />
									Open Dispatch Board
								</a>
							{/if}
						</div>
					</div>

				{:else if activeTab === 'execution'}
					<div class="space-y-6">
						<!-- Execution Status -->
						<Card variant="outlined" padding="md">
							<h3 class="font-medium mb-4">Execution Status</h3>
							<div class="grid gap-4 sm:grid-cols-3">
								<div class="text-center p-4 rounded-lg bg-surface-100-900">
									{#if job.startedAt}
										<Play class="h-6 w-6 mx-auto text-success-500" />
										<div class="mt-2 font-medium">Started</div>
										<div class="text-xs text-surface-500">{formatShortDate(job.startedAt)}</div>
									{:else}
										<Play class="h-6 w-6 mx-auto text-surface-400" />
										<div class="mt-2 text-surface-500">Not Started</div>
									{/if}
								</div>
								<div class="text-center p-4 rounded-lg bg-surface-100-900">
									{#if job.status === 'IN_PROGRESS'}
										<Clock class="h-6 w-6 mx-auto text-warning-500 animate-pulse" />
										<div class="mt-2 font-medium text-warning-500">In Progress</div>
									{:else if job.completedAt}
										<CheckCircle2 class="h-6 w-6 mx-auto text-success-500" />
										<div class="mt-2 font-medium">Completed</div>
										<div class="text-xs text-surface-500">{formatShortDate(job.completedAt)}</div>
									{:else}
										<Clock class="h-6 w-6 mx-auto text-surface-400" />
										<div class="mt-2 text-surface-500">Pending</div>
									{/if}
								</div>
								<div class="text-center p-4 rounded-lg bg-surface-100-900">
									{#if job.actualHours}
										<div class="text-2xl font-bold">{job.actualHours}</div>
										<div class="text-xs text-surface-500">Hours Logged</div>
									{:else}
										<div class="text-2xl font-bold text-surface-400">-</div>
										<div class="text-xs text-surface-500">Hours Logged</div>
									{/if}
								</div>
							</div>
						</Card>

						<!-- Quick Actions -->
						{#if job.status === 'DISPATCHED'}
							<Card variant="outlined" padding="md">
								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium">Start Work</h3>
										<p class="text-sm text-surface-500">Mark this job as in progress</p>
									</div>
									<button
										onclick={() => transitionStatus('IN_PROGRESS')}
										class="btn preset-filled-primary-500"
									>
										<Play class="mr-2 h-4 w-4" />
										Start Job
									</button>
								</div>
							</Card>
						{/if}

						{#if job.status === 'IN_PROGRESS'}
							<Card variant="outlined" padding="md">
								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium">Complete Work</h3>
										<p class="text-sm text-surface-500">Mark this job as completed</p>
									</div>
									<div class="flex gap-2">
										<button
											onclick={() => transitionStatus('ON_HOLD')}
											class="btn preset-outlined-warning-500"
										>
											<Pause class="mr-2 h-4 w-4" />
											Put On Hold
										</button>
										<button
											onclick={() => transitionStatus('COMPLETED')}
											class="btn preset-filled-success-500"
										>
											<CheckCircle2 class="mr-2 h-4 w-4" />
											Mark Complete
										</button>
									</div>
								</div>
							</Card>
						{/if}

						{#if job.status === 'ON_HOLD'}
							<Card variant="outlined" padding="md">
								<div class="flex items-center justify-between">
									<div>
										<h3 class="font-medium text-warning-500">Job On Hold</h3>
										<p class="text-sm text-surface-500">Resume work when ready</p>
									</div>
									<button
										onclick={() => transitionStatus('IN_PROGRESS')}
										class="btn preset-filled-primary-500"
									>
										<Play class="mr-2 h-4 w-4" />
										Resume Work
									</button>
								</div>
							</Card>
						{/if}

						<!-- Task Checklist -->
						<Card variant="outlined" padding="md">
							<div class="flex items-center justify-between mb-4">
								<h3 class="font-medium flex items-center gap-2">
									<ClipboardList class="h-4 w-4" />
									Task Checklist
								</h3>
								<span class="text-sm text-surface-500">0 / 0 completed</span>
							</div>
							<div class="space-y-2">
								<div class="flex items-center gap-3 p-3 rounded-lg bg-surface-100-900">
									<input type="checkbox" disabled class="checkbox" />
									<span class="text-sm text-surface-400">No checklist items defined</span>
								</div>
							</div>
							<p class="mt-3 text-xs text-surface-400">
								Checklist templates can be configured in contractor settings.
							</p>
						</Card>

						<!-- Photos & Media -->
						<Card variant="outlined" padding="md">
							<div class="flex items-center justify-between mb-4">
								<h3 class="font-medium flex items-center gap-2">
									<Camera class="h-4 w-4" />
									Photos & Media
								</h3>
								<button class="btn btn-sm preset-outlined-primary-500">
									<Camera class="mr-2 h-4 w-4" />
									Add Photo
								</button>
							</div>
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
								<div class="aspect-square rounded-lg border-2 border-dashed border-surface-300-700 flex items-center justify-center">
									<div class="text-center">
										<Camera class="h-6 w-6 mx-auto text-surface-400" />
										<p class="mt-1 text-xs text-surface-400">No photos</p>
									</div>
								</div>
							</div>
							<div class="mt-3 flex gap-4 text-xs text-surface-500">
								<span>Before: 0</span>
								<span>During: 0</span>
								<span>After: 0</span>
							</div>
						</Card>

						<!-- Materials Used -->
						<Card variant="outlined" padding="md">
							<div class="flex items-center justify-between mb-4">
								<h3 class="font-medium flex items-center gap-2">
									<Package class="h-4 w-4" />
									Materials Used
								</h3>
								<button class="btn btn-sm preset-outlined-primary-500">
									<Package class="mr-2 h-4 w-4" />
									Add Material
								</button>
							</div>
							<div class="overflow-x-auto">
								<table class="w-full text-sm">
									<thead class="text-xs text-surface-500 border-b border-surface-200-800">
										<tr>
											<th class="text-left py-2">Item</th>
											<th class="text-right py-2">Qty</th>
											<th class="text-right py-2">Unit Cost</th>
											<th class="text-right py-2">Total</th>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td colspan="4" class="py-4 text-center text-surface-400">
												No materials recorded
											</td>
										</tr>
									</tbody>
									<tfoot class="border-t border-surface-200-800">
										<tr>
											<td colspan="3" class="py-2 font-medium">Total Materials Cost</td>
											<td class="py-2 text-right font-bold">$0.00</td>
										</tr>
									</tfoot>
								</table>
							</div>
						</Card>

						<!-- Time Entries -->
						<Card variant="outlined" padding="md">
							<div class="flex items-center justify-between mb-4">
								<h3 class="font-medium flex items-center gap-2">
									<Timer class="h-4 w-4" />
									Time Entries
								</h3>
								<button class="btn btn-sm preset-outlined-primary-500">
									<Timer class="mr-2 h-4 w-4" />
									Log Time
								</button>
							</div>
							<div class="overflow-x-auto">
								<table class="w-full text-sm">
									<thead class="text-xs text-surface-500 border-b border-surface-200-800">
										<tr>
											<th class="text-left py-2">Date</th>
											<th class="text-left py-2">Technician</th>
											<th class="text-right py-2">Hours</th>
											<th class="text-left py-2">Notes</th>
										</tr>
									</thead>
									<tbody>
										{#if job.startedAt && job.completedAt}
											<tr class="border-b border-surface-200-800">
												<td class="py-2">{formatShortDate(job.startedAt)}</td>
												<td class="py-2">{getTechnicianName(job.assignedTechnicianId)}</td>
												<td class="py-2 text-right">{job.actualHours || '-'}</td>
												<td class="py-2 text-surface-500">Auto-logged</td>
											</tr>
										{:else}
											<tr>
												<td colspan="4" class="py-4 text-center text-surface-400">
													No time entries recorded
												</td>
											</tr>
										{/if}
									</tbody>
									<tfoot class="border-t border-surface-200-800">
										<tr>
											<td colspan="2" class="py-2 font-medium">Total Hours</td>
											<td class="py-2 text-right font-bold">{job.actualHours || '0'}</td>
											<td></td>
										</tr>
									</tfoot>
								</table>
							</div>
						</Card>
					</div>

				{:else if activeTab === 'invoicing'}
					<div class="space-y-4">
						<!-- Header -->
						<div class="flex items-center justify-between">
							<h3 class="font-medium">Invoices</h3>
						</div>

						{#if invoices.length === 0}
							<Card variant="outlined" padding="lg">
								<EmptyState
									title="No invoices yet"
									description="Create an invoice from an accepted estimate or directly."
								/>
							</Card>
						{:else}
							<div class="space-y-3">
								{#each invoices as invoice}
									<Card variant="outlined" padding="md">
										<div class="flex items-start justify-between">
											<div>
												<div class="flex items-center gap-2">
													<span class="font-medium">{invoice.invoiceNumber}</span>
													<span class="badge {getInvoiceStatusColor(invoice.status)} text-xs">
														{invoice.status}
													</span>
												</div>
												<div class="mt-2 grid grid-cols-3 gap-4 text-sm">
													<div>
														<span class="text-surface-500">Total:</span>
														<span class="font-bold ml-1">${Number(invoice.totalAmount).toLocaleString()}</span>
													</div>
													<div>
														<span class="text-surface-500">Paid:</span>
														<span class="font-medium ml-1 text-success-500">${Number(invoice.amountPaid).toLocaleString()}</span>
													</div>
													<div>
														<span class="text-surface-500">Due:</span>
														<span class="font-medium ml-1 {Number(invoice.balanceDue) > 0 ? 'text-warning-500' : 'text-success-500'}">
															${Number(invoice.balanceDue).toLocaleString()}
														</span>
													</div>
												</div>
												{#if invoice.dueDate}
													<div class="mt-1 text-xs text-surface-400">
														Due {formatShortDate(invoice.dueDate)}
													</div>
												{/if}
											</div>
											<div class="flex gap-2">
												{#if invoice.status === 'DRAFT'}
													<button
														onclick={() => sendInvoice(invoice.id)}
														class="btn btn-sm preset-filled-primary-500"
													>
														Send
													</button>
												{/if}
												{#if ['SENT', 'VIEWED', 'PARTIAL', 'OVERDUE'].includes(invoice.status) && Number(invoice.balanceDue) > 0}
													<a
														href="/app/contractor/jobs/{jobId}/invoice/{invoice.id}?action=payment"
														class="btn btn-sm preset-filled-success-500"
													>
														Record Payment
													</a>
												{/if}
												<a
													href="/app/contractor/jobs/{jobId}/invoice/{invoice.id}"
													class="btn btn-sm preset-outlined-surface-500"
												>
													View
												</a>
											</div>
										</div>
									</Card>
								{/each}
							</div>
						{/if}

						<!-- Summary -->
						{#if invoices.length > 0}
							<Card variant="outlined" padding="md" class="bg-surface-100-900">
								<div class="grid grid-cols-3 gap-4 text-center">
									<div>
										<div class="text-2xl font-bold">
											${invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0).toLocaleString()}
										</div>
										<div class="text-xs text-surface-500">Total Invoiced</div>
									</div>
									<div>
										<div class="text-2xl font-bold text-success-500">
											${invoices.reduce((sum, i) => sum + Number(i.amountPaid), 0).toLocaleString()}
										</div>
										<div class="text-xs text-surface-500">Total Paid</div>
									</div>
									<div>
										<div class="text-2xl font-bold text-warning-500">
											${invoices.reduce((sum, i) => sum + Number(i.balanceDue), 0).toLocaleString()}
										</div>
										<div class="text-xs text-surface-500">Balance Due</div>
									</div>
								</div>
							</Card>
						{/if}
					</div>

				{:else if activeTab === 'documents'}
					<div class="space-y-4">
						<!-- Document Categories -->
						<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<Card variant="outlined" padding="md" class="text-center">
								<FileText class="h-8 w-8 mx-auto text-primary-500" />
								<h4 class="mt-2 font-medium">Estimates</h4>
								<p class="text-sm text-surface-500">{estimates.length} document{estimates.length !== 1 ? 's' : ''}</p>
							</Card>
							<Card variant="outlined" padding="md" class="text-center">
								<Receipt class="h-8 w-8 mx-auto text-success-500" />
								<h4 class="mt-2 font-medium">Invoices</h4>
								<p class="text-sm text-surface-500">{invoices.length} document{invoices.length !== 1 ? 's' : ''}</p>
							</Card>
							<Card variant="outlined" padding="md" class="text-center">
								<Paperclip class="h-8 w-8 mx-auto text-secondary-500" />
								<h4 class="mt-2 font-medium">Attachments</h4>
								<p class="text-sm text-surface-500">0 files</p>
							</Card>
							<Card variant="outlined" padding="md" class="text-center">
								<CheckCircle2 class="h-8 w-8 mx-auto text-tertiary-500" />
								<h4 class="mt-2 font-medium">Permits</h4>
								<p class="text-sm text-surface-500">0 files</p>
							</Card>
						</div>

						<!-- Estimates List -->
						{#if estimates.length > 0}
							<Card variant="outlined" padding="md">
								<h3 class="font-medium mb-3">Estimates</h3>
								<div class="space-y-2">
									{#each estimates as estimate}
										<a
											href="/app/contractor/jobs/{jobId}/estimate/{estimate.id}"
											class="flex items-center justify-between p-3 rounded-lg hover:bg-surface-200-800 transition-colors"
										>
											<div class="flex items-center gap-3">
												<FileText class="h-5 w-5 text-surface-400" />
												<div>
													<div class="font-medium">{estimate.estimateNumber}</div>
													<div class="text-xs text-surface-500">
														{formatShortDate(estimate.createdAt)} · {estimate.status}
													</div>
												</div>
											</div>
											<span class="font-medium">${Number(estimate.totalAmount).toLocaleString()}</span>
										</a>
									{/each}
								</div>
							</Card>
						{/if}

						<!-- Invoices List -->
						{#if invoices.length > 0}
							<Card variant="outlined" padding="md">
								<h3 class="font-medium mb-3">Invoices</h3>
								<div class="space-y-2">
									{#each invoices as invoice}
										<a
											href="/app/contractor/jobs/{jobId}/invoice/{invoice.id}"
											class="flex items-center justify-between p-3 rounded-lg hover:bg-surface-200-800 transition-colors"
										>
											<div class="flex items-center gap-3">
												<Receipt class="h-5 w-5 text-surface-400" />
												<div>
													<div class="font-medium">{invoice.invoiceNumber}</div>
													<div class="text-xs text-surface-500">
														{formatShortDate(invoice.createdAt)} · {invoice.status}
													</div>
												</div>
											</div>
											<span class="font-medium">${Number(invoice.totalAmount).toLocaleString()}</span>
										</a>
									{/each}
								</div>
							</Card>
						{/if}

						<!-- Upload Section -->
						<Card variant="outlined" padding="md">
							<h3 class="font-medium mb-3">Upload Documents</h3>
							<p class="text-sm text-surface-400 mb-4">
								Upload permits, photos, contracts, or other job-related documents.
							</p>
							<div class="border-2 border-dashed border-surface-300-700 rounded-lg p-8 text-center">
								<Paperclip class="h-8 w-8 mx-auto text-surface-400" />
								<p class="mt-2 text-sm text-surface-500">
									Drag and drop files here, or click to browse
								</p>
								<p class="mt-1 text-xs text-surface-400">
									PDF, images, and documents up to 10MB
								</p>
								<button class="btn btn-sm preset-outlined-primary-500 mt-4">
									Browse Files
								</button>
							</div>
						</Card>
					</div>

				{:else if activeTab === 'history'}
					<div class="space-y-6">
						<Card variant="outlined" padding="md">
							<h3 class="font-medium mb-4">Status History</h3>
							{#if statusHistory.length === 0}
								<p class="text-sm text-surface-400">No status changes recorded.</p>
							{:else}
								<div class="space-y-4">
									{#each statusHistory as item}
										<div class="flex gap-4 border-l-2 border-surface-300-700 pl-4">
											<div class="flex-1">
												<div class="flex items-center gap-2 flex-wrap">
													{#if item.fromStatus}
														<span class="badge {getStatusColor(item.fromStatus)} text-xs">
															{getStatusLabel(item.fromStatus)}
														</span>
														<span class="text-surface-400">→</span>
													{/if}
													<span class="badge {getStatusColor(item.toStatus)} text-xs">
														{getStatusLabel(item.toStatus)}
													</span>
													{#if item.changedBy}
														<span class="text-xs text-surface-400 ml-2">
															by <span class="font-medium">{item.changedBy === 'SYSTEM' ? 'System' : 'User'}</span>
														</span>
													{/if}
												</div>
												{#if item.notes}
													<p class="mt-1 text-sm text-surface-500">{item.notes}</p>
												{/if}
												<p class="mt-1 text-xs text-surface-400">{formatDate(item.changedAt)}</p>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</Card>

						<!-- Job Timeline -->
						<Card variant="outlined" padding="md">
							<h3 class="font-medium mb-4">Job Timeline</h3>
							<div class="space-y-3 text-sm">
								<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
									<span class="text-surface-500">Created</span>
									<span class="font-medium">{formatDate(job.createdAt)}</span>
								</div>
								{#if job.assignedAt}
									<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
										<span class="text-surface-500">Technician Assigned</span>
										<span class="font-medium">{formatDate(job.assignedAt)}</span>
									</div>
								{/if}
								{#if job.scheduledStart}
									<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
										<span class="text-surface-500">Scheduled</span>
										<span class="font-medium">{formatDate(job.scheduledStart)}</span>
									</div>
								{/if}
								{#if job.dispatchedAt}
									<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
										<span class="text-surface-500">Dispatched</span>
										<span class="font-medium">{formatDate(job.dispatchedAt)}</span>
									</div>
								{/if}
								{#if job.startedAt}
									<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
										<span class="text-surface-500">Work Started</span>
										<span class="font-medium">{formatDate(job.startedAt)}</span>
									</div>
								{/if}
								{#if job.completedAt}
									<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
										<span class="text-surface-500">Completed</span>
										<span class="font-medium">{formatDate(job.completedAt)}</span>
									</div>
								{/if}
								{#if job.invoicedAt}
									<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
										<span class="text-surface-500">Invoiced</span>
										<span class="font-medium">{formatDate(job.invoicedAt)}</span>
									</div>
								{/if}
								{#if job.paidAt}
									<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
										<span class="text-surface-500">Paid</span>
										<span class="font-medium">{formatDate(job.paidAt)}</span>
									</div>
								{/if}
								{#if job.closedAt}
									<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
										<span class="text-surface-500">Closed</span>
										<span class="font-medium">{formatDate(job.closedAt)}</span>
									</div>
								{/if}
								{#if job.cancelledAt}
									<div class="flex items-center justify-between py-2 border-b border-surface-200-800 text-error-500">
										<span>Cancelled</span>
										<span class="font-medium">{formatDate(job.cancelledAt)}</span>
									</div>
								{/if}
							</div>
						</Card>

						<!-- Linked References -->
						{#if job.workOrderId || job.violationId || job.arcRequestId}
							<Card variant="outlined" padding="md">
								<h3 class="font-medium mb-4">Linked References</h3>
								<div class="space-y-2 text-sm">
									{#if job.workOrderId}
										<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
											<span class="text-surface-500">Work Order</span>
											<a href="/app/cam/work-orders/{job.workOrderId}" class="text-primary-500 hover:underline">
												View Work Order →
											</a>
										</div>
									{/if}
									{#if job.violationId}
										<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
											<span class="text-surface-500">Violation</span>
											<a href="/app/cam/violations/{job.violationId}" class="text-primary-500 hover:underline">
												View Violation →
											</a>
										</div>
									{/if}
									{#if job.arcRequestId}
										<div class="flex items-center justify-between py-2 border-b border-surface-200-800">
											<span class="text-surface-500">ARC Request</span>
											<a href="/app/cam/arc/{job.arcRequestId}" class="text-primary-500 hover:underline">
												View ARC Request →
											</a>
										</div>
									{/if}
								</div>
							</Card>
						{/if}

						<!-- Full Audit Trail -->
						<Card variant="outlined" padding="md">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="font-medium">Full Audit Trail</h3>
									<p class="text-sm text-surface-400 mt-1">View complete activity log and system events</p>
								</div>
								<a 
									href="/app/contractor/jobs/{jobId}/audit" 
									class="btn btn-sm preset-outlined-primary-500"
								>
									<History class="mr-2 h-4 w-4" />
									View Audit Log
								</a>
							</div>
						</Card>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</PageContainer>

<style>
	.dropdown {
		position: relative;
		display: inline-block;
	}
	.dropdown-content {
		display: none;
		position: absolute;
		right: 0;
		z-index: 10;
	}
	.dropdown:hover .dropdown-content,
	.dropdown:focus-within .dropdown-content {
		display: block;
	}
</style>
