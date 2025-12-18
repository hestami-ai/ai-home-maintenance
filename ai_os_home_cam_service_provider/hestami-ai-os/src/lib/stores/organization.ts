import { writable, derived } from 'svelte/store';

export interface Organization {
	id: string;
	name: string;
	slug: string;
	type: string;
	status: string;
}

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
