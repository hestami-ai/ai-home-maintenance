import { describe, it, expect, beforeEach } from 'vitest';
import {
  TemplateLoader,
  type PromptTemplate,
  type TemplateMetadata,
} from '../../../lib/orchestrator/templateLoader';
import path from 'path';

/** Access the private frontmatter parser for characterization. */
type FrontmatterParser = { parseFrontmatter(lines: string[]): TemplateMetadata };
function parseFrontmatter(loader: TemplateLoader, lines: string[]): TemplateMetadata {
  return (loader as unknown as FrontmatterParser).parseFrontmatter(lines);
}

describe('TemplateLoader', () => {
  describe('with project prompt templates', () => {
    let loader: TemplateLoader;

    beforeEach(() => {
      const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
      loader = new TemplateLoader(workspacePath);
    });

    it('loads prompt templates from disk', () => {
      const loaded = loader.getLoadedTemplates();
      expect(loaded.length).toBeGreaterThan(0);
    });

    // Note: the prior `cross_cutting/reasoning_review.system.md` template
    // was deleted in Track D Commit 10 alongside the single-pass
    // `runReasoningReview` reviewer. The harness now uses per-validator
    // templates under `prompts/review/<family>/<id>.system.md`.

    it('loads intent quality check template', () => {
      // IQC lives under phases/phase_01_intent_capture/, not cross_cutting/
      // — the duplicate at cross_cutting/intent_quality_check.system.md was
      // removed because two templates with the same agent_role + sub_phase
      // metadata made `findTemplate` behaviour depend on directory scan
      // order.
      const template = loader.findTemplate('orchestrator', 'intent_quality_check');
      expect(template).not.toBeNull();
      expect(template!.metadata.agent_role).toBe('orchestrator');
      expect(template!.metadata.required_variables).toContain('raw_intent_text');
    });

    it('loads intent domain bloom template', () => {
      const template = loader.findTemplate('domain_interpreter', 'intent_domain_bloom');
      expect(template).not.toBeNull();
      expect(template!.metadata.required_variables).toContain('active_constraints');
      expect(template!.metadata.required_variables).toContain('raw_intent_text');
      expect(template!.metadata.reasoning_review_triggers).toContain('premature_convergence');
    });

    it('loads vocabulary collision check template', () => {
      const template = loader.getTemplate('cross_cutting/vocabulary_collision_check.system');
      expect(template).not.toBeNull();
      expect(template!.metadata.required_variables).toContain('canonical_vocabulary_summary');
    });
  });

  describe('frontmatter parsing', () => {
    let loader: TemplateLoader;

    beforeEach(() => {
      loader = new TemplateLoader('/nonexistent'); // Empty loader
    });

    it('parses required_variables as array', () => {
      const template: PromptTemplate = {
        path: 'test.system.md',
        metadata: {
          agent_role: 'test',
          sub_phase: 'test',
          schema_version: '1.0',
          co_invocation_exception: false,
          required_variables: ['var1', 'var2'],
          reasoning_review_triggers: [],
          verification_ensemble_triggers: [],
        },
        body: 'Hello {{var1}} and {{var2}}',
      };

      loader.addTemplate('test', template);
      const loaded = loader.getTemplate('test');
      expect(loaded!.metadata.required_variables).toEqual(['var1', 'var2']);
    });
  });

  // Characterization tests: pin the current observable behaviour of the
  // private parseFrontmatter() before refactoring it. Inputs mirror what the
  // loader passes: the lines BETWEEN the two `---` delimiters, indentation
  // preserved.
  describe('parseFrontmatter (characterization)', () => {
    let loader: TemplateLoader;

    beforeEach(() => {
      loader = new TemplateLoader('/nonexistent'); // Empty loader
    });

    it('parses scalars, booleans, arrays and skips the [JC:...] header', () => {
      const md = parseFrontmatter(loader, [
        '[JC:PROMPT TEMPLATE]',
        'agent_role: executor_agent',
        'sub_phase: 09_1_implementation_task_execution',
        'schema_version: 1.2',
        'co_invocation_exception: false',
        'required_variables:',
        '  - active_constraints',
        '  - implementation_task',
        'reasoning_review_triggers:',
        '  - implementation_divergence_check',
        'verification_ensemble_triggers:',
        '  - implementation_divergence_check',
      ]);

      expect(md.agent_role).toBe('executor_agent');
      expect(md.sub_phase).toBe('09_1_implementation_task_execution');
      expect(md.schema_version).toBe('1.2');
      expect(md.co_invocation_exception).toBe(false);
      expect(md.required_variables).toEqual([
        'active_constraints',
        'implementation_task',
      ]);
      expect(md.reasoning_review_triggers).toEqual([
        'implementation_divergence_check',
      ]);
      expect(md.verification_ensemble_triggers).toEqual([
        'implementation_divergence_check',
      ]);
      expect(md.lens).toBeUndefined();
    });

    it('coerces true/false and passes an explicit lens through', () => {
      const md = parseFrontmatter(loader, [
        'co_invocation_exception: true',
        'lens: enterprise',
      ]);
      expect(md.co_invocation_exception).toBe(true);
      expect(md.lens).toBe('enterprise');
    });

    it('applies defaults when keys are absent', () => {
      const md = parseFrontmatter(loader, []);
      expect(md.agent_role).toBe('unknown');
      expect(md.sub_phase).toBe('unknown');
      expect(md.schema_version).toBe('1.0');
      expect(md.co_invocation_exception).toBe(false);
      expect(md.lens).toBeUndefined();
      expect(md.co_invocation_rationale).toBeUndefined();
      expect(md.co_invocation_artifact_types).toBeUndefined();
      expect(md.required_variables).toEqual([]);
      expect(md.reasoning_review_triggers).toEqual([]);
      expect(md.verification_ensemble_triggers).toEqual([]);
    });

    it('skips blank lines, comments and lines without a colon', () => {
      const md = parseFrontmatter(loader, [
        '',
        '# a comment',
        'this line has no colon',
        'agent_role: domain_interpreter',
      ]);
      expect(md.agent_role).toBe('domain_interpreter');
      expect(md.sub_phase).toBe('unknown');
    });

    it('closes an array when a following scalar key begins', () => {
      const md = parseFrontmatter(loader, [
        'required_variables:',
        '  - a',
        '  - b',
        'schema_version: 2.0',
      ]);
      expect(md.required_variables).toEqual(['a', 'b']);
      expect(md.schema_version).toBe('2.0');
    });

    it('keeps the value after the first colon intact', () => {
      const md = parseFrontmatter(loader, ['co_invocation_rationale: needs: nested']);
      expect(md.co_invocation_rationale).toBe('needs: nested');
    });
  });

  describe('render', () => {
    let loader: TemplateLoader;

    beforeEach(() => {
      loader = new TemplateLoader('/nonexistent');
    });

    it('substitutes variables', () => {
      const template: PromptTemplate = {
        path: 'test.md',
        metadata: {
          agent_role: 'test',
          sub_phase: 'test',
          schema_version: '1.0',
          co_invocation_exception: false,
          required_variables: ['name', 'task'],
          reasoning_review_triggers: [],
          verification_ensemble_triggers: [],
        },
        body: 'Hello {{name}}, your task is: {{task}}',
      };

      loader.addTemplate('test', template);
      const result = loader.render(template, {
        name: 'Alice',
        task: 'Build an app',
      });

      expect(result.rendered).toBe('Hello Alice, your task is: Build an app');
      expect(result.missing_variables).toHaveLength(0);
    });

    it('reports missing required variables', () => {
      const template: PromptTemplate = {
        path: 'test.md',
        metadata: {
          agent_role: 'test',
          sub_phase: 'test',
          schema_version: '1.0',
          co_invocation_exception: false,
          required_variables: ['name', 'task', 'deadline'],
          reasoning_review_triggers: [],
          verification_ensemble_triggers: [],
        },
        body: '{{name}} must do {{task}} by {{deadline}}',
      };

      const result = loader.render(template, { name: 'Alice' });
      expect(result.missing_variables).toContain('task');
      expect(result.missing_variables).toContain('deadline');
      expect(result.missing_variables).not.toContain('name');
    });

    it('substitutes multiple occurrences of same variable', () => {
      const template: PromptTemplate = {
        path: 'test.md',
        metadata: {
          agent_role: 'test',
          sub_phase: 'test',
          schema_version: '1.0',
          co_invocation_exception: false,
          required_variables: ['name'],
          reasoning_review_triggers: [],
          verification_ensemble_triggers: [],
        },
        body: '{{name}} is great. {{name}} is awesome.',
      };

      const result = loader.render(template, { name: 'Alice' });
      expect(result.rendered).toBe('Alice is great. Alice is awesome.');
    });
  });

  describe('validateVariables', () => {
    it('validates all required variables present', () => {
      const loader = new TemplateLoader('/nonexistent');
      const template: PromptTemplate = {
        path: 'test.md',
        metadata: {
          agent_role: 'test',
          sub_phase: 'test',
          schema_version: '1.0',
          co_invocation_exception: false,
          required_variables: ['a', 'b', 'c'],
          reasoning_review_triggers: [],
          verification_ensemble_triggers: [],
        },
        body: '{{a}} {{b}} {{c}}',
      };

      expect(loader.validateVariables(template, new Set(['a', 'b', 'c'])).valid).toBe(true);
      expect(loader.validateVariables(template, new Set(['a', 'b'])).valid).toBe(false);
      expect(loader.validateVariables(template, new Set(['a', 'b'])).missing).toEqual(['c']);
    });
  });

  describe('findTemplate', () => {
    it('finds by agent role and sub-phase', () => {
      const loader = new TemplateLoader('/nonexistent');
      const template: PromptTemplate = {
        path: 'test.md',
        metadata: {
          agent_role: 'domain_interpreter',
          sub_phase: 'intent_domain_bloom',
          schema_version: '1.0',
          co_invocation_exception: false,
          required_variables: [],
          reasoning_review_triggers: [],
          verification_ensemble_triggers: [],
        },
        body: 'test body',
      };

      loader.addTemplate('test', template);
      expect(loader.findTemplate('domain_interpreter', 'intent_domain_bloom')).not.toBeNull();
      expect(loader.findTemplate('domain_interpreter', 'wrong_phase')).toBeNull();
      expect(loader.findTemplate('wrong_role', 'intent_domain_bloom')).toBeNull();
    });
  });
});
