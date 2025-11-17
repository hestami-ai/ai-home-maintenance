/**
 * Catch-all proxy for LibreChat API
 * 
 * This route proxies all requests to LibreChat API while handling authentication
 * translation between Django JWT and LibreChat session cookies.
 * 
 * Routes:
 * - GET/POST /api/chat/conversations
 * - GET/POST /api/chat/messages
 * - POST /api/chat/files/images
 * - POST /api/chat/agents/chat/*
 * - POST /api/chat/convos/update
 */
import { librechatRequest, ensureLibreChatSession } from '$lib/server/librechat';
import { checkAuthentication, getUserData, getAuthTokens } from '$lib/server/auth';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Handle GET requests to LibreChat API
 */
export const GET: RequestHandler = async ({ request, cookies, params }) => {
  try {
    // Check authentication
    const sessionId = checkAuthentication(cookies, request.url);
    
    // Ensure LibreChat session exists
    const userData = await getUserData(sessionId);
    const tokens = await getAuthTokens(sessionId);
    
    if (!userData || !tokens) {
      throw error(401, 'Session expired. Please log in again.');
    }
    
    await ensureLibreChatSession(sessionId, userData.email);
    
    // Get path from params
    const path = params.path || '';
    
    // Proxy request to LibreChat
    const response = await librechatRequest(
      sessionId,
      `/api/${path}`,
      {
        method: 'GET',
        headers: request.headers
      }
    );
    
    // Return response as-is (including status, headers, body)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (err) {
    console.error('Chat API GET error:', err);
    
    if (err instanceof Error && err.message === 'No LibreChat session available') {
      throw error(401, 'Chat session not available. Please log in again.');
    }
    
    throw error(500, 'Failed to fetch chat data');
  }
};

/**
 * Handle POST requests to LibreChat API
 */
export const POST: RequestHandler = async ({ request, cookies, params }) => {
  try {
    console.log('[Chat POST] Request received for path:', params.path);
    
    // Check authentication
    const sessionId = checkAuthentication(cookies, request.url);
    console.log('[Chat POST] Session ID:', sessionId);
    
    // Ensure LibreChat session exists
    const userData = await getUserData(sessionId);
    console.log('[Chat POST] User data:', userData ? userData.email : 'null');
    
    const tokens = await getAuthTokens(sessionId);
    console.log('[Chat POST] Tokens:', tokens ? 'present' : 'null');
    
    if (!userData || !tokens) {
      console.error('[Chat POST] Missing user data or tokens');
      throw error(401, 'Session expired. Please log in again.');
    }
    
    console.log('[Chat POST] Ensuring LibreChat session for:', userData.email);
    await ensureLibreChatSession(sessionId, userData.email);
    console.log('[Chat POST] LibreChat session ensured');
    
    // Get path from params
    const path = params.path || '';
    
    // Handle different content types
    const contentType = request.headers.get('content-type') || '';
    let body;
    
    if (contentType.includes('multipart/form-data')) {
      // File upload (FormData)
      body = await request.formData();
    } else if (contentType.includes('application/json')) {
      // JSON data
      const text = await request.text();
      console.log('[Chat POST] Request body (full):', text);
      body = text;
    } else {
      // Other types (e.g., text/plain)
      body = await request.text();
    }
    
    // Proxy request to LibreChat
    const response = await librechatRequest(
      sessionId,
      `/api/${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': contentType || 'application/json'
        },
        body: body instanceof FormData ? body : body
      },
      userData.email  // Pass email for re-authentication if session expired
    );
    
    // Check if this is an SSE stream response
    const responseContentType = response.headers.get('content-type') || '';
    console.log('[Chat POST] Response Content-Type:', responseContentType);
    console.log('[Chat POST] Response status:', response.status);
    
    // LibreChat agents endpoint returns SSE but may not set Content-Type header
    // For agents/chat endpoints, always process as SSE stream
    if (path.includes('agents/chat') || responseContentType.includes('text/event-stream')) {
      console.log('[Chat POST] Processing SSE stream');
      
      // Read the entire SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData: any = null;
      let buffer = '';
      
      if (reader) {
        try {
          let chunkCount = 0;
          let eventCount = 0;
          while (true) {
            const { done, value } = await reader.read();
            chunkCount++;
            console.log(`[Chat POST] Read chunk ${chunkCount}, done: ${done}, bytes: ${value?.length || 0}`);
            
            if (done) {
              console.log('[Chat POST] Stream ended, total chunks:', chunkCount, 'events:', eventCount);
              break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            console.log(`[Chat POST] Chunk ${chunkCount} content:`, chunk.substring(0, 200));
            buffer += chunk;
            const lines = buffer.split('\n');
            
            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                eventCount++;
                try {
                  const jsonStr = trimmed.slice(6);
                  const data = JSON.parse(jsonStr);
                  console.log(`[Chat POST] Event ${eventCount}, has final:`, !!data.final);
                  // Keep updating with latest data, the final event has "final: true"
                  if (data.final) {
                    finalData = data;
                    console.log('[Chat POST] Found final event!');
                  }
                } catch (e) {
                  // Skip invalid JSON
                  console.log('[Chat POST] Failed to parse SSE data:', e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
      
      console.log('[Chat POST] Stream complete, returning final response');
      console.log('[Chat POST] Final data:', finalData ? 'Present' : 'NULL');
      if (finalData) {
        console.log('[Chat POST] Final data keys:', Object.keys(finalData));
      }
      
      // Return the final accumulated response as JSON
      return new Response(JSON.stringify(finalData || { error: 'No response received' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // For non-streaming responses, return as-is
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (err) {
    console.error('[Chat POST] Error:', err);
    console.error('[Chat POST] Error stack:', err instanceof Error ? err.stack : 'N/A');
    
    if (err instanceof Error && err.message === 'No LibreChat session available') {
      throw error(401, 'Chat session not available. Please log in again.');
    }
    
    throw error(500, 'Failed to send chat data');
  }
};

/**
 * Handle PUT requests to LibreChat API
 */
export const PUT: RequestHandler = async ({ request, cookies, params }) => {
  try {
    // Check authentication
    const sessionId = checkAuthentication(cookies, request.url);
    
    // Ensure LibreChat session exists
    const userData = await getUserData(sessionId);
    const tokens = await getAuthTokens(sessionId);
    
    if (!userData || !tokens) {
      throw error(401, 'Session expired. Please log in again.');
    }
    
    await ensureLibreChatSession(sessionId, userData.email);
    
    // Get path from params
    const path = params.path || '';
    
    // Get request body
    const body = await request.text();
    
    // Proxy request to LibreChat
    const response = await librechatRequest(
      sessionId,
      `/api/${path}`,
      {
        method: 'PUT',
        headers: request.headers,
        body
      }
    );
    
    // Return response as-is
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (err) {
    console.error('Chat API PUT error:', err);
    
    if (err instanceof Error && err.message === 'No LibreChat session available') {
      throw error(401, 'Chat session not available. Please log in again.');
    }
    
    throw error(500, 'Failed to update chat data');
  }
};

/**
 * Handle DELETE requests to LibreChat API
 */
export const DELETE: RequestHandler = async ({ request, cookies, params }) => {
  try {
    // Check authentication
    const sessionId = checkAuthentication(cookies, request.url);
    
    // Ensure LibreChat session exists
    const userData = await getUserData(sessionId);
    const tokens = await getAuthTokens(sessionId);
    
    if (!userData || !tokens) {
      throw error(401, 'Session expired. Please log in again.');
    }
    
    await ensureLibreChatSession(sessionId, userData.email);
    
    // Get path from params
    const path = params.path || '';
    
    // Proxy request to LibreChat
    const response = await librechatRequest(
      sessionId,
      `/api/${path}`,
      {
        method: 'DELETE',
        headers: request.headers
      }
    );
    
    // Return response as-is
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  } catch (err) {
    console.error('Chat API DELETE error:', err);
    
    if (err instanceof Error && err.message === 'No LibreChat session available') {
      throw error(401, 'Chat session not available. Please log in again.');
    }
    
    throw error(500, 'Failed to delete chat data');
  }
};
