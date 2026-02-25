/**
 * Navigation State Store
 *
 * Persists UI state across page navigations using localStorage.
 * Used for sidebar collapse state, filter preferences, etc.
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'hestami_nav_state';

interface NavigationState {
	sidebarCollapsed: boolean;
	lastWorkQueueFilters?: {
		pillar: string;
		urgency: string;
		assignedToMe: boolean;
		unassignedOnly: boolean;
	};
}

const defaultState: NavigationState = {
	sidebarCollapsed: false
};

/**
 * Load navigation state from localStorage
 */
export function loadNavigationState(): NavigationState {
	if (!browser) return defaultState;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return { ...defaultState, ...JSON.parse(stored) };
		}
	} catch {
		// Ignore parse errors
	}
	return defaultState;
}

/**
 * Save navigation state to localStorage
 */
export function saveNavigationState(state: Partial<NavigationState>): void {
	if (!browser) return;

	try {
		const current = loadNavigationState();
		const merged = { ...current, ...state };
		localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
	} catch {
		// Ignore storage errors
	}
}

/**
 * Get sidebar collapsed state
 */
export function getSidebarCollapsed(): boolean {
	return loadNavigationState().sidebarCollapsed;
}

/**
 * Set sidebar collapsed state
 */
export function setSidebarCollapsed(collapsed: boolean): void {
	saveNavigationState({ sidebarCollapsed: collapsed });
}

/**
 * Get last work queue filters
 */
export function getLastWorkQueueFilters(): NavigationState['lastWorkQueueFilters'] {
	return loadNavigationState().lastWorkQueueFilters;
}

/**
 * Save last work queue filters
 */
export function setLastWorkQueueFilters(filters: NonNullable<NavigationState['lastWorkQueueFilters']>): void {
	saveNavigationState({ lastWorkQueueFilters: filters });
}
