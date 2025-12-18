<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, User, Calendar, Paperclip, CheckCircle, MessageSquare, FileText } from 'lucide-svelte';
	import { Card, EmptyState } from '$lib/components/ui';
	import { currentAssociation, refreshBadgeCounts } from '$lib/stores';

	interface OwnerResponse {
		id: string;
		submittedDate: string;
		content: string;
		submittedBy: string;
		submittedByEmail?: string;
		submittedByPhone?: string;
		hasAttachments: boolean;
		acknowledged: boolean;
		acknowledgedBy?: string;
		acknowledgedAt?: string;
		attachments?: Array<{
			id: string;
			name: string;
			type: string;
			size: number;
			url: string;
		}>;
	}

	interface Violation {
		id: string;
		violationNumber: string;
		title: string;
		status: string;
	}

	let response = $state<OwnerResponse | null>(null);
	let violation = $state<Violation | null>(null);
	let isLoading = $state(true);
	let isAcknowledging = $state(false);
	let error = $state<string | null>(null);

	const violationId = $derived(($page.params as Record<string, string>).id);
	const responseId = $derived(($page.params as Record<string, string>).responseId);

	async function loadData() {
		if (!violationId || !responseId) return;

		isLoading = true;
		error = null;

		try {
			const [violationRes, responseRes] = await Promise.all([
				fetch(`/api/violation/${violationId}`),
				fetch(`/api/violation/${violationId}/response/${responseId}`)
			]);

			if (violationRes.ok) {
				const data = await violationRes.json();
				if (data.ok && data.data) {
					violation = data.data;
				}
			}

			if (responseRes.ok) {
				const data = await responseRes.json();
				if (data.ok && data.data) {
					response = data.data;
				} else {
					error = 'Response not found';
				}
			} else {
				error = 'Failed to load response';
			}
		} catch (e) {
			error = 'Failed to load data';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function acknowledgeResponse() {
		if (!response || !violationId) return;

		isAcknowledging = true;
		try {
			const res = await fetch(`/api/violation/${violationId}/response/${response.id}/acknowledge`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (res.ok) {
				await loadData();
				await refreshBadgeCounts();
			}
		} catch (e) {
			console.error('Failed to acknowledge response:', e);
		} finally {
			isAcknowledging = false;
		}
	}

	function formatDateTime(dateString: string): string {
		return new Date(dateString).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	$effect(() => {
		if (violationId && responseId) {
			loadData();
		}
	});
</script>

<svelte:head>
	<title>Owner Response | {violation?.violationNumber || 'Violation'} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto(`/app/cam/violations/${violationId}`)}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div class="flex-1">
				<div class="flex items-center gap-2">
					<span class="text-sm text-surface-500">{violation?.violationNumber || ''}</span>
					{#if response?.acknowledged}
						<span class="rounded-full bg-success-500/10 px-2 py-0.5 text-xs font-medium text-success-500">
							Acknowledged
						</span>
					{:else}
						<span class="rounded-full bg-warning-500/10 px-2 py-0.5 text-xs font-medium text-warning-500">
							Pending Review
						</span>
					{/if}
				</div>
				<h1 class="text-xl font-semibold">Owner Response</h1>
			</div>
			{#if response && !response.acknowledged}
				<button
					type="button"
					onclick={acknowledgeResponse}
					disabled={isAcknowledging}
					class="btn preset-filled-primary-500"
				>
					{#if isAcknowledging}
						<span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
					{:else}
						<CheckCircle class="mr-2 h-4 w-4" />
					{/if}
					Acknowledge
				</button>
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
			</div>
		{:else if error}
			<EmptyState title="Error" description={error} />
		{:else if response}
			<div class="mx-auto max-w-3xl space-y-6">
				<Card variant="outlined" padding="lg">
					<div class="mb-4 flex items-start justify-between">
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/10">
								<User class="h-5 w-5 text-primary-500" />
							</div>
							<div>
								<p class="font-semibold">{response.submittedBy}</p>
								{#if response.submittedByEmail}
									<p class="text-sm text-surface-500">{response.submittedByEmail}</p>
								{/if}
							</div>
						</div>
						<div class="flex items-center gap-2 text-sm text-surface-500">
							<Calendar class="h-4 w-4" />
							{formatDateTime(response.submittedDate)}
						</div>
					</div>

					<div class="rounded-lg bg-surface-100-900 p-4">
						<p class="whitespace-pre-wrap">{response.content}</p>
					</div>
				</Card>

				{#if response.attachments && response.attachments.length > 0}
					<Card variant="outlined" padding="lg">
						<h3 class="mb-4 flex items-center gap-2 font-semibold">
							<Paperclip class="h-5 w-5 text-primary-500" />
							Attachments ({response.attachments.length})
						</h3>
						<div class="grid gap-3 sm:grid-cols-2">
							{#each response.attachments as attachment}
								<a
									href={attachment.url}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center gap-3 rounded-lg border border-surface-300-700 p-3 transition-colors hover:bg-surface-200-800"
								>
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-200-800">
										<FileText class="h-5 w-5 text-surface-500" />
									</div>
									<div class="min-w-0 flex-1">
										<p class="truncate font-medium">{attachment.name}</p>
										<p class="text-xs text-surface-500">
											{attachment.type} · {formatFileSize(attachment.size)}
										</p>
									</div>
								</a>
							{/each}
						</div>
					</Card>
				{/if}

				{#if response.acknowledged}
					<Card variant="outlined" padding="lg">
						<div class="flex items-center gap-3 text-success-500">
							<CheckCircle class="h-6 w-6" />
							<div>
								<p class="font-semibold">Response Acknowledged</p>
								<p class="text-sm text-surface-500">
									By {response.acknowledgedBy} on {response.acknowledgedAt ? formatDateTime(response.acknowledgedAt) : 'N/A'}
								</p>
							</div>
						</div>
					</Card>
				{/if}

				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 flex items-center gap-2 font-semibold">
						<MessageSquare class="h-5 w-5 text-primary-500" />
						Manager Actions
					</h3>
					<div class="flex flex-wrap gap-3">
						{#if !response.acknowledged}
							<button
								type="button"
								onclick={acknowledgeResponse}
								disabled={isAcknowledging}
								class="btn preset-filled-primary-500"
							>
								<CheckCircle class="mr-2 h-4 w-4" />
								Acknowledge Response
							</button>
						{/if}
						<a
							href="/app/cam/violations/{violationId}"
							class="btn preset-tonal-surface"
						>
							Back to Violation
						</a>
					</div>
					<p class="mt-3 text-xs text-surface-500">
						Note: Acknowledging a response does not change the violation status. 
						State transitions require explicit manager action.
					</p>
				</Card>
			</div>
		{/if}
	</div>
</div>
