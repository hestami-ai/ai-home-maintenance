import { AccountType, AccountCategory, FundType } from '../../../../generated/prisma/enums.js';

/**
 * Default Chart of Accounts for HOA/Community Associations
 * Based on standard HOA accounting practices
 */

export interface DefaultAccountDefinition {
	accountNumber: string;
	name: string;
	accountType: AccountType;
	category: AccountCategory;
	fundType: FundType;
	description?: string;
	isSystemAccount: boolean;
	children?: Omit<DefaultAccountDefinition, 'children'>[];
}

/**
 * COA Template IDs
 */
export const COATemplateId = {
	STANDARD_HOA: 'STANDARD_HOA',
	CONDO: 'CONDO',
	SINGLE_FAMILY: 'SINGLE_FAMILY',
	TOWNHOME: 'TOWNHOME',
	MIXED_USE: 'MIXED_USE',
	SENIOR_LIVING: 'SENIOR_LIVING'
} as const;

export type COATemplateId = (typeof COATemplateId)[keyof typeof COATemplateId];

/**
 * Standard HOA Chart of Accounts
 * Account numbering scheme:
 * - 1xxx: Assets
 * - 2xxx: Liabilities
 * - 3xxx: Equity
 * - 4xxx: Revenue
 * - 5xxx: Expenses
 */
export const standardHOAChartOfAccounts: DefaultAccountDefinition[] = [
	// =========================================================================
	// ASSETS (1xxx)
	// =========================================================================
	{
		accountNumber: '1000',
		name: 'Assets',
		accountType: AccountType.ASSET,
		category: AccountCategory.CASH,
		fundType: FundType.OPERATING,
		description: 'Parent account for all assets',
		isSystemAccount: true,
		children: [
			// Cash & Bank Accounts
			{
				accountNumber: '1010',
				name: 'Operating Cash',
				accountType: AccountType.ASSET,
				category: AccountCategory.CASH,
				fundType: FundType.OPERATING,
				description: 'Primary operating bank account',
				isSystemAccount: true
			},
			{
				accountNumber: '1020',
				name: 'Reserve Cash',
				accountType: AccountType.ASSET,
				category: AccountCategory.CASH,
				fundType: FundType.RESERVE,
				description: 'Reserve fund bank account',
				isSystemAccount: true
			},
			{
				accountNumber: '1030',
				name: 'Petty Cash',
				accountType: AccountType.ASSET,
				category: AccountCategory.CASH,
				fundType: FundType.OPERATING,
				description: 'Petty cash on hand',
				isSystemAccount: false
			},
			// Accounts Receivable
			{
				accountNumber: '1100',
				name: 'Accounts Receivable - Assessments',
				accountType: AccountType.ASSET,
				category: AccountCategory.ACCOUNTS_RECEIVABLE,
				fundType: FundType.OPERATING,
				description: 'Outstanding assessment charges',
				isSystemAccount: true
			},
			{
				accountNumber: '1110',
				name: 'Accounts Receivable - Other',
				accountType: AccountType.ASSET,
				category: AccountCategory.ACCOUNTS_RECEIVABLE,
				fundType: FundType.OPERATING,
				description: 'Other receivables',
				isSystemAccount: false
			},
			// Prepaid
			{
				accountNumber: '1200',
				name: 'Prepaid Insurance',
				accountType: AccountType.ASSET,
				category: AccountCategory.PREPAID,
				fundType: FundType.OPERATING,
				description: 'Prepaid insurance premiums',
				isSystemAccount: false
			},
			{
				accountNumber: '1210',
				name: 'Prepaid Expenses',
				accountType: AccountType.ASSET,
				category: AccountCategory.PREPAID,
				fundType: FundType.OPERATING,
				description: 'Other prepaid expenses',
				isSystemAccount: false
			}
		]
	},

	// =========================================================================
	// LIABILITIES (2xxx)
	// =========================================================================
	{
		accountNumber: '2000',
		name: 'Liabilities',
		accountType: AccountType.LIABILITY,
		category: AccountCategory.ACCOUNTS_PAYABLE,
		fundType: FundType.OPERATING,
		description: 'Parent account for all liabilities',
		isSystemAccount: true,
		children: [
			{
				accountNumber: '2010',
				name: 'Accounts Payable',
				accountType: AccountType.LIABILITY,
				category: AccountCategory.ACCOUNTS_PAYABLE,
				fundType: FundType.OPERATING,
				description: 'Amounts owed to vendors',
				isSystemAccount: true
			},
			{
				accountNumber: '2020',
				name: 'Accrued Expenses',
				accountType: AccountType.LIABILITY,
				category: AccountCategory.ACCRUED_LIABILITY,
				fundType: FundType.OPERATING,
				description: 'Accrued but unpaid expenses',
				isSystemAccount: false
			},
			{
				accountNumber: '2100',
				name: 'Prepaid Assessments',
				accountType: AccountType.LIABILITY,
				category: AccountCategory.DEFERRED_REVENUE,
				fundType: FundType.OPERATING,
				description: 'Assessments received in advance',
				isSystemAccount: true
			},
			{
				accountNumber: '2110',
				name: 'Owner Credits',
				accountType: AccountType.LIABILITY,
				category: AccountCategory.DEFERRED_REVENUE,
				fundType: FundType.OPERATING,
				description: 'Credit balances owed to owners',
				isSystemAccount: true
			}
		]
	},

	// =========================================================================
	// EQUITY (3xxx)
	// =========================================================================
	{
		accountNumber: '3000',
		name: 'Equity',
		accountType: AccountType.EQUITY,
		category: AccountCategory.FUND_BALANCE,
		fundType: FundType.OPERATING,
		description: 'Parent account for equity',
		isSystemAccount: true,
		children: [
			{
				accountNumber: '3010',
				name: 'Operating Fund Balance',
				accountType: AccountType.EQUITY,
				category: AccountCategory.FUND_BALANCE,
				fundType: FundType.OPERATING,
				description: 'Accumulated operating surplus/deficit',
				isSystemAccount: true
			},
			{
				accountNumber: '3020',
				name: 'Reserve Fund Balance',
				accountType: AccountType.EQUITY,
				category: AccountCategory.RESERVE_FUND,
				fundType: FundType.RESERVE,
				description: 'Accumulated reserve contributions',
				isSystemAccount: true
			},
			{
				accountNumber: '3100',
				name: 'Current Year Surplus/Deficit',
				accountType: AccountType.EQUITY,
				category: AccountCategory.RETAINED_EARNINGS,
				fundType: FundType.OPERATING,
				description: 'Current year net income',
				isSystemAccount: true
			}
		]
	},

	// =========================================================================
	// REVENUE (4xxx)
	// =========================================================================
	{
		accountNumber: '4000',
		name: 'Revenue',
		accountType: AccountType.REVENUE,
		category: AccountCategory.ASSESSMENT_INCOME,
		fundType: FundType.OPERATING,
		description: 'Parent account for all revenue',
		isSystemAccount: true,
		children: [
			// Assessment Income
			{
				accountNumber: '4010',
				name: 'Regular Assessments',
				accountType: AccountType.REVENUE,
				category: AccountCategory.ASSESSMENT_INCOME,
				fundType: FundType.OPERATING,
				description: 'Monthly/quarterly regular assessments',
				isSystemAccount: true
			},
			{
				accountNumber: '4020',
				name: 'Special Assessments',
				accountType: AccountType.REVENUE,
				category: AccountCategory.ASSESSMENT_INCOME,
				fundType: FundType.OPERATING,
				description: 'Special assessment income',
				isSystemAccount: false
			},
			{
				accountNumber: '4030',
				name: 'Reserve Contributions',
				accountType: AccountType.REVENUE,
				category: AccountCategory.ASSESSMENT_INCOME,
				fundType: FundType.RESERVE,
				description: 'Portion of assessments for reserves',
				isSystemAccount: true
			},
			// Late Fees & Penalties
			{
				accountNumber: '4100',
				name: 'Late Fees',
				accountType: AccountType.REVENUE,
				category: AccountCategory.LATE_FEE_INCOME,
				fundType: FundType.OPERATING,
				description: 'Late payment fees',
				isSystemAccount: true
			},
			{
				accountNumber: '4110',
				name: 'Interest on Late Payments',
				accountType: AccountType.REVENUE,
				category: AccountCategory.LATE_FEE_INCOME,
				fundType: FundType.OPERATING,
				description: 'Interest charged on past due balances',
				isSystemAccount: false
			},
			// Other Income
			{
				accountNumber: '4200',
				name: 'Interest Income',
				accountType: AccountType.REVENUE,
				category: AccountCategory.INTEREST_INCOME,
				fundType: FundType.OPERATING,
				description: 'Bank interest earned',
				isSystemAccount: false
			},
			{
				accountNumber: '4210',
				name: 'Reserve Interest Income',
				accountType: AccountType.REVENUE,
				category: AccountCategory.INTEREST_INCOME,
				fundType: FundType.RESERVE,
				description: 'Interest earned on reserve funds',
				isSystemAccount: false
			},
			{
				accountNumber: '4300',
				name: 'Other Income',
				accountType: AccountType.REVENUE,
				category: AccountCategory.OTHER_INCOME,
				fundType: FundType.OPERATING,
				description: 'Miscellaneous income',
				isSystemAccount: false
			}
		]
	},

	// =========================================================================
	// EXPENSES (5xxx)
	// =========================================================================
	{
		accountNumber: '5000',
		name: 'Expenses',
		accountType: AccountType.EXPENSE,
		category: AccountCategory.ADMINISTRATIVE,
		fundType: FundType.OPERATING,
		description: 'Parent account for all expenses',
		isSystemAccount: true,
		children: [
			// Administrative
			{
				accountNumber: '5010',
				name: 'Management Fees',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.ADMINISTRATIVE,
				fundType: FundType.OPERATING,
				description: 'Property management company fees',
				isSystemAccount: false
			},
			{
				accountNumber: '5020',
				name: 'Office Supplies',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.ADMINISTRATIVE,
				fundType: FundType.OPERATING,
				description: 'Office and administrative supplies',
				isSystemAccount: false
			},
			{
				accountNumber: '5030',
				name: 'Postage & Mailing',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.ADMINISTRATIVE,
				fundType: FundType.OPERATING,
				description: 'Postage and mailing costs',
				isSystemAccount: false
			},
			{
				accountNumber: '5040',
				name: 'Bank Charges',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.ADMINISTRATIVE,
				fundType: FundType.OPERATING,
				description: 'Bank fees and charges',
				isSystemAccount: false
			},
			// Utilities
			{
				accountNumber: '5100',
				name: 'Electric - Common Areas',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.UTILITIES,
				fundType: FundType.OPERATING,
				description: 'Electricity for common areas',
				isSystemAccount: false
			},
			{
				accountNumber: '5110',
				name: 'Water & Sewer',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.UTILITIES,
				fundType: FundType.OPERATING,
				description: 'Water and sewer charges',
				isSystemAccount: false
			},
			{
				accountNumber: '5120',
				name: 'Gas',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.UTILITIES,
				fundType: FundType.OPERATING,
				description: 'Natural gas charges',
				isSystemAccount: false
			},
			{
				accountNumber: '5130',
				name: 'Trash Removal',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.UTILITIES,
				fundType: FundType.OPERATING,
				description: 'Trash and recycling services',
				isSystemAccount: false
			},
			// Maintenance
			{
				accountNumber: '5200',
				name: 'Landscaping',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.MAINTENANCE,
				fundType: FundType.OPERATING,
				description: 'Lawn care and landscaping',
				isSystemAccount: false
			},
			{
				accountNumber: '5210',
				name: 'Pool Maintenance',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.MAINTENANCE,
				fundType: FundType.OPERATING,
				description: 'Pool cleaning and chemicals',
				isSystemAccount: false
			},
			{
				accountNumber: '5220',
				name: 'Building Maintenance',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.MAINTENANCE,
				fundType: FundType.OPERATING,
				description: 'General building repairs',
				isSystemAccount: false
			},
			{
				accountNumber: '5230',
				name: 'Pest Control',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.MAINTENANCE,
				fundType: FundType.OPERATING,
				description: 'Pest control services',
				isSystemAccount: false
			},
			{
				accountNumber: '5240',
				name: 'Snow Removal',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.MAINTENANCE,
				fundType: FundType.OPERATING,
				description: 'Snow plowing and removal',
				isSystemAccount: false
			},
			// Insurance
			{
				accountNumber: '5300',
				name: 'Property Insurance',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.INSURANCE,
				fundType: FundType.OPERATING,
				description: 'Master property insurance',
				isSystemAccount: false
			},
			{
				accountNumber: '5310',
				name: 'Liability Insurance',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.INSURANCE,
				fundType: FundType.OPERATING,
				description: 'General liability insurance',
				isSystemAccount: false
			},
			{
				accountNumber: '5320',
				name: 'D&O Insurance',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.INSURANCE,
				fundType: FundType.OPERATING,
				description: 'Directors & Officers insurance',
				isSystemAccount: false
			},
			// Professional Fees
			{
				accountNumber: '5400',
				name: 'Legal Fees',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.PROFESSIONAL_FEES,
				fundType: FundType.OPERATING,
				description: 'Attorney and legal services',
				isSystemAccount: false
			},
			{
				accountNumber: '5410',
				name: 'Accounting Fees',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.PROFESSIONAL_FEES,
				fundType: FundType.OPERATING,
				description: 'CPA and accounting services',
				isSystemAccount: false
			},
			{
				accountNumber: '5420',
				name: 'Audit Fees',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.PROFESSIONAL_FEES,
				fundType: FundType.OPERATING,
				description: 'Annual audit or review',
				isSystemAccount: false
			},
			// Reserve Expenses
			{
				accountNumber: '5500',
				name: 'Reserve Expenditures',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.RESERVE_CONTRIBUTION,
				fundType: FundType.RESERVE,
				description: 'Capital expenditures from reserves',
				isSystemAccount: true
			},
			// Other
			{
				accountNumber: '5900',
				name: 'Miscellaneous Expense',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.OTHER_EXPENSE,
				fundType: FundType.OPERATING,
				description: 'Other miscellaneous expenses',
				isSystemAccount: false
			},
			{
				accountNumber: '5910',
				name: 'Bad Debt Expense',
				accountType: AccountType.EXPENSE,
				category: AccountCategory.OTHER_EXPENSE,
				fundType: FundType.OPERATING,
				description: 'Uncollectible assessment write-offs',
				isSystemAccount: true
			}
		]
	}
];

/**
 * Condo / High-Rise Chart of Accounts
 * Standard HOA + specialized maintenance (Elevators, Life Safety, HVAC)
 */
export const condoChartOfAccounts: DefaultAccountDefinition[] = [
	...standardHOAChartOfAccounts.map((group): DefaultAccountDefinition => {
		if (group.accountNumber === '5000' && group.children) {
			// Add Specialized Maintenance to Expenses
			return {
				...group,
				children: [
					...group.children,
					{
						accountNumber: '5250',
						name: 'Elevator Maintenance',
						accountType: AccountType.EXPENSE,
						category: AccountCategory.MAINTENANCE,
						fundType: FundType.OPERATING,
						description: 'Elevator service and inspections',
						isSystemAccount: false
					},
					{
						accountNumber: '5260',
						name: 'Life Safety Systems',
						accountType: AccountType.EXPENSE,
						category: AccountCategory.MAINTENANCE,
						fundType: FundType.OPERATING,
						description: 'Fire alarm and sprinkler inspections',
						isSystemAccount: false
					},
					{
						accountNumber: '5270',
						name: 'HVAC - Common Areas',
						accountType: AccountType.EXPENSE,
						category: AccountCategory.MAINTENANCE,
						fundType: FundType.OPERATING,
						description: 'Heating and cooling for common areas',
						isSystemAccount: false
					}
				]
			};
		}
		return group;
	})
];

/**
 * Single Family Home Chart of Accounts
 * Standard HOA - focused on common area landscaping and lifestyle
 */
export const singleFamilyChartOfAccounts: DefaultAccountDefinition[] = [
	...standardHOAChartOfAccounts.map((group): DefaultAccountDefinition => {
		if (group.accountNumber === '5000' && group.children) {
			return {
				...group,
				children: [
					...group.children,
					{
						accountNumber: '5280',
						name: 'Detention Pond Maintenance',
						accountType: AccountType.EXPENSE,
						category: AccountCategory.MAINTENANCE,
						fundType: FundType.OPERATING,
						description: 'Maintenance of storm water management areas',
						isSystemAccount: false
					}
				]
			};
		}
		return group;
	})
];

/**
 * Townhome Chart of Accounts
 * Standard HOA + specific reserves for roof/exterior
 */
export const townhomeChartOfAccounts: DefaultAccountDefinition[] = [
	...standardHOAChartOfAccounts.map((group): DefaultAccountDefinition => {
		if (group.accountNumber === '5000' && group.children) {
			return {
				...group,
				children: [
					...group.children,
					{
						accountNumber: '5290',
						name: 'Roof Maintenance',
						accountType: AccountType.EXPENSE,
						category: AccountCategory.MAINTENANCE,
						fundType: FundType.OPERATING,
						description: 'Common roof repairs',
						isSystemAccount: false
					}
				]
			};
		}
		return group;
	})
];

/**
 * Mixed-Use Chart of Accounts
 * Standard HOA + specialized cost centers/categories
 */
export const mixedUseChartOfAccounts: DefaultAccountDefinition[] = [
	...standardHOAChartOfAccounts.map((group): DefaultAccountDefinition => {
		if (group.accountNumber === '4000' && group.children) {
			return {
				...group,
				children: [
					...group.children,
					{
						accountNumber: '4400',
						name: 'Commercial Assessments',
						accountType: AccountType.REVENUE,
						category: AccountCategory.ASSESSMENT_INCOME,
						fundType: FundType.OPERATING,
						description: 'Revenue from commercial units',
						isSystemAccount: false
					}
				]
			};
		}
		return group;
	})
];

/**
 * Senior Living Chart of Accounts
 * Standard HOA + hospitality services (Dining, Transportation)
 */
export const seniorLivingChartOfAccounts: DefaultAccountDefinition[] = [
	...standardHOAChartOfAccounts.map((group): DefaultAccountDefinition => {
		if (group.accountNumber === '5000' && group.children) {
			return {
				...group,
				children: [
					...group.children,
					{
						accountNumber: '5600',
						name: 'Dining Services',
						accountType: AccountType.EXPENSE,
						category: AccountCategory.ADMINISTRATIVE,
						fundType: FundType.OPERATING,
						description: 'On-site dining operations',
						isSystemAccount: false
					},
					{
						accountNumber: '5700',
						name: 'Transportation Services',
						accountType: AccountType.EXPENSE,
						category: AccountCategory.ADMINISTRATIVE,
						fundType: FundType.OPERATING,
						description: 'Resident shuttle services',
						isSystemAccount: false
					}
				]
			};
		}
		return group;
	})
];

/**
 * Map of templates
 */
export const coaTemplates: Record<COATemplateId, DefaultAccountDefinition[]> = {
	[COATemplateId.STANDARD_HOA]: standardHOAChartOfAccounts,
	[COATemplateId.CONDO]: condoChartOfAccounts,
	[COATemplateId.SINGLE_FAMILY]: singleFamilyChartOfAccounts,
	[COATemplateId.TOWNHOME]: townhomeChartOfAccounts,
	[COATemplateId.MIXED_USE]: mixedUseChartOfAccounts,
	[COATemplateId.SENIOR_LIVING]: seniorLivingChartOfAccounts
};

// Keep for backward compatibility
export const defaultChartOfAccounts = standardHOAChartOfAccounts;

/**
 * Well-known account numbers for system use
 */
export const SystemAccounts = {
	// Assets
	OPERATING_CASH: '1010',
	RESERVE_CASH: '1020',
	AR_ASSESSMENTS: '1100',

	// Liabilities
	ACCOUNTS_PAYABLE: '2010',
	PREPAID_ASSESSMENTS: '2100',
	OWNER_CREDITS: '2110',

	// Revenue
	REGULAR_ASSESSMENTS: '4010',
	RESERVE_CONTRIBUTIONS: '4030',
	LATE_FEES: '4100',

	// Expenses
	BAD_DEBT: '5910'
} as const;
