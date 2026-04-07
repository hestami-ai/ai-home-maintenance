import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	getPolicy,
	getAllPolicyKeys,
	CONTEXT_POLICIES,
} from '../../../lib/context/policyRegistry';
import { Role, Phase } from '../../../lib/types';

describe('Policy Registry', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('CONTEXT_POLICIES', () => {
		it('contains registered policies', () => {
			expect(CONTEXT_POLICIES.size).toBeGreaterThan(0);
		});

		it('all policies have unique keys', () => {
			const keys = [...CONTEXT_POLICIES.keys()];
			expect(keys.length).toBe(new Set(keys).size);
		});

		it('all policies have required fields', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				expect(policy.policyKey).toBeDefined();
				expect(policy.role).toBeDefined();
				expect(policy.phase).toBeDefined();
				expect(policy.subPhase).toBeDefined();
				expect(policy.intent).toBeDefined();
				expect(policy.version).toBeGreaterThan(0);
				expect(Array.isArray(policy.requiredBlocks)).toBe(true);
				expect(Array.isArray(policy.optionalBlocks)).toBe(true);
			}
		});

		it('all required blocks have valid blockId and source', () => {
			const validSources = ['handoff_doc', 'db_query', 'static', 'agent_synthesized'];
			for (const policy of CONTEXT_POLICIES.values()) {
				for (const block of policy.requiredBlocks) {
					expect(block.blockId).toBeDefined();
					expect(block.blockId.length).toBeGreaterThan(0);
					expect(validSources).toContain(block.source);
				}
			}
		});

		it('all optional blocks have valid blockId and source', () => {
			const validSources = ['handoff_doc', 'db_query', 'static', 'agent_synthesized'];
			for (const policy of CONTEXT_POLICIES.values()) {
				for (const block of policy.optionalBlocks) {
					expect(block.blockId).toBeDefined();
					expect(block.blockId.length).toBeGreaterThan(0);
					expect(validSources).toContain(block.source);
				}
			}
		});

		it('handoff_doc blocks have handoffDocType', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				for (const block of [...policy.requiredBlocks, ...policy.optionalBlocks]) {
					if (block.source === 'handoff_doc') {
						expect(block.handoffDocType).toBeDefined();
					}
				}
			}
		});
	});

	describe('getPolicy', () => {
		it('finds exact match policy', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE);
			expect(policy).not.toBeNull();
			expect(policy?.role).toBe(Role.EXECUTOR);
			expect(policy?.phase).toBe(Phase.EXECUTE);
		});

		it('finds policy with specific subPhase', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'DECOMPOSING');
			expect(policy?.subPhase).toBe('DECOMPOSING');
		});

		it('finds policy with specific intent', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, 'MAKER_PLANNER');
			expect(policy?.intent).toBe('MAKER_PLANNER');
		});

		it('falls back to wildcard intent when exact not found', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, 'NONEXISTENT_INTENT');
			expect(policy?.intent).toBe('*');
		});

		it('falls back to wildcard phase when exact not found', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.PROPOSE);
			expect(policy?.phase).toBe('*');
		});

		it('returns null when no policy matches', () => {
			expect(getPolicy(Role.VERIFIER, Phase.EXECUTE)).toBeNull();
		});

		it('prioritizes exact match over wildcard', () => {
			const exact = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, 'MAKER_PLANNER');
			const wildcard = getPolicy(Role.EXECUTOR, Phase.EXECUTE);
			expect(exact?.intent).toBe('MAKER_PLANNER');
			expect(wildcard?.intent).toBe('*');
			expect(exact?.policyKey).not.toBe(wildcard?.policyKey);
		});

		it('handles undefined as wildcard match', () => {
			const policy1 = getPolicy(Role.EXECUTOR, Phase.EXECUTE);
			const policy2 = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, undefined);
			expect(policy1?.policyKey).toBe(policy2?.policyKey);
		});
	});

	describe('getAllPolicyKeys', () => {
		it('returns all policy keys', () => {
			expect(getAllPolicyKeys().length).toBe(CONTEXT_POLICIES.size);
		});

		it('every key resolves to a policy', () => {
			for (const key of getAllPolicyKeys()) {
				expect(CONTEXT_POLICIES.has(key)).toBe(true);
			}
		});

		it('covers all major roles', () => {
			const keys = getAllPolicyKeys();
			expect(keys.some(k => k.includes(Role.EXECUTOR))).toBe(true);
			expect(keys.some(k => k.includes(Role.VERIFIER))).toBe(true);
			expect(keys.some(k => k.includes(Role.HISTORIAN))).toBe(true);
			expect(keys.some(k => k.includes(Role.TECHNICAL_EXPERT))).toBe(true);
		});

		it('covers all major phases', () => {
			const keys = getAllPolicyKeys();
			expect(keys.some(k => k.includes(Phase.INTAKE))).toBe(true);
			expect(keys.some(k => k.includes(Phase.ARCHITECTURE))).toBe(true);
			expect(keys.some(k => k.includes(Phase.EXECUTE))).toBe(true);
			expect(keys.some(k => k.includes(Phase.VERIFY))).toBe(true);
			expect(keys.some(k => k.includes(Phase.VALIDATE))).toBe(true);
			expect(keys.some(k => k.includes(Phase.HISTORICAL_CHECK))).toBe(true);
		});
	});

	describe('role-specific policies', () => {
		it('EXECUTOR EXECUTE policy declares goal + constraints', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE);
			expect(policy?.requiredBlocks.some(b => b.blockId === 'goal')).toBe(true);
			expect(policy?.requiredBlocks.some(b => b.blockId === 'constraints')).toBe(true);
		});

		it('EXECUTOR MAKER_PLANNER policy declares intent_record + acceptance_contract', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, 'MAKER_PLANNER');
			expect(policy?.requiredBlocks.some(b => b.blockId === 'intent_record')).toBe(true);
			expect(policy?.requiredBlocks.some(b => b.blockId === 'acceptance_contract')).toBe(true);
		});

		it('VERIFIER VERIFY policy declares claim_to_verify', () => {
			const policy = getPolicy(Role.VERIFIER, Phase.VERIFY);
			expect(policy?.requiredBlocks.some(b => b.blockId === 'claim_to_verify')).toBe(true);
		});

		it('HISTORIAN HISTORICAL_CHECK policy declares full_event_history', () => {
			const policy = getPolicy(Role.HISTORIAN, Phase.HISTORICAL_CHECK);
			expect(policy?.requiredBlocks.some(b => b.blockId === 'full_event_history')).toBe(true);
		});

		it('HISTORIAN ADJUDICATION policy declares conflicting_verdicts', () => {
			const policy = getPolicy(Role.HISTORIAN, Phase.HISTORICAL_CHECK, 'ADJUDICATION');
			expect(policy?.requiredBlocks.some(b => b.blockId === 'conflicting_verdicts')).toBe(true);
		});

		it('TECHNICAL_EXPERT INTAKE policy declares conversation_history + current_plan', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.INTAKE);
			expect(policy?.requiredBlocks.some(b => b.blockId === 'conversation_history')).toBe(true);
			expect(policy?.requiredBlocks.some(b => b.blockId === 'current_plan')).toBe(true);
		});

		it('TECHNICAL_EXPERT VALIDATE HYPOTHESIZING policies exist for security/logic/best_practices', () => {
			expect(getPolicy(Role.TECHNICAL_EXPERT, Phase.VALIDATE, 'HYPOTHESIZING', 'security')).not.toBeNull();
			expect(getPolicy(Role.TECHNICAL_EXPERT, Phase.VALIDATE, 'HYPOTHESIZING', 'logic')).not.toBeNull();
			expect(getPolicy(Role.TECHNICAL_EXPERT, Phase.VALIDATE, 'HYPOTHESIZING', 'best_practices')).not.toBeNull();
		});

		it('TECHNICAL_EXPERT VALIDATE GRADING policy exists', () => {
			expect(getPolicy(Role.TECHNICAL_EXPERT, Phase.VALIDATE, 'GRADING')).not.toBeNull();
		});

		it('TECHNICAL_EXPERT wildcard fallback policy declares question block', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.PROPOSE);
			expect(policy?.phase).toBe('*');
			expect(policy?.requiredBlocks.some(b => b.blockId === 'question')).toBe(true);
		});
	});

	// ─── Architecture phase: proposer-artifact regression guard ───
	//
	// These assertions exist because of a production bug where the DECOMPOSING
	// and DESIGNING policies silently dropped user-validated INTAKE artifacts
	// (businessDomainProposals, workflowProposals, entityProposals, userJourneys,
	// phasingStrategy) before they reached the LLM. The Context Engineer had no
	// policy block to anchor those extras to, so it elided them. Symptoms: the
	// architecture phase produced impoverished components from a 5-workflow stub
	// of a 6-workflow / 13-domain / 45-entity product.
	//
	// Each architecture sub-phase MUST declare policy blocks that route the
	// proposer artifacts into the briefing.
	describe('architecture sub-phases include user-validated proposer artifacts', () => {
		const expectedDecomposing = [
			'business_domain_proposals',
			'workflow_proposals',
			'entity_proposals',
			'user_journeys',
			'phasing_strategy',
		];

		it('DECOMPOSING declares all proposer-artifact required blocks', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'DECOMPOSING');
			expect(policy).not.toBeNull();
			const requiredIds = new Set(policy!.requiredBlocks.map(b => b.blockId));
			for (const id of expectedDecomposing) {
				expect(requiredIds.has(id)).toBe(true);
			}
		});

		it('DECOMPOSING declares the full approved_plan handoff doc', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'DECOMPOSING');
			const approved = policy!.requiredBlocks.find(b => b.blockId === 'approved_plan');
			expect(approved).toBeDefined();
			expect(approved?.source).toBe('handoff_doc');
			// Label must NOT contain the prior "extract ONLY" truncation directive.
			expect(approved?.label.toLowerCase()).not.toContain('extract only');
		});

		it('MODELING declares proposer-artifact blocks (no businessBusinessDomainProposals typo)', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'MODELING');
			const required = new Set(policy!.requiredBlocks.map(b => b.blockId));
			expect(required.has('business_domain_proposals')).toBe(true);
			expect(required.has('entity_proposals')).toBe(true);
			expect(required.has('workflow_proposals')).toBe(true);
			// Regression guard: the typo'd block ID must not appear anywhere.
			for (const block of [...policy!.requiredBlocks, ...policy!.optionalBlocks]) {
				expect(block.blockId).not.toContain('businessBusiness');
				expect(block.label).not.toContain('businessBusiness');
			}
		});

		it('DESIGNING declares all proposer-artifact required blocks', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'DESIGNING');
			const required = new Set(policy!.requiredBlocks.map(b => b.blockId));
			for (const id of expectedDecomposing) {
				// DESIGNING includes integration_proposals too — check the core five anyway.
				if (id === 'phasing_strategy') { continue; } // phasing is optional for DESIGNING
				expect(required.has(id)).toBe(true);
			}
			expect(required.has('integration_proposals')).toBe(true);
		});

		it('SEQUENCING declares phasing_strategy as required', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'SEQUENCING');
			const required = new Set(policy!.requiredBlocks.map(b => b.blockId));
			expect(required.has('phasing_strategy')).toBe(true);
		});
	});

	describe('no budget machinery on any policy', () => {
		it('policies do not declare sectionBudgets, sheddingPriority, or omissionStrategy', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				expect((policy as unknown as Record<string, unknown>).sectionBudgets).toBeUndefined();
				expect((policy as unknown as Record<string, unknown>).sheddingPriority).toBeUndefined();
				expect((policy as unknown as Record<string, unknown>).omissionStrategy).toBeUndefined();
			}
		});

		it('blocks do not declare maxTokens', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				for (const block of [...policy.requiredBlocks, ...policy.optionalBlocks]) {
					expect((block as unknown as Record<string, unknown>).maxTokens).toBeUndefined();
				}
			}
		});
	});
});
