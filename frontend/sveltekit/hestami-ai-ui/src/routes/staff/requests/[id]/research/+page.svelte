<script lang="ts">
	import { goto } from '$app/navigation';
	import { ArrowLeft, Plus, Loader2, Trash2, AlertCircle } from 'lucide-svelte';
	import { apiPost } from '$lib/client/api';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	
	interface OutreachRecord {
		id: string;
		status: string;
		status_display: string;
		last_contact_date?: string;
		notes?: string;
	}

	interface Provider {
		id: string;
		business_name: string;
		phone?: string;
		website?: string;
		address?: string;
		rating?: number;
		total_reviews?: number;
		distance?: number;
		outreach?: OutreachRecord | null;
	}
	
	interface DataSource {
		source_url: string;
		raw_html: string;
		raw_text: string;
		notes: string;
	}
	
	// Receive data from server-side load function
	let { data } = $props();
	let existingProviders = $state<Provider[]>(data.existingProviders);
	let serviceRequestId = data.serviceRequestId;
	let error: string | null = $state(null);
	
	// Multi-source capture modal
	let showCaptureModal = $state(false);
	let dataSources: DataSource[] = $state([
		{ source_url: '', raw_html: '', raw_text: '', notes: '' }
	]);
	let submitting = $state(false);

	// Track providers being added to outreach
	let addingToOutreach = $state<Set<string>>(new Set());
	
	function addDataSource() {
		dataSources = [...dataSources, { source_url: '', raw_html: '', raw_text: '', notes: '' }];
	}
	
	function removeDataSource(index: number) {
		if (dataSources.length > 1) {
			dataSources = dataSources.filter((_, i) => i !== index);
		}
	}
	
	async function addToOutreach(provider: Provider) {
		if (addingToOutreach.has(provider.id)) return;
		
		addingToOutreach.add(provider.id);
		addingToOutreach = new Set(addingToOutreach);
		
		try {
			const response = await apiPost(
				`/api/services/requests/${serviceRequestId}/outreach/`,
				{
					provider: provider.id,
					status: 'NOT_CONTACTED'
				}
			);
			
			if (response.ok) {
				const outreachRecord = await response.json();
				
				// Update the provider's outreach status in the list
				existingProviders = existingProviders.map(p => 
					p.id === provider.id ? { ...p, outreach: outreachRecord } : p
				);
				
				error = null;
			} else {
				const errorData = await response.json();
				
				// Handle duplicate error (already in outreach)
				if (response.status === 400 && errorData.non_field_errors) {
					const isDuplicate = errorData.non_field_errors.some((err: any) => 
						err.includes?.('unique') || (typeof err === 'string' && err.includes('unique'))
					);
					
					if (isDuplicate) {
						// Provider already in outreach - reload page to sync state
						window.location.reload();
						return;
					}
				}
				
				error = errorData.error || errorData.non_field_errors?.[0] || 'Failed to add provider to outreach';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to add provider to outreach';
		} finally {
			addingToOutreach.delete(provider.id);
			addingToOutreach = new Set(addingToOutreach);
		}
	}

	function resetModal() {
		dataSources = [{ source_url: '', raw_html: '', raw_text: '', notes: '' }];
		showCaptureModal = false;
		submitting = false;
		error = null;
	}
	
	async function submitProviderResearch() {
		// Validate at least one source has a URL
		const validSources = dataSources.filter(s => s.source_url.trim());
		if (validSources.length === 0) {
			error = 'Please provide at least one source URL';
			return;
		}
		
		submitting = true;
		error = null;
		
		try {
			// Step 1: Create scrape group
			const scrapeGroup = await apiPost('/api/services/scrape-groups/', {
				search_query: `Provider research for request ${serviceRequestId}`,
				service_request_id: serviceRequestId
			});
			
			// Step 2: Add all sources to the group
			for (const source of validSources) {
				await apiPost(`/api/services/scrape-groups/${scrapeGroup.id}/sources/`, {
					source_url: source.source_url,
					raw_html: source.raw_html,
					raw_text: source.raw_text,
					notes: source.notes
				});
			}
			
			// Step 3: Process the group
			const result = await apiPost(`/api/services/scrape-groups/${scrapeGroup.id}/process/`, {});
			
			// Success! Reset modal and show message
			resetModal();
			alert(result.message || 'Provider research submitted successfully!');
			
			// Reload the page to get updated provider list
			window.location.reload();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to submit provider research';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Provider Research - Hestami AI</title>
</svelte:head>

<div class="container mx-auto p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<button class="btn-icon variant-ghost-surface" onclick={() => goto(`/staff/requests/${serviceRequestId}`)}>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div>
				<h1 class="h2">Provider Research</h1>
				<p class="text-sm text-surface-600-300-token">
					Find and research service providers
				</p>
			</div>
		</div>
	</div>
	
	{#if error}
		<aside class="alert variant-filled-error">
			<AlertCircle class="h-5 w-5" />
			<div class="alert-message">
				<h3 class="h4">Error</h3>
				<p>{error}</p>
			</div>
		</aside>
	{/if}
	
	<!-- Existing Providers Section -->
	<section class="space-y-4">
		<h2 class="h3">Existing Providers in Area</h2>
		<div class="card p-6">
			{#if existingProviders.length === 0}
				<p class="text-surface-600-300-token">No existing providers found. Research new providers below.</p>
			{:else}
				<div class="space-y-3">
					{#each existingProviders as provider}
						<div class="card variant-soft p-4">
							<div class="flex justify-between items-start gap-4">
								<div class="flex-1">
									<h4 class="font-semibold">{provider.business_name}</h4>
									{#if provider.address}
										<p class="text-sm text-surface-600-300-token">{provider.address}</p>
									{/if}
									{#if provider.phone}
										<p class="text-sm text-surface-600-300-token">{provider.phone}</p>
									{/if}
									{#if provider.rating && provider.rating > 0}
										<p class="text-sm text-surface-600-300-token">
											Rating: {provider.rating}/5.0 ({provider.total_reviews} reviews)
										</p>
									{/if}
									{#if provider.outreach}
										<span class="badge variant-soft-success mt-2">
											{provider.outreach.status_display}
										</span>
									{/if}
								</div>
								<div class="flex items-center gap-2">
									{#if provider.distance}
										<span class="badge variant-soft-secondary">{provider.distance.toFixed(1)} mi</span>
									{/if}
									{#if provider.outreach}
										<button
											class="btn btn-sm variant-soft-success"
											disabled
										>
											✓ Added
										</button>
									{:else}
										<button
											class="btn btn-sm variant-filled-primary"
											onclick={() => addToOutreach(provider)}
											disabled={addingToOutreach.has(provider.id)}
										>
											{#if addingToOutreach.has(provider.id)}
												<Loader2 class="h-4 w-4 animate-spin" />
											{:else}
												<Plus class="h-4 w-4" />
											{/if}
											Add to Outreach
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</section>
	
	<!-- Capture New Provider Section -->
	<section class="space-y-4">
		<div class="flex justify-between items-center">
			<h2 class="h3">Capture New Provider</h2>
			<button
				onclick={() => showCaptureModal = true}
				class="btn variant-filled-primary"
			>
				<Plus class="h-4 w-4 mr-2" />
				Capture Provider Data
			</button>
		</div>
		
		<div class="card p-6">
			<p class="text-surface-600-300-token text-sm">
				Manually research providers and capture their information from multiple sources. 
				The system will process and consolidate the data to create or update provider records.
			</p>
		</div>
	</section>
</div>

<!-- Multi-Source Capture Modal -->
{#if showCaptureModal}
	<div class="modal-backdrop fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
		<div class="card p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-surface-50-900-token shadow-xl">
			<h3 class="h3 mb-4">Capture Provider Research</h3>
			<p class="text-sm text-surface-600-300-token mb-6">
				Add one or more data sources for this provider. Each source should contain information scraped from a different website.
			</p>
			
			<form onsubmit={(e) => { e.preventDefault(); submitProviderResearch(); }}>
				<div class="space-y-6">
					{#each dataSources as source, index}
						<div class="card variant-soft p-4 space-y-4">
							<div class="flex justify-between items-center">
								<h4 class="font-semibold">Source {index + 1}</h4>
								{#if dataSources.length > 1}
									<button
										type="button"
										onclick={() => removeDataSource(index)}
										class="btn-icon variant-ghost-error btn-sm"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								{/if}
							</div>
							
							<div>
								<label class="label">
									<span class="text-sm font-medium">Source URL *</span>
								</label>
								<input
									type="url"
									bind:value={source.source_url}
									placeholder="https://maps.google.com/... or https://yelp.com/..."
									required
									class="input"
								/>
								<p class="text-xs text-surface-600-300-token mt-1">
									Source will be auto-detected from URL
								</p>
							</div>
							
							<div class="space-y-2">
								<!-- svelte-ignore a11y_label_has_associated_control -->
								<label class="label">
									<span class="text-sm font-medium">Rich Content</span>
								</label>
								<div class="rich-editor-container">
									<RichTextEditor 
										bind:value={source.raw_html} 
										placeholder="Paste formatted content from web page..."
									/>
								</div>
								<p class="text-xs text-surface-600-300-token">
									Paste content with formatting preserved from the source website.
								</p>
							</div>
							
							<div>
								<label class="label">
									<span class="text-sm font-medium">Raw Text</span>
								</label>
								<textarea
									bind:value={source.raw_text}
									placeholder="Paste text content here..."
									rows="6"
									class="textarea"
								></textarea>
							</div>
							
							<div>
								<label class="label">
									<span class="text-sm font-medium">Notes (optional)</span>
								</label>
								<textarea
									bind:value={source.notes}
									placeholder="Add any notes about this source..."
									rows="2"
									class="textarea"
								></textarea>
							</div>
						</div>
					{/each}
				</div>
				
				<div class="mt-4">
					<button
						type="button"
						onclick={addDataSource}
						class="btn variant-ghost-surface btn-sm"
					>
						<Plus class="h-4 w-4 mr-1" />
						Add Another Source
					</button>
				</div>
				
				<div class="flex gap-2 justify-end mt-6">
					<button
						type="button"
						onclick={resetModal}
						class="btn variant-ghost-surface"
						disabled={submitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="btn variant-filled-primary"
						disabled={submitting}
					>
						{#if submitting}
							<Loader2 class="h-4 w-4 mr-2 animate-spin" />
						{/if}
						{submitting ? 'Processing...' : 'Submit & Process'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
