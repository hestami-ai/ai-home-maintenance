import { writable, derived } from 'svelte/store';
import type { Association } from '$lib/api/cam.js';

// Re-export for convenience
export type { Association };

export interface AssociationState {
    current: Association | null;
    associations: Association[];
    isLoading: boolean;
}

const initialState: AssociationState = {
    current: null,
    associations: [],
    isLoading: false
};

function createAssociationStore() {
    const { subscribe, set, update } = writable<AssociationState>(initialState);

    return {
        subscribe,
        setAssociations: (associations: Association[]) => {
            update((state) => ({
                ...state,
                associations,
                isLoading: false
            }));
        },
        setCurrent: (association: Association | null) => {
            update((state) => ({
                ...state,
                current: association
            }));
        },
        setLoading: (isLoading: boolean) => {
            update((state) => ({ ...state, isLoading }));
        },
        clear: () => {
            set(initialState);
        }
    };
}

export const associationStore = createAssociationStore();

export const currentAssociation = derived(associationStore, ($assoc) => $assoc.current);
export const currentAssociationId = derived(associationStore, ($assoc) => $assoc.current?.id);
export const availableAssociations = derived(associationStore, ($assoc) => $assoc.associations);
export const isAssocLoading = derived(associationStore, ($assoc) => $assoc.isLoading);
