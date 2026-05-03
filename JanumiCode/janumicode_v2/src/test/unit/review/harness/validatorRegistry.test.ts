import { describe, it, expect } from 'vitest';
import {
  VALIDATOR_REGISTRY,
  getValidatorById,
  selectValidators,
  validateRegistryStructure,
} from '../../../../lib/review/harness/validatorRegistry';

describe('reasoning-review harness — validatorRegistry', () => {
  describe('validateRegistryStructure', () => {
    it('returns no errors on the canonical registry', () => {
      const errors = validateRegistryStructure();
      expect(errors).toEqual([]);
    });

    it('every entry has unique id, family, description, and predicate', () => {
      const ids = new Set<string>();
      for (const entry of VALIDATOR_REGISTRY) {
        expect(entry.id).toBeTruthy();
        expect(ids.has(entry.id)).toBe(false);
        ids.add(entry.id);
        expect(entry.family).toBeTruthy();
        expect(entry.description).toBeTruthy();
        expect(typeof entry.appliesTo).toBe('function');
      }
    });

    it('every LLM validator has promptTemplatePath under prompts/review/<family>', () => {
      for (const entry of VALIDATOR_REGISTRY) {
        if (entry.kind === 'llm') {
          expect(entry.promptTemplatePath).toMatch(/^prompts\/review\/[^/]+\/.+\.system\.md$/);
        }
      }
    });
  });

  describe('getValidatorById', () => {
    it('resolves a known cross-role validator', () => {
      const entry = getValidatorById('grounding_validator');
      expect(entry).toBeDefined();
      expect(entry?.family).toBe('cross_role');
      expect(entry?.kind).toBe('llm');
    });

    it('resolves the renamed release_balance_audit (was pillar_balance_audit)', () => {
      const entry = getValidatorById('release_balance_audit');
      expect(entry).toBeDefined();
      expect(entry?.family).toBe('synthesis');
      expect(entry?.kind).toBe('llm');
      // Sanity-check: pillar_balance_audit must NOT be in the registry —
      // it was renamed per locked decision §6.1.
      expect(getValidatorById('pillar_balance_audit')).toBeUndefined();
    });

    it('returns undefined for an unknown id', () => {
      expect(getValidatorById('does_not_exist_validator')).toBeUndefined();
    });
  });

  describe('selectValidators — IQC bundle', () => {
    const dispatched = selectValidators({
      agentRole: 'orchestrator',
      subPhaseId: 'intent_quality_check',
      outputContent: {},
      outputThinking: '',
    }).map((v) => v.id);

    it('includes universal cross-role validators applicable at IQC', () => {
      expect(dispatched).toContain('contract_schema_validator');
      expect(dispatched).toContain('grounding_validator');
      expect(dispatched).toContain('reasoning_to_response_faithfulness');
      expect(dispatched).toContain('final_synthesis');
    });

    it('includes IQC role-specific validators', () => {
      expect(dispatched).toContain('completeness_evidence_adequacy');
      expect(dispatched).toContain('coherence_evidence_audit');
      expect(dispatched).toContain('status_consistency_iqc');
    });

    it('excludes saturation-only and bloom-only validators', () => {
      expect(dispatched).not.toContain('tier_decomposition_validator');
      expect(dispatched).not.toContain('bloom_completeness_vs_thinking');
      expect(dispatched).not.toContain('persona_id_continuity');
    });
  });

  describe('selectValidators — FR skeleton bundle', () => {
    const dispatched = selectValidators({
      agentRole: 'requirements_agent',
      subPhaseId: 'fr_bloom_skeleton',
      outputContent: {},
      outputThinking: '',
    }).map((v) => v.id);

    it('includes the requirements-skeleton class validators', () => {
      expect(dispatched).toContain('story_structural_completeness');
      expect(dispatched).toContain('handoff_coverage_audit');
      expect(dispatched).toContain('story_shape_conformance');
      expect(dispatched).toContain('measurement_adequacy_validator');
      expect(dispatched).toContain('pass_scope_discipline');
    });

    it('includes universal cross-role validators', () => {
      expect(dispatched).toContain('contract_schema_validator');
      expect(dispatched).toContain('grounding_validator');
      expect(dispatched).toContain('reasoning_to_response_faithfulness');
      expect(dispatched).toContain('reasoning_quality_validator');
      expect(dispatched).toContain('final_synthesis');
    });

    it('excludes enrichment-only and saturation-only validators', () => {
      expect(dispatched).not.toContain('enrichment_echo_invariance');
      expect(dispatched).not.toContain('ac_count_discipline');
      expect(dispatched).not.toContain('threshold_grounding_audit');
      expect(dispatched).not.toContain('tier_decomposition_validator');
    });
  });

  describe('selectValidators — release_plan bundle', () => {
    const dispatched = selectValidators({
      agentRole: 'orchestrator',
      subPhaseId: 'release_plan',
      outputContent: {},
      outputThinking: '',
    }).map((v) => v.id);

    it('includes release_balance_audit (renamed from pillar_balance_audit)', () => {
      expect(dispatched).toContain('release_balance_audit');
    });

    it('includes release-plan synthesis-class validators', () => {
      expect(dispatched).toContain('wave_dependency_topology');
      expect(dispatched).toContain('mvp_credibility_check');
      expect(dispatched).toContain('compliance_sequencing_audit');
      expect(dispatched).toContain('synthesis_fabrication_check');
    });
  });

  describe('selectValidators — saturation pass (DEFERRED)', () => {
    const dispatched = selectValidators({
      agentRole: 'requirements_agent',
      subPhaseId: 'fr_saturation',
      outputContent: {},
      outputThinking: '',
    }).map((v) => v.id);

    it('does not dispatch tier_decomposition_validator (DEFERRED)', () => {
      expect(dispatched).not.toContain('tier_decomposition_validator');
    });

    it('dispatches only the saturation-universal bundle', () => {
      // Per §6.8 the saturation-pass implementation is blocked until a
      // calibration sample lands — only the universal trio fires.
      expect(dispatched).toContain('contract_schema_validator');
      expect(dispatched).toContain('grounding_validator');
      expect(dispatched).toContain('reasoning_to_response_faithfulness');
      expect(dispatched).toContain('reasoning_quality_validator');
      expect(dispatched).toContain('final_synthesis');
      // No requirements-class enrichment validators at saturation yet.
      expect(dispatched).not.toContain('measurement_adequacy_validator');
      expect(dispatched).not.toContain('threshold_grounding_audit');
    });
  });

  describe('selectValidators — unsampled role placeholder bundle', () => {
    it('returns the placeholder bundle for an unsampled role', () => {
      const dispatched = selectValidators({
        agentRole: 'systems_agent',
        subPhaseId: 'systems_decomposition',
        outputContent: {},
        outputThinking: '',
      }).map((v) => v.id);

      // Placeholder per harness_design §2.3 + deferred §1.
      expect(dispatched).toContain('contract_schema_validator');
      expect(dispatched).toContain('reasoning_quality_validator');
      expect(dispatched).toContain('grounding_validator');
      expect(dispatched).toContain('reasoning_to_response_faithfulness');
      expect(dispatched).toContain('final_synthesis');
      // Role-specific outliers must not bleed into placeholder runs.
      expect(dispatched).not.toContain('release_balance_audit');
      expect(dispatched).not.toContain('completeness_evidence_adequacy');
    });
  });

  describe('selectValidators — discovery bundle (compliance)', () => {
    it('includes compliance-specific discovery validators only at S04', () => {
      const s04 = selectValidators({
        agentRole: 'domain_interpreter',
        subPhaseId: 'compliance_retention_discovery',
        outputContent: {},
        outputThinking: '',
      }).map((v) => v.id);
      expect(s04).toContain('regime_citation_validity');
      expect(s04).toContain('retention_threshold_grounding');
      expect(s04).toContain('compliance_signal_completeness');
      expect(s04).toContain('scope_boundary_adherence_discovery');

      const s03 = selectValidators({
        agentRole: 'domain_interpreter',
        subPhaseId: 'product_intent_discovery',
        outputContent: {},
        outputThinking: '',
      }).map((v) => v.id);
      expect(s03).not.toContain('regime_citation_validity');
      expect(s03).not.toContain('retention_threshold_grounding');
      expect(s03).not.toContain('compliance_signal_completeness');
      expect(s03).toContain('scope_boundary_adherence_discovery');
    });
  });

  describe('saturation entries are registered but always inactive', () => {
    it('tier_decomposition_validator never dispatches (DEFERRED per §6.8)', () => {
      const entry = getValidatorById('tier_decomposition_validator');
      expect(entry).toBeDefined();
      expect(entry?.family).toBe('requirements_saturation');

      // Try every sampled (role, sub_phase) combination; tier_decomposition
      // must never be selected.
      const probes: Array<{ agentRole: string; subPhaseId: string }> = [
        { agentRole: 'orchestrator', subPhaseId: 'intent_quality_check' },
        { agentRole: 'requirements_agent', subPhaseId: 'fr_bloom_skeleton' },
        { agentRole: 'requirements_agent', subPhaseId: 'fr_bloom_enrichment' },
        { agentRole: 'requirements_agent', subPhaseId: 'fr_saturation' },
        { agentRole: 'requirements_agent', subPhaseId: 'nfr_saturation' },
      ];
      for (const p of probes) {
        const ids = selectValidators({
          ...p,
          outputContent: {},
          outputThinking: '',
        }).map((v) => v.id);
        expect(ids).not.toContain('tier_decomposition_validator');
      }
    });
  });
});
