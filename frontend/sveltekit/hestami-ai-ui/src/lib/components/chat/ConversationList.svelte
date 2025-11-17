<script lang="ts">
  /**
   * Conversation List Component
   * 
   * Displays list of user's conversations
   */
  import { createEventDispatcher } from 'svelte';
  
  export let conversations: any[] = [];
  export let selectedId: string | null = null;
  
  const dispatch = createEventDispatcher();
  
  function selectConversation(conversationId: string) {
    dispatch('select', { conversationId });
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
      <button
        on:click={() => selectConversation(conversation.conversationId)}
        class="conversation-item"
        class:selected={selectedId === conversation.conversationId}
      >
        <div class="flex items-start space-x-3">
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
        </div>
      </button>
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
