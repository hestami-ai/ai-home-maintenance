<script lang="ts">
	import {
		Home,
		ArrowLeft,
		Edit,
		Wrench,
		FileText,
		Image as ImageIcon,
		History,
		Settings,
		MapPin,
		Building2,
		Calendar,
		Ruler,
		Loader2,
		Plus,
		File,
		Upload,
		Download,
		X,
		Play
	} from 'lucide-svelte';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { orpc } from '$lib/api';
	import { page } from '$app/stores';
	import {
		getServiceCallStatusLabel,
		getServiceCallStatusColor
	} from '$lib/utils/serviceCallTerminology';

	// Derive propertyId from route params
	const propertyId = $derived($page.params.id);

	// Label mappings
	const propertyTypeLabels: Record<string, string> = {
		SINGLE_FAMILY: 'Single Family',
		CONDO: 'Condominium',
		TOWNHOUSE: 'Townhouse',
		MULTI_FAMILY: 'Multi-Family',
		APARTMENT: 'Apartment',
		COMMERCIAL: 'Commercial',
		LAND: 'Land',
		OTHER: 'Other'
	};

	const categoryLabels: Record<string, string> = {
		PROPERTY_DEED: 'Property Deed',
		INSURANCE: 'Insurance',
		WARRANTY: 'Warranty',
		INSPECTION: 'Inspection',
		RECEIPT: 'Receipt',
		CONTRACT: 'Contract',
		PHOTO: 'Photo',
		OTHER: 'Other'
	};

	interface ExternalHoa {
		id: string;
		hoaName: string;
		hoaContactName: string | null;
		hoaContactEmail: string | null;
		hoaContactPhone: string | null;
		hoaAddress: string | null;
		notes: string | null;
	}

	interface Property {
		id: string;
		name: string;
		propertyType: string;
		addressLine1: string;
		addressLine2: string | null;
		city: string;
		state: string;
		postalCode: string;
		country: string;
		yearBuilt: number | null;
		squareFeet: number | null;
		lotSquareFeet: number | null;
		bedrooms: number | null;
		bathrooms: number | null;
		isActive: boolean;
		linkedUnitId: string | null;
		createdAt: string;
		updatedAt: string;
		externalHoa: ExternalHoa | null;
		portfolios: { id: string; name: string }[];
		activeCaseCount: number;
	}

	interface Document {
		id: string;
		title: string;
		category: string;
		fileName: string;
		fileSize: number;
		mimeType: string;
		createdAt: string;
	}

	interface ServiceCall {
		id: string;
		caseNumber: string;
		title: string;
		status: string;
		priority: string;
		createdAt: string;
	}

	interface Props {
		data: {
			property: Property;
		};
	}

	let { data }: Props = $props();

	let property = $state<Property | null>(null);
	let documents = $state<Document[]>([]);
	let mediaItems = $state<Document[]>([]);
	let serviceCalls = $state<ServiceCall[]>([]);
	let isLoading = $state(false);
	let isLoadingDocs = $state(false);
	let isLoadingMedia = $state(false);
	let isLoadingHistory = $state(false);
	let error = $state<string | null>(null);
	let activeTab = $state<'overview' | 'documents' | 'media' | 'history' | 'systems'>('overview');
	let selectedImage = $state<Document | null>(null);

	// Synchronize server data to local state
	$effect(() => {
		if (data.property) {
			property = data.property;
		}
	});

	async function loadProperty() {
		// Just refresh the data
		window.location.reload();
	}

	async function loadDocuments() {
		if (documents.length > 0) return; // Already loaded
		isLoadingDocs = true;
		try {
			const result = await orpc.document.listDocuments({
				contextType: 'PROPERTY',
				contextId: propertyId,
				limit: 100
			});
			// Filter out media (images/videos)
			documents = result.data.documents.filter(
				(d) => !d.mimeType.startsWith('image/') && !d.mimeType.startsWith('video/')
			);
		} catch (err) {
			console.error('Failed to load documents:', err);
		} finally {
			isLoadingDocs = false;
		}
	}

	async function loadMedia() {
		if (mediaItems.length > 0) return; // Already loaded
		isLoadingMedia = true;
		try {
			const result = await orpc.document.listDocuments({
				contextType: 'PROPERTY',
				contextId: propertyId,
				limit: 100
			});
			// Filter to only media (images/videos)
			mediaItems = result.data.documents.filter(
				(d) => d.mimeType.startsWith('image/') || d.mimeType.startsWith('video/')
			);
		} catch (err) {
			console.error('Failed to load media:', err);
		} finally {
			isLoadingMedia = false;
		}
	}

	async function loadServiceHistory() {
		if (serviceCalls.length > 0) return; // Already loaded
		isLoadingHistory = true;
		try {
			const result = await orpc.conciergeCase.list({
				propertyId: propertyId,
				limit: 50
			});
			serviceCalls = result.data.cases.map((c) => ({
				id: c.id,
				caseNumber: c.caseNumber,
				title: c.title,
				status: c.status,
				priority: c.priority,
				createdAt: c.createdAt
			}));
		} catch (err) {
			console.error('Failed to load service history:', err);
		} finally {
			isLoadingHistory = false;
		}
	}

	function handleTabChange(tabId: typeof activeTab) {
		activeTab = tabId;
		if (tabId === 'documents') loadDocuments();
		if (tabId === 'media') loadMedia();
		if (tabId === 'history') loadServiceHistory();
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: Home },
		{ id: 'documents', label: 'Documents', icon: FileText },
		{ id: 'media', label: 'Media', icon: ImageIcon },
		{ id: 'history', label: 'Service History', icon: History },
		{ id: 'systems', label: 'Systems', icon: Settings }
	] as const;
</script>

<svelte:head>
	<title>{property?.name || 'Property'} | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-8">
		{#if isLoading}
			<div class="flex items-center justify-center py-12">
				<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
			</div>
		{:else if error}
			<Card variant="outlined" padding="md">
				<div class="text-center">
					<p class="text-error-500">{error}</p>
					<div class="mt-4 flex justify-center gap-2">
						<a href="/app/concierge/properties" class="btn preset-tonal-surface">
							<ArrowLeft class="mr-2 h-4 w-4" />
							Back to Properties
						</a>
						<button onclick={loadProperty} class="btn preset-tonal-primary">
							Try Again
						</button>
					</div>
				</div>
			</Card>
		{:else if property}
			<!-- Header -->
			<div class="mb-6">
				<a
					href="/app/concierge/properties"
					class="mb-4 inline-flex items-center text-sm text-surface-500 hover:text-surface-700"
				>
					<ArrowLeft class="mr-1 h-4 w-4" />
					Back to Properties
				</a>

				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div class="flex items-start gap-4">
						<div class="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-500/10">
							<Home class="h-7 w-7 text-primary-500" />
						</div>
						<div>
							<h1 class="text-2xl font-bold">{property.name}</h1>
							<div class="mt-1 flex items-center gap-1 text-surface-500">
								<MapPin class="h-4 w-4" />
								<span>
									{property.addressLine1}
									{#if property.addressLine2}, {property.addressLine2}{/if}
								</span>
							</div>
							<p class="text-surface-500">
								{property.city}, {property.state} {property.postalCode}
							</p>
						</div>
					</div>

					<div class="flex gap-2">
						<a
							href="/app/concierge/service-calls/new?propertyId={property?.id}"
							class="btn preset-filled-primary-500"
						>
							<Wrench class="mr-2 h-4 w-4" />
							New Service Call
						</a>
						<a
							href="/app/concierge/properties/{property.id}/edit"
							class="btn preset-tonal-surface"
						>
							<Edit class="mr-2 h-4 w-4" />
							Edit
						</a>
					</div>
				</div>
			</div>

			<!-- Tabs -->
			<div class="mb-6 border-b border-surface-300-700">
				<nav class="-mb-px flex gap-4 overflow-x-auto">
					{#each tabs as tab}
						<button
							type="button"
							onclick={() => handleTabChange(tab.id)}
							class="flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors {activeTab ===
							tab.id
								? 'border-primary-500 text-primary-500'
								: 'border-transparent text-surface-500 hover:border-surface-300 hover:text-surface-700'}"
						>
							<tab.icon class="h-4 w-4" />
							{tab.label}
						</button>
					{/each}
				</nav>
			</div>

			<!-- Tab Content -->
			{#if activeTab === 'overview'}
				<div class="grid gap-6 lg:grid-cols-2">
					<!-- Property Details -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-4 font-semibold">Property Details</h2>
						<dl class="space-y-3">
							<div class="flex justify-between">
								<dt class="text-surface-500">Type</dt>
								<dd class="font-medium">
									{propertyTypeLabels[property.propertyType] || property.propertyType}
								</dd>
							</div>
							{#if property.yearBuilt}
								<div class="flex justify-between">
									<dt class="text-surface-500">Year Built</dt>
									<dd class="font-medium">{property.yearBuilt}</dd>
								</div>
							{/if}
							{#if property.squareFeet}
								<div class="flex justify-between">
									<dt class="text-surface-500">Square Footage</dt>
									<dd class="font-medium">{property.squareFeet.toLocaleString()} sq ft</dd>
								</div>
							{/if}
							{#if property.lotSquareFeet}
								<div class="flex justify-between">
									<dt class="text-surface-500">Lot Size</dt>
									<dd class="font-medium">{property.lotSquareFeet.toLocaleString()} sq ft</dd>
								</div>
							{/if}
							{#if property.bedrooms !== null}
								<div class="flex justify-between">
									<dt class="text-surface-500">Bedrooms</dt>
									<dd class="font-medium">{property.bedrooms}</dd>
								</div>
							{/if}
							{#if property.bathrooms !== null}
								<div class="flex justify-between">
									<dt class="text-surface-500">Bathrooms</dt>
									<dd class="font-medium">{property.bathrooms}</dd>
								</div>
							{/if}
						</dl>
					</Card>

					<!-- HOA Information -->
					<Card variant="outlined" padding="md">
						<h2 class="mb-4 font-semibold">HOA Information</h2>
						{#if property.externalHoa}
							<dl class="space-y-3">
								<div class="flex justify-between">
									<dt class="text-surface-500">HOA Name</dt>
									<dd class="font-medium">{property.externalHoa.hoaName}</dd>
								</div>
								{#if property.externalHoa.hoaContactName}
									<div class="flex justify-between">
										<dt class="text-surface-500">Contact</dt>
										<dd class="font-medium">{property.externalHoa.hoaContactName}</dd>
									</div>
								{/if}
								{#if property.externalHoa.hoaContactEmail}
									<div class="flex justify-between">
										<dt class="text-surface-500">Email</dt>
										<dd class="font-medium">
											<a
												href="mailto:{property.externalHoa.hoaContactEmail}"
												class="text-primary-500 hover:underline"
											>
												{property.externalHoa.hoaContactEmail}
											</a>
										</dd>
									</div>
								{/if}
								{#if property.externalHoa.hoaContactPhone}
									<div class="flex justify-between">
										<dt class="text-surface-500">Phone</dt>
										<dd class="font-medium">
											<a
												href="tel:{property.externalHoa.hoaContactPhone}"
												class="text-primary-500 hover:underline"
											>
												{property.externalHoa.hoaContactPhone}
											</a>
										</dd>
									</div>
								{/if}
								{#if property.externalHoa.notes}
									<div>
										<dt class="text-surface-500">Notes</dt>
										<dd class="mt-1 text-sm">{property.externalHoa.notes}</dd>
									</div>
								{/if}
							</dl>
						{:else}
							<p class="text-surface-500">No HOA associated with this property.</p>
						{/if}
					</Card>

					<!-- Quick Stats -->
					<Card variant="outlined" padding="md" class="lg:col-span-2">
						<h2 class="mb-4 font-semibold">Quick Stats</h2>
						<div class="grid gap-4 sm:grid-cols-3">
							<div class="rounded-lg bg-surface-500/5 p-4 text-center">
								<p class="text-2xl font-bold text-primary-500">{property.activeCaseCount}</p>
								<p class="text-sm text-surface-500">Active Service Calls</p>
							</div>
							<div class="rounded-lg bg-surface-500/5 p-4 text-center">
								<p class="text-2xl font-bold">0</p>
								<p class="text-sm text-surface-500">Documents</p>
							</div>
							<div class="rounded-lg bg-surface-500/5 p-4 text-center">
								<p class="text-2xl font-bold">0</p>
								<p class="text-sm text-surface-500">Photos</p>
							</div>
						</div>
					</Card>
				</div>
			{:else if activeTab === 'documents'}
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h2 class="font-semibold">Property Documents</h2>
						<a
							href="/app/concierge/documents/upload?propertyId={property?.id}"
							class="btn preset-filled-primary-500"
						>
							<Upload class="mr-2 h-4 w-4" />
							Upload Document
						</a>
					</div>

					{#if isLoadingDocs}
						<div class="flex items-center justify-center py-12">
							<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
						</div>
					{:else if documents.length === 0}
						<Card variant="outlined" padding="md">
							<EmptyState
								title="No documents yet"
								description="Upload property documents like deeds, insurance policies, or warranties."
							>
								{#snippet actions()}
									<a
										href="/app/concierge/documents/upload?propertyId={property?.id}"
										class="btn preset-filled-primary-500"
									>
										<Plus class="mr-2 h-4 w-4" />
										Upload Document
									</a>
								{/snippet}
							</EmptyState>
						</Card>
					{:else}
						<div class="space-y-2">
							{#each documents as doc (doc.id)}
								<a
									href="/app/concierge/documents/{doc.id}"
									class="flex items-center gap-4 rounded-lg border border-surface-300-700 p-4 transition-all hover:border-primary-500 hover:bg-surface-500/5"
								>
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-500/10"
									>
										{#if doc.mimeType.includes('pdf')}
											<FileText class="h-5 w-5 text-surface-500" />
										{:else}
											<File class="h-5 w-5 text-surface-500" />
										{/if}
									</div>
									<div class="min-w-0 flex-1">
										<h3 class="font-medium">{doc.title}</h3>
										<p class="text-sm text-surface-500">
											{doc.fileName} • {formatFileSize(doc.fileSize)} • {formatDate(doc.createdAt)}
										</p>
									</div>
									<span class="rounded-full bg-surface-500/10 px-2 py-0.5 text-xs font-medium">
										{categoryLabels[doc.category] || doc.category}
									</span>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'media'}
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h2 class="font-semibold">Photos & Videos</h2>
						<a
							href="/app/concierge/documents/upload?propertyId={property?.id}"
							class="btn preset-filled-primary-500"
						>
							<Upload class="mr-2 h-4 w-4" />
							Upload Media
						</a>
					</div>

					{#if isLoadingMedia}
						<div class="flex items-center justify-center py-12">
							<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
						</div>
					{:else if mediaItems.length === 0}
						<Card variant="outlined" padding="md">
							<EmptyState
								title="No photos or videos yet"
								description="Add photos and videos of your property for reference."
							>
								{#snippet actions()}
									<a
										href="/app/concierge/documents/upload?propertyId={property?.id}"
										class="btn preset-filled-primary-500"
									>
										<Plus class="mr-2 h-4 w-4" />
										Upload Media
									</a>
								{/snippet}
							</EmptyState>
						</Card>
					{:else}
						<!-- Media Gallery Grid -->
						<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
							{#each mediaItems as item (item.id)}
								{#if item.mimeType.startsWith('image/')}
									<button
										type="button"
										onclick={() => (selectedImage = item)}
										class="group relative aspect-square overflow-hidden rounded-lg border border-surface-300-700 bg-surface-500/5 transition-all hover:border-primary-500"
									>
										<img
											src={`/api/documents/${item.id}/thumbnail`}
											alt={item.title}
											class="h-full w-full object-cover"
											onerror={(e) => {
												const target = e.target as HTMLImageElement;
												target.style.display = 'none';
												target.nextElementSibling?.classList.remove('hidden');
											}}
										/>
										<div class="hidden h-full w-full items-center justify-center">
											<ImageIcon class="h-8 w-8 text-surface-400" />
										</div>
										<div
											class="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
										>
											<p class="w-full truncate p-2 text-sm text-white">{item.title}</p>
										</div>
									</button>
								{:else if item.mimeType.startsWith('video/')}
									<a
										href="/app/concierge/documents/{item.id}"
										class="group relative aspect-square overflow-hidden rounded-lg border border-surface-300-700 bg-surface-500/5 transition-all hover:border-primary-500"
									>
										<div class="flex h-full w-full items-center justify-center">
											<Play class="h-10 w-10 text-surface-400 group-hover:text-primary-500" />
										</div>
										<div
											class="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent"
										>
											<p class="w-full truncate p-2 text-sm text-white">{item.title}</p>
										</div>
									</a>
								{/if}
							{/each}
						</div>
					{/if}
				</div>

				<!-- Image Lightbox -->
				{#if selectedImage}
					<div
						class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
						role="dialog"
						aria-modal="true"
					>
						<button
							type="button"
							onclick={() => (selectedImage = null)}
							class="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
							aria-label="Close"
						>
							<X class="h-6 w-6" />
						</button>
						<div class="max-h-full max-w-full">
							<img
								src={`/api/documents/${selectedImage.id}/file`}
								alt={selectedImage.title}
								class="max-h-[80vh] max-w-full rounded-lg object-contain"
							/>
							<div class="mt-4 text-center">
								<p class="text-lg font-medium text-white">{selectedImage.title}</p>
								<p class="text-sm text-white/70">{formatDate(selectedImage.createdAt)}</p>
							</div>
						</div>
					</div>
				{/if}
			{:else if activeTab === 'history'}
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h2 class="font-semibold">Service History</h2>
						<a
							href="/app/concierge/service-calls/new?propertyId={property?.id}"
							class="btn preset-filled-primary-500"
						>
							<Plus class="mr-2 h-4 w-4" />
							New Service Call
						</a>
					</div>

					{#if isLoadingHistory}
						<div class="flex items-center justify-center py-12">
							<Loader2 class="h-6 w-6 animate-spin text-primary-500" />
						</div>
					{:else if serviceCalls.length === 0}
						<Card variant="outlined" padding="md">
							<EmptyState
								title="No service history yet"
								description="Service calls for this property will appear here."
							>
								{#snippet actions()}
									<a
										href="/app/concierge/service-calls/new?propertyId={property?.id}"
										class="btn preset-filled-primary-500"
									>
										<Wrench class="mr-2 h-4 w-4" />
										Create Service Call
									</a>
								{/snippet}
							</EmptyState>
						</Card>
					{:else}
						<div class="space-y-2">
							{#each serviceCalls as call (call.id)}
								<a
									href="/app/concierge/service-calls/{call.id}"
									class="flex items-center gap-4 rounded-lg border border-surface-300-700 p-4 transition-all hover:border-primary-500 hover:bg-surface-500/5"
								>
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10"
									>
										<Wrench class="h-5 w-5 text-primary-500" />
									</div>
									<div class="min-w-0 flex-1">
										<h3 class="font-medium">{call.title}</h3>
										<p class="text-sm text-surface-500">
											#{call.caseNumber} • {formatDate(call.createdAt)}
										</p>
									</div>
									<span
										class="rounded-full px-2 py-0.5 text-xs font-medium {getServiceCallStatusColor(
												call.status as any
											)}"
									>
										{getServiceCallStatusLabel(call.status as any)}
									</span>
								</a>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'systems'}
				<Card variant="outlined" padding="md">
					<EmptyState
						title="No systems tracked yet"
						description="Track your HVAC, appliances, and other systems for better maintenance."
					>
						{#snippet actions()}
							<button class="btn preset-filled-primary-500">
								<Plus class="mr-2 h-4 w-4" />
								Add System
							</button>
						{/snippet}
					</EmptyState>
				</Card>
			{/if}
		{/if}
	</div>
</PageContainer>
