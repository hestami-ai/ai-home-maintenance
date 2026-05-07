# Track C — Sample Manifest

Samples extracted from cal-25 (workflow run 9c5922af-b477-49a8-9166-693da0ad2b92) at 2026-04-30T21:17:40+00:00.

| # | Agent role | Sub-phase | Phase code | Sample file | Has thinking | Has review | Review concerns | Prompt size | Response size |
|---|---|---|---|---|---|---|---|---|---|
| 01 | orchestrator | intent_quality_check | 1.1 | [01_…](01_orchestrator__intent_quality_check.md) | yes | yes | hasConcerns=false (0 findings) | 26.1KB | 1013B |
| 02 | orchestrator | intent_lens_classification | 1.2 | [02_…](02_orchestrator__intent_lens_classification.md) | yes | yes | hasConcerns=false (0 findings) | 26.4KB | 422B |
| 03 | domain_interpreter | product_intent_discovery | 1.3.1 | [03_…](03_domain_interpreter__product_intent_discovery.md) | yes | yes | hasConcerns=false (0 findings) | 32.6KB | 15.0KB |
| 04 | domain_interpreter | compliance_retention_discovery | 1.3.3 | [04_…](04_domain_interpreter__compliance_retention_discovery.md) | yes | yes | hasConcerns=false (0 findings) | 27.3KB | 3.0KB |
| 05 | domain_interpreter | business_domains_bloom | 1.5 | [05_…](05_domain_interpreter__business_domains_bloom.md) | yes | yes | hasConcerns=true (3 findings) | 9.7KB | 14.2KB |
| 06 | domain_interpreter | user_journey_bloom | 1.6 | [06_…](06_domain_interpreter__user_journey_bloom.md) | yes | yes | hasConcerns=true (1 finding) | 15.8KB | 33.3KB |
| 07 | domain_interpreter | product_description_synthesis | 1.11 | [07_…](07_domain_interpreter__product_description_synthesis.md) | yes | yes | hasConcerns=false (0 findings) | 8.8KB | 2.6KB |
| 08 | orchestrator | release_plan | 1.13 | [08_…](08_orchestrator__release_plan.md) | yes | yes | hasConcerns=false (0 findings) | 12.3KB | 3.2KB |
| 09 | requirements_agent | fr_bloom_skeleton | 2.1.1 | [09_…](09_requirements_agent__fr_bloom_skeleton.md) | yes | yes | hasConcerns=true (1 finding) | 31.5KB | 15.7KB |
| 10 | requirements_agent | fr_bloom_enrichment | 2.1.2 | [10_…](10_requirements_agent__fr_bloom_enrichment.md) | yes | yes | hasConcerns=false (0 findings) | 10.1KB | 1.4KB |
| 11 | requirements_agent | nfr_bloom_skeleton | 2.2.1 | [11_…](11_requirements_agent__nfr_bloom_skeleton.md) | yes | yes | hasConcerns=true (3 findings) | 34.2KB | 11.7KB |
| 12 | requirements_agent | nfr_bloom_enrichment | 2.2.2 | [12_…](12_requirements_agent__nfr_bloom_enrichment.md) | yes | yes | hasConcerns=false (0 findings) | 5.7KB | 497B |

## Notes
- Each row's "Review concerns" column reports the `hasConcerns` boolean and finding count from the captured reasoning_review_record.
- "Has thinking" is true if `agent_output.content.thinking` is non-empty.
- Sub_phase numeric Phase codes derive from the manifest at src/lib/orchestrator/phaseManifest.ts.
- Saturation passes (fr_saturation, nfr_saturation) intentionally excluded — already assessed in `redesign recommendations - 1.md`.

## Track C extension — cal-26 samples (Phase 2 saturation)

Samples extracted from cal-26 (workflow run `cea225ec-8b12-40ff-bf25-1bd26ff8a298`) at 2026-05-04T15:02:02.109Z. cal-26 ran with the new harness enabled (Track D shipped); these samples capture the full harness output rather than the legacy reasoning_review.

| # | Agent role | Sub-phase | Depth | Sample file | Has thinking | Harness validators | Findings | Decision |
|---|---|---|---|---|---|---|---|---|
| 13a | requirements_agent | fr_saturation | 0 | [13a_requirements_agent__fr_saturation_depth0.md](13a_requirements_agent__fr_saturation_depth0.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 1 (H=0/M=0/L=1) | ACCEPT |
| 13b | requirements_agent | fr_saturation | 4 | [13b_requirements_agent__fr_saturation_depth4.md](13b_requirements_agent__fr_saturation_depth4.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 1 (H=0/M=0/L=1) | ACCEPT |
| 13c | requirements_agent | fr_saturation | 8 | [13c_requirements_agent__fr_saturation_depth8.md](13c_requirements_agent__fr_saturation_depth8.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 2 (H=1/M=1/L=0) | REVISE |
| 14a | requirements_agent | nfr_saturation | 0 | [14a_requirements_agent__nfr_saturation_depth0.md](14a_requirements_agent__nfr_saturation_depth0.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 1 (H=0/M=0/L=1) | ACCEPT |
| 14b | requirements_agent | nfr_saturation | 4 | [14b_requirements_agent__nfr_saturation_depth4.md](14b_requirements_agent__nfr_saturation_depth4.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 7 (H=5/M=2/L=0) | QUARANTINE |
| 14c | requirements_agent | nfr_saturation | 8 | [14c_requirements_agent__nfr_saturation_depth8.md](14c_requirements_agent__nfr_saturation_depth8.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 6 (H=0/M=3/L=3) | REVISE |

## Track C extension — cal-26 samples (Phase 3 system specification)

Samples 15–17 from cal-26 (workflow run `cea225ec-8b12-40ff-bf25-1bd26ff8a298`) at 2026-05-04T08:12–08:29Z. `systems_agent` role newly introduced in this Phase; harness dispatched the default 5-validator bundle on all three sub-phases (Phase 3 was not in DISPATCH_BUNDLES at cal-26 time — same placeholder-bundle situation as fr_saturation/nfr_saturation). `deep_memory_research` agent_outputs are also present in Phase 3 (one per sub-phase: system_boundary, system_requirements, interface_contracts) — not extracted as samples here; noted for Stage 1B.2 per-role assessment.

| # | Agent role | Sub-phase | Phase code | Sample file | Has thinking | Harness validators | Findings | Decision |
|---|---|---|---|---|---|---|---|---|
| 15 | systems_agent | system_boundary | 3.1 | [15_systems_agent__system_boundary.md](15_systems_agent__system_boundary.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 2 (H=1/M=1/L=0) | REVISE |
| 16 | systems_agent | system_requirements | 3.2 | [16_systems_agent__system_requirements.md](16_systems_agent__system_requirements.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 2 (H=1/M=1/L=0) | REVISE |
| 17 | systems_agent | interface_contracts | 3.3 | [17_systems_agent__interface_contracts.md](17_systems_agent__interface_contracts.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 4 (H=4/M=0/L=0) | QUARANTINE |

## Track C extension — cal-26 samples (Phase 4 architecture)

Samples 18–21b from cal-26 (workflow run `cea225ec-8b12-40ff-bf25-1bd26ff8a298`) at 2026-05-04T08:32–09:17Z. `architecture_agent` role newly introduced in samples 18/19/20; component_saturation pass uses `domain_interpreter` role (samples 21a/21b — note role decoupling: the saturation executor is decoupled from phase ownership; all 34 domain_interpreter invocations on this saturation surface consistently use this role). Harness dispatched the default 5-validator placeholder bundle on all sub-phases (Phase 4 was not in DISPATCH_BUNDLES at cal-26 time — same placeholder situation as Phases 2/3). `deep_memory_research` agent_outputs are present in Phase 4 (one per flat sub-phase: software_domains, component_skeleton, adr_capture) — not extracted as samples here; noted for Stage 1C.2 per-role assessment. cal-26 only reached component_saturation depth 1 — no depth ≥2 evidence available for this saturation surface. `adr_capture` sub-phase was not in the original Phase 4 sub-phase list and appears as an emergent addition.

| # | Agent role | Sub-phase | Phase code | Depth | Sample file | Has thinking | Harness validators | Findings | Decision |
|---|---|---|---|---|---|---|---|---|---|
| 18 | architecture_agent | software_domains | 4.1 | N/A (flat) | [18_architecture_agent__software_domains.md](18_architecture_agent__software_domains.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 5 (H=0/M=5/L=0) | REVISE |
| 19 | architecture_agent | component_skeleton | 4.2 | N/A (flat) | [19_architecture_agent__component_skeleton.md](19_architecture_agent__component_skeleton.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 1 (H=0/M=0/L=1) | ACCEPT |
| 20 | architecture_agent | adr_capture | 4.3 | N/A (flat) | [20_architecture_agent__adr_capture.md](20_architecture_agent__adr_capture.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 6 (H=4/M=1/L=1) | QUARANTINE |
| 21a | domain_interpreter | component_saturation | 4.2a | 0 (root) | [21a_domain_interpreter__component_saturation_depth0.md](21a_domain_interpreter__component_saturation_depth0.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 1 (H=0/M=0/L=1) | ACCEPT |
| 21b | domain_interpreter | component_saturation | 4.2a | 1 (mid) | [21b_domain_interpreter__component_saturation_depth1.md](21b_domain_interpreter__component_saturation_depth1.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 1 (H=0/M=0/L=1) | ACCEPT |

## Track C extension — cal-26 samples (Phase 5 technical specification)

Samples 22–26b from cal-26 (workflow run `cea225ec-8b12-40ff-bf25-1bd26ff8a298`) at 2026-05-04T10:43–13:34Z. `technical_spec_agent` role newly introduced (samples 22–25 flat sub-phases, 26a–26b saturation). Harness dispatched the placeholder 5-validator bundle on all sub-phases (Phase 5 not in DISPATCH_BUNDLES at cal-26 time — same placeholder situation as Phases 2/3/4). `deep_memory_research` agent_outputs are present in Phase 5 (one per flat sub-phase: data_model_skeleton, api_definitions, error_handling, configuration_parameters) — not extracted here; noted for Stage 1D.2 per-role assessment. data_model_saturation uses `technical_spec_agent` role directly (no role decoupling — contrast with Phase 4 component_saturation which used domain_interpreter). cal-26 reached data_model_saturation depth 1 maximum (`data_model_decomposition_max_depth_reached = 2`, meaning depths 0 and 1 executed); no depth ≥2 evidence available — same depth limitation as Phase 4 component_saturation. Dominant defect class across flat sub-phases: grounding failure (agent over-specifies error types, fabricates default endpoint URLs and operational values not present in source context). Sample 23 triggered a json_repair pass (structural markdown-fence wrapping issue). Sample 25 received the highest severity concentration in any Phase 5 flat sub-phase (15 HIGH, QUARANTINE).

| # | Agent role | Sub-phase | Phase code | Depth | Sample file | Has thinking | Harness validators | Findings | Decision | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 22 | technical_spec_agent | data_model_skeleton | 5.1 | N/A (flat) | [22_technical_spec_agent__data_model_skeleton.md](22_technical_spec_agent__data_model_skeleton.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 4 (H=0/M=3/L=1) | REVISE | First corpus sample for technical_spec_agent role |
| 23 | technical_spec_agent | api_definitions | 5.2 | N/A (flat) | [23_technical_spec_agent__api_definitions.md](23_technical_spec_agent__api_definitions.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 2 (H=1/M=1/L=0) | REVISE | json_repair triggered (structural markdown-fence wrapping; recovered via qwen3.5:9b) |
| 24 | technical_spec_agent | error_handling | 5.3 | N/A (flat) | [24_technical_spec_agent__error_handling.md](24_technical_spec_agent__error_handling.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 19 (H=0/M=19/L=0) | REVISE | Highest finding count of flat sub-phases; 18 grounding unsupported_claim (error-type specificity hallucination) |
| 25 | technical_spec_agent | configuration_parameters | 5.4 | N/A (flat) | [25_technical_spec_agent__configuration_parameters.md](25_technical_spec_agent__configuration_parameters.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 16 (H=15/M=1/L=0) | QUARANTINE | Highest severity concentration; 13 HIGH unsupported_endpoint + 1 HIGH unjustified_leap (fabricated endpoint URLs/bucket names) |
| 26a | technical_spec_agent | data_model_saturation | 5.1a | 0 (root) | [26a_technical_spec_agent__data_model_saturation_depth0.md](26a_technical_spec_agent__data_model_saturation_depth0.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 2 (H=1/M=1/L=0) | REVISE | Parent entity: PropertyRecord; no role decoupling (same technical_spec_agent as flat passes) |
| 26b | technical_spec_agent | data_model_saturation | 5.1a | 1 (mid) | [26b_technical_spec_agent__data_model_saturation_depth1.md](26b_technical_spec_agent__data_model_saturation_depth1.md) | yes | contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis | 1 (H=0/M=0/L=1) | ACCEPT | Parent entity: ent-property-identity; no depth ≥2 available |
