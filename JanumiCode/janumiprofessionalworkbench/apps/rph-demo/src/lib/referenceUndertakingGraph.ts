// The Reference Undertaking (field-service SaaS) demo graph — the concrete Undertaking INSTANCE the M14 demo
// renders, in its terminal replay state. This is demo SEED DATA (one specific Undertaking instance), assembled
// from the reusable pwuGraphNode() View seam in @janumipwb/rph-projections. Per the charter, a PWA/Undertaking
// *instance* is not reusable-package material — instance data lives with the surface, not in the engine/
// projection packages.
//
// Terminal state: the ROOT Product Realization PWU is legitimately INCOMPLETE (implementation deferred), the
// Intent and Behavior PWUs are SATISFIED (Behavior unbaselined), the Architecture PWU is BASELINED, and its five
// concerns are SATISFIED except Mobile/Offline which is only CONDITIONALLY satisfied (so NOT qualified-green) —
// with the deferred offline capability surfaced as an open residual (RPH-FIX-006).
import {
	pwuGraphNode,
	type PwuAxesView,
	type GraphNode,
	type GraphEdge,
	type DemoGraph
} from '@janumipwb/rph-projections';

// Terminal-state axis presets.
const SATISFIED: PwuAxesView = {
	workLifecycleState: 'SATISFIED',
	executionState: 'SUCCEEDED',
	assuranceState: 'SATISFIED',
	shapeIntegrityState: 'PRESERVED'
};
const CONDITIONAL: PwuAxesView = {
	workLifecycleState: 'UNDER_ASSURANCE',
	executionState: 'SUCCEEDED',
	assuranceState: 'CONDITIONALLY_SATISFIED',
	shapeIntegrityState: 'AT_RISK'
};
const BASELINED: PwuAxesView = {
	workLifecycleState: 'BASELINED',
	executionState: 'SUCCEEDED',
	assuranceState: 'SATISFIED',
	shapeIntegrityState: 'PRESERVED'
};
const INCOMPLETE: PwuAxesView = {
	workLifecycleState: 'DECOMPOSED',
	executionState: 'NOT_PLANNED',
	assuranceState: 'PENDING',
	shapeIntegrityState: 'PRESERVED'
};

export function buildReferenceUndertakingGraph(): DemoGraph {
	const nodes: GraphNode[] = [
		pwuGraphNode('pwu_fsm_root', 'Product Realization', 'PRODUCT_REALIZATION', INCOMPLETE),
		pwuGraphNode('pwu_fsm_intent', 'Intent & Product Definition', 'INTENT_DEFINITION', SATISFIED),
		pwuGraphNode('pwu_fsm_behavior', 'Product Behavior Definition', 'PRODUCT_BEHAVIOR', SATISFIED),
		pwuGraphNode('pwu_fsm_arch', 'Architecture Definition', 'ARCHITECTURE', BASELINED, true),
		pwuGraphNode('pwu_fsm_arch_context', 'System Context', 'ARCHITECTURE_CONCERN', SATISFIED),
		pwuGraphNode(
			'pwu_fsm_arch_multitenancy',
			'Multi-Tenancy Architecture',
			'ARCHITECTURE_CONCERN',
			SATISFIED
		),
		pwuGraphNode('pwu_fsm_arch_data', 'Data Architecture', 'ARCHITECTURE_CONCERN', SATISFIED),
		pwuGraphNode(
			'pwu_fsm_arch_integrations',
			'Integration Architecture',
			'ARCHITECTURE_CONCERN',
			SATISFIED
		),
		pwuGraphNode(
			'pwu_fsm_arch_mobile',
			'Mobile & Offline Architecture',
			'ARCHITECTURE_CONCERN',
			CONDITIONAL
		)
	];
	const edges: GraphEdge[] = [
		{ from: 'pwu_fsm_root', to: 'pwu_fsm_intent', relation: 'DECOMPOSES_TO' },
		{ from: 'pwu_fsm_root', to: 'pwu_fsm_behavior', relation: 'DECOMPOSES_TO' },
		{ from: 'pwu_fsm_root', to: 'pwu_fsm_arch', relation: 'DECOMPOSES_TO' },
		{ from: 'pwu_fsm_arch', to: 'pwu_fsm_arch_context', relation: 'DECOMPOSES_TO' },
		{ from: 'pwu_fsm_arch', to: 'pwu_fsm_arch_multitenancy', relation: 'DECOMPOSES_TO' },
		{ from: 'pwu_fsm_arch', to: 'pwu_fsm_arch_data', relation: 'DECOMPOSES_TO' },
		{ from: 'pwu_fsm_arch', to: 'pwu_fsm_arch_integrations', relation: 'DECOMPOSES_TO' },
		{ from: 'pwu_fsm_arch', to: 'pwu_fsm_arch_mobile', relation: 'DECOMPOSES_TO' }
	];
	return {
		nodes,
		edges,
		openResiduals: ['Offline behavior deferred from the first implementation increment']
	};
}
