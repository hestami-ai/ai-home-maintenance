<script lang="ts">
	import { goto } from '$app/navigation';
	import { format, differenceInDays } from 'date-fns';
	import { 
		ArrowLeft, 
		Calendar, 
		DollarSign, 
		User, 
		MapPin, 
		Clock,
		AlertCircle,
		CheckCircle,
		Save
	} from 'lucide-svelte';
	import type { ServiceRequest } from '$lib/types';
	import { apiPatch, apiPost } from '$lib/client/api';
	import Timeline from '$lib/components/timeline/Timeline.svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	
	// Get data from page load
	const { data } = $props<{ data: any }>();
	
	// Tabs
	let activeTab = $state<'overview' | 'research' | 'timeline' | 'bids'>('overview');
	
	// Service request data
	let serviceRequest = $state<ServiceRequest>(data.serviceRequest);
	let researchEntries = $state(data.researchEntries || []);
	let bids = $state(data.bids || []);
	let bidsSummary = $state(data.bidsSummary || {});
	let providerOutreach = $state(data.providerOutreach || []);
	
	// Research notes editor (updated for Phase 1 improvements)
	let researchContent = $state(''); // Rich text HTML
	let researchContentRaw = $state(''); // Raw text/HTML
	let researchSourceUrl = $state('');
	let researchDataSources = $state<string[]>([]);
	let researchNotes = $state('');
	let isSavingResearch = $state(false);
	let researchSaveSuccess = $state(false);
	
	// Status change
	let selectedStatus = $state(serviceRequest.status);
	let isUpdatingStatus = $state(false);
	
	// Sync selectedStatus when serviceRequest changes (e.g., after reload)
	$effect(() => {
		// Only update if different to avoid infinite loops
		if (selectedStatus !== serviceRequest.status) {
			selectedStatus = serviceRequest.status;
		}
	});
	
	// Provider Outreach (Phase 2)
	// Note: Add Provider modal removed - use Research Providers page instead
	
	// Bid Selection (Phase 2)
	let showBidSelectionModal = $state(false);
	let selectedBidForAction = $state<any>(null);
	let isSelectingBid = $state(false);
	
	// Reopen Research (Phase 2)
	let showReopenResearchModal = $state(false);
	let reopenReason = $state('');
	let isReopeningResearch = $state(false);
	
	// Format helpers
	function formatDate(dateString: string | null): string {
		if (!dateString) return 'Not set';
		return format(new Date(dateString), 'MMM d, yyyy');
	}
	
	function formatDateTime(dateString: string | null): string {
		if (!dateString) return 'Not set';
		return format(new Date(dateString), 'MMM d, yyyy h:mm a');
	}
	
	function formatStatus(status: string): string {
		return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
	}
	
	function getStatusClass(status: string): string {
		switch (status.toLowerCase()) {
			case 'pending': return 'badge variant-soft-warning';
			case 'in_research': return 'badge variant-soft-secondary';
			case 'bidding': return 'badge variant-soft-primary';
			case 'accepted': return 'badge variant-soft-success';
			case 'scheduled': return 'badge variant-soft-tertiary';
			case 'in_progress': return 'badge variant-soft-tertiary';
			case 'completed': return 'badge variant-soft-success';
			case 'cancelled': return 'badge variant-soft-error';
			default: return 'badge variant-soft-surface';
		}
	}
	
	function getPriorityClass(priority: string): string {
		switch (priority.toLowerCase()) {
			case 'urgent': return 'badge variant-filled-error';
			case 'high': return 'badge variant-filled-warning';
			case 'medium': return 'badge variant-soft-secondary';
			case 'low': return 'badge variant-soft-surface';
			default: return 'badge variant-soft-surface';
		}
	}
	
	// Calculate days in current status
	function getDaysInStatus(): number {
		return differenceInDays(new Date(), new Date(serviceRequest.updated_at));
	}
	
	// Check if deadline is approaching (within 2 days)
	function isDeadlineApproaching(): boolean {
		if (!serviceRequest.bid_submission_deadline) return false;
		const daysUntil = differenceInDays(
			new Date(serviceRequest.bid_submission_deadline),
			new Date()
		);
		return daysUntil >= 0 && daysUntil <= 2;
	}
	
	// Check if deadline is overdue
	function isDeadlineOverdue(): boolean {
		if (!serviceRequest.bid_submission_deadline) return false;
		return differenceInDays(
			new Date(serviceRequest.bid_submission_deadline),
			new Date()
		) < 0;
	}
	
	// Update status
	async function updateStatus() {
		if (selectedStatus === serviceRequest.status) return;
		
		try {
			isUpdatingStatus = true;
			
			await apiPatch(`/api/services/requests/${serviceRequest.id}/status/`, {
				status: selectedStatus
			});
			
			// Update local state
			serviceRequest = { ...serviceRequest, status: selectedStatus };
			
			// Show success message
			alert('Status updated successfully');
		} catch (err) {
			console.error('Error updating status:', err);
			alert('Failed to update status');
			// Revert selection
			selectedStatus = serviceRequest.status;
		} finally {
			isUpdatingStatus = false;
		}
	}
	
	// Save research notes
	async function saveResearchNotes() {
		// Validate required fields
		if (!researchContent.trim()) {
			alert('Please enter rich text content');
			return;
		}
		if (!researchContentRaw.trim()) {
			alert('Please enter raw text/HTML content');
			return;
		}
		if (!researchSourceUrl.trim()) {
			alert('Please enter source URL');
			return;
		}
		
		try {
			isSavingResearch = true;
			researchSaveSuccess = false;
			
			await apiPost(`/api/services/requests/${serviceRequest.id}/research/add/`, {
				research_content: researchContent,
				research_content_raw_text: researchContentRaw,
				source_url: researchSourceUrl,
				data_sources: researchDataSources,
				notes: researchNotes,
				update_status: true
			});
			
			// Clear all fields
			researchContent = '';
			researchContentRaw = '';
			researchSourceUrl = '';
			researchDataSources = [];
			researchNotes = '';
			researchSaveSuccess = true;
			
			// Reload research entries
			setTimeout(() => {
				researchSaveSuccess = false;
			}, 3000);
		} catch (err) {
			console.error('Error saving research:', err);
			alert('Failed to save research notes');
		} finally {
			isSavingResearch = false;
		}
	}
	
	// Provider Outreach Functions (Phase 2)
	async function updateOutreachStatus(outreachId: string, newStatus: string) {
		try {
			await apiPatch(`/api/services/requests/${serviceRequest.id}/outreach/${outreachId}/`, {
				status: newStatus
			});
			
			// Update local state
			providerOutreach = providerOutreach.map((o: any) =>
				o.id === outreachId ? { ...o, status: newStatus } : o
			);
		} catch (err) {
			console.error('Error updating outreach status:', err);
			alert('Failed to update provider status');
		}
	}
	
	function getOutreachStatusClass(status: string): string {
		switch (status) {
			case 'NOT_CONTACTED': return 'badge variant-soft-surface';
			case 'CONTACTED': return 'badge variant-soft-secondary';
			case 'INTERESTED': return 'badge variant-soft-primary';
			case 'DECLINED': return 'badge variant-soft-error';
			case 'BID_SUBMITTED': return 'badge variant-soft-success';
			case 'NO_RESPONSE': return 'badge variant-soft-warning';
			default: return 'badge variant-soft-surface';
		}
	}
	
	// Bid Selection Functions (Phase 2)
	function openBidSelectionModal(bid: any) {
		selectedBidForAction = bid;
		showBidSelectionModal = true;
	}
	
	async function confirmBidSelection() {
		if (!selectedBidForAction) return;
		
		try {
			isSelectingBid = true;
			
			await apiPost(
				`/api/services/requests/${serviceRequest.id}/bids/${selectedBidForAction.id}/select/`,
				{}
			);
			
			// Reload page data to reflect changes
			window.location.reload();
		} catch (err) {
			console.error('Error selecting bid:', err);
			alert('Failed to select bid. Please try again.');
		} finally {
			isSelectingBid = false;
			showBidSelectionModal = false;
			selectedBidForAction = null;
		}
	}
	
	// Reopen Research Functions (Phase 2)
	async function confirmReopenResearch() {
		if (!reopenReason.trim()) {
			alert('Please provide a reason for reopening research');
			return;
		}
		
		try {
			isReopeningResearch = true;
			
			await apiPost(
				`/api/services/requests/${serviceRequest.id}/reopen-research/`,
				{ reason: reopenReason }
			);
			
			// Reload page to reflect status change
			window.location.reload();
		} catch (err) {
			console.error('Error reopening research:', err);
			alert('Failed to reopen research. Please try again.');
		} finally {
			isReopeningResearch = false;
			showReopenResearchModal = false;
			reopenReason = '';
		}
	}
	
	// Check if reopen research is allowed for current status
	function canReopenResearch(): boolean {
		const allowedStatuses = ['BIDDING', 'ACCEPTED', 'SCHEDULED'];
		return allowedStatuses.includes(serviceRequest.status);
	}
</script>

<svelte:head>
	<title>Service Request: {serviceRequest.title} - Hestami AI</title>
	<meta name="description" content="Manage service request details" />
</svelte:head>

<div class="container mx-auto p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<button class="btn-icon variant-ghost-surface" onclick={() => goto('/staff/requests')}>
				<ArrowLeft class="h-5 w-5" />
			</button>
			<div>
				<h1 class="h2">{serviceRequest.title}</h1>
				<p class="text-sm text-surface-600-300-token">
					Request #{serviceRequest.id.substring(0, 8)}
				</p>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<span class="{getPriorityClass(serviceRequest.priority)}">
				{serviceRequest.priority}
			</span>
			<span class="{getStatusClass(serviceRequest.status)}">
				{formatStatus(serviceRequest.status)}
			</span>
		</div>
	</div>
	
	<!-- Main Content -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Left Column (65%) -->
		<div class="lg:col-span-2 space-y-6">
			<!-- Tabs -->
			<div class="card">
				<div class="flex border-b border-surface-300-600-token">
					<button
						class="px-6 py-3 font-semibold transition-colors {activeTab === 'overview' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600-300-token hover:text-surface-900-50-token'}"
						onclick={() => (activeTab = 'overview')}
					>
						Overview
					</button>
					<button
						class="px-6 py-3 font-semibold transition-colors {activeTab === 'research' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600-300-token hover:text-surface-900-50-token'}"
						onclick={() => (activeTab = 'research')}
					>
						Research Notes
					</button>
					<button
						class="px-6 py-3 font-semibold transition-colors {activeTab === 'timeline' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600-300-token hover:text-surface-900-50-token'}"
						onclick={() => (activeTab = 'timeline')}
					>
						Timeline
					</button>
					<button
						class="px-6 py-3 font-semibold transition-colors {activeTab === 'bids' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-surface-600-300-token hover:text-surface-900-50-token'}"
						onclick={() => (activeTab = 'bids')}
					>
						Bids ({bids.length})
					</button>
				</div>
				
				<!-- Tab Content -->
				<div class="p-6">
					{#if activeTab === 'overview'}
						<!-- Overview Tab -->
						<div class="space-y-6">
							<!-- Customer & Property -->
							<div class="grid grid-cols-2 gap-4">
								<div>
									<h3 class="text-sm font-semibold text-surface-600-300-token mb-2">Customer</h3>
									<div class="flex items-center gap-2">
										<User class="h-4 w-4 text-surface-500-400-token" />
										<span>
											{serviceRequest.created_by_details.first_name} 
											{serviceRequest.created_by_details.last_name}
										</span>
									</div>
									<div class="text-sm text-surface-600-300-token mt-1">
										{serviceRequest.created_by_details.email}
									</div>
								</div>
								<div>
									<h3 class="text-sm font-semibold text-surface-600-300-token mb-2">Property</h3>
									<div class="flex items-center gap-2">
										<MapPin class="h-4 w-4 text-surface-500-400-token" />
										<span>{serviceRequest.property_details.address}</span>
									</div>
									<div class="text-sm text-surface-600-300-token mt-1">
										{serviceRequest.property_details.city}, {serviceRequest.property_details.state} {serviceRequest.property_details.zip_code}
									</div>
								</div>
							</div>
							
							<!-- Category & Priority -->
							<div class="grid grid-cols-2 gap-4">
								<div>
									<h3 class="text-sm font-semibold text-surface-600-300-token mb-2">Category</h3>
									<p>{serviceRequest.category_display}</p>
								</div>
								<div>
									<h3 class="text-sm font-semibold text-surface-600-300-token mb-2">Priority</h3>
									<span class="{getPriorityClass(serviceRequest.priority)}">
										{serviceRequest.priority}
									</span>
								</div>
							</div>
							
							<!-- Schedule & Budget -->
							<div class="grid grid-cols-2 gap-4">
								<div>
									<h3 class="text-sm font-semibold text-surface-600-300-token mb-2">Preferred Schedule</h3>
									<div class="flex items-center gap-2">
										<Calendar class="h-4 w-4 text-surface-500-400-token" />
										<span>{formatDate(serviceRequest.preferred_schedule?.date)}</span>
									</div>
									<div class="text-sm text-surface-600-300-token mt-1">
										Flexibility: {serviceRequest.preferred_schedule?.flexible ? 'Yes' : 'No'}
									</div>
								</div>
								<div>
									<h3 class="text-sm font-semibold text-surface-600-300-token mb-2">Budget</h3>
									<div class="flex items-center gap-2">
										<DollarSign class="h-4 w-4 text-surface-500-400-token" />
										<span>
											{#if serviceRequest.budget_minimum && serviceRequest.budget_maximum}
												${serviceRequest.budget_minimum} - ${serviceRequest.budget_maximum}
											{:else}
												Not specified
											{/if}
										</span>
									</div>
								</div>
							</div>
							
							<!-- Problem Summary -->
							<div>
								<h3 class="text-sm font-semibold text-surface-600-300-token mb-2">Problem Summary</h3>
								<p class="text-surface-700-200-token">{serviceRequest.description}</p>
							</div>
							
							<!-- Last Updated -->
							<div>
								<h3 class="text-sm font-semibold text-surface-600-300-token mb-2">Last Updated</h3>
								<p class="text-sm">{formatDateTime(serviceRequest.updated_at)}</p>
							</div>
						</div>
					{:else if activeTab === 'research'}
						<!-- Research Notes Tab -->
						<div class="space-y-6">
							<div>
								<h3 class="font-semibold mb-2">Add Research Notes</h3>
								<p class="text-sm text-surface-600-300-token mb-4">
									Copy and paste provider information from web sources. All fields marked with * are required.
								</p>
								
								<!-- Source URL -->
								<div class="space-y-2">
									<label class="label">
										<span class="text-sm font-semibold">Source URL *</span>
										<input
											type="url"
											bind:value={researchSourceUrl}
											placeholder="https://example.com/provider-profile"
											class="input"
										/>
									</label>
								</div>
								
								<!-- Data Sources -->
								<div class="space-y-2">
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="label">
										<span class="text-sm font-semibold">Data Sources</span>
									</label>
									<div class="flex flex-wrap gap-3">
										{#each ['Angi', 'Thumbtack', 'Yelp', 'Google', 'Bing Search', 'Other'] as source}
											<label class="flex items-center gap-2">
												<input
													type="checkbox"
													class="checkbox"
													checked={researchDataSources.includes(source)}
													onchange={(e) => {
														if (e.currentTarget.checked) {
															researchDataSources = [...researchDataSources, source];
														} else {
															researchDataSources = researchDataSources.filter(s => s !== source);
														}
													}}
												/>
												<span class="text-sm">{source}</span>
											</label>
										{/each}
									</div>
								</div>
								
								<!-- Rich Text Content -->
								<div class="space-y-2">
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="label">
										<span class="text-sm font-semibold">Rich Text Content * (paste formatted content)</span>
									</label>
									<RichTextEditor bind:value={researchContent} placeholder="Paste formatted content from web page..." />
									<p class="text-xs text-surface-600-300-token">
										Paste content with formatting preserved. Images and styles will be maintained.
									</p>
								</div>
								
								<!-- Raw Text Content -->
								<div class="space-y-2">
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="label">
										<span class="text-sm font-semibold">Raw Text/HTML Content * (paste raw text or HTML)</span>
									</label>
									<textarea
										bind:value={researchContentRaw}
										placeholder="Paste raw text or HTML source code here..."
										class="textarea w-full min-h-[200px] font-mono text-sm"
									></textarea>
									<p class="text-xs text-surface-600-300-token">
										Paste raw HTML or text. Useful for preserving CSS classes and attributes for ratings.
									</p>
								</div>
								
								<!-- Additional Notes -->
								<div class="space-y-2">
									<!-- svelte-ignore a11y_label_has_associated_control -->
									<label class="label">
										<span class="text-sm font-semibold">Additional Notes (optional)</span>
									</label>
									<textarea
										bind:value={researchNotes}
										placeholder="Add any additional notes or observations..."
										class="textarea w-full min-h-[100px]"
									></textarea>
								</div>
								
								<div class="flex items-center gap-2 mt-4">
									<button
										class="btn variant-filled-primary"
										onclick={saveResearchNotes}
										disabled={isSavingResearch || !researchContent.trim() || !researchContentRaw.trim() || !researchSourceUrl.trim()}
									>
										<Save class="h-4 w-4 mr-2" />
										{isSavingResearch ? 'Saving...' : 'Save Research'}
									</button>
									{#if researchSaveSuccess}
										<span class="text-success-500 flex items-center gap-1">
											<CheckCircle class="h-4 w-4" />
											Saved successfully
										</span>
									{/if}
								</div>
							</div>
							
							<!-- Previous Research Entries -->
							{#if researchEntries.length > 0}
								<div class="border-t border-surface-300-600-token pt-4">
									<h3 class="font-semibold mb-4">Previous Research</h3>
									<div class="space-y-4">
										{#each researchEntries as entry}
											<div class="card p-4 variant-soft">
												<div class="flex justify-between items-start mb-2">
													<span class="text-sm font-semibold">
														{entry.research_type || 'Research Entry'}
													</span>
													<span class="text-xs text-surface-600-300-token">
														{formatDateTime(entry.created_at)}
													</span>
												</div>
												<div class="text-sm text-surface-700-200-token">
													{entry.content}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{:else if activeTab === 'timeline'}
						<!-- Timeline Tab -->
						<Timeline serviceRequestId={serviceRequest.id} />
					{:else if activeTab === 'bids'}
						<!-- Bids Tab (Phase 2: Provider Roster + Bid Comparison) -->
						<div class="space-y-6">
							<!-- Provider Roster Section -->
							<div>
								<div class="flex justify-between items-center mb-4">
									<h3 class="h4">Provider Roster</h3>
									<button 
										class="btn variant-filled-primary btn-sm"
										onclick={() => goto(`/staff/requests/${serviceRequest.id}/research`)}
									>
										Research Providers
									</button>
								</div>
								
								{#if providerOutreach.length === 0}
									<div class="card p-6 text-center text-surface-600-300-token">
										<p>No providers contacted yet. Add providers to track outreach.</p>
									</div>
								{:else}
									<div class="card">
										<div class="table-container">
											<table class="table table-hover">
												<thead>
													<tr>
														<th>Provider</th>
														<th>Status</th>
														<th>Last Contact</th>
														<th>Notes</th>
														<th>Actions</th>
													</tr>
												</thead>
												<tbody>
													{#each providerOutreach as outreach}
														<tr>
															<td>
																<div class="font-semibold">
																	{outreach.provider_details?.business_name || 'Unknown'}
																</div>
																<div class="text-xs text-surface-600-300-token">
																	{outreach.provider_details?.phone || ''}
																</div>
															</td>
															<td>
																<select
																	value={outreach.status}
																	onchange={(e) => updateOutreachStatus(outreach.id, e.currentTarget.value)}
																	class="select select-sm"
																>
																	<option value="NOT_CONTACTED">Not Contacted</option>
																	<option value="CONTACTED">Contacted</option>
																	<option value="INTERESTED">Interested</option>
																	<option value="DECLINED">Declined</option>
																	<option value="BID_SUBMITTED">Bid Submitted</option>
																	<option value="NO_RESPONSE">No Response</option>
																</select>
															</td>
															<td class="text-sm">
																{outreach.last_contact_date ? formatDate(outreach.last_contact_date) : 'Never'}
															</td>
															<td class="text-sm max-w-xs truncate">
																{outreach.notes || '-'}
															</td>
															<td>
																<button class="btn btn-sm variant-ghost-surface">
																	Edit
																</button>
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								{/if}
							</div>
							
							<!-- Bid Comparison Section -->
							<div>
								<div class="flex justify-between items-center mb-4">
									<h3 class="h4">Bid Comparison</h3>
									{#if bidsSummary.total_bids}
										<div class="text-sm text-surface-600-300-token">
											{bidsSummary.submitted_bids} of {bidsSummary.total_bids} bids submitted
										</div>
									{/if}
								</div>
								
								{#if bids.length === 0}
									<div class="card p-6 text-center text-surface-600-300-token">
										<p>No bids submitted yet</p>
									</div>
								{:else}
									<div class="card">
										<div class="table-container">
											<table class="table table-hover">
												<thead>
													<tr>
														<th>Provider</th>
														<th>Amount</th>
														<th>Duration</th>
														<th>Start Date</th>
														<th>Status</th>
														<th class="text-right">Actions</th>
													</tr>
												</thead>
												<tbody>
													{#each bids as bid}
														<tr class:variant-soft-success={bid.is_selected}>
															<td>
																<div class="font-semibold">
																	{bid.provider_details?.business_name || 'Unknown'}
																</div>
																<div class="text-xs text-surface-600-300-token">
																	Rating: {bid.provider_details?.average_rating || 'N/A'} ⭐
																</div>
															</td>
															<td class="font-semibold">
																${bid.amount}
															</td>
															<td class="text-sm">
																{bid.estimated_duration_days ? `${bid.estimated_duration_days.toFixed(1)} days` : 'N/A'}
															</td>
															<td class="text-sm">
																{bid.proposed_start_date ? formatDate(bid.proposed_start_date) : 'TBD'}
																{#if bid.days_until_start !== null}
																	<div class="text-xs text-surface-600-300-token">
																		({bid.days_until_start} days)
																	</div>
																{/if}
															</td>
															<td>
																<span class="{getStatusClass(bid.status)}">
																	{bid.status_display}
																</span>
																{#if bid.is_selected}
																	<span class="badge variant-filled-success ml-2">Selected</span>
																{/if}
															</td>
															<td class="text-right">
																{#if !bid.is_selected && bid.status === 'SUBMITTED'}
																	<button 
																		class="btn btn-sm variant-filled-primary"
																		onclick={() => openBidSelectionModal(bid)}
																	>
																		Select Bid
																	</button>
																{:else}
																	<button class="btn btn-sm variant-ghost-surface">
																		View Details
																	</button>
																{/if}
															</td>
														</tr>
													{/each}
												</tbody>
											</table>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
		
		<!-- Right Column (35%) - Sidebar -->
		<div class="space-y-6">
			<!-- Actions Card -->
			<div class="card p-4">
				<h3 class="font-semibold mb-4">Actions</h3>
				<div class="space-y-3">
					<!-- Status Change -->
					<div>
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="label mb-2">
							<span class="text-sm font-semibold">Change Status</span>
						</label>
						<select
							bind:value={selectedStatus}
							onchange={updateStatus}
							disabled={isUpdatingStatus}
							class="select w-full"
						>
							<option value="PENDING">Pending</option>
							<option value="IN_RESEARCH">In Research</option>
							<option value="BIDDING">Bidding</option>
							<option value="ACCEPTED">Accepted</option>
							<option value="SCHEDULED">Scheduled</option>
							<option value="IN_PROGRESS">In Progress</option>
							<option value="COMPLETED">Completed</option>
							<option value="CANCELLED">Cancelled</option>
						</select>
					</div>
					
					<!-- Assign to Me -->
					{#if !serviceRequest.assigned_to}
						<button class="btn variant-filled-secondary w-full">
							Assign to Me
						</button>
					{/if}
					
					<!-- Reopen Research (Phase 2) -->
					{#if canReopenResearch()}
						<button 
							class="btn variant-filled-warning w-full"
							onclick={() => (showReopenResearchModal = true)}
						>
							Reopen Research
						</button>
					{/if}
				</div>
			</div>
			
			<!-- SLA Indicators Card -->
			<div class="card p-4">
				<h3 class="font-semibold mb-4">SLA Indicators</h3>
				<div class="space-y-3">
					<!-- Days in Status -->
					<div class="flex items-center justify-between">
						<span class="text-sm text-surface-600-300-token">Days in status:</span>
						<span class="font-semibold">{getDaysInStatus()}</span>
					</div>
					
					<!-- Bid Deadline -->
					{#if serviceRequest.bid_submission_deadline}
						<div class="flex items-start gap-2">
							{#if isDeadlineOverdue()}
								<AlertCircle class="h-5 w-5 text-error-500 flex-shrink-0 mt-0.5" />
								<div class="flex-1">
									<div class="text-sm font-semibold text-error-500">Bid deadline overdue</div>
									<div class="text-xs text-surface-600-300-token">
										{formatDate(serviceRequest.bid_submission_deadline)}
									</div>
								</div>
							{:else if isDeadlineApproaching()}
								<AlertCircle class="h-5 w-5 text-warning-500 flex-shrink-0 mt-0.5" />
								<div class="flex-1">
									<div class="text-sm font-semibold text-warning-500">Bid deadline approaching</div>
									<div class="text-xs text-surface-600-300-token">
										{formatDate(serviceRequest.bid_submission_deadline)}
									</div>
								</div>
							{:else}
								<Clock class="h-5 w-5 text-surface-500-400-token flex-shrink-0 mt-0.5" />
								<div class="flex-1">
									<div class="text-sm font-semibold">Bid deadline</div>
									<div class="text-xs text-surface-600-300-token">
										{formatDate(serviceRequest.bid_submission_deadline)}
									</div>
								</div>
							{/if}
						</div>
					{:else}
						<div class="text-sm text-surface-600-300-token">
							No bid deadline set
						</div>
					{/if}
				</div>
			</div>
			
			<!-- Assignment Card -->
			<div class="card p-4">
				<h3 class="font-semibold mb-4">Assignment</h3>
				{#if serviceRequest.assigned_to_details}
					<div class="flex items-center gap-2">
						<User class="h-4 w-4 text-surface-500-400-token" />
						<span class="text-sm">
							{serviceRequest.assigned_to_details.first_name} 
							{serviceRequest.assigned_to_details.last_name}
						</span>
					</div>
				{:else}
					<p class="text-sm text-surface-600-300-token">Unassigned</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Add Provider Modal removed - use Research Providers page instead -->

<!-- Bid Selection Confirmation Modal (Phase 2) -->
{#if showBidSelectionModal && selectedBidForAction}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="modal-backdrop" role="presentation" onclick={() => (showBidSelectionModal = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal card variant-filled-surface p-6 w-full max-w-lg bg-surface-50-900-token" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<h3 class="h3 mb-4">Confirm Bid Selection</h3>
			
			<div class="space-y-4">
				<div class="card p-4 variant-soft-primary">
					<div class="space-y-2">
						<div class="flex justify-between">
							<span class="font-semibold">Provider:</span>
							<span>{selectedBidForAction.provider_details?.business_name || 'Unknown'}</span>
						</div>
						<div class="flex justify-between">
							<span class="font-semibold">Amount:</span>
							<span class="text-lg font-bold">${selectedBidForAction.amount}</span>
						</div>
						<div class="flex justify-between">
							<span class="font-semibold">Duration:</span>
							<span>
								{selectedBidForAction.estimated_duration_days 
									? `${selectedBidForAction.estimated_duration_days.toFixed(1)} days` 
									: 'N/A'}
							</span>
						</div>
						<div class="flex justify-between">
							<span class="font-semibold">Start Date:</span>
							<span>
								{selectedBidForAction.proposed_start_date 
									? formatDate(selectedBidForAction.proposed_start_date) 
									: 'TBD'}
							</span>
						</div>
					</div>
				</div>
				
				<div class="alert variant-soft-warning">
					<p class="text-sm">
						<strong>Note:</strong> Selecting this bid will:
					</p>
					<ul class="list-disc list-inside text-sm mt-2 space-y-1">
						<li>Set the service request status to ACCEPTED</li>
						<li>Mark this bid as ACCEPTED</li>
						<li>Reject all other bids</li>
						<li>Create a timeline entry</li>
					</ul>
				</div>
			</div>
			
			<div class="flex gap-2 justify-end mt-6">
				<button 
					class="btn variant-ghost-surface" 
					onclick={() => (showBidSelectionModal = false)}
					disabled={isSelectingBid}
				>
					Cancel
				</button>
				<button 
					class="btn variant-filled-primary" 
					onclick={confirmBidSelection}
					disabled={isSelectingBid}
				>
					{isSelectingBid ? 'Selecting...' : 'Confirm Selection'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Reopen Research Modal (Phase 2) -->
{#if showReopenResearchModal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="modal-backdrop" role="presentation" onclick={() => (showReopenResearchModal = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal card variant-filled-surface p-6 w-full max-w-lg bg-surface-50-900-token" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<h3 class="h3 mb-4">Reopen Research</h3>
			
			<div class="space-y-4">
				<div class="alert variant-soft-warning">
					<p class="text-sm">
						<strong>Note:</strong> Reopening research will:
					</p>
					<ul class="list-disc list-inside text-sm mt-2 space-y-1">
						<li>Change status from <strong>{formatStatus(serviceRequest.status)}</strong> to <strong>In Research</strong></li>
						<li>Allow STAFF to add more research notes</li>
						<li>Create a timeline entry with your reason</li>
					</ul>
				</div>
				
				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="label mb-2">
						<span class="text-sm font-semibold">Reason for Reopening *</span>
					</label>
					<textarea
						bind:value={reopenReason}
						placeholder="Explain why research needs to be reopened (e.g., 'Customer requested additional scope review', 'Need to verify contractor availability')"
						rows="4"
						class="textarea"
						required
					></textarea>
					<p class="text-xs text-surface-600-300-token mt-1">
						This reason will be logged in the timeline for transparency.
					</p>
				</div>
			</div>
			
			<div class="flex gap-2 justify-end mt-6">
				<button 
					class="btn variant-ghost-surface" 
					onclick={() => (showReopenResearchModal = false)}
					disabled={isReopeningResearch}
				>
					Cancel
				</button>
				<button 
					class="btn variant-filled-warning" 
					onclick={confirmReopenResearch}
					disabled={isReopeningResearch || !reopenReason.trim()}
				>
					{isReopeningResearch ? 'Reopening...' : 'Confirm Reopen'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	
	.modal {
		max-height: 90vh;
		overflow-y: auto;
		background-color: white !important;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
	}
	
	:global(.dark) .modal {
		background-color: #1a1a1a !important;
	}
</style>
