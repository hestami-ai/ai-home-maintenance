import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator } from '../../../lib/orchestrator/schemaValidator';
import path from 'path';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    // Load schemas from the project's .janumicode directory
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    validator = new SchemaValidator(workspacePath);
  });

  describe('schema loading', () => {
    it('loads Phase 0+1 schemas', () => {
      const loaded = validator.getLoadedSchemas();
      expect(loaded).toContain('workspace_classification');
      expect(loaded).toContain('intent_quality_report');
      expect(loaded).toContain('scope_classification');
      expect(loaded).toContain('compliance_context');
      expect(loaded).toContain('intent_bloom');
      expect(loaded).toContain('intent_statement');
      expect(loaded).toContain('collision_risk_report');
    });
  });

  describe('workspace_classification', () => {
    it('validates a correct greenfield classification', () => {
      const result = validator.validate('workspace_classification', {
        kind: 'workspace_classification',
        workspace_type: 'greenfield',
        janumicode_version_sha: 'abc123',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects missing required field', () => {
      const result = validator.validate('workspace_classification', {
        workspace_type: 'greenfield',
        // missing janumicode_version_sha
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid enum value', () => {
      const result = validator.validate('workspace_classification', {
        workspace_type: 'invalid_type',
        janumicode_version_sha: 'abc123',
      });
      expect(result.valid).toBe(false);
    });

    it('rejects additional properties', () => {
      const result = validator.validate('workspace_classification', {
        workspace_type: 'greenfield',
        janumicode_version_sha: 'abc123',
        extra_field: 'not allowed',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('intent_quality_report', () => {
    it('validates a correct quality report', () => {
      const result = validator.validate('intent_quality_report', {
        completeness_findings: [
          { field: 'what_is_being_built', status: 'present', severity: 'high' },
        ],
        consistency_findings: [],
        coherence_findings: [],
        overall_status: 'pass',
      });
      expect(result.valid).toBe(true);
    });

    it('rejects invalid overall_status', () => {
      const result = validator.validate('intent_quality_report', {
        completeness_findings: [],
        consistency_findings: [],
        coherence_findings: [],
        overall_status: 'invalid',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('intent_bloom', () => {
    it('validates a correct bloom with multiple candidates', () => {
      const result = validator.validate('intent_bloom', {
        candidate_product_concepts: [
          {
            id: 'c1',
            name: 'Task Manager',
            description: 'A simple task management app',
            who_it_serves: 'Individual users',
            problem_it_solves: 'Tracking personal tasks',
            assumptions: [{ assumption: 'Web-based', basis: 'Not specified, defaulting to web' }],
            constraints: [],
            open_questions: [],
          },
          {
            id: 'c2',
            name: 'Project Tracker',
            description: 'A team project tracking tool',
            who_it_serves: 'Small teams',
            problem_it_solves: 'Coordinating team work',
            assumptions: [],
            constraints: [],
            open_questions: ['Is this for remote teams only?'],
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects empty candidate array', () => {
      const result = validator.validate('intent_bloom', {
        candidate_product_concepts: [],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('intent_statement', () => {
    it('validates a correct intent statement', () => {
      const result = validator.validate('intent_statement', {
        product_concept: {
          name: 'TaskFlow',
          description: 'A task management application',
          who_it_serves: 'Software developers',
          problem_it_solves: 'Organizing daily work tasks',
        },
        confirmed_assumptions: [],
        confirmed_constraints: [
          { constraint: 'Must work offline', type: 'technical' },
        ],
        out_of_scope: ['Mobile app', 'Enterprise SSO'],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects empty product concept name', () => {
      const result = validator.validate('intent_statement', {
        product_concept: {
          name: '',
          description: 'A task management application',
          who_it_serves: 'Software developers',
          problem_it_solves: 'Organizing daily work tasks',
        },
        confirmed_assumptions: [],
        confirmed_constraints: [],
        out_of_scope: [],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('missing schema', () => {
    it('returns error for unknown artifact type', () => {
      const result = validator.validate('nonexistent_type', { foo: 'bar' });
      expect(result.valid).toBe(false);
      expect(result.errors[0].keyword).toBe('schema_missing');
    });
  });

  describe('addSchema (programmatic)', () => {
    it('adds and validates against a custom schema', () => {
      validator.addSchema('test_artifact', {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
        },
      });

      expect(validator.validate('test_artifact', { name: 'hello' }).valid).toBe(true);
      expect(validator.validate('test_artifact', { name: '' }).valid).toBe(false);
      expect(validator.validate('test_artifact', {}).valid).toBe(false);
    });
  });
});
