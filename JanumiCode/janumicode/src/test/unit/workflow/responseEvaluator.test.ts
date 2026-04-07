import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	evaluateExecutorResponse,
	createProposalBranches,
	EvaluationVerdict,
	type ProposalOption,
} from '../../../lib/workflow/responseEvaluator';

describe('ResponseEvaluator', () => {
	beforeEach(() => {
		initTestLogger();
	});

	afterEach(() => {
		teardownTestLogger();
	});

	describe('evaluateExecutorResponse', () => {
		describe('verdict classification', () => {
			it('defaults to PROCEED when provider unavailable', async () => {
				const result = await evaluateExecutorResponse(
					'Build a todo app',
					'I will create a React application with...',
					'test-dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
				expect(result.reasoning).toBeDefined();
			});

			it('returns PROCEED for coherent proposals', async () => {
				const result = await evaluateExecutorResponse(
					'Add authentication',
					'I will implement JWT-based authentication with the following steps: 1. Create auth middleware, 2. Add login endpoint, 3. Generate tokens',
					'test-dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('handles evaluation result structure', async () => {
				const result = await evaluateExecutorResponse(
					'Test goal',
					'Test response',
					'test-dialogue'
				);

				expect(result).toHaveProperty('verdict');
				expect(result).toHaveProperty('reasoning');
				expect(Object.values(EvaluationVerdict)).toContain(result.verdict);
			});
		});

		describe('error handling', () => {
			it('defaults to PROCEED on provider creation failure', async () => {
				const result = await evaluateExecutorResponse(
					'Goal',
					'Response',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
				expect(result.reasoning).toContain('unavailable');
			});

			it('handles empty goal gracefully', async () => {
				const result = await evaluateExecutorResponse(
					'',
					'Some response',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('handles empty response gracefully', async () => {
				const result = await evaluateExecutorResponse(
					'Some goal',
					'',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('handles very long responses', async () => {
				const longResponse = 'Detailed proposal. '.repeat(1000);
				const result = await evaluateExecutorResponse(
					'Goal',
					longResponse,
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('includes reasoning in all results', async () => {
				const result = await evaluateExecutorResponse(
					'Build app',
					'Implementation plan',
					'dialogue'
				);

				expect(result.reasoning).toBeDefined();
				expect(result.reasoning.length).toBeGreaterThan(0);
			});
		});

		describe('verdict-specific fields', () => {
			it('returns result without optional fields for PROCEED', async () => {
				const result = await evaluateExecutorResponse(
					'Goal',
					'Coherent proposal',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
				expect(result.questions).toBeUndefined();
				expect(result.options).toBeUndefined();
				expect(result.summary).toBeUndefined();
			});

			it('handles optional dialogue ID', async () => {
				const result = await evaluateExecutorResponse(
					'Goal',
					'Response'
				);

				expect(result.verdict).toBeDefined();
			});
		});

		describe('special characters and formatting', () => {
			it('handles code blocks in response', async () => {
				const response = `I will implement:
\`\`\`typescript
function authenticate(user: User) {
  return jwt.sign(user);
}
\`\`\``;
				const result = await evaluateExecutorResponse(
					'Add auth',
					response,
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('handles markdown formatting', async () => {
				const response = `# Implementation Plan
## Step 1: Setup
- Install dependencies
- Configure environment

## Step 2: Implementation
- Write code
- Add tests`;
				const result = await evaluateExecutorResponse(
					'Setup project',
					response,
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('handles unicode characters', async () => {
				const result = await evaluateExecutorResponse(
					'Build 应用',
					'Implementation: 实现功能 🚀',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('handles special characters', async () => {
				const result = await evaluateExecutorResponse(
					'Fix bug #123',
					'Solution: Update @Component decorator & add $event handler',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});
		});

		describe('real-world scenarios', () => {
			it('evaluates technical proposal', async () => {
				const result = await evaluateExecutorResponse(
					'Implement user authentication',
					'I will create a JWT-based authentication system with token refresh, secure password hashing using bcrypt, and session management.',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('evaluates architecture decision', async () => {
				const result = await evaluateExecutorResponse(
					'Choose database',
					'Based on the requirements, I recommend PostgreSQL for relational data integrity and complex queries.',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('evaluates implementation plan', async () => {
				const result = await evaluateExecutorResponse(
					'Add dark mode',
					'Step 1: Create theme context. Step 2: Add CSS variables. Step 3: Implement toggle switch. Step 4: Persist preference in localStorage.',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('evaluates refactoring proposal', async () => {
				const result = await evaluateExecutorResponse(
					'Refactor payment module',
					'I will extract payment provider logic into separate classes, implement the Strategy pattern, and add comprehensive error handling.',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});
		});

		describe('token usage tracking', () => {
			it('includes token usage when available', async () => {
				const result = await evaluateExecutorResponse(
					'Goal',
					'Response',
					'dialogue'
				);

				// Token usage might not be available in test environment
				expect(result.tokenUsage).toBeDefined();
			});
		});

		describe('edge cases', () => {
			it('handles whitespace-only goal', async () => {
				const result = await evaluateExecutorResponse(
					'   \n\t  ',
					'Response',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('handles whitespace-only response', async () => {
				const result = await evaluateExecutorResponse(
					'Goal',
					'   \n\t  ',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('handles responses with only punctuation', async () => {
				const result = await evaluateExecutorResponse(
					'Goal',
					'!!!???...',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});

			it('handles multiline goals', async () => {
				const goal = `Build a system that:
1. Handles authentication
2. Manages user data
3. Provides analytics`;
				const result = await evaluateExecutorResponse(
					goal,
					'Implementation plan',
					'dialogue'
				);

				expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			});
		});
	});

	describe('createProposalBranches', () => {
		it('creates branches from options', () => {
			const options: ProposalOption[] = [
				{
					label: 'Option A',
					summary: 'Use REST API',
					proposal: 'Implement RESTful endpoints...'
				},
				{
					label: 'Option B',
					summary: 'Use GraphQL',
					proposal: 'Implement GraphQL schema...'
				}
			];

			const branches = createProposalBranches(options);

			expect(branches).toHaveLength(2);
			expect(branches[0].branch_id).toBe('branch-1');
			expect(branches[1].branch_id).toBe('branch-2');
		});

		it('sets correct labels', () => {
			const options: ProposalOption[] = [
				{
					label: 'REST',
					summary: 'REST API',
					proposal: 'REST implementation'
				},
				{
					label: 'GraphQL',
					summary: 'GraphQL API',
					proposal: 'GraphQL implementation'
				}
			];

			const branches = createProposalBranches(options);

			expect(branches[0].label).toBe('REST');
			expect(branches[1].label).toBe('GraphQL');
		});

		it('preserves proposal content', () => {
			const options: ProposalOption[] = [
				{
					label: 'Option 1',
					summary: 'Summary 1',
					proposal: 'Full proposal text for option 1'
				}
			];

			const branches = createProposalBranches(options);

			expect(branches[0].proposal).toBe('Full proposal text for option 1');
			expect(branches[0].summary).toBe('Summary 1');
		});

		it('sets status to pending', () => {
			const options: ProposalOption[] = [
				{
					label: 'Test',
					summary: 'Test summary',
					proposal: 'Test proposal'
				}
			];

			const branches = createProposalBranches(options);

			expect(branches[0].status).toBe('pending');
		});

		it('handles empty options array', () => {
			const branches = createProposalBranches([]);

			expect(branches).toEqual([]);
		});

		it('handles single option', () => {
			const options: ProposalOption[] = [
				{
					label: 'Only Option',
					summary: 'The only option',
					proposal: 'Single proposal'
				}
			];

			const branches = createProposalBranches(options);

			expect(branches).toHaveLength(1);
			expect(branches[0].branch_id).toBe('branch-1');
		});

		it('handles many options', () => {
			const options: ProposalOption[] = Array.from({ length: 10 }, (_, i) => ({
				label: `Option ${i + 1}`,
				summary: `Summary ${i + 1}`,
				proposal: `Proposal ${i + 1}`
			}));

			const branches = createProposalBranches(options);

			expect(branches).toHaveLength(10);
			expect(branches[9].branch_id).toBe('branch-10');
		});

		it('creates branches with correct structure', () => {
			const options: ProposalOption[] = [
				{
					label: 'Test',
					summary: 'Test summary',
					proposal: 'Test proposal'
				}
			];

			const branches = createProposalBranches(options);

			expect(branches[0]).toHaveProperty('branch_id');
			expect(branches[0]).toHaveProperty('label');
			expect(branches[0]).toHaveProperty('proposal');
			expect(branches[0]).toHaveProperty('summary');
			expect(branches[0]).toHaveProperty('status');
		});

		it('does not include optional fields initially', () => {
			const options: ProposalOption[] = [
				{
					label: 'Test',
					summary: 'Summary',
					proposal: 'Proposal'
				}
			];

			const branches = createProposalBranches(options);

			expect(branches[0].assumptions).toBeUndefined();
			expect(branches[0].claim_ids).toBeUndefined();
			expect(branches[0].historical_findings).toBeUndefined();
		});
	});

	describe('EvaluationVerdict enum', () => {
		it('includes all expected verdicts', () => {
			expect(EvaluationVerdict.PROCEED).toBe('PROCEED');
			expect(EvaluationVerdict.ESCALATE_CONFUSED).toBe('ESCALATE_CONFUSED');
			expect(EvaluationVerdict.ESCALATE_QUESTIONS).toBe('ESCALATE_QUESTIONS');
			expect(EvaluationVerdict.ESCALATE_OPTIONS).toBe('ESCALATE_OPTIONS');
		});

		it('includes decomposition quality verdicts', () => {
			expect(EvaluationVerdict.DECOMPOSE_REQUIRED).toBe('DECOMPOSE_REQUIRED');
			expect(EvaluationVerdict.TOO_COARSE).toBe('TOO_COARSE');
			expect(EvaluationVerdict.NOT_VERIFIABLE).toBe('NOT_VERIFIABLE');
			expect(EvaluationVerdict.MISSING_OBSERVABLES).toBe('MISSING_OBSERVABLES');
		});

		it('includes workflow verdict', () => {
			expect(EvaluationVerdict.MISSING_ACCEPTANCE_CONTRACT).toBe('MISSING_ACCEPTANCE_CONTRACT');
		});
	});

	describe('integration scenarios', () => {
		it('evaluates typical workflow progression', async () => {
			// User goal
			const goal = 'Add payment processing to checkout';
			
			// Executor provides coherent proposal
			const response = 'I will integrate Stripe payment processing with webhook handlers for payment confirmation';
			
			const result = await evaluateExecutorResponse(goal, response, 'dialogue-1');

			expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
		});

		it('handles sequential evaluations', async () => {
			const result1 = await evaluateExecutorResponse('Goal 1', 'Response 1', 'dlg-1');
			const result2 = await evaluateExecutorResponse('Goal 2', 'Response 2', 'dlg-2');
			const result3 = await evaluateExecutorResponse('Goal 3', 'Response 3', 'dlg-3');

			expect(result1.verdict).toBe(EvaluationVerdict.PROCEED);
			expect(result2.verdict).toBe(EvaluationVerdict.PROCEED);
			expect(result3.verdict).toBe(EvaluationVerdict.PROCEED);
		});

		it('evaluates multiple options scenario', async () => {
			const options: ProposalOption[] = [
				{
					label: 'Microservices',
					summary: 'Split into microservices',
					proposal: 'Decompose monolith into separate services'
				},
				{
					label: 'Modular Monolith',
					summary: 'Keep as monolith with modules',
					proposal: 'Refactor into well-defined modules'
				}
			];

			const branches = createProposalBranches(options);

			expect(branches).toHaveLength(2);
			expect(branches.every(b => b.status === 'pending')).toBe(true);
		});
	});

	describe('fail-safe behavior', () => {
		it('never blocks workflow with errors', async () => {
			// Even with problematic inputs, should default to PROCEED
			const result = await evaluateExecutorResponse(
				'',
				''
			);

			expect(result.verdict).toBe(EvaluationVerdict.PROCEED);
			expect(result.reasoning).toBeDefined();
		});

		it('provides helpful reasoning on failure', async () => {
			const result = await evaluateExecutorResponse(
				'Goal',
				'Response',
				'dialogue'
			);

			expect(result.reasoning).toBeDefined();
			expect(typeof result.reasoning).toBe('string');
			expect(result.reasoning.length).toBeGreaterThan(0);
		});
	});
});
