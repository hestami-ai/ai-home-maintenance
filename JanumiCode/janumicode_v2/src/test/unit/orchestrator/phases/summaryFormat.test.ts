/**
 * PA-8 regression — prompt-materialization serializer bugs.
 *
 * The audit found `[object Object]`, `undefined (sync_call)`, and
 * `Relationships: [object Object]` leaking into materialized prompts because
 * renderers interpolated LLM `content` arrays whose elements are objects (or
 * used drifted field names). These tests pin the shared safe formatters so the
 * leak cannot recur.
 */
import { describe, it, expect } from 'vitest';
import {
  displayCapability,
  displayComponentDependency,
  displayEntityRelationship,
} from '../../../../lib/orchestrator/phases/summaryFormat';

const NO_OBJECT_LITERAL = /\[object Object\]/;

describe('summaryFormat (PA-8 serializer fix)', () => {
  describe('displayCapability', () => {
    it('passes strings through', () => {
      expect(displayCapability('Authorization Mapping')).toBe('Authorization Mapping');
    });
    it('extracts .capability from a real system-boundary in_scope object', () => {
      expect(
        displayCapability({
          capability: 'Authorization Policy Mapping & Translation',
          description: 'entity-to-resource registry',
          satisfies_fr: ['FR-AUTH-C3.2-1.1'],
        }),
      ).toBe('Authorization Policy Mapping & Translation');
    });
    it('falls back through name/statement/description', () => {
      expect(displayCapability({ name: 'N' })).toBe('N');
      expect(displayCapability({ statement: 'S' })).toBe('S');
      expect(displayCapability({ description: 'D' })).toBe('D');
    });
    it('never emits [object Object] for an unknown-shaped object', () => {
      expect(displayCapability({ weird: 1, nested: { a: 2 } })).not.toMatch(NO_OBJECT_LITERAL);
    });
    it('handles null / undefined as empty', () => {
      expect(displayCapability(null)).toBe('');
      expect(displayCapability(undefined)).toBe('');
    });
    it('joining a mixed array never leaks [object Object]', () => {
      const items: unknown[] = ['plain', { capability: 'Cap' }, { description: 'Desc' }, { x: 1 }];
      expect(items.map(displayCapability).join('; ')).not.toMatch(NO_OBJECT_LITERAL);
    });
  });

  describe('displayComponentDependency', () => {
    it('renders target_component_id + dependency_type', () => {
      expect(displayComponentDependency({ target_component_id: 'comp-x', dependency_type: 'sync_call' }))
        .toBe('comp-x (sync_call)');
    });
    it('tolerates the component_id + kind field-name variant', () => {
      expect(displayComponentDependency({ component_id: 'comp-y', kind: 'async_event' }))
        .toBe('comp-y (async_event)');
    });
    it('renders "(unspecified)" — never "undefined (kind)" — when the target is missing', () => {
      const out = displayComponentDependency({ dependency_type: 'sync_call' });
      expect(out).toBe('(unspecified) (sync_call)');
      expect(out).not.toMatch(/\bundefined\b/);
    });
    it('handles an empty / undefined dependency', () => {
      expect(displayComponentDependency(undefined)).toBe('(unspecified)');
      expect(displayComponentDependency({})).toBe('(unspecified)');
    });
  });

  describe('displayEntityRelationship', () => {
    it('renders target_entity_id + kind + ownership', () => {
      expect(displayEntityRelationship({ target_entity_id: 'DM-a', kind: 'one_to_many', ownership: 'owns' }))
        .toBe('DM-a (one_to_many, owns)');
    });
    it('defaults kind to references', () => {
      expect(displayEntityRelationship({ target_entity_id: 'DM-b' })).toBe('DM-b (references)');
    });
    it('never emits [object Object] when target_entity_id is itself a nested object', () => {
      const out = displayEntityRelationship({ target_entity_id: { id: 'DM-c', name: 'C' }, kind: 'references' });
      expect(out).toBe('DM-c (references)');
      expect(out).not.toMatch(NO_OBJECT_LITERAL);
    });
    it('never leaks for a fully-unknown shape', () => {
      const out = displayEntityRelationship({ foo: 'bar' });
      expect(out).toBe('(unspecified) (references)');
      expect(out).not.toMatch(NO_OBJECT_LITERAL);
    });
  });
});
