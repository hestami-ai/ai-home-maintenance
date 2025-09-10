/**
 * User service for fetching user data
 */

/**
 * User interface
 */
export interface User {
    id: string;
    username: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
}

/**
 * Fetch users for @mention autocomplete
 * @param query Search query
 * @returns Promise with array of users matching the query
 */
export async function searchUsers(query: string): Promise<User[]> {
    try {
        const response = await fetch(`/api/users/search/?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.status}`);
        }
        
        const users = await response.json();
        return users.map((user: any) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            display_name: user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}`
                : user.username
        }));
    } catch (error) {
        console.error('Error searching users:', error);
        return [];
    }
}
