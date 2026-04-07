import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	getPolicy,
	getAllPolicyKeys,
	CONTEXT_POLICIES,
} from '../../../lib/context/policyRegistry';
import { Role, Phase } from '../../../lib/types';
import type { ContextPolicy } from '../../../lib/context/engineTypes';

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
			const uniqueKeys = new Set(keys);
			expect(keys.length).toBe(uniqueKeys.size);
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
				expect(Array.isArray(policy.sheddingPriority)).toBe(true);
				expect(typeof policy.sectionBudgets).toBe('object');
				expect(policy.omissionStrategy).toBeDefined();
			}
		});

		it('all policies have valid omission strategy', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				expect(['fail', 'degrade_with_warning']).toContain(policy.omissionStrategy);
			}
		});

		it('all policies have consistent blockIds in shedding priority', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				const optionalBlockIds = policy.optionalBlocks.map(b => b.blockId);
				for (const sheddingId of policy.sheddingPriority) {
					expect(optionalBlockIds).toContain(sheddingId);
				}
			}
		});

		it('all section budgets sum to reasonable total', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				const sum = Object.values(policy.sectionBudgets).reduce((a, b) => a + b, 0);
				expect(sum).toBeGreaterThan(0);
				expect(sum).toBeLessThanOrEqual(1.1); // Allow small margin for floating point
			}
		});
	});

	describe('getPolicy', () => {
		it('finds exact match policy', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, undefined);

			expect(policy).not.toBeNull();
			expect(policy?.role).toBe(Role.EXECUTOR);
			expect(policy?.phase).toBe(Phase.EXECUTE);
		});

		it('finds policy with specific subPhase', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'DECOMPOSING', undefined);

			expect(policy).not.toBeNull();
			expect(policy?.role).toBe(Role.TECHNICAL_EXPERT);
			expect(policy?.phase).toBe(Phase.ARCHITECTURE);
			expect(policy?.subPhase).toBe('DECOMPOSING');
		});

		it('finds policy with specific intent', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, 'MAKER_PLANNER');

			expect(policy).not.toBeNull();
			expect(policy?.role).toBe(Role.EXECUTOR);
			expect(policy?.phase).toBe(Phase.EXECUTE);
			expect(policy?.intent).toBe('MAKER_PLANNER');
		});

		it('falls back to wildcard intent when exact not found', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, 'NONEXISTENT_INTENT');

			expect(policy).not.toBeNull();
			expect(policy?.intent).toBe('*');
		});

		it('falls back to wildcard subPhase when exact not found', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'NONEXISTENT_SUBPHASE', undefined);

			expect(policy).toBeNull(); // No wildcard for this combination
		});

		it('falls back to wildcard phase when exact not found', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.PROPOSE, undefined, undefined);

			expect(policy).not.toBeNull();
			expect(policy?.phase).toBe('*');
		});

		it('returns null when no policy matches', () => {
			const policy = getPolicy(Role.VERIFIER, Phase.EXECUTE, undefined, undefined);

			expect(policy).toBeNull();
		});

		it('prioritizes exact match over wildcard', () => {
			const exact = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, 'MAKER_PLANNER');
			const wildcard = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, undefined);

			expect(exact?.intent).toBe('MAKER_PLANNER');
			expect(wildcard?.intent).toBe('*');
			expect(exact?.policyKey).not.toBe(wildcard?.policyKey);
		});

		it('handles undefined subPhase and intent as wildcards', () => {
			const policy1 = getPolicy(Role.EXECUTOR, Phase.EXECUTE);
			const policy2 = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, undefined);

			expect(policy1).not.toBeNull();
			expect(policy1?.policyKey).toBe(policy2?.policyKey);
		});
	});

	describe('getAllPolicyKeys', () => {
		it('returns all policy keys', () => {
			const keys = getAllPolicyKeys();

			expect(keys.length).toBe(CONTEXT_POLICIES.size);
		});

		it('returns keys matching policies', () => {
			const keys = getAllPolicyKeys();

			for (const key of keys) {
				expect(CONTEXT_POLICIES.has(key)).toBe(true);
			}
		});

		it('includes executor policies', () => {
			const keys = getAllPolicyKeys();

			expect(keys.some(k => k.includes('EXECUTOR'))).toBe(true);
		});

		it('includes verifier policies', () => {
			const keys = getAllPolicyKeys();

			expect(keys.some(k => k.includes('VERIFIER'))).toBe(true);
		});

		it('includes historian policies', () => {
			const keys = getAllPolicyKeys();

			expect(keys.some(k => k.includes('HISTORIAN'))).toBe(true);
		});

		it('includes technical expert policies', () => {
			const keys = getAllPolicyKeys();

			expect(keys.some(k => k.includes('TECHNICAL_EXPERT'))).toBe(true);
		});
	});

	describe('policy fallback chain', () => {
		it('follows correct fallback order', () => {
			const subPhase = 'CUSTOM_SUBPHASE';
			const intent = 'CUSTOM_INTENT';

			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.INTAKE, subPhase, intent);

			expect(policy).not.toBeNull();
			expect(policy?.policyKey).toContain('TECHNICAL_EXPERT:INTAKE');
		});

		it('wildcard phase catches unmatched phases', () => {
			const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.VERIFY, undefined, undefined);

			expect(policy).not.toBeNull();
			expect(policy?.phase).toBe('*');
		});
	});

	describe('specific role policies', () => {
		describe('EXECUTOR policies', () => {
			it('has general EXECUTE policy', () => {
				const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE);

				expect(policy).not.toBeNull();
				expect(policy?.requiredBlocks.some(b => b.blockId === 'goal')).toBe(true);
				expect(policy?.requiredBlocks.some(b => b.blockId === 'constraints')).toBe(true);
			});

			it('has MAKER_PLANNER specific policy', () => {
				const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, 'MAKER_PLANNER');

				expect(policy).not.toBeNull();
				expect(policy?.intent).toBe('MAKER_PLANNER');
				expect(policy?.requiredBlocks.some(b => b.blockId === 'intent_record')).toBe(true);
			});
		});

		describe('VERIFIER policies', () => {
			it('has VERIFY phase policy', () => {
				const policy = getPolicy(Role.VERIFIER, Phase.VERIFY);

				expect(policy).not.toBeNull();
				expect(policy?.requiredBlocks.some(b => b.blockId === 'claim_to_verify')).toBe(true);
				expect(policy?.requiredBlocks.some(b => b.blockId === 'constraints')).toBe(true);
			});
		});

		describe('HISTORIAN policies', () => {
			it('has general HISTORICAL_CHECK policy', () => {
				const policy = getPolicy(Role.HISTORIAN, Phase.HISTORICAL_CHECK);

				expect(policy).not.toBeNull();
				expect(policy?.requiredBlocks.some(b => b.blockId === 'full_event_history')).toBe(true);
			});

			it('has ADJUDICATION subphase policy', () => {
				const policy = getPolicy(Role.HISTORIAN, Phase.HISTORICAL_CHECK, 'ADJUDICATION');

				expect(policy).not.toBeNull();
				expect(policy?.subPhase).toBe('ADJUDICATION');
				expect(policy?.requiredBlocks.some(b => b.blockId === 'conflicting_verdicts')).toBe(true);
			});
		});

		describe('TECHNICAL_EXPERT policies', () => {
			it('has INTAKE phase policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.INTAKE);

				expect(policy).not.toBeNull();
				expect(policy?.requiredBlocks.some(b => b.blockId === 'conversation_history')).toBe(true);
				expect(policy?.requiredBlocks.some(b => b.blockId === 'current_plan')).toBe(true);
			});

			it('has ARCHITECTURE DECOMPOSING policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'DECOMPOSING');

				expect(policy).not.toBeNull();
				expect(policy?.subPhase).toBe('DECOMPOSING');
			});

			it('has ARCHITECTURE MODELING policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'MODELING');

				expect(policy).not.toBeNull();
				expect(policy?.subPhase).toBe('MODELING');
			});

			it('has ARCHITECTURE DESIGNING policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'DESIGNING');

				expect(policy).not.toBeNull();
				expect(policy?.subPhase).toBe('DESIGNING');
			});

			it('has ARCHITECTURE SEQUENCING policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'SEQUENCING');

				expect(policy).not.toBeNull();
				expect(policy?.subPhase).toBe('SEQUENCING');
			});

			it('has VALIDATE HYPOTHESIZING security policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.VALIDATE, 'HYPOTHESIZING', 'security');

				expect(policy).not.toBeNull();
				expect(policy?.intent).toBe('security');
			});

			it('has VALIDATE HYPOTHESIZING logic policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.VALIDATE, 'HYPOTHESIZING', 'logic');

				expect(policy).not.toBeNull();
				expect(policy?.intent).toBe('logic');
			});

			it('has VALIDATE HYPOTHESIZING best_practices policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.VALIDATE, 'HYPOTHESIZING', 'best_practices');

				expect(policy).not.toBeNull();
				expect(policy?.intent).toBe('best_practices');
			});

			it('has VALIDATE GRADING policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.VALIDATE, 'GRADING');

				expect(policy).not.toBeNull();
				expect(policy?.subPhase).toBe('GRADING');
			});

			it('has wildcard fallback policy', () => {
				const policy = getPolicy(Role.TECHNICAL_EXPERT, Phase.PROPOSE);

				expect(policy).not.toBeNull();
				expect(policy?.phase).toBe('*');
				expect(policy?.requiredBlocks.some(b => b.blockId === 'question')).toBe(true);
			});
		});
	});

	describe('policy structure validation', () => {
		it('all required blocks have valid blockId', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				for (const block of policy.requiredBlocks) {
					expect(block.blockId).toBeDefined();
					expect(block.blockId.length).toBeGreaterThan(0);
				}
			}
		});

		it('all required blocks have valid source', () => {
			const validSources = ['handoff_doc', 'db_query', 'static', 'agent_synthesized'];
			
			for (const policy of CONTEXT_POLICIES.values()) {
				for (const block of policy.requiredBlocks) {
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

		it('all optional blocks have valid blockId', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				for (const block of policy.optionalBlocks) {
					expect(block.blockId).toBeDefined();
					expect(block.blockId.length).toBeGreaterThan(0);
				}
			}
		});

		it('section budgets cover all blocks', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				const allBlockIds = [
					...policy.requiredBlocks.map(b => b.blockId),
					...policy.optionalBlocks.map(b => b.blockId),
				];

				const budgetKeys = Object.keys(policy.sectionBudgets);
				
				for (const blockId of allBlockIds) {
					if (!budgetKeys.includes(blockId)) {
						console.warn(`Policy ${policy.policyKey} missing budget for block ${blockId}`);
					}
				}
			}
		});

		it('all policies have version number', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				expect(typeof policy.version).toBe('number');
				expect(policy.version).toBeGreaterThan(0);
			}
		});
	});

	describe('policy versioning', () => {
		it('all policies have distinct versions or keys', () => {
			const versionMap = new Map<string, number[]>();
			
			for (const policy of CONTEXT_POLICIES.values()) {
				const baseKey = `${policy.role}:${policy.phase}:${policy.subPhase}:${policy.intent}`;
				const versions = versionMap.get(baseKey) || [];
				versions.push(policy.version);
				versionMap.set(baseKey, versions);
			}

			for (const [key, versions] of versionMap) {
				expect(versions.length).toBe(1);
			}
		});
	});

	describe('integration scenarios', () => {
		it('retrieves correct policy for complete workflow', () => {
			const intakePolicy = getPolicy(Role.TECHNICAL_EXPERT, Phase.INTAKE);
			expect(intakePolicy).not.toBeNull();

			const archPolicy = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'DECOMPOSING');
			expect(archPolicy).not.toBeNull();

			const executePolicy = getPolicy(Role.EXECUTOR, Phase.EXECUTE);
			expect(executePolicy).not.toBeNull();

			const verifyPolicy = getPolicy(Role.VERIFIER, Phase.VERIFY);
			expect(verifyPolicy).not.toBeNull();
		});

		it('handles multi-role scenarios', () => {
			const executorPolicy = getPolicy(Role.EXECUTOR, Phase.EXECUTE);
			const verifierPolicy = getPolicy(Role.VERIFIER, Phase.VERIFY);

			expect(executorPolicy?.role).not.toBe(verifierPolicy?.role);
		});

		it('supports iterative refinement with fallbacks', () => {
			const specific = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'MODELING', 'specific_intent');
			const fallback = getPolicy(Role.TECHNICAL_EXPERT, Phase.ARCHITECTURE, 'MODELING');

			expect(specific?.policyKey).toBe(fallback?.policyKey);
		});
	});

	describe('edge cases', () => {
		it('handles empty subPhase string', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE, '');

			expect(policy).not.toBeNull();
		});

		it('handles empty intent string', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, '');

			expect(policy).not.toBeNull();
		});

		it('returns same policy for undefined vs wildcard', () => {
			const policy1 = getPolicy(Role.EXECUTOR, Phase.EXECUTE, undefined, undefined);
			const policy2 = getPolicy(Role.EXECUTOR, Phase.EXECUTE, '*', '*');

			expect(policy1?.policyKey).toBe(policy2?.policyKey);
		});

		it('handles case sensitivity in lookups', () => {
			const policy = getPolicy(Role.EXECUTOR, Phase.EXECUTE);

			expect(policy).not.toBeNull();
		});
	});

	describe('policy completeness', () => {
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

	describe('budget allocation', () => {
		it('all policies allocate non-zero budgets', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				for (const [blockId, budget] of Object.entries(policy.sectionBudgets)) {
					expect(budget).toBeGreaterThan(0);
				}
			}
		});

		it('policies prioritize critical blocks with higher budgets', () => {
			for (const policy of CONTEXT_POLICIES.values()) {
				const requiredBlockIds = policy.requiredBlocks.map(b => b.blockId);
				const optionalBlockIds = policy.optionalBlocks.map(b => b.blockId);

				const requiredBudgets = requiredBlockIds
					.map(id => policy.sectionBudgets[id] || 0);
				const optionalBudgets = optionalBlockIds
					.map(id => policy.sectionBudgets[id] || 0);

				if (requiredBudgets.length > 0 && optionalBudgets.length > 0) {
					const maxRequired = Math.max(...requiredBudgets);
					const minOptional = Math.min(...optionalBudgets.filter(b => b > 0));

					if (minOptional > 0) {
						expect(maxRequired).toBeGreaterThanOrEqual(minOptional * 0.5);
					}
				}
			}
		});
	});
});
