<script lang="ts">
  /**
   * Chat Input Component
   * 
   * Text input with send button and file upload support
   */
  import { createEventDispatcher } from 'svelte';
  
  export let disabled: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let inputText = '';
  let fileInput: HTMLInputElement;
  let uploadedFiles: File[] = [];
  
  function handleSubmit() {
    if (!inputText.trim() || disabled) return;
    
    dispatch('send', { text: inputText });
    inputText = '';
    uploadedFiles = [];
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  }
  
  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      uploadedFiles = Array.from(target.files);
    }
  }
  
  function removeFile(index: number) {
    uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
  }
  
  function triggerFileInput() {
    fileInput?.click();
  }
</script>

<div class="chat-input-container">
  {#if uploadedFiles.length > 0}
    <div class="uploaded-files mb-2 flex flex-wrap gap-2">
      {#each uploadedFiles as file, index}
        <div class="file-chip">
          <span class="file-name">{file.name}</span>
          <button
            type="button"
            on:click={() => removeFile(index)}
            class="remove-file"
            aria-label="Remove file"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
  
  <div class="input-wrapper">
    <input
      type="file"
      bind:this={fileInput}
      on:change={handleFileSelect}
      accept="image/*"
      multiple
      class="hidden"
    />
    
    <button
      type="button"
      on:click={triggerFileInput}
      {disabled}
      class="attach-button"
      aria-label="Attach image"
      title="Attach image"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    </button>
    
    <textarea
      bind:value={inputText}
      on:keydown={handleKeyDown}
      {disabled}
      placeholder="Type your message... (Shift+Enter for new line)"
      class="message-input"
      rows="1"
    ></textarea>
    
    <button
      type="button"
      on:click={handleSubmit}
      disabled={disabled || !inputText.trim()}
      class="send-button"
      aria-label="Send message"
    >
      {#if disabled}
        <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      {:else}
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      {/if}
    </button>
  </div>
</div>

<style>
  .chat-input-container {
    width: 100%;
  }
  
  .input-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    background-color: rgb(var(--color-surface-100));
    border-radius: 0.5rem;
    border: 1px solid rgb(var(--color-surface-300));
    padding: 0.5rem;
  }
  
  .input-wrapper:focus-within {
    border-color: rgb(var(--color-primary-500));
    outline: 2px solid transparent;
    outline-offset: 2px;
    box-shadow: 0 0 0 1px rgb(var(--color-primary-500));
  }
  
  :global(.dark) .input-wrapper {
    background-color: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
  }
  
  .attach-button {
    flex-shrink: 0;
    padding: 0.5rem;
    color: rgb(var(--color-surface-500));
    border-radius: 0.5rem;
    transition: all 0.2s;
  }
  
  .attach-button:hover:not(:disabled) {
    color: rgb(var(--color-surface-700));
    background-color: rgb(var(--color-surface-200));
  }
  
  .attach-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  :global(.dark) .attach-button:hover:not(:disabled) {
    color: rgb(var(--color-surface-300));
    background-color: rgb(var(--color-surface-700));
  }
  
  .message-input {
    flex: 1;
    resize: none;
    border: 0;
    background: transparent;
    font-size: 0.875rem;
    max-height: 8rem;
    overflow-y: auto;
    color: rgb(var(--color-surface-900));
  }
  
  :global(.dark) .message-input {
    color: rgb(var(--color-surface-100));
  }
  
  .message-input:focus {
    outline: none;
    box-shadow: none;
  }
  
  .message-input::placeholder {
    color: rgb(var(--color-surface-400));
  }
  
  :global(.dark) .message-input::placeholder {
    color: rgb(var(--color-surface-500));
  }
  
  .send-button {
    flex-shrink: 0;
    padding: 0.5rem;
    background-color: rgb(var(--color-primary-500));
    color: white;
    border-radius: 0.5rem;
    transition: background-color 0.2s;
  }
  
  .send-button:hover:not(:disabled) {
    background-color: rgb(var(--color-primary-600));
  }
  
  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background-color: rgb(var(--color-primary-500));
  }
  
  .uploaded-files {
    padding: 0.5rem;
    background-color: rgb(var(--color-surface-100));
    border-radius: 0.5rem;
  }
  
  :global(.dark) .uploaded-files {
    background-color: rgb(var(--color-surface-800));
  }
  
  .file-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background-color: rgb(var(--color-surface-50));
    border: 1px solid rgb(var(--color-surface-300));
    border-radius: 9999px;
    font-size: 0.875rem;
  }
  
  :global(.dark) .file-chip {
    background-color: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
  }
  
  .file-name {
    color: rgb(var(--color-surface-700));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 20rem;
  }
  
  :global(.dark) .file-name {
    color: rgb(var(--color-surface-300));
  }
  
  .remove-file {
    color: rgb(var(--color-surface-400));
    transition: color 0.2s;
  }
  
  .remove-file:hover {
    color: rgb(var(--color-error-500));
  }
</style>
