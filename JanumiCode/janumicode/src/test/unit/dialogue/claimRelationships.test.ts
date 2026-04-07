import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	addClaimRelationship,
	getClaimRelationships,
	getDependentClaims,
	getClaimDependencies,
	getContradictingClaims,
	getClaimRelationshipGraph,
	removeClaimRelationship,
	clearAllClaimRelationships,
	ClaimRelationshipType,
} from '../../../lib/dialogue/claimRelationships';
import { handleClaimSpeechAct } from '../../../lib/dialogue/speechActs';
import { createDialogueSession } from '../../../lib/dialogue/session';
import { Role, Phase, ClaimCriticality } from '../../../lib/types';

describe('ClaimRelationships', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;
	let claim1Id: string;
	let claim2Id: string;
	let claim3Id: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		clearAllClaimRelationships();

		const session = createDialogueSession();
		if (session.success) {
			dialogueId = session.value.dialogue_id;
		}

		// Create test claims
		const claim1 = handleClaimSpeechAct({
			dialogue_id: dialogueId,
			statement: 'System uses PostgreSQL database',
			introduced_by: Role.EXECUTOR,
			criticality: ClaimCriticality.CRITICAL,
			content_ref: 'blob://claim1',
			phase: Phase.PROPOSE,
		});

		const claim2 = handleClaimSpeechAct({
			dialogue_id: dialogueId,
			statement: 'Database schema includes user table',
			introduced_by: Role.EXECUTOR,
			criticality: ClaimCriticality.NON_CRITICAL,
			content_ref: 'blob://claim2',
			phase: Phase.PROPOSE,
		});

		const claim3 = handleClaimSpeechAct({
			dialogue_id: dialogueId,
			statement: 'System uses MongoDB database',
			introduced_by: Role.EXECUTOR,
			criticality: ClaimCriticality.CRITICAL,
			content_ref: 'blob://claim3',
			phase: Phase.PROPOSE,
		});

		if (claim1.success) {claim1Id = claim1.value.claim.claim_id;}
		if (claim2.success) {claim2Id = claim2.value.claim.claim_id;}
		if (claim3.success) {claim3Id = claim3.value.claim.claim_id;}
	});

	afterEach(() => {
		clearAllClaimRelationships();
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('addClaimRelationship', () => {
		it('creates a DEPENDS_ON relationship', () => {
			const result = addClaimRelationship(
				claim2Id,
				claim1Id,
				ClaimRelationshipType.DEPENDS_ON
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.from_claim_id).toBe(claim2Id);
				expect(result.value.to_claim_id).toBe(claim1Id);
				expect(result.value.relationship_type).toBe(ClaimRelationshipType.DEPENDS_ON);
				expect(result.value.created_at).toBeDefined();
			}
		});

		it('creates a CONTRADICTS relationship', () => {
			const result = addClaimRelationship(
				claim1Id,
				claim3Id,
				ClaimRelationshipType.CONTRADICTS
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.relationship_type).toBe(ClaimRelationshipType.CONTRADICTS);
			}
		});

		it('creates a SUPPORTS relationship', () => {
			const result = addClaimRelationship(
				claim2Id,
				claim1Id,
				ClaimRelationshipType.SUPPORTS
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.relationship_type).toBe(ClaimRelationshipType.SUPPORTS);
			}
		});

		it('creates a REFINES relationship', () => {
			const result = addClaimRelationship(
				claim2Id,
				claim1Id,
				ClaimRelationshipType.REFINES
			);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.relationship_type).toBe(ClaimRelationshipType.REFINES);
			}
		});

		it('prevents self-relationships', () => {
			const result = addClaimRelationship(
				claim1Id,
				claim1Id,
				ClaimRelationshipType.DEPENDS_ON
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('self');
			}
		});

		it('prevents duplicate relationships', () => {
			addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.DEPENDS_ON);
			const duplicate = addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.DEPENDS_ON);

			expect(duplicate.success).toBe(false);
			if (!duplicate.success) {
				expect(duplicate.error.message).toContain('already exists');
			}
		});

		it('allows multiple relationship types between same claims', () => {
			const depends = addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.DEPENDS_ON);
			const supports = addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.SUPPORTS);

			expect(depends.success).toBe(true);
			expect(supports.success).toBe(true);
		});

		it('rejects relationships with non-existent claims', () => {
			const result = addClaimRelationship(
				'non-existent-id',
				claim1Id,
				ClaimRelationshipType.DEPENDS_ON
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('not found');
			}
		});
	});

	describe('getClaimRelationships', () => {
		beforeEach(() => {
			addClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.DEPENDS_ON);
			addClaimRelationship(claim1Id, claim3Id, ClaimRelationshipType.CONTRADICTS);
		});

		it('retrieves all relationships for a claim', () => {
			const result = getClaimRelationships(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
			}
		});

		it('filters relationships by type', () => {
			const result = getClaimRelationships(claim1Id, ClaimRelationshipType.DEPENDS_ON);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].relationship_type).toBe(ClaimRelationshipType.DEPENDS_ON);
			}
		});

		it('returns empty array for claim with no relationships', () => {
			const result = getClaimRelationships(claim2Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('returns empty array for non-existent claim', () => {
			const result = getClaimRelationships('non-existent-id');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe('getDependentClaims', () => {
		it('finds claims that depend on a given claim', () => {
			addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.DEPENDS_ON);
			addClaimRelationship(claim3Id, claim1Id, ClaimRelationshipType.DEPENDS_ON);

			const result = getDependentClaims(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				const ids = result.value.map(c => c.claim_id);
				expect(ids).toContain(claim2Id);
				expect(ids).toContain(claim3Id);
			}
		});

		it('returns empty array when no claims depend on it', () => {
			const result = getDependentClaims(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('does not include non-DEPENDS_ON relationships', () => {
			addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.SUPPORTS);
			addClaimRelationship(claim3Id, claim1Id, ClaimRelationshipType.REFINES);

			const result = getDependentClaims(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe('getClaimDependencies', () => {
		it('finds claims that a given claim depends on', () => {
			addClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.DEPENDS_ON);
			addClaimRelationship(claim1Id, claim3Id, ClaimRelationshipType.DEPENDS_ON);

			const result = getClaimDependencies(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
				const ids = result.value.map(c => c.claim_id);
				expect(ids).toContain(claim2Id);
				expect(ids).toContain(claim3Id);
			}
		});

		it('returns empty array when claim has no dependencies', () => {
			const result = getClaimDependencies(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('only includes DEPENDS_ON relationships', () => {
			addClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.SUPPORTS);
			addClaimRelationship(claim1Id, claim3Id, ClaimRelationshipType.CONTRADICTS);

			const result = getClaimDependencies(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe('getContradictingClaims', () => {
		it('finds claims that contradict a given claim', () => {
			addClaimRelationship(claim1Id, claim3Id, ClaimRelationshipType.CONTRADICTS);

			const result = getContradictingClaims(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].claim_id).toBe(claim3Id);
			}
		});

		it('finds bidirectional contradictions', () => {
			addClaimRelationship(claim1Id, claim3Id, ClaimRelationshipType.CONTRADICTS);
			addClaimRelationship(claim3Id, claim1Id, ClaimRelationshipType.CONTRADICTS);

			const result = getContradictingClaims(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].claim_id).toBe(claim3Id);
			}
		});

		it('returns empty array when no contradictions exist', () => {
			const result = getContradictingClaims(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});

		it('only includes CONTRADICTS relationships', () => {
			addClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.DEPENDS_ON);
			addClaimRelationship(claim1Id, claim3Id, ClaimRelationshipType.SUPPORTS);

			const result = getContradictingClaims(claim1Id);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe('getClaimRelationshipGraph', () => {
		it('returns nodes and edges for a dialogue', () => {
			addClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.DEPENDS_ON);
			addClaimRelationship(claim2Id, claim3Id, ClaimRelationshipType.SUPPORTS);

			const result = getClaimRelationshipGraph(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.nodes).toHaveLength(3);
				expect(result.value.edges).toHaveLength(2);
			}
		});

		it('includes all claims as nodes', () => {
			const result = getClaimRelationshipGraph(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				const ids = result.value.nodes.map(n => n.claim_id);
				expect(ids).toContain(claim1Id);
				expect(ids).toContain(claim2Id);
				expect(ids).toContain(claim3Id);
			}
		});

		it('only includes edges within the dialogue', () => {
			addClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.DEPENDS_ON);

			const result = getClaimRelationshipGraph(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.edges).toHaveLength(1);
				expect(result.value.edges[0].from_claim_id).toBe(claim1Id);
				expect(result.value.edges[0].to_claim_id).toBe(claim2Id);
			}
		});

		it('returns empty edges when no relationships exist', () => {
			const result = getClaimRelationshipGraph(dialogueId);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.nodes).toHaveLength(3);
				expect(result.value.edges).toEqual([]);
			}
		});
	});

	describe('removeClaimRelationship', () => {
		beforeEach(() => {
			addClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.DEPENDS_ON);
			addClaimRelationship(claim1Id, claim3Id, ClaimRelationshipType.CONTRADICTS);
		});

		it('removes a specific relationship', () => {
			const result = removeClaimRelationship(
				claim1Id,
				claim2Id,
				ClaimRelationshipType.DEPENDS_ON
			);

			expect(result.success).toBe(true);

			const remaining = getClaimRelationships(claim1Id);
			if (remaining.success) {
				expect(remaining.value).toHaveLength(1);
				expect(remaining.value[0].to_claim_id).toBe(claim3Id);
			}
		});

		it('only removes specified relationship type', () => {
			addClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.SUPPORTS);

			removeClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.DEPENDS_ON);

			const remaining = getClaimRelationships(claim1Id);
			if (remaining.success) {
				const types = remaining.value.map(r => r.relationship_type);
				expect(types).toContain(ClaimRelationshipType.SUPPORTS);
				expect(types).not.toContain(ClaimRelationshipType.DEPENDS_ON);
			}
		});

		it('fails when relationship does not exist', () => {
			const result = removeClaimRelationship(
				claim2Id,
				claim1Id,
				ClaimRelationshipType.DEPENDS_ON
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('not found');
			}
		});

		it('fails when claim has no relationships', () => {
			const result = removeClaimRelationship(
				claim2Id,
				claim1Id,
				ClaimRelationshipType.DEPENDS_ON
			);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('No relationships');
			}
		});
	});

	describe('clearAllClaimRelationships', () => {
		it('removes all relationships', () => {
			addClaimRelationship(claim1Id, claim2Id, ClaimRelationshipType.DEPENDS_ON);
			addClaimRelationship(claim2Id, claim3Id, ClaimRelationshipType.SUPPORTS);

			clearAllClaimRelationships();

			const result1 = getClaimRelationships(claim1Id);
			const result2 = getClaimRelationships(claim2Id);

			expect(result1.success && result1.value).toEqual([]);
			expect(result2.success && result2.value).toEqual([]);
		});
	});

	describe('workflow scenarios', () => {
		it('models dependency chain', () => {
			// claim3 depends on claim2, which depends on claim1
			addClaimRelationship(claim3Id, claim2Id, ClaimRelationshipType.DEPENDS_ON);
			addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.DEPENDS_ON);

			const claim3Deps = getClaimDependencies(claim3Id);
			const claim2Deps = getClaimDependencies(claim2Id);
			const claim1Deps = getClaimDependencies(claim1Id);

			expect(claim3Deps.success && claim3Deps.value).toHaveLength(1);
			expect(claim2Deps.success && claim2Deps.value).toHaveLength(1);
			expect(claim1Deps.success && claim1Deps.value).toEqual([]);

			const claim1Dependents = getDependentClaims(claim1Id);
			expect(claim1Dependents.success && claim1Dependents.value).toHaveLength(1);
		});

		it('models contradicting claims with PostgreSQL vs MongoDB', () => {
			addClaimRelationship(claim1Id, claim3Id, ClaimRelationshipType.CONTRADICTS);

			const contradictions = getContradictingClaims(claim1Id);

			expect(contradictions.success).toBe(true);
			if (contradictions.success) {
				expect(contradictions.value).toHaveLength(1);
				expect(contradictions.value[0].statement).toContain('MongoDB');
			}
		});

		it('models claim refinement hierarchy', () => {
			// claim2 refines claim1 (schema details refine database choice)
			addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.REFINES);

			const relationships = getClaimRelationships(claim2Id, ClaimRelationshipType.REFINES);

			expect(relationships.success).toBe(true);
			if (relationships.success) {
				expect(relationships.value).toHaveLength(1);
				expect(relationships.value[0].to_claim_id).toBe(claim1Id);
			}
		});

		it('models supporting evidence relationships', () => {
			// claim2 supports claim1
			addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.SUPPORTS);

			const graph = getClaimRelationshipGraph(dialogueId);

			expect(graph.success).toBe(true);
			if (graph.success) {
				const supportEdges = graph.value.edges.filter(
					e => e.relationship_type === ClaimRelationshipType.SUPPORTS
				);
				expect(supportEdges).toHaveLength(1);
			}
		});

		it('builds complete relationship graph', () => {
			// Build complex graph
			addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.DEPENDS_ON);
			addClaimRelationship(claim2Id, claim1Id, ClaimRelationshipType.SUPPORTS);
			addClaimRelationship(claim1Id, claim3Id, ClaimRelationshipType.CONTRADICTS);

			const graph = getClaimRelationshipGraph(dialogueId);

			expect(graph.success).toBe(true);
			if (graph.success) {
				expect(graph.value.nodes).toHaveLength(3);
				expect(graph.value.edges).toHaveLength(3);

				const edgeTypes = graph.value.edges.map(e => e.relationship_type);
				expect(edgeTypes).toContain(ClaimRelationshipType.DEPENDS_ON);
				expect(edgeTypes).toContain(ClaimRelationshipType.SUPPORTS);
				expect(edgeTypes).toContain(ClaimRelationshipType.CONTRADICTS);
			}
		});
	});
});
