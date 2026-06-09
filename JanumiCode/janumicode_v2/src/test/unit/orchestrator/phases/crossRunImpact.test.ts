import { describe, it, expect } from 'vitest';
import { diffInterfaceDefinitions, diffInterfaceMembers, isCrossRunInterfaceKind } from '../../../../lib/orchestrator/phases/crossRunImpact';

describe('diffInterfaceDefinitions — deterministic modification_type (spec §4 Phase 0.5.1)', () => {
  describe('data_models', () => {
    const base = {
      kind: 'data_models',
      models: [{ name: 'User', entities: [{ name: 'User', fields: [
        { name: 'id', type: 'string' },
        { name: 'email', type: 'string' },
      ] }] }],
    };

    it('additive — a new field with nothing removed/retyped', () => {
      const next = {
        kind: 'data_models',
        models: [{ name: 'User', entities: [{ name: 'User', fields: [
          { name: 'id', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'created_at', type: 'string' },
        ] }] }],
      };
      expect(diffInterfaceDefinitions(base, next)).toBe('additive');
    });

    it('breaking — a removed field', () => {
      const next = {
        kind: 'data_models',
        models: [{ name: 'User', entities: [{ name: 'User', fields: [
          { name: 'id', type: 'string' },
        ] }] }],
      };
      expect(diffInterfaceDefinitions(base, next)).toBe('breaking');
    });

    it('breaking — a renamed field (remove + add)', () => {
      const next = {
        kind: 'data_models',
        models: [{ name: 'User', entities: [{ name: 'User', fields: [
          { name: 'id', type: 'string' },
          { name: 'email_address', type: 'string' },
        ] }] }],
      };
      expect(diffInterfaceDefinitions(base, next)).toBe('breaking');
    });

    it('breaking — a retyped field', () => {
      const next = {
        kind: 'data_models',
        models: [{ name: 'User', entities: [{ name: 'User', fields: [
          { name: 'id', type: 'number' },
          { name: 'email', type: 'string' },
        ] }] }],
      };
      expect(diffInterfaceDefinitions(base, next)).toBe('breaking');
    });

    it('non_breaking — identical member set + signatures', () => {
      const next = structuredClone(base);
      expect(diffInterfaceDefinitions(base, next)).toBe('non_breaking');
    });
  });

  describe('api_definitions', () => {
    const base = {
      kind: 'api_definitions',
      definitions: [{ component_id: 'svc', endpoints: [
        { path: '/shorten', method: 'POST', inputs: [{ name: 'url', type: 'string' }], outputs: [{ name: 'key', type: 'string' }] },
        { path: '/resolve/:key', method: 'GET', inputs: [], outputs: [{ name: 'url', type: 'string' }] },
        { path: '/delete/:key', method: 'DELETE', inputs: [], outputs: [] },
      ] }],
    };

    it('breaking — a removed endpoint', () => {
      const next = {
        kind: 'api_definitions',
        definitions: [{ component_id: 'svc', endpoints: [
          { path: '/shorten', method: 'POST', inputs: [{ name: 'url', type: 'string' }], outputs: [{ name: 'key', type: 'string' }] },
          { path: '/resolve/:key', method: 'GET', inputs: [], outputs: [{ name: 'url', type: 'string' }] },
        ] }],
      };
      expect(diffInterfaceDefinitions(base, next)).toBe('breaking');
    });

    it('additive — a new endpoint', () => {
      const next = {
        kind: 'api_definitions',
        definitions: [{ component_id: 'svc', endpoints: [
          ...base.definitions[0].endpoints,
          { path: '/stats/:key', method: 'GET', inputs: [], outputs: [{ name: 'hits', type: 'number' }] },
        ] }],
      };
      expect(diffInterfaceDefinitions(base, next)).toBe('additive');
    });
  });

  describe('interface_contracts', () => {
    const base = { kind: 'interface_contracts', contracts: [
      { id: 'IC-1', protocol: 'rest' },
      { id: 'IC-2', protocol: 'grpc' },
    ] };

    it('breaking — a removed contract', () => {
      const next = { kind: 'interface_contracts', contracts: [{ id: 'IC-1', protocol: 'rest' }] };
      expect(diffInterfaceDefinitions(base, next)).toBe('breaking');
    });

    it('breaking — a retyped contract (protocol change)', () => {
      const next = { kind: 'interface_contracts', contracts: [
        { id: 'IC-1', protocol: 'graphql' },
        { id: 'IC-2', protocol: 'grpc' },
      ] };
      expect(diffInterfaceDefinitions(base, next)).toBe('breaking');
    });
  });

  describe('conservative defaults', () => {
    it('breaking — opaque superseding statement (no parseable members)', () => {
      const oldDef = { kind: 'interface_contracts', contracts: [{ id: 'IC-1', protocol: 'rest' }] };
      const opaque = { kind: 'interface_contracts', statement: 'the delete endpoint is removed', source: 'simulated_human_override' };
      expect(diffInterfaceDefinitions(oldDef, opaque)).toBe('breaking');
    });

    it('breaking — null / empty definitions', () => {
      expect(diffInterfaceDefinitions(null, null)).toBe('breaking');
      expect(diffInterfaceDefinitions({}, {})).toBe('breaking');
    });
  });
});

describe('diffInterfaceMembers — member-level detail (Phase 0.5 refactoring instructions)', () => {
  const base = {
    kind: 'data_models',
    models: [{ name: 'ShortUrl', entities: [{ name: 'ShortUrl', fields: [
      { name: 'slug', type: 'string' },
      { name: 'url', type: 'string' },
      { name: 'clicks', type: 'number' },
    ] }] }],
  };

  it('reports removed members + breaking', () => {
    const next = { kind: 'data_models', models: [{ name: 'ShortUrl', entities: [{ name: 'ShortUrl', fields: [
      { name: 'slug', type: 'string' }, { name: 'url', type: 'string' },
    ] }] }] };
    const d = diffInterfaceMembers(base, next);
    expect(d.modificationType).toBe('breaking');
    expect(d.removed).toEqual(['ShortUrl.clicks']);
    expect(d.added).toEqual([]);
    expect(d.retyped).toEqual([]);
    expect(d.parseable).toBe(true);
  });

  it('reports retyped members + breaking', () => {
    const next = { kind: 'data_models', models: [{ name: 'ShortUrl', entities: [{ name: 'ShortUrl', fields: [
      { name: 'slug', type: 'string' }, { name: 'url', type: 'string' }, { name: 'clicks', type: 'string' },
    ] }] }] };
    const d = diffInterfaceMembers(base, next);
    expect(d.modificationType).toBe('breaking');
    expect(d.retyped).toEqual(['ShortUrl.clicks']);
  });

  it('reports added members + additive', () => {
    const next = { kind: 'data_models', models: [{ name: 'ShortUrl', entities: [{ name: 'ShortUrl', fields: [
      ...base.models[0].entities[0].fields, { name: 'created_at', type: 'string' },
    ] }] }] };
    const d = diffInterfaceMembers(base, next);
    expect(d.modificationType).toBe('additive');
    expect(d.added).toEqual(['ShortUrl.created_at']);
    expect(d.removed).toEqual([]);
  });

  it('marks opaque/unparseable new definitions (parseable=false, breaking)', () => {
    const d = diffInterfaceMembers(base, { kind: 'data_models', statement: 'clicks removed' });
    expect(d.modificationType).toBe('breaking');
    expect(d.parseable).toBe(false);
  });

  it('diffInterfaceDefinitions wrapper agrees on the classification', () => {
    expect(diffInterfaceDefinitions(base, base)).toBe(diffInterfaceMembers(base, base).modificationType);
  });
});

describe('isCrossRunInterfaceKind', () => {
  it('accepts the three interface kinds', () => {
    expect(isCrossRunInterfaceKind('interface_contracts')).toBe(true);
    expect(isCrossRunInterfaceKind('api_definitions')).toBe(true);
    expect(isCrossRunInterfaceKind('data_models')).toBe(true);
  });
  it('rejects non-interface kinds', () => {
    expect(isCrossRunInterfaceKind('system_boundary')).toBe(false);
    expect(isCrossRunInterfaceKind('intent_statement')).toBe(false);
    expect(isCrossRunInterfaceKind(undefined)).toBe(false);
    expect(isCrossRunInterfaceKind(42)).toBe(false);
  });
});
