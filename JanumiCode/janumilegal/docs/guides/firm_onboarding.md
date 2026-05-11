# Firm Onboarding Guide

**Audience:** Operations / engineering staff onboarding a new law firm to JanumiLegal.

## Onboarding rule

> **Onboarding a new firm requires changes only to Layer 3 (firm config) and Layer 2 (lens-pack adaptation if needed). Any Layer 1 change during onboarding is a defect.**

The Wave 8 hardcoding audit (`pnpm audit:hardcoding`) and the second-firm test (`secondFirm.test.ts`) enforce this discipline structurally.

## Steps

1. **Provision firm record.** Insert a row into `firms` (firmId, displayName, primaryJurisdiction). The firmId is opaque to Layer 1 — pick a stable identifier.

2. **Author firm config.** Create `src/layer3_firm_config/<firmId>/config.ts` exporting a `FirmConfig` constant. See `firm_synthetic_md/config.ts` and `firm_synthetic_va/config.ts` as templates.

3. **Register firm config.** Add the import to `src/layer3_firm_config/loader.ts`.

4. **Provision attorneys + admissions.** Insert rows into `users` and `attorney_admissions`. Filing actions enforce admission via the AttorneyAction service.

5. **Provision matter keys.** First matter activation triggers `MatterKeyService.provision(scope)` — content + mental keys generated, wrapped by the firm's KMS-held key, persisted in `matter_keys`.

6. **Configure release policy.** The `releasePolicy` field on `FirmConfig` is consumed directly by the Release Gate Evaluator. Default: `requireAttorneyConfirmedAuthorityForClient: true`.

7. **Activate lens packs.** The `enabledLensIds` field declares which MVP lens packs the firm uses. Lens manifests must already be loaded into `lens_pack_catalog` (this happens at platform startup per Layer 1).

8. **Configure citator.** The `citatorJurisdictionScope` and `citatorSeed` fields configure the per-firm `JurisdictionScopedCitatorProvider`. No Layer 1 change required.

9. **Run the second-firm validation.** Execute `pnpm test src/test/secondFirm.test.ts` — confirms that the firm onboards via configuration alone.

## What does NOT belong in firm onboarding

- **Source-code changes to `src/lib/`, `src/extension.ts`, `src/sidecar/`.** Layer 1 stays firm-agnostic.
- **Source-code changes to existing lens manifests** (Layer 2). New practice-area lens packs are additive, not modifications to existing ones.
- **CLV entry additions** — CLV is core platform vocabulary. Firm-specific terms go in firm-namespaced extensions (`clv.firm_<firmId>.<term>.v1`); these are added via migration, not via firm config.

## Cross-jurisdiction firms

A firm with attorneys admitted in multiple jurisdictions:

1. Insert one row per (attorneyId, jurisdiction) in `attorney_admissions`.
2. The Release Gate enforces filing requires admission in the **forum jurisdiction** of the matter, regardless of where the firm is "primarily" located.
3. The CLV jurisdictionVariants for relevant terms (e.g., `clv.core.factor.v1` for Maryland's Sanders/Taylor) are queryable; the lens pack is responsible for routing to the correct variant.

## Conflicts of interest at onboarding

When onboarding a new firm acquires a book of business (e.g., lateral hire, firm merger):

1. Run the Conflicts agent against the proposed matter set BEFORE provisioning:
   - `ConflictDetectionAgent.detect({ trigger: 'matter_open', ... })` per matter.
2. Severities `imputed` or `non_waivable` block release; resolve before activation.
3. Screened-personnel records (`role: 'screened_out'` in `user_matter_access`) prevent the screened user from seeing the matter at the data-access layer.

## Verification checklist

- [ ] `pnpm typecheck` — clean.
- [ ] `pnpm lint:layers` — clean (R1–R4).
- [ ] `pnpm audit:hardcoding` — clean (H1–H3).
- [ ] `pnpm test src/test/secondFirm.test.ts` — passes for the new firm.
- [ ] `pnpm calibration` — all gold matters still pass.
