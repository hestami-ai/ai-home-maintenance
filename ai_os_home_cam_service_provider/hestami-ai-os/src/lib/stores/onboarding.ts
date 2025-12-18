import { writable } from 'svelte/store';

/**
 * Property Owner Onboarding State
 */
export interface PropertyOwnerOnboardingState {
	step: number;
	organizationType: 'INDIVIDUAL_PROPERTY_OWNER' | 'TRUST_OR_LLC' | null;
	organizationDetails: {
		name: string;
		slug: string;
		contactEmail: string;
		contactPhone: string;
	};
	property: {
		name: string;
		addressLine1: string;
		addressLine2: string;
		city: string;
		state: string;
		zipCode: string;
		propertyType: string;
		yearBuilt: string;
		squareFootage: string;
	};
	hoa: {
		hasHoa: 'none' | 'external' | 'platform';
		hoaName: string;
		hoaContact: string;
	};
	preferences: {
		mode: 'concierge' | 'diy';
	};
}

const initialPropertyOwnerState: PropertyOwnerOnboardingState = {
	step: 0,
	organizationType: null,
	organizationDetails: {
		name: '',
		slug: '',
		contactEmail: '',
		contactPhone: ''
	},
	property: {
		name: '',
		addressLine1: '',
		addressLine2: '',
		city: '',
		state: '',
		zipCode: '',
		propertyType: '',
		yearBuilt: '',
		squareFootage: ''
	},
	hoa: {
		hasHoa: 'none',
		hoaName: '',
		hoaContact: ''
	},
	preferences: {
		mode: 'concierge'
	}
};

function createPropertyOwnerOnboardingStore() {
	const { subscribe, set, update } = writable<PropertyOwnerOnboardingState>(initialPropertyOwnerState);

	return {
		subscribe,
		setStep: (step: number) => update((s) => ({ ...s, step })),
		setOrganizationType: (type: PropertyOwnerOnboardingState['organizationType']) =>
			update((s) => ({ ...s, organizationType: type })),
		setOrganizationDetails: (details: Partial<PropertyOwnerOnboardingState['organizationDetails']>) =>
			update((s) => ({ ...s, organizationDetails: { ...s.organizationDetails, ...details } })),
		setProperty: (property: Partial<PropertyOwnerOnboardingState['property']>) =>
			update((s) => ({ ...s, property: { ...s.property, ...property } })),
		setHoa: (hoa: Partial<PropertyOwnerOnboardingState['hoa']>) =>
			update((s) => ({ ...s, hoa: { ...s.hoa, ...hoa } })),
		setPreferences: (preferences: Partial<PropertyOwnerOnboardingState['preferences']>) =>
			update((s) => ({ ...s, preferences: { ...s.preferences, ...preferences } })),
		reset: () => set(initialPropertyOwnerState)
	};
}

export const propertyOwnerOnboarding = createPropertyOwnerOnboardingStore();

/**
 * Community Onboarding State
 */
export interface CommunityOnboardingState {
	step: number;
	organizationType: 'COMMUNITY_ASSOCIATION' | 'MANAGEMENT_COMPANY' | null;
	organizationDetails: {
		name: string;
		slug: string;
		addressLine1: string;
		city: string;
		state: string;
		zipCode: string;
		contactEmail: string;
		contactPhone: string;
		website: string;
	};
	governance: {
		boardSeats: number;
		fiscalYearStart: number;
		annualMeetingMonth: number;
		hasCcrs: boolean;
		hasBylaws: boolean;
		hasRules: boolean;
	};
	initialData: {
		totalUnits: number;
		unitTypes: string[];
	};
	userRole: 'ADMIN' | 'MANAGER' | 'BOARD_MEMBER';
}

const initialCommunityState: CommunityOnboardingState = {
	step: 0,
	organizationType: null,
	organizationDetails: {
		name: '',
		slug: '',
		addressLine1: '',
		city: '',
		state: '',
		zipCode: '',
		contactEmail: '',
		contactPhone: '',
		website: ''
	},
	governance: {
		boardSeats: 5,
		fiscalYearStart: 1,
		annualMeetingMonth: 1,
		hasCcrs: false,
		hasBylaws: false,
		hasRules: false
	},
	initialData: {
		totalUnits: 0,
		unitTypes: []
	},
	userRole: 'ADMIN'
};

function createCommunityOnboardingStore() {
	const { subscribe, set, update } = writable<CommunityOnboardingState>(initialCommunityState);

	return {
		subscribe,
		setStep: (step: number) => update((s) => ({ ...s, step })),
		setOrganizationType: (type: CommunityOnboardingState['organizationType']) =>
			update((s) => ({ ...s, organizationType: type })),
		setOrganizationDetails: (details: Partial<CommunityOnboardingState['organizationDetails']>) =>
			update((s) => ({ ...s, organizationDetails: { ...s.organizationDetails, ...details } })),
		setGovernance: (governance: Partial<CommunityOnboardingState['governance']>) =>
			update((s) => ({ ...s, governance: { ...s.governance, ...governance } })),
		setInitialData: (data: Partial<CommunityOnboardingState['initialData']>) =>
			update((s) => ({ ...s, initialData: { ...s.initialData, ...data } })),
		setUserRole: (role: CommunityOnboardingState['userRole']) =>
			update((s) => ({ ...s, userRole: role })),
		reset: () => set(initialCommunityState)
	};
}

export const communityOnboarding = createCommunityOnboardingStore();

/**
 * Service Provider Onboarding State
 */
export interface ServiceProviderOnboardingState {
	step: number;
	businessDetails: {
		name: string;
		slug: string;
		businessType: string;
		contactName: string;
		contactEmail: string;
		contactPhone: string;
		website: string;
		serviceCategories: string[];
	};
	compliance: {
		hasBusinessLicense: boolean;
		licenseNumber: string;
		licenseState: string;
		hasGeneralLiability: boolean;
		hasWorkersComp: boolean;
	};
	serviceArea: {
		zipCodes: string[];
		serviceRadius: number;
		states: string[];
	};
	operations: {
		businessHoursStart: string;
		businessHoursEnd: string;
		workDays: string[];
		emergencyServices: boolean;
		teamSize: string;
	};
}

const initialServiceProviderState: ServiceProviderOnboardingState = {
	step: 0,
	businessDetails: {
		name: '',
		slug: '',
		businessType: '',
		contactName: '',
		contactEmail: '',
		contactPhone: '',
		website: '',
		serviceCategories: []
	},
	compliance: {
		hasBusinessLicense: false,
		licenseNumber: '',
		licenseState: '',
		hasGeneralLiability: false,
		hasWorkersComp: false
	},
	serviceArea: {
		zipCodes: [],
		serviceRadius: 25,
		states: []
	},
	operations: {
		businessHoursStart: '08:00',
		businessHoursEnd: '17:00',
		workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
		emergencyServices: false,
		teamSize: 'solo'
	}
};

function createServiceProviderOnboardingStore() {
	const { subscribe, set, update } = writable<ServiceProviderOnboardingState>(initialServiceProviderState);

	return {
		subscribe,
		setStep: (step: number) => update((s) => ({ ...s, step })),
		setBusinessDetails: (details: Partial<ServiceProviderOnboardingState['businessDetails']>) =>
			update((s) => ({ ...s, businessDetails: { ...s.businessDetails, ...details } })),
		setCompliance: (compliance: Partial<ServiceProviderOnboardingState['compliance']>) =>
			update((s) => ({ ...s, compliance: { ...s.compliance, ...compliance } })),
		setServiceArea: (area: Partial<ServiceProviderOnboardingState['serviceArea']>) =>
			update((s) => ({ ...s, serviceArea: { ...s.serviceArea, ...area } })),
		setOperations: (ops: Partial<ServiceProviderOnboardingState['operations']>) =>
			update((s) => ({ ...s, operations: { ...s.operations, ...ops } })),
		reset: () => set(initialServiceProviderState)
	};
}

export const serviceProviderOnboarding = createServiceProviderOnboardingStore();
