// The single source for a PWU-Type node's LEAF KIND (JAN-PRPWA-DS-001 STD-1). The inspector (DWP-05), the §11.7.4
// assurance rail (DWP-06), and any graph report all classify leaves the SAME way through this helper, so the
// "two kinds of leaf" never diverge across surfaces (F-13). Pure and browser-safe (type-only contracts import).
import type { ExecutionBoundary } from '@janumipwb/rph-contracts';

/**
 * - DELEGATED   — a DELEGATED_EXTERNAL node: a delegated leaf, terminal by contract (INV-1). It has no children
 *                 because the work belongs to another organization; from our scope it is a single external party.
 * - IRREDUCIBLE — an INTERNAL node with no permitted children: an irreducible-within-scope leaf (STD-1-I).
 * - NON_LEAF    — anything that declares permitted children: a decomposition node, not a leaf.
 */
export type LeafKind = 'DELEGATED' | 'IRREDUCIBLE' | 'NON_LEAF';

export interface LeafKindInput {
	/** Absent ⇒ INTERNAL (the STD-2 resolution). */
	readonly executionBoundary?: ExecutionBoundary;
	readonly permittedChildTypeIds?: readonly string[];
}

/** Classify a node's leaf status. DELEGATED wins over child-count because a delegated node is terminal by
 *  contract (INV-1 guarantees it declares no children, so the order is belt-and-suspenders, never contradictory). */
export function leafKind(node: LeafKindInput): LeafKind {
	if (node.executionBoundary === 'DELEGATED_EXTERNAL') return 'DELEGATED';
	return (node.permittedChildTypeIds?.length ?? 0) > 0 ? 'NON_LEAF' : 'IRREDUCIBLE';
}

/** True iff the node is a legitimate leaf (STD-1): irreducible-within-scope OR delegated-across-a-boundary. */
export function isLeaf(node: LeafKindInput): boolean {
	return leafKind(node) !== 'NON_LEAF';
}

/** Short human label for a leaf kind — used by the inspector and the node rail. */
export function leafKindLabel(kind: LeafKind): string {
	switch (kind) {
		case 'DELEGATED':
			return 'Delegated leaf · external boundary';
		case 'IRREDUCIBLE':
			return 'Irreducible leaf · within scope';
		default:
			return 'Decomposition node';
	}
}
