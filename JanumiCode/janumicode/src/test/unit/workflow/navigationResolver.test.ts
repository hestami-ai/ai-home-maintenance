import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	resolveNavigationTarget,
	assessNavigation,
	getAvailableTargets,
	type NavigationTarget,
} from '../../../lib/workflow/navigationResolver';
import { Phase } from '../../../lib/types';
import { createGate } from '../../../lib/workflow/gates';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../lib/database/init';

describe('NavigationResolver', () => {
	let tempDb: TempDbContext;
	let dialogueId: string;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
		dialogueId = randomUUID();

		const db = getDatabase()!;
		db.prepare(
			"INSERT INTO dialogues (dialogue_id, goal, status, created_at) VALUES (?, 'test goal', 'ACTIVE', datetime('now'))"
		).run(dialogueId);
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
	});

	describe('resolveNavigationTarget', () => {
		describe('major phase aliases', () => {
			it('resolves intake phase', () => {
				const result = resolveNavigationTarget('intake', Phase.PROPOSE);
				expect(result).toEqual({ majorPhase: Phase.INTAKE });
			});

			it('resolves architecture phase', () => {
				const result = resolveNavigationTarget('architecture', Phase.INTAKE);
				expect(result).toEqual({ majorPhase: Phase.ARCHITECTURE });
			});

			it('resolves propose phase', () => {
				const result = resolveNavigationTarget('propose', Phase.INTAKE);
				expect(result).toEqual({ majorPhase: Phase.PROPOSE });
			});

			it('resolves proposal alias', () => {
				const result = resolveNavigationTarget('proposal', Phase.INTAKE);
				expect(result).toEqual({ majorPhase: Phase.PROPOSE });
			});

			it('resolves assumption surfacing', () => {
				const result = resolveNavigationTarget('assumption surfacing', Phase.PROPOSE);
				expect(result).toEqual({ majorPhase: Phase.ASSUMPTION_SURFACING });
			});

			it('resolves assumptions alias', () => {
				const result = resolveNavigationTarget('assumptions', Phase.PROPOSE);
				expect(result).toEqual({ majorPhase: Phase.ASSUMPTION_SURFACING });
			});

			it('resolves verify phase', () => {
				const result = resolveNavigationTarget('verify', Phase.ASSUMPTION_SURFACING);
				expect(result).toEqual({ majorPhase: Phase.VERIFY });
			});

			it('resolves verification alias', () => {
				const result = resolveNavigationTarget('verification', Phase.PROPOSE);
				expect(result).toEqual({ majorPhase: Phase.VERIFY });
			});

			it('resolves historical check', () => {
				const result = resolveNavigationTarget('historical check', Phase.VERIFY);
				expect(result).toEqual({ majorPhase: Phase.HISTORICAL_CHECK });
			});

			it('resolves historical alias', () => {
				const result = resolveNavigationTarget('historical', Phase.VERIFY);
				expect(result).toEqual({ majorPhase: Phase.HISTORICAL_CHECK });
			});

			it('resolves review phase', () => {
				const result = resolveNavigationTarget('review', Phase.HISTORICAL_CHECK);
				expect(result).toEqual({ majorPhase: Phase.REVIEW });
			});

			it('resolves execute phase', () => {
				const result = resolveNavigationTarget('execute', Phase.REVIEW);
				expect(result).toEqual({ majorPhase: Phase.EXECUTE });
			});

			it('resolves execution alias', () => {
				const result = resolveNavigationTarget('execution', Phase.REVIEW);
				expect(result).toEqual({ majorPhase: Phase.EXECUTE });
			});

			it('resolves validate phase', () => {
				const result = resolveNavigationTarget('validate', Phase.EXECUTE);
				expect(result).toEqual({ majorPhase: Phase.VALIDATE });
			});

			it('resolves validation alias', () => {
				const result = resolveNavigationTarget('validation', Phase.EXECUTE);
				expect(result).toEqual({ majorPhase: Phase.VALIDATE });
			});

			it('resolves commit phase', () => {
				const result = resolveNavigationTarget('commit', Phase.VALIDATE);
				expect(result).toEqual({ majorPhase: Phase.COMMIT });
			});

			it('resolves replan phase', () => {
				const result = resolveNavigationTarget('replan', Phase.VALIDATE);
				expect(result).toEqual({ majorPhase: Phase.REPLAN });
			});
		});

		describe('architecture sub-phases', () => {
			it('resolves technical analysis', () => {
				const result = resolveNavigationTarget('technical analysis', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
				expect(result?.subPhaseOwner).toBe('ARCHITECTURE');
			});

			it('resolves decompose', () => {
				const result = resolveNavigationTarget('decompose', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
				expect(result?.subPhaseOwner).toBe('ARCHITECTURE');
			});

			it('resolves decomposing alias', () => {
				const result = resolveNavigationTarget('decomposing', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
			});

			it('resolves modeling', () => {
				const result = resolveNavigationTarget('modeling', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
			});

			it('resolves domain model alias', () => {
				const result = resolveNavigationTarget('domain model', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
			});

			it('resolves designing', () => {
				const result = resolveNavigationTarget('designing', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
			});

			it('resolves component design alias', () => {
				const result = resolveNavigationTarget('component design', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
			});

			it('resolves sequencing', () => {
				const result = resolveNavigationTarget('sequencing', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
			});

			it('resolves presenting', () => {
				const result = resolveNavigationTarget('presenting', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
			});

			it('resolves architecture review alias', () => {
				const result = resolveNavigationTarget('architecture review', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
			});
		});

		describe('intake sub-phases', () => {
			it('resolves intent discovery', () => {
				const result = resolveNavigationTarget('intent discovery', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
				expect(result?.subPhaseOwner).toBe('INTAKE');
			});

			it('resolves analysis alias', () => {
				const result = resolveNavigationTarget('analysis', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves product review', () => {
				const result = resolveNavigationTarget('product review', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves proposing domains', () => {
				const result = resolveNavigationTarget('proposing domains', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves domains alias', () => {
				const result = resolveNavigationTarget('domains', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves proposing journeys', () => {
				const result = resolveNavigationTarget('proposing journeys', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves journeys alias', () => {
				const result = resolveNavigationTarget('journeys', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves proposing entities', () => {
				const result = resolveNavigationTarget('proposing entities', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves entities alias', () => {
				const result = resolveNavigationTarget('entities', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves proposing integrations', () => {
				const result = resolveNavigationTarget('proposing integrations', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves integrations alias', () => {
				const result = resolveNavigationTarget('integrations', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves clarifying', () => {
				const result = resolveNavigationTarget('clarifying', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves synthesizing', () => {
				const result = resolveNavigationTarget('synthesizing', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('resolves approval', () => {
				const result = resolveNavigationTarget('approval', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});
		});

		describe('context-sensitive aliases', () => {
			it('resolves validating to VALIDATE phase from non-architecture', () => {
				const result = resolveNavigationTarget('validating', Phase.EXECUTE);
				expect(result?.majorPhase).toBe(Phase.VALIDATE);
			});

			it('resolves validating to architecture sub-phase from architecture', () => {
				const result = resolveNavigationTarget('validating', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
				expect(result?.subPhaseOwner).toBe('ARCHITECTURE');
			});

			it('resolves proposing to PROPOSE phase from non-intake', () => {
				const result = resolveNavigationTarget('proposing', Phase.VERIFY);
				expect(result?.majorPhase).toBe(Phase.PROPOSE);
			});

			it('resolves proposing to intake sub-phase from intake', () => {
				const result = resolveNavigationTarget('proposing', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
				expect(result?.subPhaseOwner).toBe('INTAKE');
			});
		});

		describe('normalization', () => {
			it('handles leading "go to"', () => {
				const result = resolveNavigationTarget('go to propose', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.PROPOSE);
			});

			it('handles leading "go back to"', () => {
				const result = resolveNavigationTarget('go back to intake', Phase.PROPOSE);
				expect(result?.majorPhase).toBe(Phase.INTAKE);
			});

			it('handles trailing "phase"', () => {
				const result = resolveNavigationTarget('execute phase', Phase.REVIEW);
				expect(result?.majorPhase).toBe(Phase.EXECUTE);
			});

			it('handles "the" prefix', () => {
				const result = resolveNavigationTarget('the verification phase', Phase.PROPOSE);
				expect(result?.majorPhase).toBe(Phase.VERIFY);
			});

			it('handles mixed case', () => {
				const result = resolveNavigationTarget('PROPOSE', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.PROPOSE);
			});

			it('handles extra whitespace', () => {
				const result = resolveNavigationTarget('  propose  ', Phase.INTAKE);
				expect(result?.majorPhase).toBe(Phase.PROPOSE);
			});

			it('handles hyphens in sub-phase', () => {
				const result = resolveNavigationTarget('go to the sub-phase decompose', Phase.ARCHITECTURE);
				expect(result?.majorPhase).toBe(Phase.ARCHITECTURE);
			});
		});

		describe('edge cases', () => {
			it('returns null for empty string', () => {
				const result = resolveNavigationTarget('', Phase.INTAKE);
				expect(result).toBeNull();
			});

			it('returns null for whitespace only', () => {
				const result = resolveNavigationTarget('   ', Phase.INTAKE);
				expect(result).toBeNull();
			});

			it('returns null for unrecognized target', () => {
				const result = resolveNavigationTarget('unknown phase', Phase.INTAKE);
				expect(result).toBeNull();
			});

			it('returns null for partial matches', () => {
				const result = resolveNavigationTarget('prop', Phase.INTAKE);
				expect(result).toBeNull();
			});

			it('handles special characters gracefully', () => {
				const result = resolveNavigationTarget('propose!!!', Phase.INTAKE);
				expect(result).toBeNull();
			});
		});
	});

	describe('assessNavigation', () => {
		describe('direction detection', () => {
			it('detects forward navigation', () => {
				const target: NavigationTarget = { majorPhase: Phase.EXECUTE };
				const assessment = assessNavigation(target, Phase.PROPOSE, dialogueId);

				expect(assessment.direction).toBe('forward');
			});

			it('detects backward navigation', () => {
				const target: NavigationTarget = { majorPhase: Phase.INTAKE };
				const assessment = assessNavigation(target, Phase.EXECUTE, dialogueId);

				expect(assessment.direction).toBe('backward');
			});

			it('detects lateral navigation within same phase', () => {
				const target: NavigationTarget = {
					majorPhase: Phase.INTAKE,
					subPhase: 'SYNTHESIZING',
					subPhaseOwner: 'INTAKE',
				};
				const assessment = assessNavigation(target, Phase.INTAKE, dialogueId);

				expect(assessment.direction).toBe('lateral');
			});

			it('treats REPLAN as equivalent to PROPOSE level', () => {
				const target: NavigationTarget = { majorPhase: Phase.REPLAN };
				const assessment = assessNavigation(target, Phase.PROPOSE, dialogueId);

				expect(assessment.direction).toBe('lateral');
			});
		});

		describe('gate cleanup requirements', () => {
			it('requires cleanup for backward navigation with open gates', () => {
				createGate({
					dialogueId,
					reason: 'Test gate',
					blockingClaims: [],
				});

				const target: NavigationTarget = { majorPhase: Phase.INTAKE };
				const assessment = assessNavigation(target, Phase.EXECUTE, dialogueId);

				expect(assessment.requiresGateCleanup).toBe(true);
				expect(assessment.openGateCount).toBe(1);
			});

			it('does not require cleanup for forward navigation with open gates', () => {
				createGate({
					dialogueId,
					reason: 'Test gate',
					blockingClaims: [],
				});

				const target: NavigationTarget = { majorPhase: Phase.EXECUTE };
				const assessment = assessNavigation(target, Phase.PROPOSE, dialogueId);

				expect(assessment.requiresGateCleanup).toBe(false);
			});

			it('does not require cleanup for backward navigation without open gates', () => {
				const target: NavigationTarget = { majorPhase: Phase.INTAKE };
				const assessment = assessNavigation(target, Phase.EXECUTE, dialogueId);

				expect(assessment.requiresGateCleanup).toBe(false);
				expect(assessment.openGateCount).toBe(0);
			});

			it('counts multiple open gates', () => {
				createGate({
					dialogueId,
					reason: 'Gate 1',
					blockingClaims: [],
				});
				createGate({
					dialogueId,
					reason: 'Gate 2',
					blockingClaims: [],
				});

				const target: NavigationTarget = { majorPhase: Phase.INTAKE };
				const assessment = assessNavigation(target, Phase.EXECUTE, dialogueId);

				expect(assessment.openGateCount).toBe(2);
			});
		});

		describe('skip warnings', () => {
			it('warns when skipping one phase forward', () => {
				const target: NavigationTarget = { majorPhase: Phase.VERIFY };
				const assessment = assessNavigation(target, Phase.PROPOSE, dialogueId);

				expect(assessment.warning).toBeDefined();
				expect(assessment.warning).toContain('Skipping 1 phase');
			});

			it('warns when skipping multiple phases forward', () => {
				const target: NavigationTarget = { majorPhase: Phase.EXECUTE };
				const assessment = assessNavigation(target, Phase.INTAKE, dialogueId);

				expect(assessment.warning).toBeDefined();
				expect(assessment.warning).toContain('Skipping');
			});

			it('does not warn for sequential forward navigation', () => {
				const target: NavigationTarget = { majorPhase: Phase.ARCHITECTURE };
				const assessment = assessNavigation(target, Phase.INTAKE, dialogueId);

				expect(assessment.warning).toBeUndefined();
			});

			it('does not warn for backward navigation', () => {
				const target: NavigationTarget = { majorPhase: Phase.INTAKE };
				const assessment = assessNavigation(target, Phase.EXECUTE, dialogueId);

				expect(assessment.warning).toBeUndefined();
			});

			it('does not warn for lateral navigation', () => {
				const target: NavigationTarget = {
					majorPhase: Phase.INTAKE,
					subPhase: 'CLARIFYING',
					subPhaseOwner: 'INTAKE',
				};
				const assessment = assessNavigation(target, Phase.INTAKE, dialogueId);

				expect(assessment.warning).toBeUndefined();
			});
		});

		describe('assessment fields', () => {
			it('includes target in assessment', () => {
				const target: NavigationTarget = { majorPhase: Phase.PROPOSE };
				const assessment = assessNavigation(target, Phase.INTAKE, dialogueId);

				expect(assessment.target).toEqual(target);
			});

			it('includes all required fields', () => {
				const target: NavigationTarget = { majorPhase: Phase.EXECUTE };
				const assessment = assessNavigation(target, Phase.PROPOSE, dialogueId);

				expect(assessment).toHaveProperty('target');
				expect(assessment).toHaveProperty('direction');
				expect(assessment).toHaveProperty('requiresGateCleanup');
				expect(assessment).toHaveProperty('openGateCount');
			});
		});
	});

	describe('getAvailableTargets', () => {
		it('returns list of available phases', () => {
			const targets = getAvailableTargets(Phase.PROPOSE);

			expect(targets).toContain('intake');
			expect(targets).toContain('propose');
			expect(targets).toContain('execute');
			expect(targets).toContain('commit');
		});

		it('excludes REPLAN from general list', () => {
			const targets = getAvailableTargets(Phase.PROPOSE);

			expect(targets).not.toContain('replan');
		});

		it('includes architecture sub-phases when in architecture', () => {
			const targets = getAvailableTargets(Phase.ARCHITECTURE);

			expect(targets).toContain('Architecture sub-phases');
		});

		it('includes intake sub-phases when in intake', () => {
			const targets = getAvailableTargets(Phase.INTAKE);

			expect(targets).toContain('Intake sub-phases');
			expect(targets).toContain('domains');
			expect(targets).toContain('journeys');
		});

		it('does not include sub-phases for other phases', () => {
			const targets = getAvailableTargets(Phase.EXECUTE);

			expect(targets).not.toContain('sub-phases');
		});

		it('formats phases as lowercase', () => {
			const targets = getAvailableTargets(Phase.PROPOSE);

			expect(targets).toMatch(/[a-z, ]+/);
			expect(targets).not.toContain('INTAKE');
		});
	});

	describe('integration scenarios', () => {
		it('resolves and assesses complete navigation workflow', () => {
			const target = resolveNavigationTarget('go back to intake', Phase.EXECUTE);
			expect(target).not.toBeNull();

			if (target) {
				const assessment = assessNavigation(target, Phase.EXECUTE, dialogueId);
				expect(assessment.direction).toBe('backward');
				expect(assessment.target.majorPhase).toBe(Phase.INTAKE);
			}
		});

		it('handles navigation with gates present', () => {
			createGate({
				dialogueId,
				reason: 'Blocking gate',
				blockingClaims: [],
			});

			const target = resolveNavigationTarget('intake', Phase.EXECUTE);
			if (target) {
				const assessment = assessNavigation(target, Phase.EXECUTE, dialogueId);
				expect(assessment.openGateCount).toBe(1);
				expect(assessment.requiresGateCleanup).toBe(true);
			}
		});

		it('handles context-sensitive resolution and assessment', () => {
			const target = resolveNavigationTarget('validating', Phase.ARCHITECTURE);
			expect(target?.majorPhase).toBe(Phase.ARCHITECTURE);

			if (target) {
				const assessment = assessNavigation(target, Phase.ARCHITECTURE, dialogueId);
				expect(assessment.direction).toBe('lateral');
			}
		});

		it('handles sub-phase navigation', () => {
			const target = resolveNavigationTarget('decompose', Phase.ARCHITECTURE);
			expect(target?.subPhase).toBeDefined();

			if (target) {
				const assessment = assessNavigation(target, Phase.ARCHITECTURE, dialogueId);
				expect(assessment.direction).toBe('lateral');
			}
		});

		it('provides helpful targets list for current context', () => {
			const targets = getAvailableTargets(Phase.INTAKE);
			expect(targets).toBeTruthy();
			expect(targets.length).toBeGreaterThan(0);

			const resolved = resolveNavigationTarget('domains', Phase.INTAKE);
			expect(resolved).not.toBeNull();
		});

		it('handles sequential phase transitions', () => {
			const phases = [Phase.INTAKE, Phase.ARCHITECTURE, Phase.PROPOSE, Phase.VERIFY, Phase.EXECUTE];

			for (let i = 0; i < phases.length - 1; i++) {
				const current = phases[i];
				const next = phases[i + 1];
				const target: NavigationTarget = { majorPhase: next };
				const assessment = assessNavigation(target, current, dialogueId);
				expect(assessment.direction).toBe('forward');
				expect(assessment.warning).toBeUndefined();
			}
		});

		it('handles various user input formats', () => {
			const inputs = [
				'go to propose',
				'back to intake',
				'the verification phase',
				'execute',
				'go back to the decompose sub-phase',
			];

			for (const input of inputs) {
				const result = resolveNavigationTarget(input, Phase.PROPOSE);
				expect(result).not.toBeNull();
			}
		});
	});
});
