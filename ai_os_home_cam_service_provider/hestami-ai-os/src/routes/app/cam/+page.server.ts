export const load = async () => {
	return {
		stats: {
			totalUnits: 0,
			totalOwners: 0,
			openViolations: 0,
			pendingArc: 0
		},
		requiresAction: {
			pendingArc: 0,
			escalatedViolations: 0,
			overdueWorkOrders: 0
		},
		riskCompliance: {
			violationsBySeverity: {
				critical: 0,
				major: 0,
				moderate: 0,
				minor: 0
			},
			repeatOffenders: []
		},
		financialAttention: {
			overdueAssessmentsCount: 0,
			overdueAssessmentsAmount: 0,
			budgetExceptionsCount: 0
		}
	};
};
