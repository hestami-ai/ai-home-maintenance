import { writable, derived, get } from 'svelte/store';
import type { operations } from '$lib/api/types.generated';

// Extract Organization type from organization.create API response
// This ensures the store uses the same type shape as the API
export type Organization = operations['organization.create']['responses']['200']['content']['application/json']['data']['organization'];

export interface OrganizationMembership {
	organization: Organization;
	role: string;
	isDefault: boolean;
}

export interface OrganizationState {
	current: OrganizationMembership | null;
	memberships: OrganizationMembership[];
	isLoading: boolean;
}

const initialState: OrganizationState = {
	current: null,
	memberships: [],
	isLoading: true
};

function createOrganizationStore() {
	const { subscribe, set, update } = writable<OrganizationState>(initialState);

	return {
		subscribe,
		setMemberships: (memberships: OrganizationMembership[]) => {
			update((state) => {
				const defaultOrg = memberships.find((m) => m.isDefault) || memberships[0] || null;
				return {
					...state,
					memberships,
					current: defaultOrg,
					isLoading: false
				};
			});
		},
		setCurrent: (membership: OrganizationMembership | null) => {
			update((state) => ({
				...state,
				current: membership
			}));
		},
		setLoading: (isLoading: boolean) => {
			update((state) => ({ ...state, isLoading }));
		},
		clear: () => {
			set(initialState);
		},
		addMembership: (membership: OrganizationMembership) => {
			update((state) => ({
				...state,
				memberships: [...state.memberships, membership],
				current: membership.isDefault ? membership : state.current
			}));
		}
	};
}

export const organizationStore = createOrganizationStore();

export const currentOrganization = derived(organizationStore, ($org) => $org.current?.organization);
export const currentRole = derived(organizationStore, ($org) => $org.current?.role);
export const hasOrganizations = derived(organizationStore, ($org) => $org.memberships.length > 0);
export const isOrgLoading = derived(organizationStore, ($org) => $org.isLoading);

/**
 * Wait for the organization store to finish loading.
 * Use this before making API calls that require organization context.
 * 
 * @param timeoutMs - Maximum time to wait (default 10 seconds)
 * @returns Promise that resolves when organization is loaded, or rejects on timeout
 * 
 * @example
 * await waitForOrganization();
 * const result = await orpc.conciergeCase.getDetail({ id });
 */
export function waitForOrganization(timeoutMs = 10000): Promise<Organization | null> {
	return new Promise((resolve, reject) => {
		const state = get(organizationStore);

		// Already loaded
		if (!state.isLoading) {
			if (!state.current) {
				console.warn('[waitForOrganization] Resolved with no organization');
			}
			resolve(state.current?.organization ?? null);
			return;
		}

		const timeout = setTimeout(() => {
			unsubscribe();
			console.error('[waitForOrganization] Timeout waiting for organization');
			reject(new Error('Timeout waiting for organization to load'));
		}, timeoutMs);

		const unsubscribe = organizationStore.subscribe((state) => {
			if (!state.isLoading) {
				clearTimeout(timeout);
				unsubscribe();
				if (!state.current) {
					console.warn('[waitForOrganization] Resolved with no organization after subscription');
				}
				resolve(state.current?.organization ?? null);
			}
		});
	});
}
