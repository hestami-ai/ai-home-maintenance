<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { X, AlertCircle, CheckCircle2 } from 'lucide-svelte';
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  
  export let open = false;
  
  const dispatch = createEventDispatcher();
  
  let formData = {
    source_url: '',
    raw_html: '',
    raw_text: '',
    notes: ''
  };
  
  let loading = false;
  let error: string | null = null;
  let success = false;
  
  async function handleSubmit() {
    loading = true;
    error = null;
    success = false;
    
    try {
      const response = await fetch('/api/services/providers/add-to-roster/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add provider');
      }
      
      const data = await response.json();
      success = true;
      
      // Reset form
      formData = {
        source_url: '',
        raw_html: '',
        raw_text: '',
        notes: ''
      };
      
      // Dispatch success event
      dispatch('success', { id: data.id });
      
      // Close modal after 2 seconds
      setTimeout(() => {
        open = false;
        success = false;
      }, 2000);
      
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      loading = false;
    }
  }
  
  function handleClose() {
    if (!loading) {
      open = false;
      error = null;
      success = false;
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal-backdrop backdrop-blur-sm bg-surface-backdrop-token" role="presentation" on:click={handleClose} on:keydown={(e) => e.key === 'Escape' && handleClose()}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal card variant-filled-surface p-0 w-full max-w-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" tabindex="-1" on:click|stopPropagation on:keydown|stopPropagation>
      <header class="card-header flex items-center justify-between">
        <div>
          <h2 class="h3">Add Provider to Roster</h2>
          <p class="text-sm text-surface-600-300-token mt-1">
            Add a service provider from an external source. The system will automatically extract and process the provider information.
          </p>
        </div>
        <button type="button" class="btn-icon variant-ghost-surface" on:click={handleClose} disabled={loading}>
          <X class="h-5 w-5" />
        </button>
      </header>
      
      <form on:submit|preventDefault={handleSubmit} class="p-6 space-y-4">
        <!-- Source URL -->
        <label class="label">
          <span class="font-semibold">Source URL *</span>
          <input
            type="url"
            class="input"
            placeholder="https://www.yelp.com/biz/acme-hvac"
            bind:value={formData.source_url}
            required
            disabled={loading}
          />
        </label>
        
        <!-- Rich Content -->
        <div class="space-y-2">
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <label class="label">
            <span class="font-semibold">Rich Content</span>
          </label>
          <div class="rich-editor-container">
            <RichTextEditor 
              bind:value={formData.raw_html} 
              placeholder="Paste formatted content from web page..."
            />
          </div>
          <p class="text-xs text-surface-600-300-token">Paste content with formatting preserved. Leave empty to fetch automatically from the URL.</p>
        </div>
        
        <!-- Raw Text -->
        <label class="label">
          <span class="font-semibold">Raw Text</span>
          <textarea
            class="textarea"
            placeholder="Paste plain text content here..."
            bind:value={formData.raw_text}
            rows="3"
            disabled={loading}
          ></textarea>
          <p class="text-xs text-surface-600-300-token mt-1">Plain text version of the provider information</p>
        </label>
        
        <!-- Notes -->
        <label class="label">
          <span class="font-semibold">Notes (Optional)</span>
          <textarea
            class="textarea"
            placeholder="Add any additional notes or context..."
            bind:value={formData.notes}
            rows="2"
            disabled={loading}
          ></textarea>
        </label>
        
        <!-- Error Alert -->
        {#if error}
          <aside class="alert variant-filled-error">
            <AlertCircle class="h-5 w-5" />
            <div class="alert-message">
              <p>{error}</p>
            </div>
          </aside>
        {/if}
        
        <!-- Success Alert -->
        {#if success}
          <aside class="alert variant-filled-success">
            <CheckCircle2 class="h-5 w-5" />
            <div class="alert-message">
              <p>Provider added successfully! Processing will begin shortly.</p>
            </div>
          </aside>
        {/if}
        
        <!-- Action Buttons -->
        <footer class="flex gap-3 justify-end pt-4">
          <button
            type="button"
            class="btn variant-ghost-surface"
            on:click={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn variant-filled-primary"
            disabled={loading || success}
          >
            {#if loading}
              <span class="animate-spin">⏳</span>
              <span>Adding...</span>
            {:else}
              <span>Add Provider</span>
            {/if}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 1rem;
  }
  
  .modal {
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  }
  
  .rich-editor-container {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid rgb(var(--color-surface-400));
    border-radius: 0.375rem;
  }
  
  .rich-editor-container :global(.ProseMirror) {
    min-height: 150px;
    max-height: 280px;
    overflow-y: auto;
  }
</style>
