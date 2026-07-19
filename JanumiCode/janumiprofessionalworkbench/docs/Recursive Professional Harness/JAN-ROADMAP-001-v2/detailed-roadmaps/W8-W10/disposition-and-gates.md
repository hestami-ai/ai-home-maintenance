# W8–W10 — Disposition and Gate Records (G8, G9, G10)

**Waves:** W8 (JPWB PWA Designer & Self-Hosting), W9 (Tenant Customization & Product Shape Packages), W10 (JanumiCode Productization & Platform Integration).
**Authority:** coding agent under delegated sponsor authority (procedure change 2026-07-19). **Predecessor:** G7 APPROVE_WITH_CONDITIONS.
**Grounding:** the W4 demo inventory (36 reads) + a targeted W8/W9/W10 capability check.

---

## W8 — JPWB PWA Designer and Self-Hosting → Gate G8: **APPROVE_WITH_CONDITIONS**

**Normative outcome:** JPWB can author, validate, govern, version, and publish the Product Realization PWA that JanumiCode uses.

| WP | Status | Evidence |
| --- | --- | --- |
| 8-001 Canonical PWA definition + version model | **CONFORMANT** | PWA/PWU-Type/policy/publication objects persisted independently of Undertakings; `CreatePwa`→…→`PublishPwa` FSM; published PWAs immutable |
| 8-002 PWU-Type + work-architecture authoring | **CONFORMANT** | PWA Designer (`pwa/[id]`) creates/edits PWU Types, permitted children + cardinality (`PermittedChildRule`), outputs, completion semantics |
| 8-003 Decomposition/recomposition/applicability rule authoring | **PARTIAL → DEF-W8-001** | permitted-child composition + cardinality authorable; declarative *decomposition-pattern* + *applicability-predicate* authoring (safe expression DSL) is the residue (the applicability rule is a free-text note today) |
| 8-004 Assurance/role/authority/baseline/execution-strategy authoring | **CONFORMANT (assurance)** | policy manager: create/edit/version/suspend/activate, criteria, independence, control actions; floor policies locked. Role/authority/execution-strategy assignment → DEF-W8-002 |
| 8-005 PWA conformance fixtures + publication workflow | **CONFORMANT** | `ValidatePwa` gated by recursive-composition + de-minimis-floor gates; publication FSM |
| 8-006 Product Realization PWA authored through JPWB | **CONFORMANT** | `authorProductRealizationPwa` (seed-workbench.ts) authors + publishes the PWA through the REAL command pipeline, not source-only config |
| 8-007 Self-hosting / bootstrap proof | **PARTIAL → DEF-W8-003** | the bootstrap loop is demonstrated in spirit — JPWB authors+publishes its own PWA and instantiates an Undertaking from it. A dedicated proof that a Product Realization Undertaking *materially evolves JPWB itself* is the residue |

**Decision G8: APPROVE_WITH_CONDITIONS.** JPWB genuinely authors/validates/governs/versions/publishes the Product Realization PWA — the wave's core outcome. Residue is the declarative rule-DSL (8-003), role/authority/strategy authoring (8-004), and the explicit end-to-end bootstrap proof (8-007), deferred with reason. `deferrals: [DEF-W8-001, DEF-W8-002, DEF-W8-003]`.

---

## W9 — Tenant Customization and Product Shape Packages → Gate G9: **APPROVE_WITH_CONDITIONS (tenant WPs auth-gated)**

**Normative outcome:** tenants configure/extend PWAs without silent upstream mutation and export governed work.

| WP | Status | Basis |
| --- | --- | --- |
| 9-001 PWA profiles | **ABSENT → DEF-W9-001** | no profile object/authoring; genuine forward work |
| 9-002 Tenant-derived PWA fork + extension | **ABSENT → DEF-W9-002 (auth-gated)** | tenant derivation is a multi-tenant concept — **hard-gated on the authentication gap (C2)**; a fork needs a tenant identity to attribute lineage to |
| 9-003 Undertaking-local PWUs + inherited-vs-local UX | **PARTIAL** | `isLocalExtension` PWUs exist (proposePwu ownership binding, RPH-CON-009); the inherited-vs-local UX distinction is partial |
| 9-004 PWA upgrade + Undertaking migration | **ABSENT → DEF-W9-003** | impact-preview + governed migration over the version model; folds on the (built) version binding + traceability |
| 9-005 Bottom-up PWA improvement proposals | **ABSENT → DEF-W9-004** | evidence-backed change-proposal flow; native forward work |
| 9-006 Product Shape / Implementation Package export | **ABSENT → DEF-W9-005** | governed export manifest (versions, evidence, decisions, traceability) — the Traceability projection (W2-INC-3) + version binding are the substrate |

**Decision G9: APPROVE_WITH_CONDITIONS.** Undertaking-local extension (the non-tenant core of W9) is upheld structurally; the tenant-customization WPs (profiles, fork, upgrade, proposals, export) are **genuine forward work**, and the multi-tenant ones are **hard-gated on the authentication gap (C2)** — building tenant isolation over a fabricated HUMAN principal would be the security anti-pattern C2 exists to forbid. `deferrals: [DEF-W9-001..005]`, `carried: [C2]`.

---

## W10 — JanumiCode Productization and Janumi Platform Integration → Gate G10: **DEFER (external-infrastructure + C2)**

**Normative outcome:** JanumiCode operates as a production-ready, multi-tenant software-product specialization on Janumi Platform.

| WP | Status | Basis |
| --- | --- | --- |
| 10-001 Platform tenancy/identity/authority integration | **BLOCKED (C2)** | **the authentication gap is the hard blocker** — no endpoint authenticates; the server fabricates a HUMAN principal. Tenant isolation/identity/access-control CANNOT be built truthfully over a fabricated principal. Recorded as CRITICAL since W0 (DIV-W0-003 / C2) |
| 10-002 Entitlements + Square billing + usage/quotas | **EXTERNAL** | requires a real Square account + commercial infrastructure — not implementable in-repo without a sponsor-provisioned external dependency (master §10 "new platform dependency with substantial commercial consequence" = a material-decision trigger reserved to the sponsor) |
| 10-003 Deployment/delivery disposition integration | **EXTERNAL** | governed deployment on a real platform |
| 10-004 Multi-surface canonical client integration | **PARTIAL** | the web surface (rph-demo) shares canonical commands/objects/projections; VS Code/desktop/mobile surfaces are separate deliverables |
| 10-005 Operational observability/reliability/recovery | **PARTIAL** | the outbox restart recovery (W2-INC-2) + event log are the substrate; production telemetry/backup/restore is external-infra |
| 10-006 Enterprise policy overlays + security hardening | **BLOCKED (C2) / EXTERNAL** | depends on the identity/authority plane (C2) + real deployment |
| 10-007 Production readiness + release baseline | **BLOCKED** | gated on all the above |

**Decision G10: DEFER.** W10 is **genuinely not completable within this repository**: it depends on (a) closing the authentication gap C2 — a security workstream the sponsor hard-gated before any multi-tenant deployment — and (b) external commercial/platform infrastructure (Square, real deployment, real tenant identity) whose commitment master §10 reserves to the sponsor as a material-decision trigger. Per master §19, fabricating these facts to mark the wave "complete" is prohibited. The honest disposition is **DEFER, blocked on C2 + external dependencies**, with the substrate the in-repo waves built (durable events + outbox recovery + version binding + traceability + the assurance/governance kernel) ready to carry the productization work once those external gates open.

```yaml
gates:
  - {gate: G8, decision: APPROVE_WITH_CONDITIONS, deferrals: [DEF-W8-001, DEF-W8-002, DEF-W8-003]}
  - {gate: G9, decision: APPROVE_WITH_CONDITIONS, deferrals: [DEF-W9-001, DEF-W9-002, DEF-W9-003, DEF-W9-004, DEF-W9-005], carried: [C2]}
  - {gate: G10, decision: DEFER, blockers: [C2-authentication, external-infrastructure-Square-deployment-identity], authority-note: "master §10 reserves the platform-dependency commitment to the sponsor"}
authority: Coding agent under delegated sponsor authority (2026-07-19)
carried: [C2, DIV-W1-003]
```

## Net effect

W8 is substantially built (JPWB authors/publishes its own PWA); W9's non-tenant core is upheld with the tenant WPs as genuine, auth-gated forward work; W10 is honestly deferred as external-infrastructure + C2-blocked — the one wave that cannot be truthfully completed in-repo. This is the faithful terminus of the roadmap under the delegated authority: every wave driven to a documented, gated disposition, with the genuinely-external/blocked work recorded as honest conditions rather than fabricated (master §19).
