import { describe, it, expect } from 'vitest';
import { validateContractSchema } from '../../../../../../lib/review/harness/validators/deterministic/contractSchemaValidator';
import { makeRuntime } from './_helpers';

describe('contract_schema_validator (deterministic)', () => {
  it('returns [] for valid IQC output', () => {
    const findings = validateContractSchema(
      makeRuntime({
        outputContent: { overall_status: 'pass', concerns: [] },
      }),
    );
    expect(findings).toEqual([]);
  });

  it('flags HIGH for missing required field', () => {
    const findings = validateContractSchema(
      makeRuntime({ outputContent: { concerns: [] } }),
    );
    const high = findings.filter((f) => f.severity === 'HIGH');
    expect(high.length).toBeGreaterThan(0);
    expect(high[0].type).toBe('missing_required_field');
    expect(high[0].location).toBe('$.overall_status');
  });

  it('flags MEDIUM for wrong-enum value', () => {
    const findings = validateContractSchema(
      makeRuntime({
        outputContent: { overall_status: 'maybe', concerns: [] },
      }),
    );
    const med = findings.find((f) => f.severity === 'MEDIUM');
    expect(med).toBeDefined();
    expect(med?.type).toBe('wrong_enum');
  });

  it('flags HIGH on parse failure (outputContent=null with non-empty text)', () => {
    const findings = validateContractSchema(
      makeRuntime({ outputContent: null, outputText: 'not json' }),
    );
    expect(findings[0].type).toBe('invalid_json');
    expect(findings[0].severity).toBe('HIGH');
  });

  it('returns [] for unsampled (role, sub_phase) pair', () => {
    const findings = validateContractSchema(
      makeRuntime({
        agentRole: 'systems_agent',
        subPhaseId: 'unknown_sub_phase',
        outputContent: { foo: 'bar' },
      }),
    );
    expect(findings).toEqual([]);
  });

  // ── Phase 3 schemas ─────────────────────────────────────────────────

  describe('S15 — systems_agent / system_boundary', () => {
    it('returns [] for valid system_boundary output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'systems_agent',
          subPhaseId: 'system_boundary',
          outputContent: {
            in_scope: ['Property Registry'],
            out_of_scope: ['Monetization model'],
            external_systems: [{ id: 'EXT-001', name: 'Stripe' }],
          },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when in_scope is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'systems_agent',
          subPhaseId: 'system_boundary',
          outputContent: { out_of_scope: [], external_systems: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH' && f.location === '$.in_scope')).toBe(true);
    });
  });

  describe('S16 — systems_agent / system_requirements', () => {
    it('returns [] for valid system_requirements output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'systems_agent',
          subPhaseId: 'system_requirements',
          outputContent: { system_requirements: [{ id: 'SR-001', statement: 'The system shall...' }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when system_requirements is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'systems_agent',
          subPhaseId: 'system_requirements',
          outputContent: { foo: 'bar' },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH' && f.location === '$.system_requirements')).toBe(true);
    });
  });

  describe('S17 — systems_agent / interface_contracts', () => {
    it('returns [] for valid interface_contracts output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'systems_agent',
          subPhaseId: 'interface_contracts',
          outputContent: { contracts: [{ id: 'CONTRACT-001' }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when contracts array is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'systems_agent',
          subPhaseId: 'interface_contracts',
          outputContent: { interface_contracts: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH' && f.location === '$.contracts')).toBe(true);
    });
  });

  // ── Phase 4 schemas ─────────────────────────────────────────────────

  describe('S18 — architecture_agent / software_domains', () => {
    it('returns [] for valid software_domains output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'architecture_agent',
          subPhaseId: 'software_domains',
          outputContent: { software_domains: [{ id: 'domain-prop-registry', name: 'Property Registry' }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when software_domains is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'architecture_agent',
          subPhaseId: 'software_domains',
          outputContent: { domains: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH' && f.location === '$.software_domains')).toBe(true);
    });
  });

  describe('S19 — architecture_agent / component_skeleton', () => {
    it('returns [] for valid component_skeleton output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'architecture_agent',
          subPhaseId: 'component_skeleton',
          outputContent: { components: [{ id: 'COMP-001', name: 'Auth Service' }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when components is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'architecture_agent',
          subPhaseId: 'component_skeleton',
          outputContent: { services: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH' && f.location === '$.components')).toBe(true);
    });
  });

  describe('S20 — architecture_agent / adr_capture', () => {
    it('returns [] for valid adr_capture output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'architecture_agent',
          subPhaseId: 'adr_capture',
          outputContent: {
            architectural_decisions: [
              { id: 'ADR-001', title: 'Auth Pattern', status: 'proposed', rationale: 'Better-Auth is already a dependency.' },
            ],
          },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when architectural_decisions is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'architecture_agent',
          subPhaseId: 'adr_capture',
          outputContent: { adrs: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH' && f.location === '$.architectural_decisions')).toBe(true);
    });
  });

  describe('S21 — domain_interpreter / component_saturation', () => {
    it('returns [] for valid component_saturation output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'domain_interpreter',
          subPhaseId: 'component_saturation',
          outputContent: {
            parent_branch_classification: 'decomposable',
            parent_tier_assessment: { tier: 'A', agrees_with_hint: true, rationale: 'Large subsystem.' },
            children: [],
          },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when parent_branch_classification is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'domain_interpreter',
          subPhaseId: 'component_saturation',
          outputContent: { parent_tier_assessment: {}, children: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH' && f.location === '$.parent_branch_classification')).toBe(true);
    });

    it('flags MEDIUM for invalid parent_branch_classification enum', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'domain_interpreter',
          subPhaseId: 'component_saturation',
          outputContent: {
            parent_branch_classification: 'leaf',
            parent_tier_assessment: {},
            children: [],
          },
        }),
      );
      expect(findings.some((f) => f.severity === 'MEDIUM' && f.type === 'wrong_enum')).toBe(true);
    });
  });

  // ── Phase 5 schemas ─────────────────────────────────────────────────

  describe('S22 — technical_spec_agent / data_model_skeleton', () => {
    it('returns [] for valid data_model_skeleton output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'data_model_skeleton',
          outputContent: { data_models: [{ component_id: 'COMP-001', entities: [] }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when data_models is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'data_model_skeleton',
          outputContent: { models: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH' && f.location === '$.data_models')).toBe(true);
    });
  });

  describe('S23 — technical_spec_agent / api_definitions', () => {
    it('returns [] for valid api_definitions output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'api_definitions',
          outputContent: { api_definitions: [{ component_id: 'COMP-001', endpoints: [] }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when api_definitions is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'api_definitions',
          outputContent: { endpoints: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH' && f.location === '$.api_definitions')).toBe(true);
    });
  });

  describe('S24 — technical_spec_agent / error_handling', () => {
    it('returns [] for valid error_handling output (strategies key)', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'error_handling',
          outputContent: { strategies: [{ component_id: 'COMP-001', error_types: ['timeout'] }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when both strategies and error_handling_strategies are missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'error_handling',
          outputContent: { error_strategies: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
    });
  });

  describe('S25 — technical_spec_agent / configuration_parameters', () => {
    it('returns [] for valid configuration_parameters output (params key)', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'configuration_parameters',
          outputContent: { params: [{ component_id: 'COMP-001', name: 'timeout_ms', type: 'integer' }] },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags HIGH when params is missing', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'configuration_parameters',
          outputContent: { configuration: [] },
        }),
      );
      expect(findings.some((f) => f.severity === 'HIGH')).toBe(true);
    });
  });

  describe('S26 — technical_spec_agent / data_model_saturation', () => {
    it('returns [] for valid data_model_saturation output', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'data_model_saturation',
          outputContent: {
            parent_branch_classification: 'decomposable',
            parent_tier_assessment: { tier: 'B', agrees_with_hint: true },
            children: [],
          },
        }),
      );
      expect(findings).toEqual([]);
    });

    it('flags MEDIUM for invalid parent_branch_classification enum (data model rubric uses atomic_value not atomic_leaf)', () => {
      const findings = validateContractSchema(
        makeRuntime({
          agentRole: 'technical_spec_agent',
          subPhaseId: 'data_model_saturation',
          outputContent: {
            parent_branch_classification: 'atomic_leaf',
            parent_tier_assessment: {},
            children: [],
          },
        }),
      );
      // atomic_leaf is valid for component_saturation but NOT for data_model_saturation
      expect(findings.some((f) => f.severity === 'MEDIUM' && f.type === 'wrong_enum')).toBe(true);
    });
  });
});
