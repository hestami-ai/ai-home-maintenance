import { describe, it, expect } from 'vitest';
import { classifyGoverningKind, BINDING_KINDS } from '../../../lib/agents/governingClassification';

describe('classifyGoverningKind — binding vs certified_context', () => {
  it('classifies normative rule kinds as BINDING', () => {
    for (const kind of [
      'technical_constraints_discovery', 'architectural_decisions', 'non_functional_requirements',
      'compliance_context', 'vv_requirements_discovery', 'quality_attribute',
      'completion_criteria', 'constitutional_invariant', 'cross_cutting_constraints',
    ]) {
      expect(classifyGoverningKind(kind)).toBe('binding');
    }
  });

  it('classifies certified architecture/structural kinds as CERTIFIED_CONTEXT', () => {
    for (const kind of [
      'component_model', 'data_models', 'api_definitions', 'interface_contracts',
      'software_domains', 'system_boundary', 'system_requirements', 'intent_statement',
      'functional_requirements', 'error_handling_strategies', 'configuration_parameters',
      'implementation_plan',
    ]) {
      expect(classifyGoverningKind(kind)).toBe('certified_context');
    }
  });

  it('defaults unknown / undefined kinds to certified_context (conservative)', () => {
    expect(classifyGoverningKind('some_new_artifact_kind')).toBe('certified_context');
    expect(classifyGoverningKind(undefined)).toBe('certified_context');
    expect(classifyGoverningKind('')).toBe('certified_context');
  });

  it('reproduces the ws-156 split: only ADR + NFR are binding among the 14', () => {
    // The 14 kinds actually rendered under "apply without exception" in ws-156.
    const ws156 = [
      'component_model', 'data_models', 'api_definitions', 'interface_contracts',
      'architectural_decisions', 'software_domains', 'intent_statement',
      'functional_requirements', 'non_functional_requirements', 'system_boundary',
      'system_requirements', 'error_handling_strategies', 'configuration_parameters',
      'implementation_plan',
    ];
    const binding = ws156.filter(k => classifyGoverningKind(k) === 'binding');
    expect(binding.sort()).toEqual(['architectural_decisions', 'non_functional_requirements']);
    expect(ws156.length - binding.length).toBe(12); // the other 12 become certified context
  });

  it('BINDING_KINDS is the single source of truth (membership === binding)', () => {
    expect(BINDING_KINDS.has('architectural_decisions')).toBe(true);
    expect(BINDING_KINDS.has('component_model')).toBe(false);
  });
});
