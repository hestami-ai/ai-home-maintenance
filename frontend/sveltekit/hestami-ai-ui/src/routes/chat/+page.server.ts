/**
 * Chat Page - Server-side data loading
 * 
 * Loads user's conversations and handles initial data fetching
 */
import { checkAuthentication, getUserData } from '$lib/server/auth';
import { librechatRequest } from '$lib/server/librechat';
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ cookies, url }) => {
  try {
    // Check authentication
    const sessionId = checkAuthentication(cookies, url.pathname);
    
    // Get user data
    const user = await getUserData(sessionId);
    
    if (!user) {
      throw error(401, 'User not found');
    }
    
    // Fetch conversations from LibreChat
    let conversations = [];
    let initialMessages = [];
    let selectedConversationId: string | null = null;
    
    try {
      const response = await librechatRequest(
        sessionId,
        '/api/convos',
        { method: 'GET' },
        user.email  // Pass email for re-authentication if needed
      );
      
      if (response.ok) {
        const result = await response.json();
        // LibreChat returns { conversations: [...], pageNumber, pages }
        conversations = result.conversations || result || [];
        
        console.log('[Chat page] Loaded conversations:', conversations.length);
        
        // If there are conversations, load the first one's messages
        if (conversations && conversations.length > 0) {
          selectedConversationId = conversations[0].conversationId;
          
          try {
            const messagesResponse = await librechatRequest(
              sessionId,
              `/api/messages/${selectedConversationId}`,
              { method: 'GET' },
              user.email
            );
            
            if (messagesResponse.ok) {
              const messagesData = await messagesResponse.json();
              // LibreChat returns messages array directly
              initialMessages = Array.isArray(messagesData) ? messagesData : (messagesData.messages || []);
              console.log('[Chat page] Loaded initial messages:', initialMessages.length);
            }
          } catch (err) {
            console.error('Error fetching initial messages:', err);
          }
        }
      } else {
        console.warn('Failed to fetch conversations:', response.status);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      // Don't fail the page load if conversations can't be fetched
    }
    
    return {
      user,
      conversations: conversations || [],
      initialMessages,
      selectedConversationId
    };
  } catch (err) {
    console.error('Chat page load error:', err);
    throw err;
  }
};
