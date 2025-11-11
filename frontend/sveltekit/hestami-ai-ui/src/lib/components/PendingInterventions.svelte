<script lang="ts">
  import { onMount } from 'svelte';
  import { ExternalLink, CheckCircle, AlertCircle, Plus, Loader2 } from 'lucide-svelte';
  import { apiGet, apiPost } from '$lib/client/api';
  
  interface CandidateProvider {
    id: string;
    business_name: string;
    phone?: string;
    website?: string;
  }
  
  interface ScrapedBusinessInfo {
    name: string;
    phone: string;
    website: string;
    description: string;
  }
  
  interface PendingIntervention {
    id: string;
    source_name: string;
    source_url: string;
    last_scraped_at: string;
    intervention_reason: string;
    scraped_business_info: ScrapedBusinessInfo;
    candidate_providers: CandidateProvider[];
    match_scores: Record<string, number>;
  }
  
  interface InterventionsResponse {
    count: number;
    results: PendingIntervention[];
  }
  
  let interventions: PendingIntervention[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedIntervention: PendingIntervention | null = null;
  let selectedAction: 'link' | 'create' = 'create';
  let selectedProviderId: string | null = null;
  let resolving = false;
  
  onMount(() => {
    fetchInterventions();
  });
  
  async function fetchInterventions() {
    loading = true;
    error = null;
    
    try {
      const data = await apiGet<InterventionsResponse>('/api/interventions');
      interventions = data.results;
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      loading = false;
    }
  }
  
  async function handleResolve() {
    if (!selectedIntervention) return;
    if (selectedAction === 'link' && !selectedProviderId) {
      error = 'Please select a provider to link';
      return;
    }
    
    resolving = true;
    error = null;
    try {
      await apiPost(
        `/api/interventions/${selectedIntervention.id}/resolve`,
        {
          action: selectedAction,
          provider_id: selectedProviderId,
        }
      );
      
      // Refresh the list
      await fetchInterventions();
      closeModal();
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      resolving = false;
    }
  }
  
  function openModal(intervention: PendingIntervention) {
    selectedIntervention = intervention;
    // Default to linking if there are candidates, otherwise create
    if (intervention.candidate_providers.length > 0) {
      selectedAction = 'link';
      selectedProviderId = intervention.candidate_providers[0].id;
    } else {
      selectedAction = 'create';
      selectedProviderId = null;
    }
  }
  
  function closeModal() {
    selectedIntervention = null;
    selectedAction = 'create';
    selectedProviderId = null;
  }
  
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }
</script>

<div class="space-y-4">
  {#if loading}
    <div class="flex justify-center items-center py-12">
      <Loader2 class="w-12 h-12 animate-spin text-primary-500" />
    </div>
  {:else if error}
    <aside class="alert variant-filled-error">
      <AlertCircle class="w-5 h-5" />
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
    </aside>
  {:else if interventions.length === 0}
    <div class="flex flex-col items-center justify-center py-12 text-surface-500">
      <CheckCircle class="w-16 h-16 mb-4" />
      <p class="text-lg font-medium">No pending interventions</p>
      <p class="text-sm">All provider data has been processed</p>
    </div>
  {:else}
    {#each interventions as intervention (intervention.id)}
      <div class="card variant-ghost">
        <header class="card-header flex justify-between items-start">
          <div class="space-y-1">
            <h3 class="h3">{intervention.source_name}</h3>
            <div class="flex items-center gap-2 text-sm text-surface-600-300-token">
              <a 
                href={intervention.source_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                class="anchor flex items-center gap-1"
              >
                View Source
                <ExternalLink class="w-3 h-3" />
              </a>
              <span>•</span>
              <span>{formatDate(intervention.last_scraped_at)}</span>
            </div>
          </div>
          <span class="badge variant-soft-warning">Needs Review</span>
        </header>
        
        <section class="p-4 space-y-4">
          <div>
            <p class="font-semibold text-sm mb-1">Reason:</p>
            <p class="text-sm text-surface-600-300-token">{intervention.intervention_reason}</p>
          </div>
          
          {#if intervention.scraped_business_info.name}
            <div class="card variant-filled-warning p-3">
              <p class="font-semibold text-sm mb-2">Scraped Business Data:</p>
              <div class="space-y-1">
                <p class="font-medium">{intervention.scraped_business_info.name}</p>
                {#if intervention.scraped_business_info.phone || intervention.scraped_business_info.website}
                  <p class="text-sm">
                    {#if intervention.scraped_business_info.phone}{intervention.scraped_business_info.phone}{/if}
                    {#if intervention.scraped_business_info.phone && intervention.scraped_business_info.website} • {/if}
                    {#if intervention.scraped_business_info.website}{intervention.scraped_business_info.website}{/if}
                  </p>
                {/if}
                {#if intervention.scraped_business_info.description}
                  <p class="text-sm opacity-75 line-clamp-2">{intervention.scraped_business_info.description}</p>
                {/if}
              </div>
            </div>
          {/if}
          
          {#if intervention.candidate_providers.length > 0}
            <div>
              <p class="font-semibold text-sm mb-2">Potential Matches ({intervention.candidate_providers.length}):</p>
              <div class="space-y-2">
                {#each intervention.candidate_providers as provider (provider.id)}
                  <div class="card variant-soft p-3 flex justify-between items-center">
                    <div>
                      <p class="font-medium">{provider.business_name}</p>
                      <p class="text-sm text-surface-600-300-token">
                        {#if provider.phone}{provider.phone}{/if}
                        {#if provider.phone && provider.website} • {/if}
                        {#if provider.website}{provider.website}{/if}
                      </p>
                    </div>
                    <span class="badge variant-filled-primary">
                      {Math.round(intervention.match_scores[provider.id] || 0)}%
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          
          <button
            class="btn variant-filled-primary w-full"
            on:click={() => openModal(intervention)}
          >
            Resolve Intervention
          </button>
        </section>
      </div>
    {/each}
  {/if}
</div>

<!-- Resolution Modal -->
{#if selectedIntervention}
  <div class="modal-backdrop" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="presentation">
    <div class="modal bg-surface-100-800-token w-modal shadow-xl space-y-4" on:click|stopPropagation on:keydown|stopPropagation role="dialog" aria-modal="true" tabindex="-1">
      <header class="modal-header">
        <h2 class="h2">Resolve Intervention</h2>
        <p class="text-surface-600-300-token">Choose how to handle this provider data</p>
      </header>
      
      <article class="modal-body space-y-4 max-h-[60vh] overflow-y-auto">
        {#if selectedIntervention.scraped_business_info.name}
          <div class="card variant-filled-warning p-4">
            <p class="font-semibold mb-2">Scraped Business Data:</p>
            <div class="space-y-1">
              <p class="font-medium text-lg">{selectedIntervention.scraped_business_info.name}</p>
              {#if selectedIntervention.scraped_business_info.phone || selectedIntervention.scraped_business_info.website}
                <p class="text-sm">
                  {#if selectedIntervention.scraped_business_info.phone}{selectedIntervention.scraped_business_info.phone}{/if}
                  {#if selectedIntervention.scraped_business_info.phone && selectedIntervention.scraped_business_info.website} • {/if}
                  {#if selectedIntervention.scraped_business_info.website}{selectedIntervention.scraped_business_info.website}{/if}
                </p>
              {/if}
              {#if selectedIntervention.scraped_business_info.description}
                <p class="text-sm opacity-75">{selectedIntervention.scraped_business_info.description}</p>
              {/if}
            </div>
          </div>
        {/if}
        
        {#if selectedIntervention.candidate_providers.length > 0}
          <div class="space-y-3">
            <label class="flex items-center space-x-3 card variant-soft p-4 cursor-pointer hover:variant-filled-surface">
              <input 
                type="radio" 
                name="action" 
                value="link" 
                bind:group={selectedAction}
                class="radio"
              />
              <div class="flex-1">
                <p class="font-semibold">Link to Existing Provider</p>
                <p class="text-sm text-surface-600-300-token">Select a matching provider below</p>
              </div>
            </label>
            
            {#if selectedAction === 'link'}
              <div class="pl-8 space-y-2">
                {#each selectedIntervention.candidate_providers as provider (provider.id)}
                  <label class="flex items-center space-x-3 card variant-ghost p-3 cursor-pointer hover:variant-soft">
                    <input 
                      type="radio" 
                      name="provider" 
                      value={provider.id} 
                      bind:group={selectedProviderId}
                      class="radio"
                    />
                    <div class="flex-1">
                      <p class="font-medium">{provider.business_name}</p>
                      <p class="text-sm text-surface-600-300-token">
                        {#if provider.phone}{provider.phone}{/if}
                        {#if provider.phone && provider.website} • {/if}
                        {#if provider.website}{provider.website}{/if}
                      </p>
                    </div>
                    <span class="badge variant-filled-primary">
                      {Math.round(selectedIntervention.match_scores[provider.id] || 0)}%
                    </span>
                  </label>
                {/each}
              </div>
            {/if}
          </div>
          
          <hr class="!border-t-2" />
        {/if}
        
        <label class="flex items-center space-x-3 card variant-soft p-4 cursor-pointer hover:variant-filled-surface">
          <input 
            type="radio" 
            name="action" 
            value="create" 
            bind:group={selectedAction}
            class="radio"
          />
          <div class="flex-1">
            <p class="font-semibold flex items-center gap-2">
              <Plus class="w-4 h-4" />
              Create New Provider
            </p>
            <p class="text-sm text-surface-600-300-token">Add this as a new provider to the roster</p>
          </div>
        </label>
      </article>
      
      <footer class="modal-footer flex justify-end gap-2">
        <button 
          class="btn variant-ghost"
          on:click={closeModal}
          disabled={resolving}
        >
          Cancel
        </button>
        <button
          class="btn variant-filled-primary"
          on:click={handleResolve}
          disabled={resolving || (selectedAction === 'link' && !selectedProviderId)}
        >
          {#if resolving}
            <Loader2 class="w-4 h-4 animate-spin" />
            Processing...
          {:else}
            Confirm & Resume Workflow
          {/if}
        </button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 1rem;
  }
</style>
