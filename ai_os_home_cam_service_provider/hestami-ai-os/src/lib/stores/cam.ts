import { writable, derived, get } from 'svelte/store';
import { fetchBadgeCounts as apiFetchBadgeCounts } from '$lib/api/cam';

export interface Association {
	id: string;
	name: string;
	legalName?: string;
	status: string;
	fiscalYearEnd: number;
}

export interface BadgeCounts {
	violations: number;
	arcRequests: number;
	workOrders: number;
}

export interface CamState {
	currentAssociation: Association | null;
	associations: Association[];
	badgeCounts: BadgeCounts;
	isLoading: boolean;
	isSidebarCollapsed: boolean;
}

const initialState: CamState = {
	currentAssociation: null,
	associations: [],
	badgeCounts: {
		violations: 0,
		arcRequests: 0,
		workOrders: 0
	},
	isLoading: true,
	isSidebarCollapsed: false
};

function createCamStore() {
	const { subscribe, set, update } = writable<CamState>(initialState);

	return {
		subscribe,

		setAssociations: (associations: Association[]) => {
			update((state) => {
				const current = associations.length === 1 ? associations[0] : state.currentAssociation;
				return {
					...state,
					associations,
					currentAssociation: current,
					isLoading: false
				};
			});
		},

		setCurrentAssociation: (association: Association | null) => {
			update((state) => ({
				...state,
				currentAssociation: association
			}));
		},

		setBadgeCounts: (counts: Partial<BadgeCounts>) => {
			update((state) => ({
				...state,
				badgeCounts: {
					...state.badgeCounts,
					...counts
				}
			}));
		},

		setLoading: (isLoading: boolean) => {
			update((state) => ({ ...state, isLoading }));
		},

		toggleSidebar: () => {
			update((state) => ({
				...state,
				isSidebarCollapsed: !state.isSidebarCollapsed
			}));
		},

		setSidebarCollapsed: (collapsed: boolean) => {
			update((state) => ({
				...state,
				isSidebarCollapsed: collapsed
			}));
		},

		clear: () => {
			set(initialState);
		}
	};
}

export const camStore = createCamStore();

export const currentAssociation = derived(camStore, ($cam) => $cam.currentAssociation);
export const hasMultipleAssociations = derived(camStore, ($cam) => $cam.associations.length > 1);
export const badgeCounts = derived(camStore, ($cam) => $cam.badgeCounts);
export const isCamLoading = derived(camStore, ($cam) => $cam.isLoading);
export const isSidebarCollapsed = derived(camStore, ($cam) => $cam.isSidebarCollapsed);

// Badge count refresh function - can be called from anywhere after relevant actions
let badgeCountRefreshFn: (() => Promise<void>) | null = null;

export function registerBadgeCountRefresh(fn: () => Promise<void>) {
	badgeCountRefreshFn = fn;
}

export async function refreshBadgeCounts() {
	if (badgeCountRefreshFn) {
		await badgeCountRefreshFn();
	}
}

/**
 * Load badge counts for the current association using the API
 */
export async function loadBadgeCounts() {
	const state = get(camStore);
	if (!state.currentAssociation?.id) return;

	try {
		const counts = await apiFetchBadgeCounts(state.currentAssociation.id);
		camStore.setBadgeCounts({
			violations: counts.openViolations,
			arcRequests: counts.pendingArcRequests,
			workOrders: counts.activeWorkOrders
		});
	} catch (e) {
		console.error('Failed to load badge counts:', e);
	}
}
