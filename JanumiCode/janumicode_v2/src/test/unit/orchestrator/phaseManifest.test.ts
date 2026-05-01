import { describe, it, expect } from 'vitest';
import {
  PHASES,
  SUB_PHASES,
  CROSS_CUTTING,
  getPhase,
  getSubPhase,
  getCrossCutting,
  displayCodeFor,
  displayLabelFor,
  subPhasesOf,
  parentPhaseOf,
  isKnownSubPhase,
  isKnownPhase,
  validateManifest,
} from '../../../lib/orchestrator/phaseManifest';

describe('phaseManifest', () => {
  describe('structural integrity', () => {
    it('passes internal validation', () => {
      expect(validateManifest()).toEqual([]);
    });

    it('every sub-phase parentPhase resolves to a known phase', () => {
      for (const sp of SUB_PHASES) {
        expect(getPhase(sp.parentPhase)).toBeDefined();
      }
    });

    it('all ids are unique across phases, sub-phases, and cross-cutting', () => {
      const ids = [
        ...PHASES.map((p) => p.id),
        ...SUB_PHASES.map((s) => s.id),
        ...CROSS_CUTTING.map((c) => c.id),
      ];
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('display code derivation', () => {
    // These expectations lock in the slug → displayCode mapping that
    // was reviewed and approved before the refactor began. If you
    // change manifest order or `group` membership and these break,
    // confirm the new codes are intentional before updating.

    it('phase 0 — workspace_init', () => {
      expect(displayCodeFor('workspace_classification')).toBe('0.1.1');
      expect(displayCodeFor('external_reference_resolution')).toBe('0.1.2');
      expect(displayCodeFor('artifact_ingestion')).toBe('0.2.1');
      expect(displayCodeFor('brownfield_continuity_check')).toBe('0.2.2');
      expect(displayCodeFor('vocabulary_collision_check')).toBe('0.3');
    });

    it('phase 0.5 — cross_run_impact_analysis', () => {
      expect(displayCodeFor('impact_enumeration')).toBe('0.5.1');
      expect(displayCodeFor('refactoring_decision')).toBe('0.5.2');
    });

    it('phase 1 — intent_capture', () => {
      expect(displayCodeFor('intent_quality_check')).toBe('1.1');
      expect(displayCodeFor('intent_lens_classification')).toBe('1.2');
      expect(displayCodeFor('product_intent_discovery')).toBe('1.3.1');
      expect(displayCodeFor('technical_constraints_discovery')).toBe('1.3.2');
      expect(displayCodeFor('compliance_retention_discovery')).toBe('1.3.3');
      expect(displayCodeFor('vv_requirements_discovery')).toBe('1.3.4');
      expect(displayCodeFor('canonical_vocabulary_discovery')).toBe('1.3.5');
      expect(displayCodeFor('discovery_bundle_compose')).toBe('1.3.6');
      expect(displayCodeFor('scope_bounding')).toBe('1.4');
      expect(displayCodeFor('business_domains_bloom')).toBe('1.5');
      expect(displayCodeFor('user_journey_bloom')).toBe('1.6');
      expect(displayCodeFor('system_workflow_bloom')).toBe('1.7');
      expect(displayCodeFor('coverage_verifier')).toBe('1.8');
      expect(displayCodeFor('entities_bloom')).toBe('1.9');
      expect(displayCodeFor('integrations_qa_bloom')).toBe('1.10');
      expect(displayCodeFor('product_description_synthesis')).toBe('1.11');
      expect(displayCodeFor('product_handoff_gate')).toBe('1.12');
      expect(displayCodeFor('release_plan')).toBe('1.13');
    });

    it('phase 2 — requirements (FR + NFR three-pass + saturation)', () => {
      expect(displayCodeFor('fr_bloom_skeleton')).toBe('2.1.1');
      expect(displayCodeFor('fr_bloom_enrichment')).toBe('2.1.2');
      expect(displayCodeFor('fr_bloom_verifier')).toBe('2.1.3');
      expect(displayCodeFor('fr_saturation')).toBe('2.1.4');
      expect(displayCodeFor('nfr_bloom_skeleton')).toBe('2.2.1');
      expect(displayCodeFor('nfr_bloom_enrichment')).toBe('2.2.2');
      expect(displayCodeFor('nfr_bloom_verifier')).toBe('2.2.3');
      expect(displayCodeFor('nfr_saturation')).toBe('2.2.4');
      expect(displayCodeFor('requirement_set_finalize')).toBe('2.3');
      expect(displayCodeFor('requirement_set_review_prep')).toBe('2.4');
      expect(displayCodeFor('requirements_gate')).toBe('2.5');
    });

    it('phase 3 — system_specification (flat)', () => {
      expect(displayCodeFor('system_boundary')).toBe('3.1');
      expect(displayCodeFor('system_requirements')).toBe('3.2');
      expect(displayCodeFor('interface_contracts')).toBe('3.3');
      expect(displayCodeFor('system_spec_finalize')).toBe('3.4');
      expect(displayCodeFor('system_spec_gate')).toBe('3.5');
    });

    it('phase 4 — architecture (with component group)', () => {
      expect(displayCodeFor('software_domains')).toBe('4.1');
      expect(displayCodeFor('component_skeleton')).toBe('4.2.1');
      expect(displayCodeFor('component_saturation')).toBe('4.2.2');
      expect(displayCodeFor('adr_capture')).toBe('4.3');
      expect(displayCodeFor('architecture_synthesis')).toBe('4.4');
      expect(displayCodeFor('architecture_gate')).toBe('4.5');
    });

    it('phase 5 — technical_specification (with data_model group)', () => {
      expect(displayCodeFor('data_model_skeleton')).toBe('5.1.1');
      expect(displayCodeFor('data_model_saturation')).toBe('5.1.2');
      expect(displayCodeFor('api_definitions')).toBe('5.2');
      expect(displayCodeFor('error_handling')).toBe('5.3');
      expect(displayCodeFor('configuration_parameters')).toBe('5.4');
      expect(displayCodeFor('technical_spec_synthesis')).toBe('5.5');
      expect(displayCodeFor('technical_spec_gate')).toBe('5.6');
    });

    it('phase 6 — implementation_planning (with task group)', () => {
      expect(displayCodeFor('task_skeleton')).toBe('6.1.1');
      expect(displayCodeFor('task_saturation')).toBe('6.1.2');
      expect(displayCodeFor('implementation_plan_synthesis')).toBe('6.2');
      expect(displayCodeFor('implementation_plan_gate')).toBe('6.3');
    });

    it('phase 7 — test_planning (with test_case group)', () => {
      expect(displayCodeFor('test_case_skeleton')).toBe('7.1.1');
      expect(displayCodeFor('test_case_saturation')).toBe('7.1.2');
      expect(displayCodeFor('test_plan_synthesis')).toBe('7.2');
      expect(displayCodeFor('test_plan_review_prep')).toBe('7.3');
      expect(displayCodeFor('test_plan_gate')).toBe('7.4');
    });

    it('phases 8/9/10 (flat)', () => {
      expect(displayCodeFor('evaluation_design')).toBe('8.1');
      expect(displayCodeFor('evaluation_metrics')).toBe('8.2');
      expect(displayCodeFor('evaluation_thresholds')).toBe('8.3');
      expect(displayCodeFor('evaluation_synthesis')).toBe('8.4');
      expect(displayCodeFor('evaluation_gate')).toBe('8.5');

      expect(displayCodeFor('implementation_task_execution')).toBe('9.1');
      expect(displayCodeFor('test_execution')).toBe('9.2');
      expect(displayCodeFor('evaluation_execution')).toBe('9.3');
      expect(displayCodeFor('execution_synthesis')).toBe('9.4');
      expect(displayCodeFor('execution_gate')).toBe('9.5');

      expect(displayCodeFor('pre_commit_consistency_check')).toBe('10.1');
      expect(displayCodeFor('commit_preparation')).toBe('10.2');
      expect(displayCodeFor('workflow_run_closure')).toBe('10.3');
    });
  });

  describe('cross-cutting entries have no displayCode', () => {
    it('reasoning_review has no display code', () => {
      expect(displayCodeFor('reasoning_review')).toBeUndefined();
    });

    it('renders as bracketed slug in displayLabelFor', () => {
      expect(displayLabelFor('reasoning_review')).toContain('[reasoning_review]');
    });
  });

  describe('lookup helpers', () => {
    it('getPhase / getSubPhase / getCrossCutting', () => {
      expect(getPhase('requirements')?.displayName).toBe('Requirements');
      expect(getSubPhase('fr_saturation')?.parentPhase).toBe('requirements');
      expect(getCrossCutting('reasoning_review')?.agentRole).toBe('reasoning_review');
    });

    it('subPhasesOf returns sub-phases in execution order', () => {
      const phase2Subs = subPhasesOf('requirements').map((sp) => sp.id);
      expect(phase2Subs.slice(0, 4)).toEqual([
        'fr_bloom_skeleton',
        'fr_bloom_enrichment',
        'fr_bloom_verifier',
        'fr_saturation',
      ]);
    });

    it('parentPhaseOf walks back to the phase entry', () => {
      expect(parentPhaseOf('fr_saturation')?.id).toBe('requirements');
      expect(parentPhaseOf('does_not_exist')).toBeUndefined();
    });

    it('isKnownSubPhase / isKnownPhase', () => {
      expect(isKnownSubPhase('fr_saturation')).toBe(true);
      expect(isKnownSubPhase('reasoning_review')).toBe(true); // cross-cutting counts
      expect(isKnownSubPhase('2.1a')).toBe(false); // legacy IDs no longer recognized
      expect(isKnownPhase('requirements')).toBe(true);
      expect(isKnownPhase('2')).toBe(false);
    });
  });

  describe('displayLabelFor', () => {
    it('formats sub-phase as "code · name"', () => {
      expect(displayLabelFor('fr_saturation')).toBe('2.1.4 · FR Saturation');
    });

    it('formats cross-cutting as "[id] name"', () => {
      expect(displayLabelFor('reasoning_review')).toBe('[reasoning_review] Reasoning Review');
    });

    it('falls back to raw id for unknown slugs', () => {
      expect(displayLabelFor('totally_made_up')).toBe('totally_made_up');
    });
  });
});
