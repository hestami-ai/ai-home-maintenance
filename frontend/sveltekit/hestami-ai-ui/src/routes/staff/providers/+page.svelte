<script lang="ts">
  import AddProviderModal from '$lib/components/AddProviderModal.svelte';
  import PendingInterventions from '$lib/components/PendingInterventions.svelte';
  import { AlertCircle, PlusCircle, Search } from 'lucide-svelte';
  
  let addModalOpen = false;
  
  function handleProviderAdded(event: CustomEvent<{ id: string }>) {
    console.log('Provider added:', event.detail.id);
    // Optionally show a toast notification
  }
</script>

<svelte:head>
  <title>Provider Management - Hestami AI</title>
</svelte:head>

<div class="container mx-auto p-4 space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="h1">Provider Management</h1>
      <p class="text-surface-600-300-token mt-1">
        Add and manage service providers in the roster
      </p>
    </div>
    <div class="flex gap-3">
      <a href="/staff/providers/search" class="btn variant-ghost-surface">
        <Search class="h-5 w-5" />
        <span>Search Providers</span>
      </a>
      <button class="btn variant-filled-primary" on:click={() => addModalOpen = true}>
        <PlusCircle class="h-5 w-5" />
        <span>Add Provider</span>
      </button>
    </div>
  </div>
  
  <!-- Main Content Card -->
  <div class="card">
    <header class="card-header flex items-center gap-3">
      <AlertCircle class="h-6 w-6 text-warning-500" />
      <div>
        <h2 class="h3">Pending Interventions</h2>
        <p class="text-sm text-surface-600-300-token">
          These providers need manual review to determine if they match existing records
        </p>
      </div>
    </header>
    <section class="p-4">
      <PendingInterventions />
    </section>
  </div>
</div>

<AddProviderModal bind:open={addModalOpen} on:success={handleProviderAdded} />
