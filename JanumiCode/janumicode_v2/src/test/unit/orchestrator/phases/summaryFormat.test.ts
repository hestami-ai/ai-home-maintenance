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
  displayFieldType,
  displayFieldConstraint,
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

  // PA-8b — the data-model "Fields:" per-field type/constraint annotation was a
  // distinct serializer path PA-8 didn't cover (cal-38: `role: string ([object
  // Object])`, `uuid: undefined` in ~14/900 phase-05 prompts).
  describe('displayFieldType', () => {
    it('passes a string type through', () => {
      expect(displayFieldType('uuid')).toBe('uuid');
    });
    it('extracts a nested object type without leaking [object Object]', () => {
      const out = displayFieldType({ type: 'varchar', sql_type: 'VARCHAR(255)' });
      expect(out).toBe('varchar');
      expect(out).not.toMatch(NO_OBJECT_LITERAL);
    });
    it('renders "" (not the literal "undefined") for a missing type', () => {
      expect(displayFieldType(undefined)).toBe('');
      expect(displayFieldType(null)).toBe('');
    });
    it('never leaks for a fully-unknown object shape', () => {
      expect(displayFieldType({ weird: 1 })).not.toMatch(NO_OBJECT_LITERAL);
    });
  });

  describe('displayFieldConstraint', () => {
    it('passes a string constraint through', () => {
      expect(displayFieldConstraint('unique,not_null')).toBe('unique,not_null');
    });
    it('joins an array constraint', () => {
      expect(displayFieldConstraint(['not_null', 'unique'])).toBe('not_null, unique');
    });
    it('renders an object constraint as k=v pairs — never [object Object]', () => {
      const out = displayFieldConstraint({ max_length: 255, unique: true });
      expect(out).toBe('max_length=255, unique=true');
      expect(out).not.toMatch(NO_OBJECT_LITERAL);
    });
    it('returns "" for an absent constraint (caller omits the trailing "(...)")', () => {
      expect(displayFieldConstraint(undefined)).toBe('');
      expect(displayFieldConstraint(null)).toBe('');
    });
  });
});
