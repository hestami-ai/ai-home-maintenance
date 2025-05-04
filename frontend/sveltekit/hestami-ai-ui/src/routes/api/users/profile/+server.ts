import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Django API base URL
const API_BASE_URL = 'http://localhost:8050';

/**
 * Specific handler for the user profile endpoint
 * This proxy forwards profile requests from the SvelteKit frontend to the Django backend
 * to avoid CORS issues with direct browser-to-Django API calls
 */
export const GET: RequestHandler = async ({ request, cookies }) => {
    try {
        console.log('Profile endpoint called directly');
        
        // Prepare headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        
        // Forward authorization header if present
        if (request.headers.has('Authorization')) {
            headers['Authorization'] = request.headers.get('Authorization') || '';
        }
        
        // Forward the request to the Django backend
        const response = await fetch(`${API_BASE_URL}/api/users/profile/`, {
            method: 'GET',
            headers,
            credentials: 'include'
        });
        
        console.log('Profile response status:', response.status);
        
        // Handle cookies from the response
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
            // Parse cookies properly
            setCookieHeader.split(',').forEach(cookieStr => {
                // Extract the cookie name and value
                const cookieParts = cookieStr.split(';');
                const nameValuePair = cookieParts[0].split('=');
                
                if (nameValuePair.length >= 2) {
                    const cookieName = nameValuePair[0].trim();
                    const cookieValue = nameValuePair[1].trim();
                    
                    // Only set cookies with valid names (no spaces or special chars)
                    if (cookieName && /^[\w\-\.]+$/.test(cookieName)) {
                        cookies.set(cookieName, cookieValue, {
                            path: '/',
                            httpOnly: true,
                            secure: false, // Set to true in production
                            sameSite: 'strict'
                        });
                    } else {
                        console.warn(`Skipping invalid cookie name: ${cookieName}`);
                    }
                }
            });
        }
        
        // Get response data
        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = {};
        }
        
        return json(data, { status: response.status });
    } catch (error) {
        console.error('Profile API proxy error:', error);
        return json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }
};
