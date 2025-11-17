<script lang="ts">
  /**
   * Chat Page Component
   * 
   * Main chat interface with conversation list and message area
   */
  import ConversationList from '$lib/components/chat/ConversationList.svelte';
  import ChatMessages from '$lib/components/chat/ChatMessages.svelte';
  import ChatInput from '$lib/components/chat/ChatInput.svelte';
  import type { PageData } from './$types';
  
  export let data: PageData;
  
  // Initialize from SSR data
  let selectedConversationId: string | null = data.selectedConversationId || null;
  let conversations: any[] = data.conversations || [];
  let messages: any[] = data.initialMessages || [];
  let isLoading = false;
  let error: string | null = null;
  
  /**
   * Select a conversation and load its messages
   */
  async function selectConversation(conversationId: string) {
    selectedConversationId = conversationId;
    isLoading = true;
    error = null;
    
    try {
      const response = await fetch(`/api/chat/messages?conversationId=${conversationId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load messages');
      }
      
      const data = await response.json();
      // LibreChat returns messages array directly
      messages = Array.isArray(data) ? data : (data.messages || []);
      console.log('[selectConversation] Loaded messages:', messages.length);
    } catch (err) {
      console.error('Error loading messages:', err);
      error = 'Failed to load messages. Please try again.';
      messages = [];
    } finally {
      isLoading = false;
    }
  }
  
  /**
   * Create a new conversation
   */
  async function createNewConversation() {
    selectedConversationId = null;
    messages = [];
    error = null;
  }
  
  /**
   * Send a message
   */
  async function handleSendMessage(event: CustomEvent<{ text: string }>) {
    const { text } = event.detail;
    
    if (!text.trim()) return;
    
    isLoading = true;
    error = null;
    
    try {
      // Generate message IDs
      const messageId = crypto.randomUUID();
      const parentMessageId = '00000000-0000-0000-0000-000000000000'; // Root message
      
      const response = await fetch('/api/chat/agents/chat/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          sender: 'User',
          clientTimestamp: new Date().toISOString(),
          isCreatedByUser: true,
          parentMessageId,
          messageId,
          error: false,
          endpoint: 'google',
          model: 'gemini-2.0-flash-lite',
          agent_id: 'ephemeral',  // Required by LibreChat middleware
          conversationId: selectedConversationId,
          thinking: false,  // Disable thinking mode (not supported by gemini-2.0-flash-lite)
          clientOptions: {
            disableStreaming: true  // Disable streaming to avoid parse errors
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      // Handle JSON response (buffered from SSE stream)
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Add the user message and assistant response using LibreChat's format
      const requestMessage = data.requestMessage;
      const responseMessage = data.responseMessage;
      
      // Add the user message first (if provided)
      if (requestMessage) {
        messages = [...messages, requestMessage];
      }
      
      // Add the complete assistant response
      if (responseMessage) {
        messages = [...messages, responseMessage];
        
        // Update conversation ID and add to list if this was a new conversation
        if (data.conversation?.conversationId) {
          const newConversationId = data.conversation.conversationId;
          const conversationTitle = data.title || text.substring(0, 50);
          
          // Check if this is a new conversation
          if (!selectedConversationId) {
            selectedConversationId = newConversationId;
            
            // Add new conversation to the list
            conversations = [{
              conversationId: newConversationId,
              title: conversationTitle,
              updatedAt: new Date().toISOString(),
              endpoint: 'google'
            }, ...conversations];
          }
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      error = 'Failed to send message. Please try again.';
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Chat - Hestami AI</title>
</svelte:head>

<div class="flex h-full">
  <!-- Sidebar - Conversation List -->
  <div class="w-80 bg-surface-50-900-token border-r border-surface-300-600-token flex flex-col">
    <div class="p-4 border-b border-surface-300-600-token">
      <div class="flex items-center justify-between mb-4">
        <h1 class="h3">Chat</h1>
        <button
          on:click={createNewConversation}
          class="btn variant-filled-primary text-sm"
        >
          New Chat
        </button>
      </div>
      <p class="text-sm text-surface-600-300-token">
        Welcome, {data.user.first_name}!
      </p>
    </div>
    
    <div class="flex-1 overflow-y-auto">
      <ConversationList
        conversations={conversations}
        selectedId={selectedConversationId}
        on:select={(e) => selectConversation(e.detail.conversationId)}
      />
    </div>
  </div>
  
  <!-- Main Chat Area -->
  <div class="flex-1 flex flex-col">
    {#if error}
      <div class="alert variant-filled-error m-4">
        <div>
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="alert-message">
          <p>{error}</p>
        </div>
      </div>
    {/if}
    
    {#if !selectedConversationId && messages.length === 0}
      <!-- Empty State -->
      <div class="flex-1 flex items-center justify-center p-8">
        <div class="text-center max-w-md">
          <svg class="mx-auto h-16 w-16 text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 class="h2 mb-2">Start a New Conversation</h2>
          <p class="text-surface-600-300-token mb-6">
            Ask me anything about home maintenance, repairs, or improvements. I'm here to help!
          </p>
          <button
            on:click={createNewConversation}
            class="btn variant-filled-primary"
          >
            Start Chatting
          </button>
        </div>
      </div>
    {:else}
      <!-- Messages Area -->
      <div class="flex-1 overflow-y-auto">
        <ChatMessages {messages} {isLoading} />
      </div>
    {/if}
    
    <!-- Input Area -->
    <div class="border-t border-surface-300-600-token bg-surface-50-900-token p-4">
      <ChatInput
        on:send={handleSendMessage}
        disabled={isLoading}
      />
    </div>
  </div>
</div>
