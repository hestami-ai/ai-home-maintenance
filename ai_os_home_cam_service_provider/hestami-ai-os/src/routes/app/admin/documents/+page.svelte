<script lang="ts">
	import { ARCCategoryValues, DocumentCategoryValues, MediaTypeValues } from '$lib/api/cam';
	import { PageContainer, Card, EmptyState } from '$lib/components/ui';
	import { FileText, Search, Filter, Upload, Loader2, Calendar, User, Tag } from 'lucide-svelte';

	interface Props {
		data: {
			documents: any[];
			filters: {
				q: string;
				type: string;
			};
		};
	}

	let { data }: Props = $props();

	let isLoading = $state(false);
	// Use $state with $effect to avoid proxy errors during navigation
	let documents = $state<any[]>([]);
	let searchQuery = $state('');
	let filterType = $state('');

	// Sync all data from server
	// Track data to trigger re-runs on navigation, but guard against undefined
	$effect(() => {
		if (data == null || typeof data !== 'object') return;
		documents = data.documents ?? [];
		searchQuery = data.filters?.q ?? '';
		filterType = data.filters?.type ?? '';
	});


	const documentTypes = [
		{ value: '', label: 'All Types' },
		{ value: DocumentCategoryValues.CONTRACT, label: 'Contracts' },
		{ value: DocumentCategoryValues.INVOICE, label: 'Invoices' },
		{ value: DocumentCategoryValues.ESTIMATE, label: 'Estimates' },
		{ value: MediaTypeValues.PHOTO, label: 'Photos' },
		{ value: 'REPORT', label: 'Reports' },
		{ value: ARCCategoryValues.OTHER, label: 'Other' }
	];
</script>

<svelte:head>
	<title>Documents | Staff Portal | Hestami AI</title>
</svelte:head>

<PageContainer>
	<div class="py-6">
		<!-- Header -->
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold">Documents & Evidence</h1>
				<p class="mt-1 text-surface-500">Browse and manage case-related documents</p>
			</div>
			<button class="btn preset-filled-primary-500" disabled>
				<Upload class="mr-2 h-4 w-4" />
				Upload Document
			</button>
		</div>

		<!-- Filters -->
		<div class="mt-6 flex flex-wrap gap-4">
			<div class="flex-1 min-w-[200px]">
				<div class="relative">
					<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search documents..."
						class="input w-full pl-10"
					/>
				</div>
			</div>
			<div>
				<select bind:value={filterType} class="select">
					{#each documentTypes as type}
						<option value={type.value}>{type.label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Content -->
		<div class="mt-6">
			{#if isLoading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-primary-500" />
				</div>
			{:else if documents.length === 0}
				<Card variant="outlined" padding="lg">
					<EmptyState
						title="No documents found"
						description="Documents attached to cases will appear here. Upload documents through case detail pages or use the upload button above."
					>
						{#snippet actions()}
							<a href="/app/admin/work-queue" class="btn preset-outlined-primary-500">
								Go to Work Queue
							</a>
						{/snippet}
					</EmptyState>
				</Card>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each documents as doc}
						<Card variant="outlined" padding="md" class="hover:border-primary-500 transition-colors cursor-pointer">
							<div class="flex items-start gap-3">
								<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-200-800">
									<FileText class="h-5 w-5 text-surface-500" />
								</div>
								<div class="flex-1 min-w-0">
									<p class="font-medium truncate">{doc.fileName}</p>
									<p class="text-sm text-surface-500">{doc.fileType}</p>
									<div class="mt-2 flex items-center gap-3 text-xs text-surface-400">
										<span class="flex items-center gap-1">
											<Calendar class="h-3 w-3" />
											{doc.createdAt}
										</span>
									</div>
								</div>
							</div>
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</PageContainer>
