<script lang="ts">
  /**
   * Chat Messages Component
   * 
   * Displays conversation messages with user and assistant roles
   */
  import { marked } from 'marked';
  
  let { messages = [], isLoading = false }: { messages?: any[], isLoading?: boolean } = $props();
  
  // Configure marked for safe rendering
  marked.setOptions({
    breaks: true,  // Convert \n to <br>
    gfm: true      // GitHub Flavored Markdown
  });
  
  let messagesContainer: HTMLDivElement;
  
  // Auto-scroll to bottom when messages change (Svelte 5 rune)
  $effect(() => {
    // Track messages and isLoading to trigger scroll
    messages;
    isLoading;
    
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  });
  
  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  /**
   * Extract text content from LibreChat message format
   * LibreChat messages can have:
   * - text: string (simple text)
   * - content: array of { type: 'text', text: string } | { type: 'think', think: string } | { type: 'error', error: string }
   */
  function getMessageText(message: any): string {
    // If there's a direct text field, use it
    if (message.text) {
      return message.text;
    }
    
    // If there's a content array, extract text and errors from it
    if (Array.isArray(message.content)) {
      const parts: string[] = [];
      
      for (const item of message.content) {
        if (item.type === 'text' && item.text) {
          parts.push(item.text);
        } else if (item.type === 'error' && item.error) {
          parts.push(`⚠️ Error: ${item.error}`);
        }
      }
      
      return parts.join('\n\n');
    }
    
    return '';
  }
  
  /**
   * Get file attachments from LibreChat message format
   * LibreChat stores files in message.files array with filepath, filename, type, etc.
   */
  function getMessageFiles(message: any): Array<{ url: string; name: string; type: string }> {
    if (!message.files || !Array.isArray(message.files)) {
      return [];
    }
    
    return message.files.map((file: any) => {
      // LibreChat stores images with filepath like "/images/userId/filename.jpg"
      // We need to proxy these through our API or LibreChat directly
      let url = file.filepath || file.url || '';
      
      // If it's a relative path, make it absolute via LibreChat proxy
      if (url.startsWith('/images/') || url.startsWith('/uploads/')) {
        url = `/api/chat/files/serve${url}`;
      }
      
      return {
        url,
        name: file.filename || file.name || 'file',
        type: file.type || 'application/octet-stream'
      };
    });
  }
  
  /**
   * Check if file type is an image
   */
  function isImageType(type: string): boolean {
    return type?.startsWith('image/') || false;
  }
</script>

<div bind:this={messagesContainer} class="messages-container p-4 space-y-4">
  {#if messages.length === 0 && !isLoading}
    <div class="text-center text-gray-500 py-8">
      <p>No messages yet. Start the conversation!</p>
    </div>
  {/if}
  
  {#each messages as message}
    <div class="message" class:user={message.isCreatedByUser} class:assistant={!message.isCreatedByUser}>
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">
            {message.isCreatedByUser ? 'You' : (message.sender || 'Assistant')}
          </span>
          {#if message.createdAt}
            <span class="message-time">
              {formatTime(message.createdAt)}
            </span>
          {/if}
        </div>
        <!-- Display file attachments above the text for user messages -->
        {#if message.isCreatedByUser}
          {@const files = getMessageFiles(message)}
          {#if files.length > 0}
            <div class="message-files mb-2 flex flex-wrap gap-2">
              {#each files as file}
                <div class="file-attachment">
                  {#if isImageType(file.type)}
                    <button 
                      type="button"
                      class="block p-0 border-0 bg-transparent cursor-pointer"
                      onclick={() => window.open(file.url, '_blank')}
                      aria-label="View {file.name} full size"
                    >
                      <img 
                        src={file.url} 
                        alt={file.name} 
                        class="max-w-xs max-h-48 rounded-lg object-cover hover:opacity-90 transition-opacity"
                      />
                    </button>
                  {:else}
                    <a href={file.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 bg-black/10 dark:bg-white/10 rounded text-sm hover:bg-black/20 dark:hover:bg-white/20">
                      📎 {file.name}
                    </a>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
        
        <div class="message-text prose prose-sm dark:prose-invert max-w-none">
          {@html marked(getMessageText(message))}
        </div>
        
        <!-- Display file attachments below the text for assistant messages -->
        {#if !message.isCreatedByUser}
          {@const files = getMessageFiles(message)}
          {#if files.length > 0}
            <div class="message-files mt-2 flex flex-wrap gap-2">
              {#each files as file}
                <div class="file-attachment">
                  {#if isImageType(file.type)}
                    <button 
                      type="button"
                      class="block p-0 border-0 bg-transparent cursor-pointer"
                      onclick={() => window.open(file.url, '_blank')}
                      aria-label="View {file.name} full size"
                    >
                      <img 
                        src={file.url} 
                        alt={file.name} 
                        class="max-w-xs max-h-48 rounded-lg object-cover hover:opacity-90 transition-opacity"
                      />
                    </button>
                  {:else}
                    <a href={file.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-1 bg-black/10 dark:bg-white/10 rounded text-sm hover:bg-black/20 dark:hover:bg-white/20">
                      📎 {file.name}
                    </a>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/each}
  
  {#if isLoading}
    <div class="message assistant">
      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">Assistant</span>
        </div>
        <div class="message-text">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .messages-container {
    flex: 1;
    overflow-y: auto;
    max-height: calc(100vh - 200px);
  }
  
  .message {
    display: flex;
  }
  
  .message.user {
    justify-content: flex-end;
  }
  
  .message.assistant {
    justify-content: flex-start;
  }
  
  .message-content {
    max-width: 42rem;
    border-radius: 0.5rem;
    padding: 0.75rem 1rem;
  }
  
  .message.user .message-content {
    background-color: rgb(var(--color-primary-500));
    color: white;
  }
  
  .message.assistant .message-content {
    background-color: rgb(var(--color-surface-200));
    color: rgb(var(--color-surface-900));
  }
  
  :global(.dark) .message.assistant .message-content {
    background-color: rgb(var(--color-surface-700));
    color: rgb(var(--color-surface-50));
  }
  
  .message-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
    font-size: 0.75rem;
    opacity: 0.75;
  }
  
  .message-sender {
    font-weight: 500;
  }
  
  .message-time {
    margin-left: 0.5rem;
  }
  
  .message-text {
    font-size: 0.875rem;
  }
  
  /* Override prose styles for better chat appearance */
  .message-text :global(p) {
    margin-top: 0.5em;
    margin-bottom: 0.5em;
  }
  
  .message-text :global(p:first-child) {
    margin-top: 0;
  }
  
  .message-text :global(p:last-child) {
    margin-bottom: 0;
  }
  
  .message-text :global(code) {
    background-color: rgba(0, 0, 0, 0.1);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.85em;
  }
  
  :global(.dark) .message-text :global(code) {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .message-text :global(pre) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 0.75rem;
    border-radius: 0.375rem;
    overflow-x: auto;
  }
  
  :global(.dark) .message-text :global(pre) {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .typing-indicator {
    display: flex;
    gap: 0.25rem;
  }
  
  .typing-indicator span {
    width: 0.5rem;
    height: 0.5rem;
    background-color: #9ca3af;
    border-radius: 9999px;
    animation: bounce 1.4s infinite ease-in-out;
  }
  
  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
  
  .file-attachment {
    margin-top: 0.5rem;
  }
</style>
