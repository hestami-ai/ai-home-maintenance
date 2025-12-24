import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface AuthUser {
	id: string;
	email: string;
	name: string | null;
	emailVerified: boolean;
	image: string | null;
}

export interface AuthSession {
	user: AuthUser | null;
	isAuthenticated: boolean;
	isLoading: boolean;
}

const initialState: AuthSession = {
	user: null,
	isAuthenticated: false,
	isLoading: true
};

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthSession>(initialState);

	return {
		subscribe,
		setUser: (user: AuthUser | null) => {
			set({
				user,
				isAuthenticated: !!user,
				isLoading: false
			});
		},
		setLoading: (isLoading: boolean) => {
			update((state) => ({ ...state, isLoading }));
		},
		clear: () => {
			set({
				user: null,
				isAuthenticated: false,
				isLoading: false
			});
		},
		init: () => {
			// Initial loading state
			set({ ...initialState, isLoading: true });
		}
	};
}

export const auth = createAuthStore();

export const isAuthenticated = derived(auth, ($auth) => $auth.isAuthenticated);
export const currentUser = derived(auth, ($auth) => $auth.user);
export const isAuthLoading = derived(auth, ($auth) => $auth.isLoading);
