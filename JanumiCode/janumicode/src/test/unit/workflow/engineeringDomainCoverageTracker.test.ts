import { describe, it, expect, beforeEach } from 'vitest';
import {
	initializeCoverageMap,
	updateCoverageFromText,
	updateCoverageFromExpert,
	getCoverageGaps,
	getPartialDomains,
	getCoverageSummary,
	shouldTriggerCheckpoint,
	buildCheckpoint,
	getNextDomain,
	isDomainAdequatelyCovered,
	formatCoverageSummaryForPrompt,
	formatUncoveredDomainsForPrompt,
	seedCoverageFromAnalysis,
	DOMAIN_SEQUENCE,
} from '../../../lib/workflow/engineeringDomainCoverageTracker';
import {
	EngineeringDomain,
	EngineeringDomainCoverageLevel,
	type EngineeringDomainCoverageMap,
} from '../../../lib/types';

describe('EngineeringDomainCoverageTracker', () => {
	let coverageMap: EngineeringDomainCoverageMap;

	beforeEach(() => {
		coverageMap = initializeCoverageMap();
	});

	describe('initializeCoverageMap', () => {
		it('creates map with all domains at NONE', () => {
			const map = initializeCoverageMap();
			
			for (const domain of Object.values(EngineeringDomain)) {
				expect(map[domain]).toBeDefined();
				expect(map[domain].level).toBe(EngineeringDomainCoverageLevel.NONE);
				expect(map[domain].evidence).toEqual([]);
				expect(map[domain].turnNumbers).toEqual([]);
			}
		});

		it('creates map with 12 domains', () => {
			const map = initializeCoverageMap();
			expect(Object.keys(map).length).toBe(12);
		});
	});

	describe('updateCoverageFromText', () => {
		it('detects problem domain keywords', () => {
			const text = 'Our mission is to solve the problem of inefficient workflows';
			const updated = updateCoverageFromText(coverageMap, text, 1);

			expect(updated[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.PARTIAL
			);
			expect(updated[EngineeringDomain.PROBLEM_MISSION].turnNumbers).toContain(1);
		});

		it('detects stakeholder keywords', () => {
			const text = 'The users and personas include admins, operators, and end users';
			const updated = updateCoverageFromText(coverageMap, text, 1);

			expect(updated[EngineeringDomain.STAKEHOLDERS].level).toBe(
				EngineeringDomainCoverageLevel.PARTIAL
			);
		});

		it('detects multiple domains in same text', () => {
			const text = 'Users need authentication and authorization features with OAuth';
			const updated = updateCoverageFromText(coverageMap, text, 1);

			expect(updated[EngineeringDomain.STAKEHOLDERS].level).not.toBe(
				EngineeringDomainCoverageLevel.NONE
			);
			expect(updated[EngineeringDomain.SECURITY_COMPLIANCE].level).not.toBe(
				EngineeringDomainCoverageLevel.NONE
			);
		});

		it('promotes to ADEQUATE after multiple turns', () => {
			let map = coverageMap;
			map = updateCoverageFromText(map, 'The problem we are solving', 1);
			map = updateCoverageFromText(map, 'Our mission statement is clear', 2);
			map = updateCoverageFromText(map, 'The goal of this project', 3);

			expect(map[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.ADEQUATE
			);
			expect(map[EngineeringDomain.PROBLEM_MISSION].turnNumbers.length).toBe(3);
		});

		it('stores evidence snippets', () => {
			const text = 'The mission is to improve user experience';
			const updated = updateCoverageFromText(coverageMap, text, 1);

			expect(updated[EngineeringDomain.PROBLEM_MISSION].evidence.length).toBeGreaterThan(0);
		});

		it('handles case-insensitive matching', () => {
			const text = 'MISSION and GOAL are important';
			const updated = updateCoverageFromText(coverageMap, text, 1);

			expect(updated[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.PARTIAL
			);
		});

		it('ignores text without relevant keywords', () => {
			const text = 'Some random text without domain keywords xyz abc def';
			const updated = updateCoverageFromText(coverageMap, text, 1);

			const allNone = Object.values(EngineeringDomain).every(
				d => updated[d].level === EngineeringDomainCoverageLevel.NONE
			);
			expect(allNone).toBe(true);
		});

		it('does not duplicate turn numbers', () => {
			let map = coverageMap;
			map = updateCoverageFromText(map, 'mission problem goal', 1);
			map = updateCoverageFromText(map, 'mission problem goal', 1);

			expect(map[EngineeringDomain.PROBLEM_MISSION].turnNumbers).toEqual([1]);
		});

		it('caps evidence snippets', () => {
			let map = coverageMap;
			for (let i = 0; i < 15; i++) {
				map = updateCoverageFromText(map, `mission statement number ${i}`, i);
			}

			expect(map[EngineeringDomain.PROBLEM_MISSION].evidence.length).toBeLessThanOrEqual(10);
		});
	});

	describe('updateCoverageFromExpert', () => {
		it('parses expert domain tags', () => {
			const text = 'Analysis: [DOMAIN_COVERAGE: PROBLEM_MISSION=ADEQUATE]';
			const updated = updateCoverageFromExpert(coverageMap, text, 1);

			expect(updated[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.ADEQUATE
			);
		});

		it('accepts human-readable labels', () => {
			const text = '[DOMAIN_COVERAGE: Problem & Mission=ADEQUATE]';
			const updated = updateCoverageFromExpert(coverageMap, text, 1);

			expect(updated[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.ADEQUATE
			);
		});

		it('handles multiple tags in same text', () => {
			const text = `
				[DOMAIN_COVERAGE: STAKEHOLDERS=PARTIAL]
				[DOMAIN_COVERAGE: SECURITY_COMPLIANCE=ADEQUATE]
			`;
			const updated = updateCoverageFromExpert(coverageMap, text, 1);

			expect(updated[EngineeringDomain.STAKEHOLDERS].level).toBe(
				EngineeringDomainCoverageLevel.PARTIAL
			);
			expect(updated[EngineeringDomain.SECURITY_COMPLIANCE].level).toBe(
				EngineeringDomainCoverageLevel.ADEQUATE
			);
		});

		it('ignores invalid domain names', () => {
			const text = '[DOMAIN_COVERAGE: INVALID_DOMAIN=ADEQUATE]';
			const updated = updateCoverageFromExpert(coverageMap, text, 1);

			const allNone = Object.values(EngineeringDomain).every(
				d => updated[d].level === EngineeringDomainCoverageLevel.NONE
			);
			expect(allNone).toBe(true);
		});

		it('ignores invalid coverage levels', () => {
			const text = '[DOMAIN_COVERAGE: PROBLEM_MISSION=INVALID_LEVEL]';
			const updated = updateCoverageFromExpert(coverageMap, text, 1);

			expect(updated[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.NONE
			);
		});

		it('allows expert to demote coverage level', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.ADEQUATE;

			const text = '[DOMAIN_COVERAGE: PROBLEM_MISSION=PARTIAL]';
			const updated = updateCoverageFromExpert(coverageMap, text, 1);

			expect(updated[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.PARTIAL
			);
		});

		it('tracks turn numbers', () => {
			const text = '[DOMAIN_COVERAGE: PROBLEM_MISSION=ADEQUATE]';
			const updated = updateCoverageFromExpert(coverageMap, text, 5);

			expect(updated[EngineeringDomain.PROBLEM_MISSION].turnNumbers).toContain(5);
		});
	});

	describe('getCoverageGaps', () => {
		it('returns all domains initially', () => {
			const gaps = getCoverageGaps(coverageMap);
			expect(gaps.length).toBe(12);
		});

		it('excludes domains with PARTIAL coverage', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.PARTIAL;

			const gaps = getCoverageGaps(coverageMap);
			expect(gaps).not.toContain(EngineeringDomain.PROBLEM_MISSION);
			expect(gaps.length).toBe(11);
		});

		it('excludes domains with ADEQUATE coverage', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.ADEQUATE;
			coverageMap[EngineeringDomain.STAKEHOLDERS].level =
				EngineeringDomainCoverageLevel.ADEQUATE;

			const gaps = getCoverageGaps(coverageMap);
			expect(gaps.length).toBe(10);
		});

		it('returns empty array when all covered', () => {
			for (const domain of Object.values(EngineeringDomain)) {
				coverageMap[domain].level = EngineeringDomainCoverageLevel.ADEQUATE;
			}

			const gaps = getCoverageGaps(coverageMap);
			expect(gaps).toEqual([]);
		});
	});

	describe('getPartialDomains', () => {
		it('returns empty array initially', () => {
			const partials = getPartialDomains(coverageMap);
			expect(partials).toEqual([]);
		});

		it('returns domains with PARTIAL coverage', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.PARTIAL;
			coverageMap[EngineeringDomain.STAKEHOLDERS].level =
				EngineeringDomainCoverageLevel.PARTIAL;

			const partials = getPartialDomains(coverageMap);
			expect(partials.length).toBe(2);
			expect(partials).toContain(EngineeringDomain.PROBLEM_MISSION);
			expect(partials).toContain(EngineeringDomain.STAKEHOLDERS);
		});

		it('excludes NONE domains', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.PARTIAL;

			const partials = getPartialDomains(coverageMap);
			expect(partials.length).toBe(1);
		});

		it('excludes ADEQUATE domains', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.ADEQUATE;

			const partials = getPartialDomains(coverageMap);
			expect(partials).toEqual([]);
		});
	});

	describe('getCoverageSummary', () => {
		it('reports all NONE initially', () => {
			const summary = getCoverageSummary(coverageMap);
			expect(summary.none).toBe(12);
			expect(summary.partial).toBe(0);
			expect(summary.adequate).toBe(0);
			expect(summary.percentage).toBe(0);
		});

		it('calculates percentage correctly', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.ADEQUATE;
			coverageMap[EngineeringDomain.STAKEHOLDERS].level =
				EngineeringDomainCoverageLevel.PARTIAL;

			const summary = getCoverageSummary(coverageMap);
			expect(summary.adequate).toBe(1);
			expect(summary.partial).toBe(1);
			expect(summary.none).toBe(10);
			expect(summary.percentage).toBeGreaterThan(0);
		});

		it('reports 100% when all adequate', () => {
			for (const domain of Object.values(EngineeringDomain)) {
				coverageMap[domain].level = EngineeringDomainCoverageLevel.ADEQUATE;
			}

			const summary = getCoverageSummary(coverageMap);
			expect(summary.adequate).toBe(12);
			expect(summary.percentage).toBe(100);
		});

		it('weights PARTIAL as 50%', () => {
			for (const domain of Object.values(EngineeringDomain)) {
				coverageMap[domain].level = EngineeringDomainCoverageLevel.PARTIAL;
			}

			const summary = getCoverageSummary(coverageMap);
			expect(summary.partial).toBe(12);
			expect(summary.percentage).toBe(50);
		});
	});

	describe('shouldTriggerCheckpoint', () => {
		it('returns false on first turn', () => {
			const shouldTrigger = shouldTriggerCheckpoint(coverageMap, 1, 0);
			expect(shouldTrigger).toBe(false);
		});

		it('returns false when not enough turns passed', () => {
			const shouldTrigger = shouldTriggerCheckpoint(coverageMap, 3, 2);
			expect(shouldTrigger).toBe(false);
		});

		it('returns true when interval met and gaps exist', () => {
			const shouldTrigger = shouldTriggerCheckpoint(coverageMap, 5, 1);
			expect(shouldTrigger).toBe(true);
		});

		it('returns false when no gaps remain', () => {
			for (const domain of Object.values(EngineeringDomain)) {
				coverageMap[domain].level = EngineeringDomainCoverageLevel.ADEQUATE;
			}

			const shouldTrigger = shouldTriggerCheckpoint(coverageMap, 5, 1);
			expect(shouldTrigger).toBe(false);
		});
	});

	describe('buildCheckpoint', () => {
		it('creates checkpoint with coverage snapshot', () => {
			const checkpoint = buildCheckpoint(coverageMap, 5);

			expect(checkpoint.turnNumber).toBe(5);
			expect(checkpoint.coverageSnapshot).toBeDefined();
			expect(checkpoint.suggestedDomains).toBeDefined();
		});

		it('suggests gaps first', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.PARTIAL;

			const checkpoint = buildCheckpoint(coverageMap, 5);
			const suggested = checkpoint.suggestedDomains;

			expect(suggested.length).toBeGreaterThan(0);
			expect(suggested).not.toContain(EngineeringDomain.PROBLEM_MISSION);
		});

		it('suggests partials when few gaps remain', () => {
			for (const domain of Object.values(EngineeringDomain)) {
				coverageMap[domain].level = EngineeringDomainCoverageLevel.ADEQUATE;
			}
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.PARTIAL;
			coverageMap[EngineeringDomain.STAKEHOLDERS].level =
				EngineeringDomainCoverageLevel.PARTIAL;

			const checkpoint = buildCheckpoint(coverageMap, 5);
			expect(checkpoint.suggestedDomains).toContain(EngineeringDomain.PROBLEM_MISSION);
		});

		it('limits suggestions to 4 domains', () => {
			const checkpoint = buildCheckpoint(coverageMap, 5);
			expect(checkpoint.suggestedDomains.length).toBeLessThanOrEqual(4);
		});
	});

	describe('getNextDomain', () => {
		it('returns first domain when null', () => {
			const next = getNextDomain(null);
			expect(next).toBe(DOMAIN_SEQUENCE[0]);
		});

		it('returns next in sequence', () => {
			const current = EngineeringDomain.PROBLEM_MISSION;
			const next = getNextDomain(current);
			expect(next).toBe(EngineeringDomain.STAKEHOLDERS);
		});

		it('returns null at end of sequence', () => {
			const last = DOMAIN_SEQUENCE[DOMAIN_SEQUENCE.length - 1];
			const next = getNextDomain(last);
			expect(next).toBeNull();
		});

		it('handles unknown domain', () => {
			const next = getNextDomain('UNKNOWN' as EngineeringDomain);
			expect(next).toBeNull();
		});
	});

	describe('isDomainAdequatelyCovered', () => {
		it('returns false for NONE coverage', () => {
			const result = isDomainAdequatelyCovered(
				coverageMap,
				EngineeringDomain.PROBLEM_MISSION
			);
			expect(result).toBe(false);
		});

		it('returns false for PARTIAL coverage', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.PARTIAL;

			const result = isDomainAdequatelyCovered(
				coverageMap,
				EngineeringDomain.PROBLEM_MISSION
			);
			expect(result).toBe(false);
		});

		it('returns true for ADEQUATE coverage', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.ADEQUATE;

			const result = isDomainAdequatelyCovered(
				coverageMap,
				EngineeringDomain.PROBLEM_MISSION
			);
			expect(result).toBe(true);
		});
	});

	describe('formatCoverageSummaryForPrompt', () => {
		it('includes all domains', () => {
			const formatted = formatCoverageSummaryForPrompt(coverageMap);

			for (const domain of Object.values(EngineeringDomain)) {
				expect(formatted).toContain(domain);
			}
		});

		it('includes percentage', () => {
			const formatted = formatCoverageSummaryForPrompt(coverageMap);
			expect(formatted).toContain('percentage');
		});

		it('shows coverage icons', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.ADEQUATE;

			const formatted = formatCoverageSummaryForPrompt(coverageMap);
			expect(formatted).toContain('[OK]');
			expect(formatted).toContain('[NONE]');
		});
	});

	describe('formatUncoveredDomainsForPrompt', () => {
		it('lists uncovered domains', () => {
			const formatted = formatUncoveredDomainsForPrompt(coverageMap);
			expect(formatted).toContain('NOT YET discussed');
		});

		it('lists partial domains', () => {
			coverageMap[EngineeringDomain.PROBLEM_MISSION].level =
				EngineeringDomainCoverageLevel.PARTIAL;

			const formatted = formatUncoveredDomainsForPrompt(coverageMap);
			expect(formatted).toContain('PARTIALLY covered');
		});

		it('reports completion when all adequate', () => {
			for (const domain of Object.values(EngineeringDomain)) {
				coverageMap[domain].level = EngineeringDomainCoverageLevel.ADEQUATE;
			}

			const formatted = formatUncoveredDomainsForPrompt(coverageMap);
			expect(formatted).toContain('adequately covered');
		});
	});

	describe('seedCoverageFromAnalysis', () => {
		it('seeds coverage from analysis array', () => {
			const analysis = [
				{
					domain: 'PROBLEM_MISSION',
					level: 'ADEQUATE',
					evidence: 'Analysis evidence here',
				},
				{
					domain: 'STAKEHOLDERS',
					level: 'PARTIAL',
					evidence: 'Stakeholder evidence',
				},
			];

			const seeded = seedCoverageFromAnalysis(coverageMap, analysis);

			expect(seeded[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.ADEQUATE
			);
			expect(seeded[EngineeringDomain.STAKEHOLDERS].level).toBe(
				EngineeringDomainCoverageLevel.PARTIAL
			);
		});

		it('stores evidence from analysis', () => {
			const analysis = [
				{
					domain: 'PROBLEM_MISSION',
					level: 'ADEQUATE',
					evidence: 'Test evidence',
				},
			];

			const seeded = seedCoverageFromAnalysis(coverageMap, analysis);
			expect(seeded[EngineeringDomain.PROBLEM_MISSION].evidence).toContain(
				'Test evidence'
			);
		});

		it('tracks turn 0 for analysis', () => {
			const analysis = [
				{
					domain: 'PROBLEM_MISSION',
					level: 'ADEQUATE',
					evidence: 'Evidence',
				},
			];

			const seeded = seedCoverageFromAnalysis(coverageMap, analysis);
			expect(seeded[EngineeringDomain.PROBLEM_MISSION].turnNumbers).toContain(0);
		});

		it('handles invalid domain names gracefully', () => {
			const analysis = [
				{
					domain: 'INVALID_DOMAIN',
					level: 'ADEQUATE',
					evidence: 'Evidence',
				},
			];

			const seeded = seedCoverageFromAnalysis(coverageMap, analysis);
			const allNone = Object.values(EngineeringDomain).every(
				d => seeded[d].level === EngineeringDomainCoverageLevel.NONE
			);
			expect(allNone).toBe(true);
		});

		it('handles invalid level strings gracefully', () => {
			const analysis = [
				{
					domain: 'PROBLEM_MISSION',
					level: 'INVALID_LEVEL',
					evidence: 'Evidence',
				},
			];

			const seeded = seedCoverageFromAnalysis(coverageMap, analysis);
			expect(seeded[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.NONE
			);
		});
	});

	describe('integration scenarios', () => {
		it('tracks complete coverage evolution', () => {
			let map = initializeCoverageMap();

			map = updateCoverageFromText(map, 'Our mission is to solve problems', 1);
			expect(map[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.PARTIAL
			);

			map = updateCoverageFromText(map, 'Users and stakeholders include admins', 2);
			expect(map[EngineeringDomain.STAKEHOLDERS].level).toBe(
				EngineeringDomainCoverageLevel.PARTIAL
			);

			const summary = getCoverageSummary(map);
			expect(summary.partial).toBe(2);
			expect(summary.none).toBe(10);
		});

		it('combines text and expert updates', () => {
			let map = initializeCoverageMap();

			map = updateCoverageFromText(map, 'mission and goal', 1);
			map = updateCoverageFromExpert(
				map,
				'[DOMAIN_COVERAGE: PROBLEM_MISSION=ADEQUATE]',
				1
			);

			expect(map[EngineeringDomain.PROBLEM_MISSION].level).toBe(
				EngineeringDomainCoverageLevel.ADEQUATE
			);
		});

		it('manages checkpoint workflow', () => {
			let map = initializeCoverageMap();
			map = updateCoverageFromText(map, 'mission problem goal', 1);

			const should1 = shouldTriggerCheckpoint(map, 2, 0);
			expect(should1).toBe(false);

			const should2 = shouldTriggerCheckpoint(map, 4, 0);
			expect(should2).toBe(true);

			const checkpoint = buildCheckpoint(map, 4);
			expect(checkpoint.suggestedDomains.length).toBeGreaterThan(0);
		});

		it('handles STATE_DRIVEN domain progression', () => {
			let current: EngineeringDomain | null = null;
			const visited: EngineeringDomain[] = [];

			while (true) {
				const next = getNextDomain(current);
				if (!next) {break;}
				visited.push(next);
				current = next;
			}

			expect(visited.length).toBe(12);
			expect(visited[0]).toBe(EngineeringDomain.PROBLEM_MISSION);
		});
	});
});
