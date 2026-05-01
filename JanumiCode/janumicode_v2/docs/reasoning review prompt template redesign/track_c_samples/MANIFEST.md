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