/**
 * Centralized API utility for server-side communication with Django backend
 * This module provides standardized functions for making API requests to the Django backend
 * with proper authentication handling, error handling, and type safety.
 */
import type { Cookies } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import * as auth from './auth';
import type { ApiResponse } from '$lib/types';

// API interfaces are imported from $lib/types

/**
 * Make a GET request to the Django API
 * @param cookies - SvelteKit cookies object
 * @param endpoint - API endpoint (without base URL)
 * @param options - Fetch options
 * @param returnUrl - URL to return to after login
 * @returns API response
 */
export async function apiGet<T = any>(
  cookies: Cookies,
  endpoint: string,
  options: RequestInit = {},
  returnUrl: string
): Promise<ApiResponse<T>> {
  try {
    // Check authentication
    const sessionId = auth.checkAuthentication(cookies, returnUrl);
    
    // Make API request
    const response = await auth.apiRequest(sessionId, endpoint, {
      ...options,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    
    // Handle error status codes
    if (!response.ok) {
      throw error(response.status, response.statusText || 'Failed to fetch data');
    }
    
    // Parse response
    const responseText = await response.text();
    let data: T;
    
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw error(500, 'Invalid response format from API');
    }
    
    // Return formatted response
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    };
  } catch (err) {
    return auth.handleApiError(err, returnUrl);
  }
}

/**
 * Make a POST request to the Django API
 * @param cookies - SvelteKit cookies object
 * @param endpoint - API endpoint (without base URL)
 * @param body - Request body
 * @param options - Fetch options
 * @param returnUrl - URL to return to after login
 * @returns API response
 */
export async function apiPost<T = any, U = any>(
  cookies: Cookies,
  endpoint: string,
  body: U,
  options: RequestInit = {},
  returnUrl: string
): Promise<ApiResponse<T>> {
  try {
    // Check authentication
    const sessionId = auth.checkAuthentication(cookies, returnUrl);
    
    // Make API request
    const response = await auth.apiRequest(sessionId, endpoint, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      body: JSON.stringify(body)
    });
    
    // Handle error status codes
    if (!response.ok) {
      throw error(response.status, response.statusText || 'Failed to submit data');
    }
    
    // Parse response
    const responseText = await response.text();
    let data: T;
    
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw error(500, 'Invalid response format from API');
    }
    
    // Return formatted response
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    };
  } catch (err) {
    return auth.handleApiError(err, returnUrl);
  }
}

/**
 * Make a PUT request to the Django API
 * @param cookies - SvelteKit cookies object
 * @param endpoint - API endpoint (without base URL)
 * @param body - Request body
 * @param options - Fetch options
 * @param returnUrl - URL to return to after login
 * @returns API response
 */
export async function apiPut<T = any, U = any>(
  cookies: Cookies,
  endpoint: string,
  body: U,
  options: RequestInit = {},
  returnUrl: string
): Promise<ApiResponse<T>> {
  try {
    // Check authentication
    const sessionId = auth.checkAuthentication(cookies, returnUrl);
    
    // Make API request
    const response = await auth.apiRequest(sessionId, endpoint, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      body: JSON.stringify(body)
    });
    
    // Handle error status codes
    if (!response.ok) {
      throw error(response.status, response.statusText || 'Failed to update data');
    }
    
    // Parse response
    const responseText = await response.text();
    let data: T;
    
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw error(500, 'Invalid response format from API');
    }
    
    // Return formatted response
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    };
  } catch (err) {
    return auth.handleApiError(err, returnUrl);
  }
}

/**
 * Make a DELETE request to the Django API
 * @param cookies - SvelteKit cookies object
 * @param endpoint - API endpoint (without base URL)
 * @param options - Fetch options
 * @param returnUrl - URL to return to after login
 * @returns API response
 */
export async function apiDelete<T = any>(
  cookies: Cookies,
  endpoint: string,
  options: RequestInit = {},
  returnUrl: string
): Promise<ApiResponse<T>> {
  try {
    // Check authentication
    const sessionId = auth.checkAuthentication(cookies, returnUrl);
    
    // Make API request
    const response = await auth.apiRequest(sessionId, endpoint, {
      ...options,
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    
    // Handle error status codes
    if (!response.ok) {
      throw error(response.status, response.statusText || 'Failed to delete data');
    }
    
    // Parse response
    const responseText = await response.text();
    let data: T;
    
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      throw error(500, 'Invalid response format from API');
    }
    
    // Return formatted response
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    };
  } catch (err) {
    return auth.handleApiError(err, returnUrl);
  }
}
