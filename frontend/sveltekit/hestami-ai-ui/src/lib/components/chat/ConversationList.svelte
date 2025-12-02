<script lang="ts">
  /**
   * Conversation List Component
   * 
   * Displays list of user's conversations with delete functionality
   */
  import { createEventDispatcher } from 'svelte';
  
  export let conversations: any[] = [];
  export let selectedId: string | null = null;
  
  const dispatch = createEventDispatcher();
  
  // Track which conversation is pending delete confirmation
  let pendingDeleteId: string | null = null;
  
  function selectConversation(conversationId: string) {
    // Don't select if we're in delete confirmation mode
    if (pendingDeleteId) return;
    dispatch('select', { conversationId });
  }
  
  function requestDelete(e: Event, conversationId: string) {
    e.stopPropagation();
    pendingDeleteId = conversationId;
  }
  
  function confirmDelete(e: Event) {
    e.stopPropagation();
    if (pendingDeleteId) {
      dispatch('delete', { conversationId: pendingDeleteId });
      pendingDeleteId = null;
    }
  }
  
  function cancelDelete(e: Event) {
    e.stopPropagation();
    pendingDeleteId = null;
  }
  
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }
  
  function truncateTitle(title: string, maxLength: number = 50): string {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  }
</script>

<div class="conversation-list">
  {#if conversations.length === 0}
    <div class="p-4 text-center text-surface-500 text-sm">
      No conversations yet. Start a new chat!
    </div>
  {:else}
    {#each conversations as conversation}
      <div
        role="button"
        tabindex="0"
        on:click={() => selectConversation(conversation.conversationId)}
        on:keydown={(e) => e.key === 'Enter' && selectConversation(conversation.conversationId)}
        class="conversation-item group"
        class:selected={selectedId === conversation.conversationId}
        class:confirming={pendingDeleteId === conversation.conversationId}
      >
        {#if pendingDeleteId === conversation.conversationId}
          <!-- Delete confirmation inline -->
          <div class="flex items-center justify-between w-full">
            <span class="text-sm text-surface-600-300-token">Delete?</span>
            <div class="flex items-center space-x-2">
              <button
                on:click={confirmDelete}
                class="px-2 py-1 text-xs font-medium text-white bg-error-500 hover:bg-error-600 rounded transition-colors"
              >
                Yes
              </button>
              <button
                on:click={cancelDelete}
                class="px-2 py-1 text-xs font-medium text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 rounded transition-colors"
              >
                No
              </button>
            </div>
          </div>
        {:else}
          <!-- Normal conversation display -->
          <div class="flex items-start space-x-3 w-full">
            <div class="flex-shrink-0 mt-1">
              <svg class="h-5 w-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-surface-900-50-token truncate">
                {truncateTitle(conversation.title || 'New Chat')}
              </p>
              {#if conversation.updatedAt}
                <p class="text-xs text-surface-500-400-token">
                  {formatDate(conversation.updatedAt)}
                </p>
              {/if}
            </div>
            <!-- Delete button (visible on hover) -->
            <button
              on:click={(e) => requestDelete(e, conversation.conversationId)}
              class="delete-btn flex-shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-error-500/20 text-surface-400 hover:text-error-500 transition-all"
              title="Delete conversation"
              aria-label="Delete conversation"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .conversation-list {
    border-top: 1px solid rgb(var(--color-surface-300) / 0.5);
  }
  
  .conversation-item {
    width: 100%;
    text-align: left;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgb(var(--color-surface-300) / 0.3);
    transition: background-color 0.2s;
    background: none;
    border-left: 4px solid transparent;
    border-right: none;
    border-top: none;
    cursor: pointer;
  }
  
  .conversation-item:hover {
    background-color: rgb(var(--color-surface-200) / 0.5);
  }
  
  .conversation-item.selected {
    background-color: rgb(var(--color-primary-500) / 0.1);
    border-left-color: rgb(var(--color-primary-500));
  }
  
  :global(.dark) .conversation-item:hover {
    background-color: rgb(var(--color-surface-700) / 0.5);
  }
  
  :global(.dark) .conversation-item.selected {
    background-color: rgb(var(--color-primary-500) / 0.2);
  }
</style>
