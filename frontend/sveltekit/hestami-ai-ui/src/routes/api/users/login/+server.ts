import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSession } from '$lib/server/auth';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

// Django API base URL
const API_BASE_URL = env.SVELTE_KIT_DJANGO_API_BASE_URL || 'http://localhost:8050';

/**
 * Login endpoint with server-side session management
 * This proxy forwards login requests to Django and creates a server-side session
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
    try {
        console.log('Login endpoint called');
        
        // Get credentials from request
        const credentials = await request.json();
        
        // Forward the request to the Django backend
        const response = await fetch(`${API_BASE_URL}/api/users/login/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });
        
        console.log('Login response status:', response.status);
        
        // Get response data
        const data = await response.json();
        
        // If login was successful, create server-side session
        if (response.ok && data.access && data.refresh && data.user) {
            // Create session in Redis
            await createSession(
                cookies,
                {
                    id: data.user.id,
                    email: data.user.email,
                    first_name: data.user.first_name,
                    last_name: data.user.last_name,
                    user_role: data.user.user_role,
                    phone_number: data.user.phone_number
                },
                {
                    accessToken: data.access,
                    refreshToken: data.refresh
                }
            );
            
            // Return success with minimal user data
            return json({
                success: true,
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    first_name: data.user.first_name,
                    last_name: data.user.last_name,
                    user_role: data.user.user_role
                }
            });
        }
        
        // Return error response from Django
        return json(data, { status: response.status });
    } catch (error) {
        console.error('Login API proxy error:', error);
        return json({ error: 'Failed to process login request' }, { status: 500 });
    }
};
