declare const staticSemanticOperationBudgetProviderBindingBrand: unique symbol;

/** Opaque operation identity shared with budget-evidence producers. */
export interface StaticSemanticOperationBudgetProviderBinding {
	readonly [staticSemanticOperationBudgetProviderBindingBrand]: true;
}
