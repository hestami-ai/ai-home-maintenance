/**
 * Chat File Upload API Endpoint
 * 
 * Handles file uploads for chat attachments:
 * 1. Receives file from client (web/iOS/Android)
 * 2. Forwards to Django for virus scan
 * 3. If clean, forwards to LibreChat file upload API
 * 4. Returns LibreChat's file_id to client
 */
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { checkAuthentication, getUserData, getAuthTokens } from '$lib/server/auth';
import { librechatRequest } from '$lib/server/librechat';
import { env } from '$env/dynamic/private';

const API_BASE_URL = env.DJANGO_API_URL || 'http://django-api:8000';

// Allowed file extensions (must match Django's ALLOWED_CHAT_EXTENSIONS)
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'md', 'pdf', 'docx', 'txt', 'doc', 'usdz'];

// Image extensions that should use LibreChat's /api/files/images endpoint
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];

export const POST = async ({ request, cookies, url }: RequestEvent) => {
  try {
    // Check authentication
    const sessionId = checkAuthentication(cookies, url.pathname);
    
    // Get user data
    const userData = await getUserData(sessionId);
    if (!userData) {
      throw error(401, 'User not found');
    }
    
    // Get auth tokens for Django API call
    const tokens = await getAuthTokens(sessionId);
    if (!tokens) {
      throw error(401, 'No auth tokens available');
    }
    
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      throw error(400, 'No file provided');
    }
    
    console.log(`[chat/files/upload] Received file: ${file.name}, size: ${file.size}, type: ${file.type}`);
    
    // Validate file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw error(400, `File type .${ext} is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }
    
    // Get optional metadata from form
    const endpoint = formData.get('endpoint') as string || 'google';
    const toolResource = formData.get('tool_resource') as string | null;
    const width = formData.get('width') as string | null;
    const height = formData.get('height') as string | null;
    
    // Step 1: Send file to Django for virus scan
    console.log(`[chat/files/upload] Sending file to Django for virus scan...`);
    
    const scanFormData = new FormData();
    scanFormData.append('file', file);
    
    const scanResponse = await fetch(`${API_BASE_URL}/api/media/scan/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`
      },
      body: scanFormData
    });
    
    const scanResult = await scanResponse.json();
    console.log(`[chat/files/upload] Scan result:`, scanResult);
    
    if (!scanResponse.ok || !scanResult.is_clean) {
      const errorMessage = scanResult.message || scanResult.error || 'File failed virus scan';
      console.error(`[chat/files/upload] Virus scan failed: ${errorMessage}`);
      throw error(400, errorMessage);
    }
    
    console.log(`[chat/files/upload] File passed virus scan, forwarding to LibreChat...`);
    
    // Step 2: Forward file to LibreChat
    // Determine which LibreChat endpoint to use based on file type
    const isImage = IMAGE_EXTENSIONS.includes(ext);
    const librechatEndpoint = isImage ? '/api/files/images' : '/api/files';
    
    // Prepare FormData for LibreChat
    const librechatFormData = new FormData();
    librechatFormData.append('file', file);
    
    // For non-image files (PDFs, docs, etc.), we need to:
    // 1. Use endpoint='agents' to trigger processAgentFileUpload in LibreChat
    // 2. Use tool_resource='context' to enable text extraction
    // This enables LibreChat's "Upload as Text" feature which extracts text content from documents
    const needsTextExtraction = !isImage;
    const effectiveEndpoint = needsTextExtraction ? 'agents' : endpoint;
    librechatFormData.append('endpoint', effectiveEndpoint);
    
    // Mark as message file attachment (required for LibreChat to process correctly)
    librechatFormData.append('message_file', 'true');
    
    // Set tool_resource for text extraction
    const effectiveToolResource = toolResource || (needsTextExtraction ? 'context' : null);
    if (effectiveToolResource) {
      librechatFormData.append('tool_resource', effectiveToolResource);
      console.log(`[chat/files/upload] Using endpoint: ${effectiveEndpoint}, tool_resource: ${effectiveToolResource}`);
    }
    
    // Add image dimensions if provided (required by LibreChat for images)
    if (width) {
      librechatFormData.append('width', width);
    }
    if (height) {
      librechatFormData.append('height', height);
    }
    
    // Generate a temporary file_id (LibreChat expects this)
    const tempFileId = crypto.randomUUID();
    librechatFormData.append('file_id', tempFileId);
    
    const librechatResponse = await librechatRequest(
      sessionId,
      librechatEndpoint,
      {
        method: 'POST',
        body: librechatFormData
      },
      userData.email
    );
    
    if (!librechatResponse.ok) {
      const errorText = await librechatResponse.text();
      console.error(`[chat/files/upload] LibreChat upload failed: ${librechatResponse.status} - ${errorText}`);
      throw error(librechatResponse.status, `Failed to upload file to chat service: ${errorText}`);
    }
    
    const librechatResult = await librechatResponse.json();
    console.log(`[chat/files/upload] LibreChat upload successful:`, JSON.stringify(librechatResult, null, 2));
    console.log(`[chat/files/upload] Response keys:`, Object.keys(librechatResult));
    
    // Return the LibreChat file info to the client
    return json({
      success: true,
      file_id: librechatResult.file_id,
      _id: librechatResult._id,
      filename: librechatResult.filename || file.name,
      filepath: librechatResult.filepath,
      type: librechatResult.type || file.type,
      size: librechatResult.size || file.size,
      width: librechatResult.width,
      height: librechatResult.height,
      // Include any other relevant fields from LibreChat response
      ...librechatResult
    });
    
  } catch (err) {
    console.error('[chat/files/upload] Error:', err);
    
    // Re-throw SvelteKit errors
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    
    throw error(500, `Failed to upload file: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};
