/**
 * Single source of truth for artifact id-extraction (Pillar B).
 *
 * The packet collectors (packetSynthesis.ts) and the coherence verifier's
 * upstream index (upstreamIndex.ts) each used to declare, independently, which
 * array-key + id-field carries the ids for each artifact. They drifted (4
 * mismatches → false P7_INVENTED_ID_REFERENCE for every NFR / compliance /
 * data-model / api id). This module declares each artifact's id-extraction
 * ONCE; both the index and the collectors derive their keys from here, so they
 * can never disagree again.
 *
 * Keys here are the ACTUAL emitted content keys (verified against the
 * producers in phase1.ts/phase2.ts/phase5.ts). Data-model entities and API
 * endpoints now carry producer-minted ids (Pillar A, dataModelIdMinter), so
 * they are extracted by their real `id` from the nested array — no synthetic
 * minting anywhere.
 */

export interface ArtifactIdSpec {
  /** governed_stream sub_phase_id this artifact is written under. */
  subPhaseId: string;
  /** content.kind discriminator (for collector filtering). */
  contentKind: string;
  /** Top-level array in content that holds the id-bearing (or nesting) items. */
  arrayKey: string;
  /** Id field on each top-level item; omit when ids live only in `nested`. */
  idField?: string;
  /** One level of nesting: e.g. user_stories[].acceptance_criteria[].id. */
  nested?: { arrayKey: string; idField: string };
  /** Position-indexed synthetic id (only for bare-string arrays like QA). */
  syntheticIdPrefix?: string;
}

/**
 * Keyed by a stable logical name. `subPhaseId` is the join key the index uses;
 * the named constants are imported by the collectors so the array-key lives in
 * exactly one place.
 */
export const ARTIFACT_ID_SPECS = {
  technicalConstraints: { subPhaseId: 'technical_constraints_discovery', contentKind: 'technical_constraints_discovery', arrayKey: 'technicalConstraints', idField: 'id' },
  complianceItems: { subPhaseId: 'compliance_retention_discovery', contentKind: 'compliance_retention_discovery', arrayKey: 'complianceExtractedItems', idField: 'id' },
  vvRequirements: { subPhaseId: 'vv_requirements_discovery', contentKind: 'vv_requirements_discovery', arrayKey: 'vvRequirements', idField: 'id' },
  canonicalVocabulary: { subPhaseId: 'canonical_vocabulary_discovery', contentKind: 'canonical_vocabulary_discovery', arrayKey: 'canonicalVocabulary', idField: 'id' },
  qualityAttributes: { subPhaseId: 'integrations_qa_bloom', contentKind: 'integrations_qa_bloom', arrayKey: 'qualityAttributes', syntheticIdPrefix: 'QA-' },
  integrations: { subPhaseId: 'integrations_qa_bloom', contentKind: 'integrations_qa_bloom', arrayKey: 'integrations', idField: 'id' },
  releases: { subPhaseId: 'release_plan', contentKind: 'release_plan', arrayKey: 'releases', idField: 'release_id' },
  businessDomains: { subPhaseId: 'business_domains_bloom', contentKind: 'business_domains_bloom', arrayKey: 'domains', idField: 'id' },
  personas: { subPhaseId: 'business_domains_bloom', contentKind: 'business_domains_bloom', arrayKey: 'personas', idField: 'id' },
  userJourneys: { subPhaseId: 'user_journey_bloom', contentKind: 'user_journey_bloom', arrayKey: 'userJourneys', idField: 'id' },
  workflows: { subPhaseId: 'system_workflow_bloom', contentKind: 'system_workflow_bloom', arrayKey: 'workflows', idField: 'id' },
  entities: { subPhaseId: 'entities_bloom', contentKind: 'entities_bloom', arrayKey: 'entities', idField: 'id' },

  // Phase 2 — requirements
  userStories: { subPhaseId: 'fr_bloom_skeleton', contentKind: 'functional_requirements', arrayKey: 'user_stories', idField: 'id', nested: { arrayKey: 'acceptance_criteria', idField: 'id' } },
  // FIX: NFRs are emitted under `requirements` (was wrongly `nonfunctional_requirements` in the index).
  nfrs: { subPhaseId: 'nfr_bloom_skeleton', contentKind: 'non_functional_requirements', arrayKey: 'requirements', idField: 'id', nested: { arrayKey: 'acceptance_criteria', idField: 'id' } },

  // Phase 3 — system requirements
  systemRequirements: { subPhaseId: 'system_requirements', contentKind: 'system_requirements', arrayKey: 'items', idField: 'id' },

  // Phase 4–7 skeletons
  components: { subPhaseId: 'component_skeleton', contentKind: 'component_model', arrayKey: 'components', idField: 'id' },
  // Lever-1a cross-cutting NFR concerns (`cc-*`) — emitted at component_skeleton
  // alongside component_model. Tasks trace to these; without indexing them P7
  // flagged every `cc-*` reference as invented.
  crossCuttingConstraints: { subPhaseId: 'component_skeleton', contentKind: 'cross_cutting_constraints', arrayKey: 'concerns', idField: 'id' },
  // FIX: data models live under `models[].entities[]` with producer-minted `id` (Pillar A).
  dataModels: { subPhaseId: 'data_model_skeleton', contentKind: 'data_models', arrayKey: 'models', nested: { arrayKey: 'entities', idField: 'id' } },
  // FIX: api defs live under `definitions[].endpoints[]` with producer-minted `id` (Pillar A).
  apiDefinitions: { subPhaseId: 'api_definitions', contentKind: 'api_definitions', arrayKey: 'definitions', nested: { arrayKey: 'endpoints', idField: 'id' } },
  tasks: { subPhaseId: 'task_skeleton', contentKind: 'implementation_plan', arrayKey: 'tasks', idField: 'id' },
  testSuites: { subPhaseId: 'test_case_skeleton', contentKind: 'test_plan', arrayKey: 'test_suites', idField: 'suite_id', nested: { arrayKey: 'test_cases', idField: 'test_case_id' } },
} as const satisfies Record<string, ArtifactIdSpec>;

export type ArtifactIdSpecName = keyof typeof ARTIFACT_ID_SPECS;

/** All specs as a flat array (the index walks these). */
export const ALL_ID_SPECS: ArtifactIdSpec[] = Object.values(ARTIFACT_ID_SPECS);
