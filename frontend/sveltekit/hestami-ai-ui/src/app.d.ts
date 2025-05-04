// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// Define user type from Django backend
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_role: string;
  phone_number?: string;
}

// Define authentication session type
interface AuthSession {
  // For cookie-based auth
  accessToken?: string;
  refreshToken?: string;
  // For server-side session auth
  sessionId?: string;
  // User data
  user?: User;
}

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			auth: AuthSession | null;
		}
		interface PageData {
			user?: User;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
