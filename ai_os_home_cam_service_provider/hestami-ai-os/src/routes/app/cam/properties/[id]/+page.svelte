<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Building2, FileText, Clock, Home, MapPin, Pencil } from 'lucide-svelte';
	import { TabbedContent } from '$lib/components/cam';
	import { Card, EmptyState } from '$lib/components/ui';
	import { propertyApi, documentApi, activityEventApi } from '$lib/api/cam';

	interface Property {
		id: string;
		name: string;
		address: string;
		propertyType: string;
		status: string;
		unitCount: number;
		commonAreaCount: number;
		yearBuilt?: number;
		totalSquareFootage?: number;
		parkingSpaces?: number;
		amenities?: string[];
		managerId?: string;
		managerName?: string;
		createdAt: string;
		updatedAt: string;
	}

	interface PropertyDocument {
		id: string;
		name: string;
		category: string;
		createdAt: string;
	}

	interface PropertyHistoryEvent {
		id: string;
		action: string;
		description: string;
		performedBy: string;
		createdAt: string;
	}

	interface CommonArea {
		id: string;
		name: string;
		areaType: string;
		status: string;
	}

	let property = $state<Property | null>(null);
	let documents = $state<PropertyDocument[]>([]);
	let history = $state<PropertyHistoryEvent[]>([]);
	let commonAreas = $state<CommonArea[]>([]);
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	const propertyId = $derived(($page.params as Record<string, string>).id);

	async function loadProperty() {
		if (!propertyId) return;

		isLoading = true;
		error = null;

		try {
			const response = await propertyApi.get(propertyId);
			if (response.ok && response.data?.property) {
				property = response.data.property as Property;
			} else {
				error = 'Property not found';
			}
		} catch (e) {
			error = 'Failed to load property';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function loadDocuments() {
		if (!propertyId) return;

		try {
			const response = await documentApi.list({ contextType: 'PROPERTY', contextId: propertyId });
			if (response.ok && response.data?.documents) {
				documents = response.data.documents;
			}
		} catch (e) {
			console.error('Failed to load documents:', e);
		}
	}

	async function loadHistory() {
		if (!propertyId) return;

		try {
			const response = await activityEventApi.list({ entityType: 'PROPERTY', entityId: propertyId });
			if (response.ok && response.data?.events) {
				history = response.data.events.map(e => ({
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

	async function loadCommonAreas() {
		if (!propertyId) return;

		try {
			const response = await fetch(`/api/common-area?propertyId=${propertyId}`);
			if (response.ok) {
				const data = await response.json();
				if (data.ok && data.data?.items) {
					commonAreas = data.data.items;
				}
			}
		} catch (e) {
			console.error('Failed to load common areas:', e);
		}
	}

	function getPropertyTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			'SINGLE_FAMILY': 'Single Family',
			'TOWNHOME': 'Townhome',
			'CONDO': 'Condominium',
			'APARTMENT': 'Apartment',
			'COMMERCIAL': 'Commercial',
			'MIXED_USE': 'Mixed Use'
		};
		return labels[type] || type.replace(/_/g, ' ');
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
		if (propertyId) {
			loadProperty();
			loadDocuments();
			loadHistory();
			loadCommonAreas();
		}
	});
</script>

<svelte:head>
	<title>{property?.name || 'Property'} | CAM | Hestami AI</title>
</svelte:head>

<div class="flex h-full flex-col">
	<div class="border-b border-surface-300-700 bg-surface-50-950 px-6 py-4">
		<div class="flex items-center gap-4">
			<button
				type="button"
				onclick={() => goto('/app/cam/properties')}
				class="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-200-800"
			>
				<ArrowLeft class="h-5 w-5" />
			</button>

			{#if isLoading}
				<div class="h-6 w-48 animate-pulse rounded bg-surface-200-800"></div>
			{:else if property}
				<div class="flex-1">
					<h1 class="text-xl font-semibold">{property.name}</h1>
					<p class="mt-0.5 text-sm text-surface-500">
						{getPropertyTypeLabel(property.propertyType)} · {property.unitCount} units
					</p>
				</div>

				<div class="flex gap-2">
					<a
						href="/app/cam/properties/{property.id}/edit"
						class="btn btn-sm preset-tonal-surface"
					>
						<Pencil class="mr-1 h-4 w-4" />
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
		{:else if property}
			{@const overviewTab = overviewContent}
			{@const unitsTab = unitsContent}
			{@const commonAreasTab = commonAreasContent}
			{@const documentsTab = documentsContent}
			{@const historyTab = historyContent}
			<TabbedContent
				tabs={[
					{ id: 'overview', label: 'Overview', content: overviewTab },
					{ id: 'units', label: 'Units', content: unitsTab },
					{ id: 'common-areas', label: 'Common Areas', content: commonAreasTab },
					{ id: 'documents', label: 'Documents', content: documentsTab },
					{ id: 'history', label: 'History', content: historyTab }
				]}
			/>
		{/if}
	</div>
</div>

{#snippet overviewContent()}
	{#if property}
		<div class="space-y-6">
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Card variant="outlined" padding="md">
					<p class="text-sm text-surface-500">Units</p>
					<p class="mt-1 text-2xl font-semibold">{property.unitCount}</p>
				</Card>

				<Card variant="outlined" padding="md">
					<p class="text-sm text-surface-500">Common Areas</p>
					<p class="mt-1 text-2xl font-semibold">{property.commonAreaCount}</p>
				</Card>

				<Card variant="outlined" padding="md">
					<p class="text-sm text-surface-500">Property Type</p>
					<p class="mt-1 font-medium">{getPropertyTypeLabel(property.propertyType)}</p>
				</Card>

				<Card variant="outlined" padding="md">
					<p class="text-sm text-surface-500">Status</p>
					<p class="mt-1 font-medium">{property.status}</p>
				</Card>
			</div>

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Property Details</h3>
				<dl class="grid gap-4 sm:grid-cols-2">
					<div>
						<dt class="text-sm text-surface-500">Address</dt>
						<dd class="mt-1 flex items-center gap-2">
							<MapPin class="h-4 w-4 text-surface-400" />
							{property.address}
						</dd>
					</div>

					{#if property.yearBuilt}
						<div>
							<dt class="text-sm text-surface-500">Year Built</dt>
							<dd class="mt-1">{property.yearBuilt}</dd>
						</div>
					{/if}

					{#if property.totalSquareFootage}
						<div>
							<dt class="text-sm text-surface-500">Total Square Footage</dt>
							<dd class="mt-1">{property.totalSquareFootage.toLocaleString()} sq ft</dd>
						</div>
					{/if}

					{#if property.parkingSpaces}
						<div>
							<dt class="text-sm text-surface-500">Parking Spaces</dt>
							<dd class="mt-1">{property.parkingSpaces}</dd>
						</div>
					{/if}

					{#if property.managerName}
						<div>
							<dt class="text-sm text-surface-500">Property Manager</dt>
							<dd class="mt-1">{property.managerName}</dd>
						</div>
					{/if}

					<div>
						<dt class="text-sm text-surface-500">Created</dt>
						<dd class="mt-1">{formatDate(property.createdAt)}</dd>
					</div>
				</dl>
			</Card>

			{#if property.amenities && property.amenities.length > 0}
				<Card variant="outlined" padding="lg">
					<h3 class="mb-4 font-semibold">Amenities</h3>
					<div class="flex flex-wrap gap-2">
						{#each property.amenities as amenity}
							<span class="rounded-full bg-primary-500/10 px-3 py-1 text-sm text-primary-500">
								{amenity}
							</span>
						{/each}
					</div>
				</Card>
			{/if}

			<Card variant="outlined" padding="lg">
				<h3 class="mb-4 font-semibold">Quick Actions</h3>
				<div class="flex flex-wrap gap-2">
					<a href="/app/cam/units?propertyId={property.id}" class="btn btn-sm preset-tonal-surface">
						<Home class="mr-1 h-4 w-4" />
						View Units
					</a>
					<a href="/app/cam/work-orders/new?propertyId={property.id}" class="btn btn-sm preset-tonal-surface">
						Create Work Order
					</a>
					<a href="/app/cam/documents/upload?contextType=PROPERTY&contextId={property.id}" class="btn btn-sm preset-tonal-surface">
						<FileText class="mr-1 h-4 w-4" />
						Upload Document
					</a>
				</div>
			</Card>
		</div>
	{/if}
{/snippet}

{#snippet unitsContent()}
	{#if property}
		<Card variant="outlined" padding="lg">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="font-semibold">Units ({property.unitCount})</h3>
				<a href="/app/cam/units?propertyId={property.id}" class="text-sm text-primary-500 hover:underline">
					View All
				</a>
			</div>
			<p class="text-sm text-surface-500">
				This property has {property.unitCount} units. Click "View All" to see the full list and manage units.
			</p>
			<div class="mt-4">
				<a href="/app/cam/units/new?propertyId={property.id}" class="btn btn-sm preset-filled-primary-500">
					Add Unit
				</a>
			</div>
		</Card>
	{/if}
{/snippet}

{#snippet commonAreasContent()}
	<Card variant="outlined" padding="lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-semibold">Common Areas ({commonAreas.length})</h3>
		</div>
		{#if commonAreas.length > 0}
			<div class="space-y-2">
				{#each commonAreas as area}
					<div class="flex items-center justify-between rounded-lg border border-surface-200-800 p-3">
						<div>
							<p class="font-medium">{area.name}</p>
							<p class="text-sm text-surface-500">{area.areaType.replace(/_/g, ' ')}</p>
						</div>
						<span class="rounded-full px-2 py-0.5 text-xs {area.status === 'ACTIVE' ? 'bg-success-500/10 text-success-500' : 'bg-surface-500/10 text-surface-500'}">
							{area.status}
						</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-surface-500">No common areas defined for this property.</p>
		{/if}
	</Card>
{/snippet}

{#snippet documentsContent()}
	<Card variant="outlined" padding="lg">
		<div class="mb-4 flex items-center justify-between">
			<h3 class="font-semibold">Documents ({documents.length})</h3>
			{#if property}
				<a href="/app/cam/documents/upload?contextType=PROPERTY&contextId={property.id}" class="btn btn-sm preset-filled-primary-500">
					Upload
				</a>
			{/if}
		</div>
		{#if documents.length > 0}
			<div class="space-y-2">
				{#each documents as doc}
					<a
						href="/app/cam/documents/{doc.id}"
						class="flex items-center justify-between rounded-lg border border-surface-200-800 p-3 transition-colors hover:bg-surface-100-900"
					>
						<div class="flex items-center gap-3">
							<FileText class="h-5 w-5 text-surface-400" />
							<div>
								<p class="font-medium">{doc.name}</p>
								<p class="text-sm text-surface-500">{doc.category}</p>
							</div>
						</div>
						<span class="text-sm text-surface-500">{formatDate(doc.createdAt)}</span>
					</a>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-surface-500">No documents uploaded for this property.</p>
		{/if}
	</Card>
{/snippet}

{#snippet historyContent()}
	<Card variant="outlined" padding="lg">
		<h3 class="mb-4 font-semibold">Activity History</h3>
		{#if history.length > 0}
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
		{:else}
			<p class="text-sm text-surface-500">No activity recorded for this property.</p>
		{/if}
	</Card>
{/snippet}
