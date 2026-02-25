/**
 * Claim Relationship Tracking
 * Implements Phase 2.3: Claims System (relationship tracking)
 * Manages claim dependencies and relationships
 */

import type { Result, Claim } from '../types';
import { getClaims, getClaimById } from '../events';

/**
 * Claim relationship types
 */
export enum ClaimRelationshipType {
	DEPENDS_ON = 'DEPENDS_ON', // This claim depends on another
	CONTRADICTS = 'CONTRADICTS', // This claim contradicts another
	SUPPORTS = 'SUPPORTS', // This claim supports another
	REFINES = 'REFINES', // This claim refines/clarifies another
}

/**
 * Claim relationship record
 */
export interface ClaimRelationship {
	from_claim_id: string;
	to_claim_id: string;
	relationship_type: ClaimRelationshipType;
	created_at: string;
}

/**
 * In-memory claim relationship graph
 * In production, this would be stored in the database
 */
const claimRelationships = new Map<string, ClaimRelationship[]>();

/**
 * Add a relationship between claims
 * @param from_claim_id Source claim ID
 * @param to_claim_id Target claim ID
 * @param relationship_type Type of relationship
 * @returns Result indicating success
 */
export function addClaimRelationship(
	from_claim_id: string,
	to_claim_id: string,
	relationship_type: ClaimRelationshipType
): Result<ClaimRelationship> {
	try {
		// Validate both claims exist
		const fromClaimResult = getClaimById(from_claim_id);
		const toClaimResult = getClaimById(to_claim_id);

		if (!fromClaimResult.success || !toClaimResult.success) {
			return {
				success: false,
				error: new Error('One or both claims not found'),
			};
		}

		if (!fromClaimResult.value || !toClaimResult.value) {
			return {
				success: false,
				error: new Error('One or both claims not found'),
			};
		}

		// Prevent self-relationships
		if (from_claim_id === to_claim_id) {
			return {
				success: false,
				error: new Error('Cannot create relationship to self'),
			};
		}

		// Check for existing relationship
		const existing = claimRelationships.get(from_claim_id) || [];
		const duplicate = existing.find(
			(r) =>
				r.to_claim_id === to_claim_id &&
				r.relationship_type === relationship_type
		);

		if (duplicate) {
			return {
				success: false,
				error: new Error('Relationship already exists'),
			};
		}

		// Create relationship
		const relationship: ClaimRelationship = {
			from_claim_id,
			to_claim_id,
			relationship_type,
			created_at: new Date().toISOString(),
		};

		// Store relationship
		const relationships = claimRelationships.get(from_claim_id) || [];
		relationships.push(relationship);
		claimRelationships.set(from_claim_id, relationships);

		return { success: true, value: relationship };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to add claim relationship'),
		};
	}
}

/**
 * Get relationships for a claim
 * @param claim_id Claim ID
 * @param relationship_type Optional filter by type
 * @returns Result containing relationships
 */
export function getClaimRelationships(
	claim_id: string,
	relationship_type?: ClaimRelationshipType
): Result<ClaimRelationship[]> {
	try {
		const relationships = claimRelationships.get(claim_id) || [];

		if (relationship_type) {
			const filtered = relationships.filter(
				(r) => r.relationship_type === relationship_type
			);
			return { success: true, value: filtered };
		}

		return { success: true, value: relationships };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get claim relationships'),
		};
	}
}

/**
 * Get all claims that depend on a given claim
 * @param claim_id Claim ID
 * @returns Result containing dependent claims
 */
export function getDependentClaims(
	claim_id: string
): Result<Claim[]> {
	try {
		const dependentIds: string[] = [];

		// Find all claims that have DEPENDS_ON relationship to this claim
		for (const [fromId, relationships] of claimRelationships.entries()) {
			for (const rel of relationships) {
				if (
					rel.to_claim_id === claim_id &&
					rel.relationship_type === ClaimRelationshipType.DEPENDS_ON
				) {
					dependentIds.push(fromId);
				}
			}
		}

		// Fetch the actual claims
		const claims: Claim[] = [];
		for (const id of dependentIds) {
			const claimResult = getClaimById(id);
			if (claimResult.success && claimResult.value) {
				claims.push(claimResult.value);
			}
		}

		return { success: true, value: claims };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get dependent claims'),
		};
	}
}

/**
 * Get all claims that a given claim depends on
 * @param claim_id Claim ID
 * @returns Result containing dependency claims
 */
export function getClaimDependencies(
	claim_id: string
): Result<Claim[]> {
	try {
		const relationships = claimRelationships.get(claim_id) || [];
		const dependencyIds = relationships
			.filter((r) => r.relationship_type === ClaimRelationshipType.DEPENDS_ON)
			.map((r) => r.to_claim_id);

		// Fetch the actual claims
		const claims: Claim[] = [];
		for (const id of dependencyIds) {
			const claimResult = getClaimById(id);
			if (claimResult.success && claimResult.value) {
				claims.push(claimResult.value);
			}
		}

		return { success: true, value: claims };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get claim dependencies'),
		};
	}
}

/**
 * Check for claim contradictions
 * @param claim_id Claim ID
 * @returns Result containing contradicting claims
 */
export function getContradictingClaims(
	claim_id: string
): Result<Claim[]> {
	try {
		const relationships = claimRelationships.get(claim_id) || [];
		const contradictIds = relationships
			.filter((r) => r.relationship_type === ClaimRelationshipType.CONTRADICTS)
			.map((r) => r.to_claim_id);

		// Also find claims that contradict this one
		for (const [fromId, rels] of claimRelationships.entries()) {
			for (const rel of rels) {
				if (
					rel.to_claim_id === claim_id &&
					rel.relationship_type === ClaimRelationshipType.CONTRADICTS &&
					!contradictIds.includes(fromId)
				) {
					contradictIds.push(fromId);
				}
			}
		}

		// Fetch the actual claims
		const claims: Claim[] = [];
		for (const id of contradictIds) {
			const claimResult = getClaimById(id);
			if (claimResult.success && claimResult.value) {
				claims.push(claimResult.value);
			}
		}

		return { success: true, value: claims };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get contradicting claims'),
		};
	}
}

/**
 * Get claim relationship graph for visualization
 * @param dialogue_id Dialogue ID
 * @returns Result containing graph representation
 */
export function getClaimRelationshipGraph(dialogue_id: string): Result<{
	nodes: Claim[];
	edges: ClaimRelationship[];
}> {
	try {
		// Get all claims for the dialogue
		const claimsResult = getClaims({ dialogue_id });
		if (!claimsResult.success) {
			return {
				success: false,
				error: claimsResult.error,
			};
		}

		const claims = claimsResult.value;
		const claimIds = new Set(claims.map((c) => c.claim_id));

		// Collect all relationships within this dialogue
		const edges: ClaimRelationship[] = [];
		for (const claim of claims) {
			const relationships = claimRelationships.get(claim.claim_id) || [];
			// Only include relationships where both claims are in this dialogue
			for (const rel of relationships) {
				if (claimIds.has(rel.to_claim_id)) {
					edges.push(rel);
				}
			}
		}

		return {
			success: true,
			value: {
				nodes: claims,
				edges,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get claim relationship graph'),
		};
	}
}

/**
 * Remove a claim relationship
 * @param from_claim_id Source claim ID
 * @param to_claim_id Target claim ID
 * @param relationship_type Type of relationship
 * @returns Result indicating success
 */
export function removeClaimRelationship(
	from_claim_id: string,
	to_claim_id: string,
	relationship_type: ClaimRelationshipType
): Result<void> {
	try {
		const relationships = claimRelationships.get(from_claim_id);
		if (!relationships) {
			return {
				success: false,
				error: new Error('No relationships found for claim'),
			};
		}

		const filtered = relationships.filter(
			(r) =>
				!(
					r.to_claim_id === to_claim_id &&
					r.relationship_type === relationship_type
				)
		);

		if (filtered.length === relationships.length) {
			return {
				success: false,
				error: new Error('Relationship not found'),
			};
		}

		claimRelationships.set(from_claim_id, filtered);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to remove claim relationship'),
		};
	}
}

/**
 * Clear all claim relationships (for cleanup/testing)
 */
export function clearAllClaimRelationships(): void {
	claimRelationships.clear();
}
