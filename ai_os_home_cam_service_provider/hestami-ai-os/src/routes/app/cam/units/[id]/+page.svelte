<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Home, FileText, Clock, AlertTriangle, ClipboardCheck, Wrench } from 'lucide-svelte';
	import { TabbedContent } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { unitApi, documentApi, activityEventApi, violationApi, arcRequestApi, workOrderApi, type Unit, type Document } from '$lib/api/cam';

	interface UnitHistoryEvent {
		id: string;
		action: string;
		description: string;
		performedBy: string;
		createdAt: string;
	}

	interface RelatedCount {
		violations: number;
		arcRequests: number;
		workOrders: number;
	}

	let unit = $state<Unit | null>(null);
	let documents = $state<Document[]>([]);
	let history = $state<UnitHistoryEvent[]>([]);
	let relatedCounts = $state<RelatedCount>({ violations: 0, arcRequests: 0, workOrders: 0 });
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	const unitId = $derived(($page.params as Record<string, string>).id);

	async function loadUnit() {
		if (!unitId) return;

		isLoading = true;
		error = null;

		try {
			const response = await unitApi.get(unitId);
			if (!response.ok) {
				error = 'Unit not found';
				return;
			}
			unit = response.data.unit as unknown as Unit;
		} catch (e) {
			error = 'Failed to load unit';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function loadDocuments() {
		if (!unitId) return;
		try {
			const response = await documentApi.list({ contextType: 'UNIT', contextId: unitId });
			if (response.ok) {
				documents = response.data.documents as any;
			}
		} catch (e) {
			console.error('Failed to load documents:', e);
		}
	}

	async function loadHistory() {
		if (!unitId) return;
		try {
			const response = await activityEventApi.getByEntity({ entityType: 'UNIT', entityId: unitId });
			if (response.ok) {
				history = response.data.events.map((e: any) => ({
					id: e.id,
					action: e.action,
					description: e.summary,
					performedBy: e.performedBy,
					createdAt: e.createdAt
				}));
			}
		} catch (e) {
			console.error('Failed to load history:', e);
		}
	}

	async function loadRelatedCounts() {
		if (!unitId) return;
		try {
			const [violationsRes, arcRes, workOrdersRes] = await Promise.all([
				violationApi.list({ unitId } as any),
				arcRequestApi.list({ unitId } as any),
				workOrderApi.list({ unitId } as any)
			]);

			if (violationsRes.ok) {
				relatedCounts.violations = violationsRes.data?.violations?.length || 0;
			}
			if (arcRes.ok) {
				relatedCounts.arcRequests = arcRes.data?.requests?.length || 0;
			}
			if (workOrdersRes.ok) {
				relatedCounts.workOrders = workOrdersRes.data?.workOrders?.length || 0;
			}
		} catch (e) {
			console.error('Failed to load related counts:', e);
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
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

	$effect(() => {
		if (unitId) {
			loadUnit();
			loadDocuments();
			loadHistory();
			loadRelatedCounts();
		}
	});
</script>

<svelte:head>
	<title>Unit {unit?.unitNumber || ''} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/units')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>

			{#if isLoading}
				<div class="h-6 w-48 animate-pulse rounded bg-surface-200-800"></div>
			{:else if unit}
				<div class="flex-1">
					<h1 class="text-xl font-semibold">Unit {unit.unitNumber}</h1>
					<p class="mt-0.5 text-sm text-surface-500">
						{unit.unitType.replace(/_/g, ' ')} · {unit.propertyName}
					</p>
				</div>

				<div class="flex gap-2">
					<a href="/app/cam/units/{unit.id}/edit" class="btn btn-sm preset-tonal-surface">
						Edit
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
		{:else if unit}
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
	{#if unit}
		<div class="space-y-6">
			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Unit Details</h3>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Unit Number</h4>
						<p class="mt-1">{unit.unitNumber}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Type</h4>
						<p class="mt-1">{unit.unitType.replace(/_/g, ' ')}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Status</h4>
						<p class="mt-1">{(unit as any).status || 'Active'}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Property</h4>
						<p class="mt-1">{unit.propertyName}</p>
					</div>
					{#if (unit as any).address}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Address</h4>
							<p class="mt-1">{(unit as any).address}</p>
						</div>
					{/if}
					{#if (unit as any).squareFootage}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Square Footage</h4>
							<p class="mt-1">{(unit as any).squareFootage?.toLocaleString()} sq ft</p>
						</div>
					{/if}
					{#if (unit as any).bedrooms !== undefined}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Bedrooms</h4>
							<p class="mt-1">{(unit as any).bedrooms}</p>
						</div>
					{/if}
					{#if (unit as any).bathrooms !== undefined}
						<div>
							<h4 class="text-sm font-medium text-surface-500">Bathrooms</h4>
							<p class="mt-1">{(unit as any).bathrooms}</p>
						</div>
					{/if}
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Ownership & Occupancy</h3>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<h4 class="text-sm font-medium text-surface-500">Owner</h4>
						<p class="mt-1">{(unit as any).ownerName || 'Not assigned'}</p>
					</div>
					<div>
						<h4 class="text-sm font-medium text-surface-500">Tenant</h4>
						<p class="mt-1">{(unit as any).tenantName || 'Owner occupied / Vacant'}</p>
					</div>
				</div>
			</Card>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Related Records</h3>
				<div class="grid gap-4 sm:grid-cols-3">
					<a
						href="/app/cam/violations?unitId={unit.id}"
						class="flex items-center gap-3 rounded-lg border border-surface-300-700 p-4 transition-colors hover:bg-surface-200-800"
					>
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-error-500/10">
							<AlertTriangle class="h-5 w-5 text-error-500" />
						</div>
						<div>
							<p class="text-2xl font-bold">{relatedCounts.violations}</p>
							<p class="text-sm text-surface-500">Violations</p>
						</div>
					</a>
					<a
						href="/app/cam/arc?unitId={unit.id}"
						class="flex items-center gap-3 rounded-lg border border-surface-300-700 p-4 transition-colors hover:bg-surface-200-800"
					>
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/10">
							<ClipboardCheck class="h-5 w-5 text-primary-500" />
						</div>
						<div>
							<p class="text-2xl font-bold">{relatedCounts.arcRequests}</p>
							<p class="text-sm text-surface-500">ARC Requests</p>
						</div>
					</a>
					<a
						href="/app/cam/work-orders?unitId={unit.id}"
						class="flex items-center gap-3 rounded-lg border border-surface-300-700 p-4 transition-colors hover:bg-surface-200-800"
					>
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10">
							<Wrench class="h-5 w-5 text-warning-500" />
						</div>
						<div>
							<p class="text-2xl font-bold">{relatedCounts.workOrders}</p>
							<p class="text-sm text-surface-500">Work Orders</p>
						</div>
					</a>
				</div>
			</Card>
		</div>
	{/if}
{/snippet}

{#snippet documentsTab()}
	<Card variant="outlined" padding="lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-semibold">Documents</h3>
			<a href="/app/cam/documents/upload?contextType=UNIT&contextId={unitId}" class="btn btn-sm preset-filled-primary-500">
				Upload
			</a>
		</div>

		{#if documents.length === 0}
			<EmptyState
				title="No documents"
				description="Unit-specific documents will appear here."
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
				description="Ownership changes and activity will appear here."
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
							<p class="text-sm text-surface-500">{event.description}</p>
							<p class="mt-1 text-xs text-surface-400">
								{event.performedBy} · {formatDateTime(event.createdAt)}
							</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
{/snippet}
