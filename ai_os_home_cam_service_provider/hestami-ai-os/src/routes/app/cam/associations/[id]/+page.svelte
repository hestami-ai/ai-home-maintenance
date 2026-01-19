<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Building2, FileText, Clock, Settings } from 'lucide-svelte';
	import { TabbedContent } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
    import { enhance } from '$app/forms';

	interface Association {
		id: string;
		name: string;
		legalName?: string;
		status: string;
		fiscalYearEnd?: number;
		unitCount?: number;
		propertyCount?: number;
		address?: string;
		phone?: string;
		email?: string;
		website?: string;
		taxId?: string;
		incorporationDate?: string;
		createdAt?: string;
		updatedAt?: string;
	}

	interface AssociationDocument {
		id: string;
		title: string;
		category: string;
		createdAt: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
	}

	interface AssociationHistoryEvent {
		id: string;
		action: string;
		summary: string;
		performedByType: string;
		performedAt: string;
	}
    
    let { data } = $props();

    // Use $state with $effect to avoid proxy errors during navigation
	let association = $state<Association | null>(null);
	let documents = $state<AssociationDocument[]>([]);
	let history = $state<AssociationHistoryEvent[]>([]);

	$effect(() => {
		// Track data to trigger re-runs on navigation, but guard against undefined
		if (data != null && typeof data === 'object') {
			association = (data.association ?? null) as Association | null;
			documents = (data.documents ?? []) as AssociationDocument[];
			history = (data.history ?? []) as AssociationHistoryEvent[];
		}
	});

	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// No local load functions needed, data comes from SSR

	function formatDate(dateString: string): string {
        if (!dateString) return '—';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatDateTime(dateString: string): string {
        if (!dateString) return '—';
		return new Date(dateString).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>{association?.name || 'Association'} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/associations')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>

			{#if isLoading}
				<div class="h-6 w-48 animate-pulse rounded bg-surface-200-800"></div>
			{:else if association}
				<div class="flex-1">
					<h1 class="text-xl font-semibold">{association.name}</h1>
					{#if association.legalName && association.legalName !== association.name}
						<p class="mt-0.5 text-sm text-surface-500">{association.legalName}</p>
					{/if}
				</div>

				<div class="flex gap-2">
					<form action="/api/cam/switch" method="POST" use:enhance>
						<input type="hidden" name="associationId" value={association.id} />
						<button
							type="submit"
							class="btn btn-sm preset-filled-primary-500"
						>
							Switch to This
						</button>
					</form>
					<a href="/app/cam/associations/{association.id}/edit" class="btn btn-sm preset-tonal-surface">
						Edit
					</a>
					<a href="/app/cam/associations/{association.id}/settings" class="btn btn-sm preset-tonal-surface">
						<Settings class="mr-1 h-4 w-4" />
						Settings
					</a>
				</div>
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if isLoading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
			</div>
		{:else if error}
			<div class="flex h-64 items-center justify-center">
				<EmptyState title="Error" description={error} />
			</div>
		{:else if association}
			<TabbedContent
				tabs={[
					{ id: 'overview', label: 'Overview', content: overviewTab },
					{ id: 'documents', label: 'Documents', content: documentsTab },
					{ id: 'history', label: 'History', content: historyTab }
				]}
			/>
		{/if}
	</div>
</div>

{#snippet overviewTab()}
	{#if association}
		<div class="space-y-6">
			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Association Information</h3>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Name</h4>
						<p class="mt-1">{association.name}</p>
					</div>
					{#if association.legalName}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Legal Name</h4>
							<p class="mt-1">{association.legalName}</p>
						</div>
					{/if}
					<div>
						<h4 class="text-sm font-medium text-surface-500">Status</h4>
						<p class="mt-1">{association.status}</p>
					</div>
					{#if association.fiscalYearEnd}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Fiscal Year End</h4>
							<p class="mt-1">{association.fiscalYearEnd}</p>
						</div>
					{/if}
					{#if association.taxId}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Tax ID</h4>
							<p class="mt-1">{association.taxId}</p>
						</div>
					{/if}
					{#if association.incorporationDate}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Incorporated</h4>
							<p class="mt-1">{formatDate(association.incorporationDate)}</p>
						</div>
					{/if}
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Statistics</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Total Units</h4>
						<p class="mt-1 text-2xl font-bold">{association.unitCount ?? 0}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Properties</h4>
						<p class="mt-1 text-2xl font-bold">{association.propertyCount ?? 0}</p>
					</div>
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Contact Information</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					{#if association.address}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Address</h4>
							<p class="mt-1">{association.address}</p>
						</div>
					{/if}
					{#if association.phone}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Phone</h4>
							<p class="mt-1">
								<a href="tel:{association.phone}" class="text-primary-500 hover:underline">
									{association.phone}
								</a>
							</p>
						</div>
					{/if}
					{#if association.email}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Email</h4>
							<p class="mt-1">
								<a href="mailto:{association.email}" class="text-primary-500 hover:underline">
									{association.email}
								</a>
							</p>
						</div>
					{/if}
					{#if association.website}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Website</h4>
							<p class="mt-1">
								<a href={association.website} target="_blank" rel="noopener" class="text-primary-500 hover:underline">
									{association.website}
								</a>
							</p>
						</div>
					{/if}
				</div>
			</Card>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<Card variant="outlined" padding="lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-semibold">Governing Documents</h3>
			<a href="/app/cam/documents/upload?contextType=ASSOCIATION&contextId={association?.id}" class="btn btn-sm preset-filled-primary-500">
				Upload
			</a>
		</div>

		{#if documents.length === 0}
			<EmptyState
				title="No documents"
				description="CC&Rs, bylaws, and other governing documents will appear here."
			/>
		{:else}
			<div class="divide-y divide-surface-300-700">
				{#each documents as doc}
					<div class="flex items-center gap-3 py-3">
						<FileText class="h-5 w-5 text-surface-400" />
						<div class="flex-1">
							<p class="font-medium">{doc.title}</p>
							<p class="text-sm text-surface-500">{doc.category} · {formatDate(doc.createdAt)}</p>
						</div>
						<a href="/api/document/{doc.id}/download" class="btn btn-sm preset-tonal-surface">
							Download
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}

{#snippet historyTab()}
	<Card variant="outlined" padding="lg">
		<h3 class="mb-4 font-semibold">Activity History</h3>

		{#if history.length === 0}
			<EmptyState
				title="No history"
				description="Association changes and activity will appear here."
			/>
		{:else}
			<div class="space-y-4">
				{#each history as event}
					<div class="flex gap-3">
						<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-200-800">
							<Clock class="h-4 w-4 text-surface-500" />
						</div>
						<div class="flex-1">
							<p class="font-medium">{event.action}</p>
							<p class="text-sm text-surface-500">{event.summary}</p>
							<p class="mt-1 text-xs text-surface-400">
								{event.performedByType} · {formatDateTime(event.performedAt)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}
