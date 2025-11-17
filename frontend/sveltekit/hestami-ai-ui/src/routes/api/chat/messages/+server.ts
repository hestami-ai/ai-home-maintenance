/**
 * Chat Messages API Endpoint
 * 
 * Proxies requests to LibreChat's messages API
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkAuthentication, getUserData } from '$lib/server/auth';
import { librechatRequest } from '$lib/server/librechat';

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    // Check authentication
    const sessionId = checkAuthentication(cookies, url.pathname);
    
    // Get user data
    const userData = await getUserData(sessionId);
    
    if (!userData) {
      throw error(401, 'User not found');
    }
    
    // Get conversationId from query params
    const conversationId = url.searchParams.get('conversationId');
    
    if (!conversationId) {
      throw error(400, 'conversationId is required');
    }
    
    // Fetch messages from LibreChat
    const response = await librechatRequest(
      sessionId,
      `/api/messages/${conversationId}`,
      { method: 'GET' },
      userData.email
    );
    
    if (!response.ok) {
      throw error(response.status, 'Failed to fetch messages from LibreChat');
    }
    
    const messages = await response.json();
    
    return json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    throw err;
  }
};
