/**
 * Association Creation Page - Server-Side Data Loading
 * 
 * This file handles SSR data loading only. Form submission is handled
 * client-side via oRPC for proper type safety and observability.
 * 
 * Pattern: SSR load + client-side oRPC submit (no Superforms)
 */
import { COATemplateId } from '$lib/server/accounting/defaultChartOfAccounts';
import type { PageServerLoad } from './$types';

/** COA Template option for the UI */
export interface COATemplateOption {
    id: string;
    label: string;
    description: string;
}

export const load: PageServerLoad = async ({ parent }) => {
    // Get organization from parent layout (root layout provides user's default org)
    const { organization } = await parent();

    // COA templates for the form - loaded server-side to avoid client imports
    const coaTemplates: COATemplateOption[] = [
        { id: COATemplateId.STANDARD_HOA, label: 'Standard HOA', description: 'General community association chart of accounts.' },
        { id: COATemplateId.CONDO, label: 'Condo / High-Rise', description: 'Includes accounts for elevators, life safety, and shared HVAC.' },
        { id: COATemplateId.SINGLE_FAMILY, label: 'Single Family Home', description: 'Focused on common area landscaping and lifestyle amenities.' },
        { id: COATemplateId.TOWNHOME, label: 'Townhome', description: 'Includes specific reserve categories for roofs and exteriors.' },
        { id: COATemplateId.MIXED_USE, label: 'Mixed-Use', description: 'Supports both residential and commercial assessment tracking.' },
        { id: COATemplateId.SENIOR_LIVING, label: 'Senior Living', description: 'Includes hospitality, dining, and transportation cost centers.' }
    ];

    return { coaTemplates, organization , association: null};
};
