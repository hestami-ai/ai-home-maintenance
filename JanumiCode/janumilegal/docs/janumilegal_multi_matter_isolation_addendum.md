# JanumiLegal Multi-Matter Isolation Addendum

**Status:** Addendum to `janumilegal_product_description.md` and `janumilegal_product_description_evolution.md`.
**Purpose:** Establish the multi-tenant isolation model that distinguishes JanumiLegal from JanumiCode v2. JanumiCode is fundamentally single-project / single-context. JanumiLegal is fundamentally multi-client, multi-matter, simultaneously-active, with isolation requirements that are not policy preferences — they are ethical and legal obligations.

This addendum supersedes any conflicting language in earlier documents.

---

## 1. Why This Is Architectural, Not UX

A legal professional routinely works across many active matters in a single day. The isolation requirement is not a UI convenience; it is driven by:

- **Privilege per client** — work product, attorney-client communications, and mental impressions are scoped to a single client (or to an explicit joint-representation set). Cross-matter leakage of these is potentially a privilege waiver or a malpractice event.
- **Conflicts and ethical walls** — when a firm screens an attorney from a matter (e.g., a former-client conflict screen, a screened lateral hire), that screen must be enforced at the data layer, not at the UI layer.
- **Confidentiality** — third-party confidentiality obligations and protective orders may bind specific matters and not others.
- **Discovery containment** — a discovery production in matter A must not be able to reach into matter B's stream, even by accident, even by an attorney with access to both.
- **LLM context contamination** — an agent invocation for matter A must never receive context, embeddings, examples, or prior reasoning from matter B unless an explicit and recorded cross-matter authorization is in force.
- **Cognitive separation** — the attorney user must always know which matter they are acting on. Mistaken-matter actions (drafting in the wrong matter, sending to the wrong client) are a recurring real-world malpractice cause.

Isolation is therefore enforced at five layers: **identity, database, agent context, governed stream, and UI/UX**. Each layer assumes the layer above it may fail.

---

## 2. Isolation Hierarchy

JanumiLegal models the following nested scopes. Each scope is a hard isolation boundary at the database layer; cross-scope reads require explicit authorization.

```
firm
  └── client
        └── matter
              ├── lens activations
              ├── governed stream segment
              ├── artifacts
              ├── attorney action records
              └── MMP records
```

Notes:

- **Firm** is the top tenant. Multi-firm hosting (if pursued later) treats firms as fully isolated tenants — no shared storage, no shared keys, no shared agent context.
- **Client** is the privilege owner. Privilege scopes default to client, not matter — a single client with five matters has five matters that share privilege ownership but not necessarily content.
- **Matter** is the workflow unit. Lens execution, state machines, artifacts, and the matter-track Governed Stream are all matter-scoped.
- **Joint representation** and **common-interest groups** are explicit, separately modeled relations that span matters. They are *named exceptions* to scope, not implicit ones.

---

## 3. Identity and Authorization Model

### 3.1 User scoping

```ts
type UserMatterAccess = {
  userId: string;                         // attorney/staff identity
  firmId: string;
  clientId: string;
  matterId: string;
  role: "attorney_of_record" | "supervising" | "reviewer" | "drafter"
      | "paralegal" | "legal_assistant" | "knowledge_attorney"
      | "billing" | "intake_only" | "screened_out";
  scopeRestrictions?: {
    readOnly?: boolean;
    classificationCeiling?: StreamClassification;  // e.g., may not read work_product_mental
    redactedFields?: string[];
  };
  effectiveFrom: string;
  effectiveUntil?: string;                // for time-bounded access (e.g., contract attorney)
  grantedBy: string;
  grantBasis: string;                     // engagement letter, screening memo, etc.
};
```

Key rules:

- A user has **no implicit access** to any matter. Access is by explicit `UserMatterAccess` record.
- `screened_out` is a real role with a real enforcement effect: the user cannot read, search, or be staffed on the matter, and the system cannot mention the matter in their UI even by side-channel (no notification badges, no autocomplete, no telemetry exposure).
- Role does not by itself convey approval authority — that lives in `AttorneyAction` per evolution §9.

### 3.2 Active matter context

A user may have many `UserMatterAccess` rows, but at any given moment exactly one **active matter context** is in force in their session. All actions are stamped with that context. Switching contexts is a deliberate, logged, observable event.

---

## 4. Database Isolation

### 4.1 Scoping rule

Every row in every domain table carries `firm_id`, `client_id`, `matter_id` (where applicable). There are no domain tables that are matter-agnostic except:

- the firm registry,
- the canonical vocabulary (CLV),
- the agent registry,
- the lens-pack catalog,
- operational telemetry.

### 4.2 Query enforcement

- All domain queries go through a **scoped data-access layer** that injects the active scope and refuses unscoped queries.
- Raw SQL access bypassing the scoped layer is prohibited in application code; the linter rejects direct `db.prepare(...)` outside the data-access layer.
- Cross-matter reads are a separately-authorized API surface that requires a documented basis (see §7).

### 4.3 Encryption boundaries

- Each matter's matter-track Governed Stream segment is encrypted with a **per-matter content key**.
- Per-matter content keys are wrapped by a per-client key, which is wrapped by a per-firm key.
- Compromise of a single matter key does not by itself expose any other matter.
- Mental-impressions sub-segments (per evolution §3.7) are encrypted with a separate per-matter key, not the same per-matter content key.

### 4.4 Screened matters

When a user has `screened_out` for a matter:

- All queries from that user's session apply a `NOT IN (screened_matter_ids)` filter at the data-access layer.
- Search results, autocomplete, recently-viewed lists, and global telemetry views never surface the matter to that user.
- The screening is recorded once per (user, matter) pair; the user's session caches the screen list at session start and refreshes on grant changes.

---

## 5. Agent Context Isolation

This is the layer JanumiCode v2 does not have to think about and JanumiLegal cannot afford to skip.

### 5.1 Per-invocation context envelope

Every agent invocation receives a context envelope explicitly scoped:

```ts
type AgentInvocationScope = {
  firmId: string;
  clientId: string;
  matterId: string;
  lensId: string;
  lensVersion: string;
  stateId: string;
  privilegeFrame: PrivilegeFrame;        // evolution §12
  authorizedSources: SourceRef[];        // explicit list — agent may not read others
  authorizedPriorArtifacts: ArtifactRef[];
  authorizedMMP: MMPRef[];
  forbiddenScopes: { matterId: string; reason: string }[];
};
```

### 5.2 Hard rules

- An agent invocation **cannot read** any data outside its `AgentInvocationScope`. The scoped data-access layer enforces this; the agent runtime double-checks.
- LLM prompt construction is performed by a **prompt assembler** that reads only from the envelope. No global retrieval, no firm-wide RAG, no cross-matter examples.
- Few-shot examples and templates come from the **lens pack** (Layer 2) or **firm config** (Layer 3), never from another matter's content.
- Embeddings and vector stores are **per-matter**. A firm-wide knowledge base is permissible only as an explicitly Layer-1 published, public-record-classified resource (statutes, public rules) — it never contains matter content.

### 5.3 Cross-matter retrieval (the rare allowed case)

Occasionally a firm legitimately wants prior work from a different matter (a precedent brief, a clause library entry). This is allowed only via:

- **Explicit clause-library or brief-bank artifacts** that have been promoted, by attorney action, into a firm-wide knowledge layer with **client-identifying content scrubbed** at promotion time.
- The promotion event is recorded; the source matter's stream marks the artifact as exported to firm knowledge; the receiving matter records the inbound reference.

There is no "search across all matters" affordance for agents. None.

### 5.4 Provider-side concerns

- LLM providers are configured per firm; per-matter choice may override.
- Provider request headers carry no matter-identifying content.
- Prompt-cache keys are scoped per matter at minimum to prevent any possibility of cache leakage across matters.
- Cache TTL semantics from JanumiCode v2 (5-minute prompt cache) are inherited but the cache namespace is matter-scoped.

---

## 6. Governed Stream — Per-Matter Segmentation

### 6.1 Segmentation model

The matter-track Governed Stream (per evolution §3.3) is **physically segmented per matter**. There is no global matter-track table that contains rows from multiple matters.

Implementation options (decision deferred to Wave 3 design doc, but constrained):

- **Per-matter SQLite file** under matter-scoped directory, encrypted at the file level — strongest isolation, simplest reasoning.
- **Per-matter table partition** within a single DB with row-level encryption keyed per matter — operationally simpler, more attack surface.
- **Per-matter logical schema** in a multi-schema DB — middle ground.

The default is **per-matter file** unless operational scale forces a different choice.

### 6.2 Stream-event scope

Every Governed Stream event records:

- `firm_id`, `client_id`, `matter_id` (mandatory).
- `user_id` of the actor (or `system` / `agent:<id>` for non-human actors).
- `active_matter_context` of the user's session at write time — this should equal the event's matter id; mismatch is an alarm.
- The CLV `termId`s in active scope at the time.
- The Privilege Frame snapshot reference (so later replay can interpret classifications under the frame in force at the time).

### 6.3 Cross-matter event prohibition

A single Governed Stream event may not reference more than one matter. Operations that span matters (rare — see §7) generate **paired events**, one in each matter's stream, cross-referenced by a shared correlation id.

### 6.4 Search and analytics

- Per-matter search is the default surface.
- Across-matter operational queries (telemetry, performance, regression) operate on the operational track only and never see matter-track content.
- "Show me all my matters" dashboards are constructed by aggregating **summary metadata** from each matter scoped to the user's authorized list — never by querying matter-track content directly.

---

## 7. Cross-Matter Operations (the named exceptions)

The following are the *only* sanctioned cross-matter operations. Each has an explicit authorization, recording, and audit path.

### 7.1 Joint representation

A single matter spans multiple clients (joint defense, co-plaintiffs, joint estate planning). Modeled by `jointRepresentation` on the Privilege Frame. Within the joint set, content flows freely; outside it, the matter is isolated as usual.

### 7.2 Common-interest privilege group

Two matters with separate clients but a shared common-interest agreement may share specific designated artifacts. Modeled as a `CommonInterestLink`:

```ts
type CommonInterestLink = {
  linkId: string;
  matters: string[];                      // matterIds
  agreementBasis: string;                 // engagement / agreement document ref
  sharedArtifactIds: string[];            // explicit list — not "all artifacts"
  effectiveFrom: string;
  effectiveUntil?: string;
  authorizedBy: AttorneyAction[];
};
```

Sharing is by explicit artifact, never by default.

### 7.3 Conflicts check

Conflicts checking inherently reads across matters. This is performed by the Conflicts agent (evolution §8.1) via a **conflicts-only data-access surface** that:

- returns only party identifiers, party roles, and matter status — never matter-track content.
- is restricted to the conflicts agent and to the firm conflicts officer role.
- writes its own audit trail to the operational track.

### 7.4 Brief bank / clause library promotion

Per §5.3 — explicit attorney-action promotion of a scrubbed artifact into a firm knowledge layer.

### 7.5 Firm-wide reporting and billing

Reads operational metadata only (matter count, hours, status), never matter-track content.

### 7.6 Discovery production

A matter-scoped operation by definition; no cross-matter exposure.

**No other cross-matter operations exist.** Adding one requires a design-doc proposal and counsel review.

---

## 8. UI/UX — The Active Matter Context Discipline

The UI must make the active matter context unambiguous at every moment. This is the cognitive-isolation layer — it prevents the attorney from acting on the wrong matter.

### 8.1 The Matter Header Bar

Every primary view displays a persistent, prominent **Matter Header Bar** showing:

```
[ CLIENT NAME ]  ›  [ MATTER NAME ]  ›  [ ACTIVE LENS ]  ›  [ PROCEDURAL POSTURE ]
                                                              [ release-status badge ]
```

Properties:

- Always visible — never collapsed, never hidden, never moved off-screen.
- Color-coded per matter so muscle-memory reinforces context (color is a hash of the matter id, deterministic, accessibility-aware).
- Includes an explicit "Switch Matter" affordance — never an autocomplete or search-typed shortcut that could pick the wrong matter.

### 8.2 Switching matters

Switching the active matter is a **deliberate, observable event**:

- Triggered only by an explicit click in the matter switcher.
- Confirmation step if there are unsaved actions or pending MMP cards in the current matter.
- A full UI re-paint with the new matter's color, header, and dashboards. No half-switched states where one panel still shows the old matter.
- Recorded to both matters' operational-track streams as a context-out / context-in event.

### 8.3 Single-window, folder-hierarchy substrate (form factor: VS Code + Svelte)

JanumiLegal runs in a single VS Code window with a Svelte webview, mirroring the JanumiCode form factor. There is no VS Code workspace switching for matter switching — that is a UX hassle and a source of partial-state bugs. Instead:

**On-disk layout** mirrors the database scope tuple:

```
<janumilegal_data_root>/
  firms/
    <firm_id>/
      clients/
        <client_id>/
          matters/
            <matter_id>/
              governed_stream.sqlite        (per-matter, encrypted)
              artifacts/
              sources/
              exports/
              ...
```

**Active matter context** is the discipline that replaces workspace switching:

- Exactly one matter is active in the session at any moment.
- The Matter Header Bar (§8.1) displays it, color-coded.
- The Switch Matter affordance (§8.2) re-paints the entire Svelte webview to the new matter; no panel retains stale matter content.
- The user's file-explorer view in the VS Code sidebar may navigate the firm/client/matter folder hierarchy (read-only browsing is fine), but **actions** — drafting, generating, releasing — are bound to the active matter context, not to whatever folder is selected in the explorer.
- The webview never displays content from any matter other than the active matter context. Browsing the explorer to a different matter's folder does not change the webview content; switching the active matter does, and the switch is deliberate, confirmed, and recorded.

**Two-matter side-by-side work** is intentionally not supported in a single window. If a user genuinely needs to compare matters (rare; usually a sign that a cross-matter operation per §7 is the correct flow), they open a second VS Code window — a separate process, separate session, separate active matter context. The OS-level window separation is the isolation boundary for the rare side-by-side case.

### 8.4 Cross-matter affordances are explicit

- The "All my matters" dashboard is its own view, distinct in chrome from any single-matter view, with no action affordances that could mutate matter data — read-only navigation only.
- Search across matters is a distinct surface, gated to authorized users, returns matter metadata only, and requires switching into a matter to read its content.

### 8.5 Forbidden affordances

- No quick-action keyboard shortcut whose behavior depends on hovering over a matter rather than activating it.
- No drag-and-drop between matter views.
- No clipboard auto-paste of matter content into another matter without an explicit "promote to firm knowledge" or "common-interest share" flow.
- No notification badges or unread counts that surface a matter to a user who is screened out from it.

### 8.6 Mistaken-matter recovery

If an attorney detects they have acted on the wrong matter:

- A "Mark as mistaken-matter action" flow records the misattribution in both matters' streams.
- The system surfaces a remediation checklist (revoke MMP submissions, withdraw artifact drafts, alert supervisor).
- Release gates are re-evaluated for any artifact whose context is now suspect.

---

## 9. Database Schema Implications

The CLV-bound domain tables introduced in earlier waves are revised to carry the full scope:

```sql
-- Every domain table carries the full scope tuple.
firm_id   TEXT NOT NULL
client_id TEXT NOT NULL
matter_id TEXT NOT NULL
```

New tables introduced by this addendum:

- `users` — identity registry within a firm.
- `user_matter_access` — per (user, matter) authorization with role and screen state.
- `clients` — firm's client registry.
- `matters` — firm's matter registry, foreign key to client.
- `joint_representation_groups` — explicit joint sets.
- `common_interest_links` — explicit cross-matter sharing.
- `matter_keys` — per-matter content key envelopes (wrapped).
- `matter_context_switches` — operational record of active-matter changes per session.
- `cross_matter_operation_audit` — record of every authorized cross-matter operation.

All matter-track tables carry physical or logical per-matter segmentation per §6.1.

---

## 10. Implementation Roadmap Impact

Work items are grafted onto the existing roadmap rather than reordered.

### Wave 0 additions
- Schema: `firm_id`, `client_id`, `matter_id` columns mandatory on all domain tables.
- Scoped data-access layer; linter rejection of raw `db.prepare` outside it.
- `users`, `clients`, `matters`, `user_matter_access` tables.

### Wave 1 (CLV) additions
- CLV entries for: matter, client, joint representation, common-interest, screen, active matter context, mistaken-matter action.

### Wave 2 (lens runtime) additions
- `AgentInvocationScope` envelope mandatory on every agent call.
- Prompt assembler reads only from envelope.
- Per-matter prompt-cache namespace.
- Per-matter embedding stores.

### Wave 3 (Governed Stream) additions
- Per-matter segmentation decision recorded in privilege design doc.
- Per-matter content keys; per-firm and per-client wrap keys.
- Cross-matter event prohibition enforced.
- Joint-representation and common-interest data models.

### Wave 6 (lens packs) additions
- Conflicts agent uses the conflicts-only data-access surface.
- Brief-bank / clause-library promotion flow with content scrubbing.

### Wave 7 (UI workbench) additions
- Matter Header Bar in every primary view.
- Per-matter color hashing.
- Workspace-per-matter for simultaneous-matter work.
- Distinct cross-matter dashboards with read-only chrome.
- Explicit Switch Matter affordance with confirmation.
- Mistaken-matter recovery flow.

### Wave 8 (LNFR + audits) additions
- Screened-matter surfacing audit (ensure screened-out users have no UI side-channels).
- Cross-matter operation audit reporting.
- Matter-key isolation penetration test (Wave 9 hardening).

### Wave 9 additions
- Red-team specifically targeting cross-matter leakage (cache, embedding, prompt assembly, UI side-channels).

---

## 11. Standing Disciplines (added to the cross-wave list)

- **No unscoped query.** Every domain query carries firm/client/matter or comes from an explicitly-permitted unscoped registry.
- **No agent invocation without scope envelope.** No exceptions.
- **No cross-matter event in a single stream record.** Paired events with correlation id only.
- **No UI affordance that surfaces a screened matter.** Including notifications, autocompletes, telemetry, and recently-viewed.
- **No firm-wide knowledge content drawn from matters without explicit promotion.** No "RAG over the firm."
- **No simultaneous matter work in a single window.** Active matter context is unique per session; side-by-side requires separate VS Code windows.
- **No silent matter switch.** Every switch is observable, confirmed, and recorded.

---

## 12. Summary

JanumiCode v2 lives in one project at a time. JanumiLegal lives in many matters at once, and the cost of conflating them ranges from embarrassing to disqualifying. Isolation must therefore be enforced at five independent layers — identity, database, agent context, governed stream, and UI — each assuming the layer above it may fail. Cross-matter operations exist but are a small named set, each with its own authorization and audit path.

The architectural test is simple: at any point in the system, ask "can a byte of matter A's content reach matter B's context?" The answer must be no, except through one of the explicitly named flows in §7, each of which leaves an audit trail.
