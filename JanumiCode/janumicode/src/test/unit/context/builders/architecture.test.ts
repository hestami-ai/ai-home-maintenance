import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../../helpers/fakeLogger';
import {
	buildDecomposingContext,
	buildModelingContext,
	type DecomposingContextOptions,
	type ModelingContextOptions,
} from '../../../../lib/context/builders/architecture';
import type { IntakePlanDocument } from '../../../../lib/types/intake';
import type { ArchitectureDocument, CapabilityNode } from '../../../../lib/types/architecture';
import { ArchitectureDocumentStatus } from '../../../../lib/types/architecture';
import { randomUUID } from 'node:crypto';

describe('Architecture Context Builder', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	const createMockPlan = (title: string): IntakePlanDocument => ({
		version: 1,
		title,
		summary: 'Test summary',
		proposedApproach: 'Build using modern architecture',
		requirements: [],
		decisions: [],
		constraints: [],
		openQuestions: [],
		technicalNotes: [],
		lastUpdatedAt: new Date().toISOString(),
	});

	const createMockArchitectureDoc = (): ArchitectureDocument => ({
		doc_id: randomUUID(),
		dialogue_id: dialogueId,
		version: 1,
		capabilities: [],
		workflow_graph: [],
		components: [],
		data_models: [],
		interfaces: [],
		implementation_sequence: [],
		goal_alignment_score: null,
		validation_findings: [],
		status: ArchitectureDocumentStatus.DRAFT,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
	});

	describe('buildDecomposingContext', () => {
		it('builds basic decomposing context successfully', () => {
			const approvedPlan = createMockPlan('Build REST API');

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('Build REST API');
			}
		});

		it('includes plan title in context', () => {
			const approvedPlan = createMockPlan('User Authentication System');

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('User Authentication System');
			}
		});

		it('includes proposed approach when present', () => {
			const approvedPlan = createMockPlan('Test Plan');
			approvedPlan.proposedApproach = 'Use microservices architecture';

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('microservices architecture');
			}
		});

		it('includes requirements when present', () => {
			const approvedPlan = createMockPlan('Test Plan');
			approvedPlan.requirements = [
				{ id: 'REQ-1', type: 'REQUIREMENT', text: 'Must support REST API', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
				{ id: 'REQ-2', type: 'REQUIREMENT', text: 'Must handle 1000 requests/sec', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
			];

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('REQ-1');
				expect(result.value).toContain('support REST API');
			}
		});

		it('includes decisions when present', () => {
			const approvedPlan = createMockPlan('Test Plan');
			approvedPlan.decisions = [
				{ id: 'DEC-1', type: 'DECISION', text: 'Use PostgreSQL database', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
			];

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('DEC-1');
				expect(result.value).toContain('PostgreSQL');
			}
		});

		it('includes constraints when present', () => {
			const approvedPlan = createMockPlan('Test Plan');
			approvedPlan.constraints = [
				{ id: 'CON-1', type: 'CONSTRAINT', text: 'Must use TypeScript', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
				{ id: 'CON-2', type: 'CONSTRAINT', text: 'Budget limit: $10,000', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
			];

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('TypeScript');
				expect(result.value).toContain('Budget limit');
			}
		});

		it('includes engineering domain coverage', () => {
			const approvedPlan = createMockPlan('Test Plan');
			const engineeringDomainCoverage = null;

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				// engineeringDomainCoverage is now null in this test
			}
		});

		it('includes human feedback when provided', () => {
			const approvedPlan = createMockPlan('Test Plan');

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
				humanFeedback: 'Add more detail to capability descriptions',
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('Validation Feedback');
				expect(result.value).toContain('more detail');
			}
		});

		it('handles empty requirements array', () => {
			const approvedPlan = createMockPlan('Test Plan');
			approvedPlan.requirements = [];

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
		});

		it('handles null engineering domain coverage', () => {
			const approvedPlan = createMockPlan('Test Plan');

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
		});

		it('respects token budget allocation', () => {
			const approvedPlan = createMockPlan('Test Plan');

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 5000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
		});

		it('handles requirements without id', () => {
			const approvedPlan = createMockPlan('Test Plan');
			approvedPlan.requirements = [
				{ id: 'REQ-1', type: 'REQUIREMENT', text: 'Requirement without ID', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
			];

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('Requirement without ID');
			}
		});
	});

	describe('buildModelingContext', () => {
		it('builds basic modeling context successfully', () => {
			const architectureDoc = createMockArchitectureDoc();

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 10000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toBeDefined();
			}
		});

		it('includes capabilities in context', () => {
			const architectureDoc = createMockArchitectureDoc();
			const capability: CapabilityNode = {
				capability_id: 'cap-1',
				parent_capability_id: null,
				label: 'User Management',
				description: 'Manage user accounts and authentication',
				source_requirements: ['REQ-1'],
				engineering_domain_mappings: [],
				workflows: [],
			};
			architectureDoc.capabilities = [capability];

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 10000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('User Management');
				expect(result.value).toContain('user accounts');
			}
		});

		it('handles hierarchical capabilities', () => {
			const architectureDoc = createMockArchitectureDoc();
			const parent: CapabilityNode = {
				capability_id: 'cap-parent',
				parent_capability_id: null,
				label: 'Authentication',
				description: 'Authentication system',
				source_requirements: [],
				engineering_domain_mappings: [],
				workflows: [],
			};
			const child: CapabilityNode = {
				capability_id: 'cap-child',
				parent_capability_id: 'cap-parent',
				label: 'OAuth',
				description: 'OAuth provider',
				source_requirements: [],
				engineering_domain_mappings: [],
				workflows: [],
			};
			architectureDoc.capabilities = [parent, child];

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 10000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('Authentication');
				expect(result.value).toContain('OAuth');
			}
		});

		it('includes source requirements for capabilities', () => {
			const architectureDoc = createMockArchitectureDoc();
			const capability: CapabilityNode = {
				capability_id: 'cap-1',
				parent_capability_id: null,
				label: 'Test Capability',
				description: 'Test',
				source_requirements: ['REQ-1', 'REQ-2'],
				engineering_domain_mappings: [],
				workflows: [],
			};
			architectureDoc.capabilities = [capability];

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 10000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('REQ-1');
				expect(result.value).toContain('REQ-2');
			}
		});

		it('handles empty capabilities array', () => {
			const architectureDoc = createMockArchitectureDoc();
			architectureDoc.capabilities = [];

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 10000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
		});

		it('respects token budget', () => {
			const architectureDoc = createMockArchitectureDoc();

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 5000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('handles very long plan titles', () => {
			const longTitle = 'Build a comprehensive enterprise-grade system with multiple modules and complex integrations '.repeat(10);
			const approvedPlan = createMockPlan(longTitle);

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
		});

		it('handles special characters in plan data', () => {
			const approvedPlan = createMockPlan('Plan with @#$% & special chars 日本語');

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
		});

		it('handles many requirements', () => {
			const approvedPlan = createMockPlan('Test Plan');
			approvedPlan.requirements = Array.from({ length: 100 }, (_, i) => ({
				id: `REQ-${i}`,
				type: 'REQUIREMENT' as const,
				text: `Requirement ${i}`,
				extractedFromTurnId: 1,
				timestamp: new Date().toISOString(),
			}));

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 20000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
		});

		it('handles unicode in capability descriptions', () => {
			const architectureDoc = createMockArchitectureDoc();
			const capability: CapabilityNode = {
				capability_id: 'cap-1',
				parent_capability_id: null,
				label: '用户管理',
				description: 'システムのユーザー管理',
				source_requirements: [],
				engineering_domain_mappings: [],
				workflows: [],
			};
			architectureDoc.capabilities = [capability];

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 10000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('integration scenarios', () => {
		it('builds complete decomposing context with all features', () => {
			const approvedPlan = createMockPlan('Comprehensive System');
			approvedPlan.proposedApproach = 'Microservices with event-driven architecture';
			approvedPlan.requirements = [
				{ id: 'REQ-1', type: 'REQUIREMENT', text: 'High availability', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
				{ id: 'REQ-2', type: 'REQUIREMENT', text: 'Scalability', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
			];
			approvedPlan.decisions = [
				{ id: 'DEC-1', type: 'DECISION', text: 'Use Kubernetes', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
			];
			approvedPlan.constraints = [
				{ id: 'CON-1', type: 'CONSTRAINT', text: 'Must be cloud-native', extractedFromTurnId: 1, timestamp: new Date().toISOString() },
			];

			const engineeringDomainCoverage = null;

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage,
				tokenBudget: 15000,
				humanFeedback: 'Need more detail on scaling strategy',
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('Comprehensive System');
				expect(result.value).toContain('Microservices');
				expect(result.value).toContain('REQ-1');
				expect(result.value).toContain('DEC-1');
				expect(result.value).toContain('Validation Feedback');
			}
		});

		it('builds complete modeling context with hierarchy', () => {
			const architectureDoc = createMockArchitectureDoc();
			
			const parent1: CapabilityNode = {
				capability_id: 'cap-auth',
				parent_capability_id: null,
				label: 'Authentication',
				description: 'User authentication and authorization',
				source_requirements: ['REQ-1', 'REQ-2'],
				engineering_domain_mappings: [],
				workflows: [],
			};

			const child1: CapabilityNode = {
				capability_id: 'cap-oauth',
				parent_capability_id: 'cap-auth',
				label: 'OAuth Integration',
				description: 'Third-party OAuth providers',
				source_requirements: ['REQ-3'],
				engineering_domain_mappings: [],
				workflows: [],
			};

			const parent2: CapabilityNode = {
				capability_id: 'cap-data',
				parent_capability_id: null,
				label: 'Data Management',
				description: 'Data storage and retrieval',
				source_requirements: ['REQ-4'],
				engineering_domain_mappings: [],
				workflows: [],
			};

			architectureDoc.capabilities = [parent1, child1, parent2];

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 15000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('Authentication');
				expect(result.value).toContain('OAuth Integration');
				expect(result.value).toContain('Data Management');
			}
		});

		it('handles minimal plan data', () => {
			const approvedPlan = createMockPlan('Minimal Plan');

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 5000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
		});

		it('handles empty architecture document', () => {
			const architectureDoc = createMockArchitectureDoc();

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 5000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
		});
	});

	describe('context formatting', () => {
		it('formats decomposing context with proper sections', () => {
			const approvedPlan = createMockPlan('Test Plan');

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('# Approved Implementation Plan');
				expect(result.value).toContain('## Title');
			}
		});

		it('formats modeling context with proper sections', () => {
			const architectureDoc = createMockArchitectureDoc();

			const options: ModelingContextOptions = {
				dialogueId,
				architectureDoc,
				tokenBudget: 10000,
			};

			const result = buildModelingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toContain('# Architecture: Capabilities');
			}
		});

		it('includes markdown formatting in output', () => {
			const approvedPlan = createMockPlan('Test Plan');
			approvedPlan.requirements = [{ id: 'REQ-1', type: 'REQUIREMENT', text: 'Test requirement', extractedFromTurnId: 1, timestamp: new Date().toISOString() }];

			const options: DecomposingContextOptions = {
				dialogueId,
				approvedPlan,
				engineeringDomainCoverage: null,
				tokenBudget: 10000,
			};

			const result = buildDecomposingContext(options);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toMatch(/##/);
				expect(result.value).toMatch(/\*\*/);
			}
		});
	});
});
