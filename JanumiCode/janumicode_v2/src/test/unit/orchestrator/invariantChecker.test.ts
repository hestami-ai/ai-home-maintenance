import { describe, it, expect, beforeEach } from 'vitest';
import { InvariantChecker, type InvariantRule } from '../../../lib/orchestrator/invariantChecker';
import path from 'path';

describe('InvariantChecker', () => {
  describe('with loaded invariant files', () => {
    let checker: InvariantChecker;

    beforeEach(() => {
      const invariantsPath = path.resolve(
        __dirname, '..', '..', '..', '..', '.janumicode', 'schemas', 'invariants'
      );
      checker = new InvariantChecker(invariantsPath);
    });

    it('loads invariant files from disk', () => {
      // component_model invariants should be loaded
      const result = checker.check('component_model', {
        components: [
          {
            id: 'c1',
            name: 'AuthService',
            responsibilities: [
              { statement: 'Handle user authentication' },
            ],
          },
        ],
      }, '4');

      expect(result.checks_run).toBeGreaterThan(0);
    });

    it('detects forbidden conjunction in component responsibility', () => {
      const result = checker.check('component_model', {
        components: [
          {
            id: 'c1',
            name: 'AuthService',
            responsibilities: [
              { statement: 'Handle authentication and authorization' },
            ],
          },
        ],
      }, '4');

      expect(result.overall_pass).toBe(false);
      expect(result.violations.some(v => v.invariant_id === 'CM-001')).toBe(true);
    });

    it('passes clean component model', () => {
      const result = checker.check('component_model', {
        components: [
          {
            id: 'c1',
            name: 'AuthService',
            responsibilities: [
              { statement: 'Handle user authentication' },
              { statement: 'Manage session tokens' },
            ],
          },
        ],
      }, '4');

      expect(result.overall_pass).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe('check types', () => {
    let checker: InvariantChecker;

    beforeEach(() => {
      checker = new InvariantChecker();
    });

    describe('field_presence', () => {
      it('detects missing field', () => {
        checker.addRules('test', [{
          invariant_id: 'T-001',
          artifact_type: 'test',
          description: 'name required',
          check_type: 'field_presence',
          specification: {
            field_path: 'name',
            message: 'name is required',
          },
          severity: 'blocking',
          phase_applies_to: [],
        }]);

        const result = checker.check('test', {});
        expect(result.overall_pass).toBe(false);
        expect(result.violations[0].message).toBe('name is required');
      });

      it('detects empty field value', () => {
        checker.addRules('test', [{
          invariant_id: 'T-001',
          artifact_type: 'test',
          description: 'name required',
          check_type: 'field_presence',
          specification: { field_path: 'name' },
          severity: 'blocking',
          phase_applies_to: [],
        }]);

        const result = checker.check('test', { name: '' });
        expect(result.overall_pass).toBe(false);
      });

      it('passes when field is present', () => {
        checker.addRules('test', [{
          invariant_id: 'T-001',
          artifact_type: 'test',
          description: 'name required',
          check_type: 'field_presence',
          specification: { field_path: 'name' },
          severity: 'blocking',
          phase_applies_to: [],
        }]);

        const result = checker.check('test', { name: 'hello' });
        expect(result.overall_pass).toBe(true);
      });

      it('handles nested array paths', () => {
        checker.addRules('test', [{
          invariant_id: 'T-002',
          artifact_type: 'test',
          description: 'items need names',
          check_type: 'field_presence',
          specification: { field_path: 'items[*].name' },
          severity: 'blocking',
          phase_applies_to: [],
        }]);

        expect(checker.check('test', {
          items: [{ name: 'a' }, { name: 'b' }],
        }).overall_pass).toBe(true);

        expect(checker.check('test', {
          items: [{ name: 'a' }, { name: '' }],
        }).overall_pass).toBe(false);
      });
    });

    describe('forbidden_pattern', () => {
      it('detects forbidden word', () => {
        checker.addRules('test', [{
          invariant_id: 'T-003',
          artifact_type: 'test',
          description: 'no conjunctions',
          check_type: 'forbidden_pattern',
          specification: {
            field_path: 'statement',
            pattern: '\\b(and|or)\\b',
            forbidden: true,
            message: 'Statement contains conjunction',
          },
          severity: 'blocking',
          phase_applies_to: [],
        }]);

        expect(checker.check('test', {
          statement: 'Handle auth and logging',
        }).overall_pass).toBe(false);

        expect(checker.check('test', {
          statement: 'Handle user authentication',
        }).overall_pass).toBe(true);
      });
    });

    describe('count_minimum', () => {
      it('detects array below minimum', () => {
        checker.addRules('test', [{
          invariant_id: 'T-004',
          artifact_type: 'test',
          description: 'at least 2 items',
          check_type: 'count_minimum',
          specification: {
            field_path: 'items[*]',
            minimum: 2,
          },
          severity: 'blocking',
          phase_applies_to: [],
        }]);

        expect(checker.check('test', { items: [1] }).overall_pass).toBe(false);
        expect(checker.check('test', { items: [1, 2] }).overall_pass).toBe(true);
      });
    });

    describe('cross_field', () => {
      it('detects unmatched source value', () => {
        checker.addRules('test', [{
          invariant_id: 'T-005',
          artifact_type: 'test',
          description: 'every source has target',
          check_type: 'cross_field',
          specification: {
            source_field: 'requirements[*].id',
            target_field: 'tests[*].requirement_id',
            relationship: 'each_source_has_target',
          },
          severity: 'blocking',
          phase_applies_to: [],
        }]);

        expect(checker.check('test', {
          requirements: [{ id: 'R1' }, { id: 'R2' }],
          tests: [{ requirement_id: 'R1' }],
        }).overall_pass).toBe(false);

        expect(checker.check('test', {
          requirements: [{ id: 'R1' }, { id: 'R2' }],
          tests: [{ requirement_id: 'R1' }, { requirement_id: 'R2' }],
        }).overall_pass).toBe(true);
      });
    });

    describe('phase filtering', () => {
      it('only applies rules for the specified phase', () => {
        checker.addRules('test', [
          {
            invariant_id: 'T-P2',
            artifact_type: 'test',
            description: 'phase 2 only',
            check_type: 'field_presence',
            specification: { field_path: 'phase2_field' },
            severity: 'blocking',
            phase_applies_to: ['2'],
          },
          {
            invariant_id: 'T-P4',
            artifact_type: 'test',
            description: 'phase 4 only',
            check_type: 'field_presence',
            specification: { field_path: 'phase4_field' },
            severity: 'blocking',
            phase_applies_to: ['4'],
          },
        ]);

        // Only phase 2 rule runs — phase4_field missing is ok
        const result = checker.check('test', { phase2_field: 'present' }, '2');
        expect(result.overall_pass).toBe(true);
        expect(result.checks_run).toBe(1);
      });
    });

    describe('severity', () => {
      it('warnings do not block overall_pass', () => {
        checker.addRules('test', [{
          invariant_id: 'T-W',
          artifact_type: 'test',
          description: 'optional check',
          check_type: 'field_presence',
          specification: { field_path: 'optional_field' },
          severity: 'warning',
          phase_applies_to: [],
        }]);

        const result = checker.check('test', {});
        expect(result.overall_pass).toBe(true); // warning doesn't block
        expect(result.violations.length).toBe(1);
        expect(result.violations[0].severity).toBe('warning');
      });
    });
  });

  describe('resolveFieldPath', () => {
    it('resolves simple paths', () => {
      const checker = new InvariantChecker();
      const values = checker.resolveFieldPath({ a: { b: 'hello' } }, 'a.b');
      expect(values).toEqual([{ path: 'a.b', value: 'hello' }]);
    });

    it('resolves array wildcards', () => {
      const checker = new InvariantChecker();
      const values = checker.resolveFieldPath(
        { items: [{ name: 'a' }, { name: 'b' }] },
        'items[*].name',
      );
      expect(values).toEqual([
        { path: 'items[0].name', value: 'a' },
        { path: 'items[1].name', value: 'b' },
      ]);
    });

    it('resolves nested array wildcards', () => {
      const checker = new InvariantChecker();
      const values = checker.resolveFieldPath(
        {
          groups: [
            { items: [{ v: 1 }, { v: 2 }] },
            { items: [{ v: 3 }] },
          ],
        },
        'groups[*].items[*].v',
      );
      expect(values).toHaveLength(3);
      expect(values.map(v => v.value)).toEqual([1, 2, 3]);
    });
  });
});
