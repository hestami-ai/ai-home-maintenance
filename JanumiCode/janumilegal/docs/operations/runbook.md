# JanumiLegal Operations Runbook

**Audience:** Platform operations.

## Daily

- Review CI green: `typecheck → lint → lint:layers → audit:hardcoding → test → calibration → build`. Any red blocks deploys.
- `regression_report.json` review: any newly-failing gold matter is investigated within the day.
- Op-track telemetry (`TelemetryAuditor.audit`): completion rate trend; cross-matter operation count baseline check.

## Weekly

- Hardcoding audit results review: any warnings (Layer 2) tracked; any errors (Layer 1) are immediate fix.
- Layer linter results review: ditto.
- Per-firm matter activity summary: count of new matter activations, average state count, count of release-gate `held_pending_*` events.

## Monthly

- Restore drill (DR doc §6): synthetic-data restore on staging environment; integrity checks pass.
- Hash-chain integrity verification on a sample of matters (`MatterTrackStore.verifyChain`).
- Firm config audit: any drift between declared `FirmConfig` and operational state.

## Incident response

### Suspected privilege leakage

1. Halt new exports for affected matter (matter-track read remains gated by the existing classification rules).
2. Identify the leak surface: op-track export records, classification-bypass attempt, mistaken-matter action.
3. Run `MatterTrackStore.verifyChain` on each classification of the affected matter.
4. Engage counsel.
5. Document root cause; if structural, file a hardening item.

### Suspected cross-matter leak

1. Run the red-team test suite (`pnpm test src/test/redTeam.test.ts`) — must remain all-green.
2. Audit the prompt-cache key generation: `cacheKeyForScope` produces matter-scoped namespace; verify no override path exists.
3. Audit screened-matter enforcement: `firmDal.listAccessibleMatters` excludes; cross-matter dashboard excludes.
4. If a real leak is found, treat as a Sev-1 architectural defect.

### Lens manifest fails to load mid-day

1. Roll back to the prior lens version (`lens_pack_catalog` retains versioned history).
2. Mid-flight activations remain pinned to their version; new activations use the rolled-back version.
3. Investigate the failed manifest's validation errors; fix and redeploy.

### Citator-source outage

1. The citator status field becomes empty for new authority verifications. Display label downgrades to `machine_assessed_support`.
2. Notify attorneys via op-track event; they must treat affected authorities as `attorney_confirmation_required` until citator is restored.
3. The Release Gate's `requireAttorneyConfirmedAuthorityForClient` policy will continue to block client release until authority is attorney-confirmed.

## Standing checks (no override)

These are CI-blocking and have no operational override:

- Hard-gate calibration metrics (required-state completion = 100%, late-addition = 0, silent-pruning = 0, false-confidence = 0, cross-matter-leakage = 0, release-gate-correctness = 100%).
- Layer linter (R1–R4).
- Hardcoding audit (H1–H3).
- Red-team adversarial tests.

## Wave 9 deferred items

Per `docs/janumilegal_product_description_evolution.md` §15, deferred to post-GA design tracks:

1. Citator data model and license finalization (open-data architecture in place; commercial licensing pending).
2. E-filing protocol scope (court-by-court ECF/state e-filing connectors).
3. DMS integration design (iManage / NetDocuments).
4. Form-factor decision — locked to VS Code + Svelte for v1.0 GA.
5. Counsel review of privilege architecture — pending demonstrable implementation. Wave 9 GA demonstration provides the runnable artifact for review.
