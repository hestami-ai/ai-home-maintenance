/**
 * Client-side API utilities for making authenticated requests
 */

/**
 * Make an authenticated fetch request with proper error handling
 * @param endpoint - API endpoint (with leading slash)
 * @param options - Fetch options
 * @returns Promise with response data
 */
export async function fetchWithAuth<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    // Create a proper Headers object
    const headers = new Headers(options.headers);
    
    // Only set Content-Type to application/json if:
    // 1. It's not already set in options.headers
    // 2. The body is not FormData (browser will set the correct Content-Type with boundary)
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    // Make the request
    const response = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include', // Important: Include cookies with the request
    });

    // Handle HTTP errors
    if (!response.ok) {
      // Handle authentication errors specifically
      if (response.status === 401 || response.status === 403) {
        // Redirect to login page
        window.location.href = `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`;
        throw new Error('Authentication failed. Redirecting to login page...');
      }

      // Handle other errors
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = {};
      }
      throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
    }

    // Parse and return JSON response
    try {
      const data = await response.json();
      return data as T;
    } catch (e) {
      // Some responses might not be JSON (like 204 No Content)
      return {} as T;
    }
  } catch (error) {
    // Re-throw the error for component-level handling
    throw error;
  }
}

/**
 * Make a GET request with authentication
 * @param endpoint - API endpoint (with leading slash)
 * @param options - Additional fetch options
 * @returns Promise with response data
 */
export function apiGet<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return fetchWithAuth<T>(endpoint, {
    method: 'GET',
    ...options,
  });
}

/**
 * Make a POST request with authentication
 * @param endpoint - API endpoint (with leading slash)
 * @param data - Request body data
 * @param options - Additional fetch options
 * @returns Promise with response data
 */
export function apiPost<T = any, U = any>(
  endpoint: string,
  data: U,
  options: RequestInit = {}
): Promise<T> {
  // Don't stringify FormData objects
  const body = data instanceof FormData ? data : JSON.stringify(data);
  
  return fetchWithAuth<T>(endpoint, {
    method: 'POST',
    body,
    ...options,
  });
}

/**
 * Make a PUT request with authentication
 * @param endpoint - API endpoint (with leading slash)
 * @param data - Request body data
 * @param options - Additional fetch options
 * @returns Promise with response data
 */
export function apiPut<T = any, U = any>(
  endpoint: string,
  data: U,
  options: RequestInit = {}
): Promise<T> {
  return fetchWithAuth<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
    ...options,
  });
}

/**
 * Make a DELETE request with authentication
 * @param endpoint - API endpoint (with leading slash)
 * @param options - Additional fetch options
 * @returns Promise with response data
 */
export function apiDelete<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return fetchWithAuth<T>(endpoint, {
    method: 'DELETE',
    ...options,
  });
}
