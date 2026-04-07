import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import { classifyIntakeInput } from '../../../lib/workflow/intakeClassifier';
import { IntakeMode } from '../../../lib/types';

describe('IntakeClassifier', () => {
	beforeEach(() => {
		initTestLogger();
	});

	afterEach(() => {
		teardownTestLogger();
	});

	describe('classifyIntakeInput - heuristic fallback', () => {
		describe('STATE_DRIVEN mode', () => {
			it('classifies vague high-level requests', async () => {
				const result = await classifyIntakeInput(
					'Build a real estate platform',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
				expect(result.confidence).toBeGreaterThan(0);
				expect(result.rationale).toBeDefined();
			});

			it('classifies short concept ideas', async () => {
				const result = await classifyIntakeInput(
					'I want an app that tracks fitness goals',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
			});

			it('classifies greenfield projects', async () => {
				const result = await classifyIntakeInput(
					'Create a new marketplace for freelancers from scratch',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
			});

			it('classifies MVP requests', async () => {
				const result = await classifyIntakeInput(
					'We need to build an MVP for a food delivery service',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
			});

			it('handles very short inputs', async () => {
				const result = await classifyIntakeInput(
					'Build todo app',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
			});
		});

		describe('DOCUMENT_BASED mode', () => {
			it('classifies document review requests', async () => {
				const result = await classifyIntakeInput(
					'Review the specifications in specs/ and prepare for implementation',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
				expect(result.confidence).toBeGreaterThan(0);
			});

			it('classifies PRD analysis requests', async () => {
				const result = await classifyIntakeInput(
					'Analyze these PRD documents and identify what is missing',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});

			it('classifies codebase review requests', async () => {
				const result = await classifyIntakeInput(
					'Look at the existing codebase and propose improvements',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});

			it('classifies requests with document references', async () => {
				const result = await classifyIntakeInput(
					'Here are our requirements documents - assess readiness for development',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});

			it('detects spec attachments', async () => {
				const result = await classifyIntakeInput(
					'Review these files',
					['specs/requirements.md', 'docs/architecture.pdf']
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});

			it('detects spec format markers', async () => {
				const result = await classifyIntakeInput(
					`# RFC-001: User Authentication
## Background
## Requirements
### Functional
- User login
- Password reset`,
					[]
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});

			it('detects path references', async () => {
				const result = await classifyIntakeInput(
					'Analyze the code in src/auth/ and docs/api.md',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});
		});

		describe('HYBRID_CHECKPOINTS mode', () => {
			it('classifies scoped feature requests', async () => {
				const result = await classifyIntakeInput(
					'Add dark mode support to the settings page',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
			});

			it('classifies bug fix requests', async () => {
				const result = await classifyIntakeInput(
					'Fix the authentication timeout issue in the login flow',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
			});

			it('classifies refactor requests', async () => {
				const result = await classifyIntakeInput(
					'Refactor the payment module to support Stripe integration',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
			});

			it('classifies specific tasks', async () => {
				const result = await classifyIntakeInput(
					'We need to add multi-tenancy - here is what we have considered so far',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
			});

			it('classifies modification requests', async () => {
				const result = await classifyIntakeInput(
					'Update the user profile page to include avatar upload',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
			});

			it('classifies migration tasks', async () => {
				const result = await classifyIntakeInput(
					'Migrate the database from PostgreSQL to MongoDB',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
			});
		});

		describe('keyword detection', () => {
			it('detects review intent keywords', async () => {
				const inputs = [
					'review the codebase',
					'analyze the architecture',
					'evaluate the design',
					'examine the specifications',
					'audit the security',
					'assess readiness'
				];

				for (const input of inputs) {
					const result = await classifyIntakeInput(input, []);
					expect([IntakeMode.DOCUMENT_BASED, IntakeMode.HYBRID_CHECKPOINTS])
						.toContain(result.recommended);
				}
			});

			it('detects document reference keywords', async () => {
				const inputs = [
					'check the specification',
					'review the docs',
					'analyze the requirements',
					'look at the design document',
					'read the PRD',
					'examine the RFC'
				];

				for (const input of inputs) {
					const result = await classifyIntakeInput(input, []);
					expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
				}
			});

			it('detects greenfield intent keywords', async () => {
				const inputs = [
					'build a new app',
					'create a service',
					'design a platform',
					'develop from scratch',
					'I want to make',
					'we need a new product'
				];

				for (const input of inputs) {
					const result = await classifyIntakeInput(input, []);
					expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
				}
			});

			it('detects scoped task keywords', async () => {
				const inputs = [
					'fix the bug',
					'update the feature',
					'change the behavior',
					'add a button',
					'remove the field',
					'refactor the code'
				];

				for (const input of inputs) {
					const result = await classifyIntakeInput(input, []);
					expect(result.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
				}
			});
		});

		describe('signal analysis', () => {
			it('considers word count in classification', async () => {
				const short = await classifyIntakeInput('Build app', []);
				const long = await classifyIntakeInput(
					'Build a comprehensive enterprise resource planning system with modules for inventory management, customer relationship management, human resources, accounting, and supply chain optimization. The system should support multi-tenant architecture, role-based access control, and integrate with existing ERP systems via REST APIs. We need detailed reporting dashboards, real-time notifications, and mobile app support.',
					[]
				);

				expect(short.recommended).toBe(IntakeMode.STATE_DRIVEN);
				expect(long.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});

			it('increases confidence with multiple signals', async () => {
				const weak = await classifyIntakeInput('Fix bug', []);
				const strong = await classifyIntakeInput(
					'Fix the critical authentication timeout bug in the login flow that affects enterprise customers',
					[]
				);

				expect(strong.confidence).toBeGreaterThanOrEqual(weak.confidence);
			});

			it('handles mixed signals', async () => {
				const result = await classifyIntakeInput(
					'Review the existing authentication code and build a new SSO integration',
					[]
				);

				expect(result.recommended).toBeDefined();
				expect(result.confidence).toBeGreaterThan(0);
			});
		});

		describe('attachment handling', () => {
			it('recognizes markdown spec files', async () => {
				const result = await classifyIntakeInput(
					'Prepare for development',
					['requirements.md', 'architecture.md']
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});

			it('recognizes PDF documents', async () => {
				const result = await classifyIntakeInput(
					'Review these',
					['design.pdf', 'specs.pdf']
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});

			it('recognizes YAML/JSON config files', async () => {
				const result = await classifyIntakeInput(
					'Analyze configuration',
					['config.yaml', 'settings.json']
				);

				expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
			});

			it('handles non-spec attachments', async () => {
				const result = await classifyIntakeInput(
					'Build a new feature',
					['screenshot.png', 'mockup.jpg']
				);

				expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
			});
		});

		describe('edge cases', () => {
			it('handles empty input', async () => {
				const result = await classifyIntakeInput('', []);

				expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
			});

			it('handles whitespace-only input', async () => {
				const result = await classifyIntakeInput('   \n\t  ', []);

				expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
			});

			it('handles special characters', async () => {
				const result = await classifyIntakeInput(
					'Fix bug #1234: API returns 500 @/api/users',
					[]
				);

				expect(result.recommended).toBeDefined();
			});

			it('handles unicode characters', async () => {
				const result = await classifyIntakeInput(
					'构建一个新应用 Build new app 🚀',
					[]
				);

				expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
			});

			it('provides rationale for all classifications', async () => {
				const inputs = [
					'Build app',
					'Review specs/',
					'Fix the login bug'
				];

				for (const input of inputs) {
					const result = await classifyIntakeInput(input, []);
					expect(result.rationale).toBeDefined();
					expect(result.rationale.length).toBeGreaterThan(0);
				}
			});
		});

		describe('confidence scoring', () => {
			it('returns confidence between 0 and 1', async () => {
				const result = await classifyIntakeInput('Build a todo app', []);

				expect(result.confidence).toBeGreaterThanOrEqual(0);
				expect(result.confidence).toBeLessThanOrEqual(1);
			});

			it('higher confidence for clear signals', async () => {
				const vague = await classifyIntakeInput('Do something', []);
				const clear = await classifyIntakeInput(
					'Review the PRD in docs/ and analyze the architecture specifications',
					['docs/prd.md', 'specs/architecture.pdf']
				);

				expect(clear.confidence).toBeGreaterThan(vague.confidence);
			});

			it('moderate confidence for ambiguous inputs', async () => {
				const result = await classifyIntakeInput(
					'We need better user management',
					[]
				);

				expect(result.confidence).toBeGreaterThan(0.5);
				expect(result.confidence).toBeLessThan(1);
			});
		});
	});

	describe('classification consistency', () => {
		it('produces consistent results for same input', async () => {
			const input = 'Add authentication to the user dashboard';
			
			const result1 = await classifyIntakeInput(input, []);
			const result2 = await classifyIntakeInput(input, []);

			expect(result1.recommended).toBe(result2.recommended);
			expect(result1.confidence).toBe(result2.confidence);
		});

		it('differentiates similar inputs with different intents', async () => {
			const build = await classifyIntakeInput('Build authentication system', []);
			const fix = await classifyIntakeInput('Fix authentication bug', []);
			const review = await classifyIntakeInput('Review authentication docs', []);

			expect(build.recommended).toBe(IntakeMode.STATE_DRIVEN);
			expect(fix.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
			expect(review.recommended).toBe(IntakeMode.DOCUMENT_BASED);
		});
	});

	describe('real-world examples', () => {
		it('classifies e-commerce platform request', async () => {
			const result = await classifyIntakeInput(
				'I want to build an e-commerce platform for selling handmade crafts',
				[]
			);

			expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
		});

		it('classifies API integration task', async () => {
			const result = await classifyIntakeInput(
				'Integrate Stripe payment processing into the checkout flow',
				[]
			);

			expect(result.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
		});

		it('classifies legacy code review', async () => {
			const result = await classifyIntakeInput(
				'Analyze the legacy authentication system in src/auth/ and recommend modernization approach',
				[]
			);

			expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
		});

		it('classifies performance optimization', async () => {
			const result = await classifyIntakeInput(
				'Optimize database queries in the user service - currently taking 3+ seconds',
				[]
			);

			expect(result.recommended).toBe(IntakeMode.HYBRID_CHECKPOINTS);
		});

		it('classifies greenfield SaaS', async () => {
			const result = await classifyIntakeInput(
				'Create a SaaS product for project management',
				[]
			);

			expect(result.recommended).toBe(IntakeMode.STATE_DRIVEN);
		});

		it('classifies spec-driven development', async () => {
			const result = await classifyIntakeInput(
				'Implement the features defined in the attached requirements document',
				['requirements.docx']
			);

			expect(result.recommended).toBe(IntakeMode.DOCUMENT_BASED);
		});
	});
});
