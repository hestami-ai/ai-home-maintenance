/**
 * File Serving Proxy Endpoint
 * 
 * Proxies file requests to LibreChat to serve uploaded images and files.
 * This is needed because LibreChat files are stored internally and need
 * authentication to access.
 * 
 * Route: /api/chat/files/serve/images/... or /api/chat/files/serve/uploads/...
 */
import { error, type RequestEvent } from '@sveltejs/kit';
import { checkAuthentication } from '$lib/server/auth';
import { librechatRequest } from '$lib/server/librechat';

export const GET = async ({ params, cookies, url }: RequestEvent) => {
  try {
    // Check authentication
    const sessionId = checkAuthentication(cookies, url.pathname);
    
    // Get the file path from the catch-all parameter
    const filePath = params.path;
    
    if (!filePath) {
      throw error(400, 'No file path provided');
    }
    
    // Construct the LibreChat file URL
    // The path will be like "images/userId/filename.jpg" or "uploads/userId/filename.pdf"
    const librechatPath = `/${filePath}`;
    
    console.log(`[chat/files/serve] Proxying file request: ${librechatPath}`);
    
    // Request the file from LibreChat
    const response = await librechatRequest(
      sessionId,
      librechatPath,
      {
        method: 'GET'
      }
    );
    
    if (!response.ok) {
      console.error(`[chat/files/serve] LibreChat returned ${response.status}`);
      throw error(response.status, 'Failed to fetch file');
    }
    
    // Get the content type from LibreChat's response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Stream the response body
    const body = await response.arrayBuffer();
    
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      }
    });
    
  } catch (err) {
    console.error('[chat/files/serve] Error:', err);
    
    // Re-throw SvelteKit errors
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    
    throw error(500, `Failed to serve file: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};
