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
    // Set default headers if not provided
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
    }

    // Parse and return JSON response
    const data = await response.json();
    return data as T;
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
  return fetchWithAuth<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
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
