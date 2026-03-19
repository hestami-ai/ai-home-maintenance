# Deep Research Remediation Report for Governed Stream UI VS Code Extension

## Background and methodology

This report analyzes a provided multi-pass code review document (“Governed Stream UI: Multi-Pass Code Review”) for a entity["organization","Visual Studio Code","code editor by microsoft"] extension that renders a complex workflow timeline in a webview. The review describes a UI architecture built around Extension Host–side HTML generation (`components.ts`, `GovernedStreamPanel.ts`) and Client-side webview scripts (`main.ts`, `mmp.ts`) that interact through `postMessage` and DOM event delegation, plus a SQLite-backed event timeline aggregated by `dataAggregator.ts`.

The remediation guidance below is intentionally framed around hard constraints and best practices for VS Code extensions and webviews:

- Webviews are effectively sandboxed “iframes” that communicate with the extension via message passing (`postMessage` and `onDidReceiveMessage`).citeturn9view2  
- Setting `webview.html` replaces the entire webview DOM, similar to reloading an iframe, and resets script state—this is a root cause for multiple “destructive re-render” and “state loss” findings.citeturn12view0  
- VS Code recommends keeping webviews as stateless as possible, persisting state via `acquireVsCodeApi().getState()` / `.setState()`, and using `retainContextWhenHidden` only when necessary due to resource overhead.citeturn2view0turn9view4  
- Webview security is defense-in-depth: minimize capabilities, restrict `localResourceRoots`, enforce a strict Content Security Policy (CSP), and sanitize all untrusted inputs.citeturn2view0turn9view0  
- Any heavy synchronous work (notably large `JSON.parse` and complex regex usage) can block the entity["organization","Node.js","javascript runtime"] event loop, degrading responsiveness and enabling denial-of-service patterns.citeturn3search0turn3search7  

Because only a review document (not the full code) was provided, code snippets and diffs below are “drop-in patterns” designed to be adapted to the referenced files and architecture. Where the report’s findings imply behavior (for example, `innerHTML` injection), remediation is presented both as a minimal-risk patch and as a VS Code–idiomatic long-term refactor.

## Executive summary

The review identifies three dominant risk clusters:

**Security boundary collapse (P0).** The extension host appears to send raw HTML fragments into the webview (via `postMessage`) which are likely inserted using `innerHTML`. When any LLM- or user-derived content crosses that boundary without correct escaping/sanitization, it becomes an XSS vector inside the VS Code UI surface. VS Code explicitly requires sanitizing all user input and recommends a strict CSP to contain injection impact.citeturn2view0turn4search0turn4search1turn4search6

**Compounding performance collapse (P1).** Multiple findings describe an O(N²) rendering pathway: each streamed turn triggers a full data re-aggregation (`buildStreamItems()`) and full HTML regeneration of “entire conversation history,” followed by a full webview DOM swap. Besides CPU and memory spikes, frequent `webview.html` replacement resets the client’s JS state.citeturn12view0turn3search0turn3search7

**Tool execution governance gaps (P0/P1).** The report raises concerns that “Architecture” phases of an agent workflow omit tool constraints, enabling unexpected invocations of CLI/tools in high-privilege contexts. The VS Code Language Model Tool API is explicitly designed to provide schema validation of tool inputs and mandatory user confirmations for extension tools.citeturn8view0

A pragmatic remediation strategy is to implement **immediate containment** (CSP, sanitization, message validation, tool allowlisting, durable webview state) while beginning a staged refactor toward **structured JSON state + incremental rendering** (instead of streaming host-generated HTML).

## Architecture and risk analysis

### Current flow implied by the review

The failure modes and performance issues converge on a single key mechanic: repeated `webview.html` replacement or equivalent full DOM swaps, plus HTML string construction in the extension host.

```mermaid
flowchart TD
  A[Extension Host receives event\n(dialogue:turn_added, streaming token, etc.)] --> B[GovernedStreamPanel._update()]
  B --> C[dataAggregator.buildStreamItems()\nre-walks DB events]
  C --> D[components.ts renders full HTML string\nfor entire stream]
  D --> E[Host sends HTML to webview\n(webview.html or postMessage {html})]
  E --> F[Webview replaces DOM\n(webview reload or innerHTML swap)]
  F --> G[Client JS rebinds handlers\nbut loses ephemeral UI state]
  G --> H[User input may be lost\nselectors may drift; UI may desync]
```

This flow is directly at odds with VS Code’s guidance that setting `webview.html` replaces the whole document and resets script state, and that the preferred approach is state persistence via `getState` / `setState` or message-passing reconstruction.citeturn12view0turn2view0

### Target flow aligned with VS Code best practices

A VS Code–idiomatic architecture is: **Host = data + orchestration**, **Webview = rendering + ephemeral UI state**, with a typed, versioned JSON message protocol and client-side persistence.

```mermaid
flowchart TD
  A[Extension Host receives event] --> B[Incremental aggregator updates ViewModel\n(delta items only)]
  B --> C[Host posts JSON patch message\n{type, schemaVersion, payload}]
  C --> D[Webview validates message schema]
  D --> E[Webview updates DOM incrementally\n(no full swap)]
  E --> F[Webview persists drafts/decisions\nvia acquireVsCodeApi().setState()]
  F --> G[If hidden/recreated, getState() restores UI]
```

This directly leverages VS Code’s recommended persistence mechanism (`getState`/`setState`) and reduces the need for `retainContextWhenHidden` (which has high overhead and is not recommended when persistence is feasible).citeturn2view0turn9view4

### Tool-calling governance baseline

If this extension contributes agent tools, the Language Model Tool API provides explicit “confirmation messages” and structured input validation via JSON schema in `package.json`. A generic confirmation dialog is always shown for extension tools, and the extension can customize it in `prepareInvocation`.citeturn8view0  
This is the correct baseline to close the “unconstrained tool access” class of findings.

## Issue comparison table

Severity and effort estimates are based on typical VS Code extension constraints and refactor scope (S≈1–2 days, M≈3–7 days, L≈1–2 weeks, XL≈multi-week). These are directional and should be validated against actual code complexity and test coverage.

| ID | Pass | Issue (short) | Severity | Effort | Priority |
|---|---:|---|---|---|---|
| GSUI-01 | 1 | Server-Rendered ↔ Client-Side Contract | High | L | P1 |
| GSUI-02 | 1 | State Trichotomy Alignment | High | L | P1 |
| GSUI-03 | 2 | Destructive Re-renders | High | L | P1 |
| GSUI-04 | 2 | Selector Drift and Silent Failures | Medium | M | P2 |
| GSUI-05 | 2 | Dangling Processing States | Medium | S | P2 |
| GSUI-06 | 2 | Regex Injection Brittleness | Low | S | P3 |
| GSUI-07 | 3 | Linear CPU Degradation on Stream Length | High | M | P1 |
| GSUI-08 | 3 | Synchronous JSON Parsing Overhead | Medium | S | P2 |
| GSUI-09 | 4 | High Component Coupling | Medium | L | P2 |
| GSUI-10 | 4 | Monolithic God Classes/Files | Medium | XL | P2 |
| GSUI-11 | 5 | Prompt Instruction Contradictions | Medium | S | P2 |
| GSUI-12 | 5 | Inconsistent Tool Constraints | High | M | P1 |
| GSUI-13 | 5 | Provider Routing Ambiguity | Medium | M | P2 |
| GSUI-14 | 6 | Data Loss on DOM Swap | High | M | P1 |
| GSUI-15 | 6 | Weak Typed SerDes | High | M | P1 |
| GSUI-16 | 6 | Process-State Orphanage | High | M | P1 |
| GSUI-17 | 7 | Webview HTML Injection Vector | Critical | M | P0 |
| GSUI-18 | 7 | Inadequate Tool Invocation Boundaries | Critical | M | P0 |
| GSUI-19 | 8 | Tight HTML-JS Schema Coupling | High | M | P1 |
| GSUI-20 | 8 | SQLite Schema Rigidity | Medium | M | P2 |
| GSUI-21 | 9 | Prompt Instruction Contradictions | Medium | S | P2 |
| GSUI-22 | 9 | Dual Indicator Discrepancy | Medium | S | P2 |
| GSUI-23 | 10 | Regex Injection in wrapResizable() | Low | S | P3 |
| GSUI-24 | 10 | Fallback Pathing Flaws | High | S | P1 |
| GSUI-25 | 11 | Cross-Site Scripting (XSS) | Critical | M | P0 |
| GSUI-26 | 11 | Unconstrained Tool Access | Critical | M | P0 |
| GSUI-27 | 12 | O(N²) Rendering Bottleneck | High | L | P1 |
| GSUI-28 | 12 | Synchronous God-Loop | Medium | M | P2 |
| GSUI-29 | 13 | God Objects | Medium | XL | P2 |
| GSUI-30 | 13 | Shotgun Surgery Anti-Pattern | Medium | L | P2 |
| GSUI-31 | 14 | Violates Separation of Concerns (MVC Boundary) | High | XL | P1 |
| GSUI-32 | 15 | Testability Black Hole | Medium | L | P2 |
| GSUI-33 | 15 | Implicit Database Mocking | Medium | M | P2 |
| GSUI-34 | 16 | String Concatenation vs. Declarative UI | Low | L | P3 |
| GSUI-35 | 16 | Weak TypeScript Strictness | Medium | M | P2 |

## Issue-by-issue remediation recommendations

Each issue below includes: verbatim issue text (from the provided report), root cause analysis, concrete code/config changes (with direct patterns/snippets), testing steps, CI/packaging notes, and priority.

A recurring theme is that multiple issues share the same root cause and therefore share the same remediation package. When this is the case, the “Concrete changes” section will reference shared patterns in the Appendix (Protocol, Webview shell/CSP, State persistence, Incremental rendering, Safe JSON parsing, Tool governance, and Build/CI wiring).

**Legend for remediation pattern references**
- **Pattern A**: Versioned JSON message protocol + validation
- **Pattern B**: Secure webview HTML shell (CSP, localResourceRoots, no inline scripts)
- **Pattern C**: Webview state persistence (`getState`/`setState`) for drafts and UI state
- **Pattern D**: Incremental rendering / patch-based UI updates (avoid full `webview.html` resets)
- **Pattern E**: Safe JSON parsing + runtime schema validation (Zod-based)
- **Pattern F**: Language Model Tool governance (schema + confirmation + allowlist)
- **Pattern G**: Build/packaging + CI guardrails

---

**GSUI-01 — Server-Rendered ↔ Client-Side Contract (Pass 1)**

**Issue description (verbatim)**  
> 1.  **Server-Rendered ↔ Client-Side Contract**: The physical DOM structure generated ... Any mismatch gracefully silences functionality rather than explicitly throwing errors.

**Surface mapping (APIs / security / performance / packaging / activation / commands & contributions / telemetry / permissions & trust / best practices)**  
Webviews + DOM event delegation; `webview.postMessage` and webview message handler model; primary risk is reliability and rollout stability; indirect security impact if missing elements cause fallback to unsafe operations.citeturn9view2turn12view0

**Root cause analysis**  
When the extension host constructs HTML and the webview JS depends on brittle selectors/paths, the UI boundary is not an API—it’s an undocumented DOM “wire protocol”. This is brittle even in ordinary web apps, but in VS Code webviews it becomes worse because setting `webview.html` (or a full innerHTML swap) reconstructs the DOM and resets script state.citeturn12view0

**Concrete code/config changes**  
- Replace “DOM-is-the-contract” with a versioned JSON contract: implement **Pattern A** and **Pattern D**, sending structured `StreamItem[]` plus incremental patches instead of HTML fragments.  
- Add a schema/version handshake: embed `data-schema-version` in the webview root and have the client refuse to process messages with mismatched versions (prevent silent failures).  
- Add explicit error surfacing: when `data-action` is unknown or a node is missing, show a non-intrusive error banner in the webview and log via extension output.

_Minimal patch (if large refactor is deferred)_:
```ts
// webview/main.ts (client)
function assertElement<T extends Element>(el: T | null, what: string): T {
  if (!el) {
    window.dispatchEvent(new CustomEvent('gsui:error', { detail: { what } }));
    throw new Error(`GSUI webview invariant failed: missing ${what}`);
  }
  return el;
}
```

**Testing steps**
- Add a “contract test” that loads the generated HTML shell and validates the presence of required `data-action` elements and key IDs.  
- Add an integration test that opens the webview and clicks a representative set of actions (commands, gate decisions) using the VS Code extension test runner approach.citeturn5search2turn5search7  

**CI/packaging changes**
- Add a CI job running integration tests with `@vscode/test-electron` and fail on missing selectors (see **Pattern G**).citeturn5search2turn5search7  

**Risk/impact**
- Prevents “soft brick” failures during UI evolution; increases correctness and debuggability during rollout; reduces regressions from markup refactors.

**Priority**: P1 (High severity, L effort)

---

**GSUI-02 — State Trichotomy Alignment (Pass 1)**

**Issue description (verbatim)**  
> 2.  **State Trichotomy Alignment**: The system relies on synchronized consistency across three distinct storage domains: ... **Invariant**: The Webview Client State must survive and... after full DOM re-renders ...

**Surface mapping**  
Webview lifecycle + persistence (`getState`/`setState`), message passing, potential `WebviewPanelSerializer` if persistence across restarts is required.citeturn2view0turn0search0turn12view0  

**Root cause analysis**  
VS Code webview documents are destroyed and recreated during hide/show and whenever you replace `webview.html`, which resets in-webview state unless you persist it. VS Code’s preferred solution is to persist JSON-serializable webview state via `getState`/`setState`, which survives these lifecycle transitions within a session, and optionally use a serializer for restarts.citeturn2view0turn0search0

**Concrete code/config changes**  
- Implement **Pattern C**: persist every “draft” and “decision-in-progress” (e.g., gate rationales) into webview state on each keystroke (or debounced).  
- For cross-restart recovery: register a `WebviewPanelSerializer` and add `onWebviewPanel:<viewType>` activation (see **Pattern C** + **Pattern G**).citeturn2view0turn0search0turn12view0

**Testing steps**
- Manual: type a gate rationale, trigger an unrelated backend event, confirm text remains.  
- Automated: integration test that opens the webview, types into the rationale input, triggers a host-side update, verifies input retains. (Use VS Code testing setup.)citeturn5search2turn5search7

**CI/packaging changes**
- Add regression test to CI; ensure webview bundle is deterministic and included (see **Pattern G**).citeturn5search1turn5search7

**Risk/impact**
- Direct user trust impact: prevents “lost work” during interactive gating, reduces race-condition perception.

**Priority**: P1 (High severity, L effort)

---

**GSUI-03 — Destructive Re-renders (Pass 2)**

**Issue description (verbatim)**  
> 1.  **Destructive Re-renders**: Triggering `this._update()` ... executes a full DOM replacement ... incoming backend events can wipe out human input halfway through typing.

**Surface mapping**  
`webview.html` replacement semantics; webview persistence; performance; UX.citeturn12view0turn2view0

**Root cause analysis**  
VS Code explicitly documents that setting `webview.html` replaces the entire webview content (iframe-like reload) and resets scripts, which destroys ephemeral input unless persisted.citeturn12view0

**Concrete code/config changes**  
- Stop calling `_update()` on every streaming or small event. Introduce:
  - host-side throttling (coalesce updates), and  
  - patch-based UI updates (**Pattern D**), where the shell HTML is stable and only data is changed via `postMessage`.citeturn9view2turn2view0  
- Persist drafts via **Pattern C**.

Example host-side throttling:
```ts
// GovernedStreamPanel.ts
private _pendingRender = false;

private scheduleRender(): void {
  if (this._pendingRender) return;
  this._pendingRender = true;
  setTimeout(() => { // or queueMicrotask + debounce
    this._pendingRender = false;
    this._postPatchUpdates(); // do NOT set webview.html
  }, 50);
}
```

**Testing steps**
- Performance test: simulate 500–2000 events and ensure UI remains responsive (no seconds-long freezes).  
- UX test: typing into inputs while backend events stream should not clear text.

**CI/packaging changes**
- Add a perf regression benchmark (even a coarse “render must complete < X ms for N events”) run in CI on PRs touching aggregator/render. Node guidance is explicit that expensive JSON/regex operations can block the event loop; guardrails prevent reintroducing this class of regression.citeturn3search0turn3search7  

**Risk/impact**
- High: this materially affects usability and operator trust; also drives downstream bug reports that are hard to reproduce.

**Priority**: P1 (High severity, L effort)

---

**GSUI-04 — Selector Drift and Silent Failures (Pass 2)**

**Issue description (verbatim)**  
> 2.  **Selector Drift and Silent Failures**: Updating HTML markup ... breaks selectors ... broken selectors fail silently.

**Surface mapping**  
Webview DOM query reliance; message passing; maintainability; packaging (rollout mismatches).citeturn9view2  

**Root cause analysis**  
This is a classic symptom of implicit contracts: when selectors are not centralized, not tested, and not versioned, changes break behavior without a hard failure signal.

**Concrete code/config changes**  
- Centralize selectors and actions in a shared file that is compiled into both host-side renderer and webview client bundle (if both are TS).  
- Emit explicit error messages (banner + log) when selectors/actions mismatch (see GSUI-01).  
- Add schema version handshake (GSUI-19).

**Testing steps**
- Contract test ensures required selectors exist.  
- Integration tests click-by-action.

**CI/packaging changes**
- Add “contract snapshot” test of HTML shell output to CI.

**Risk/impact**
- Medium: frequent source of regressions; rollout entangles unrelated changes.

**Priority**: P2 (Medium severity, M effort)

---

**GSUI-05 — Dangling Processing States (Pass 2)**

**Issue description (verbatim)**  
> 3.  **Dangling Processing States**: The system maintains two separate UI representations of "Processing" ... UI locks in a permanently loading state.

**Surface mapping**  
Webview UI correctness; error handling; cancellation; message passing.citeturn9view2turn12view0  

**Root cause analysis**  
Dual sources of truth (host-rendered `.processing-cancel-bar` and client-controlled `#processing-indicator`) plus missing `try/finally` cleanup creates “stuck spinner” failure states.

**Concrete code/config changes**  
- Unify processing state into a single state machine owned by the host (source of truth), and render indicators purely from that state via patch messages (**Pattern D**).  
- Ensure any workflow that enters “processing” exits it in `finally`.

Minimal patch:
```ts
// GovernedStreamPanel.ts
private async withProcessing<T>(fn: () => Promise<T>): Promise<T> {
  this._setProcessing(true);
  try { return await fn(); }
  finally { this._setProcessing(false); }
}
```

**Testing steps**
- Force exceptions at each step of gate triggering/cancellation; ensure spinner clears (unit + integration).  
- Manual: cancel mid-stream, verify both UI indicators clear.

**CI/packaging changes**
- Add integration “cancel path” test to CI.

**Risk/impact**
- Medium: blocks operators; increases restart frequency and amplifies GSUI-16 orphanage.

**Priority**: P2 (Medium severity, S effort)

---

**GSUI-06 — Regex Injection Brittleness (Pass 2)**

**Issue description (verbatim)**  
> 4.  **Regex Injection Brittleness**: The `wrapResizable()` utility relies on regex to inject inline styling ... brittle ...

**Surface mapping**  
Webview rendering reliability; security-adjacent (regex on untrusted input); performance.citeturn3search0  

**Root cause analysis**  
String-level HTML manipulation is fragile and can also become a performance hazard. Node’s guidance explicitly flags regex work as a common event-loop blocking risk, especially when inputs are large or adversarial.citeturn3search0

**Concrete code/config changes**  
- Eliminate regex-based HTML mutation. Replace `wrapResizable(html)` with a structured renderer:
  - host-side: build wrapper HTML explicitly (string templating with placeholders), or  
  - client-side: create DOM nodes and wrap with `document.createElement` (preferred if moving rendering to client).  
- Remove inline styles and move to CSS (also aligns with CSP best practices).citeturn2view0

**Testing steps**
- Unit: `wrapResizable` equivalent should still wrap even with leading comments/attribute changes.  
- Integration: resize behavior persists after multiple renders.

**CI/packaging changes**
- None beyond normal unit tests.

**Risk/impact**
- Low-to-medium individually, but it’s a “footgun” that becomes costly during refactors.

**Priority**: P3 (Low severity, S effort)

---

**GSUI-07 — Linear CPU Degradation on Stream Length (Pass 3)**

**Issue description (verbatim)**  
> 1.  **Linear CPU Degradation on Stream Length**: The `buildStreamItems()` function reconstructs the entire sequence ... every time ...

**Surface mapping**  
Extension Host performance; DB access patterns; UI responsiveness.citeturn3search0turn3search7  

**Root cause analysis**  
Repeated full rebuilds convert a linear aggregator into a quadratic workload once called for every incremental UI update (especially during streaming). Node explicitly warns that expensive CPU work blocks the event loop, harming throughput and responsiveness.citeturn3search0turn3search7

**Concrete code/config changes**  
- Implement incremental aggregation (**Pattern D** and **Pattern E**):
  - Track `lastProcessedEventId` (or timestamp) per dialogue.
  - Fetch only events since that marker.
  - Append/patch only affected `StreamItem`s.  
- Add memoization caches keyed by (dialogueId, eventId).

**Testing steps**
- Unit: aggregator returns identical results for “full rebuild” vs “delta rebuild”.  
- Perf: N=10k events should not cause multi-second render.  

**CI/packaging changes**
- Add a perf regression test in CI for aggregator updates.

**Risk/impact**
- High: performance regressions scale with use; can freeze VS Code.

**Priority**: P1 (High severity, M effort)

---

**GSUI-08 — Synchronous JSON Parsing Overhead (Pass 3)**

**Issue description (verbatim)**  
> 2.  **Synchronous JSON Parsing Overhead**: ... massive strings ... synchronously parsed using `JSON.parse()` ... introduces meaningful synchronous blocking ...

**Surface mapping**  
Extension Host performance and reliability; DB data validation.citeturn3search7turn3search0  

**Root cause analysis**  
Node’s “Don’t block the Event Loop” guide explicitly calls out `JSON.parse`/`JSON.stringify` as potentially expensive operations for large inputs (“JSON DOS”).citeturn3search7turn3search0  

**Concrete code/config changes**  
- Wrap parsing in safe helpers and validate shape (**Pattern E**).  
- Parse lazily: only parse `event.detail` for event types that actually require it for rendering.  
- Cache parsed results by event primary key so the same detail isn’t parsed repeatedly.

**Testing steps**
- Unit: invalid JSON should not crash aggregation; event should render as “Malformed detail” with raw payload.  
- Perf: parse budget test on representative payload sizes.

**CI/packaging changes**
- Add unit tests for malformed JSON and large JSON.

**Risk/impact**
- Medium: can escalate to “hard crash” rendering loop (see GSUI-15).

**Priority**: P2 (Medium severity, S effort)

---

**GSUI-09 — High Component Coupling (Pass 4)**

**Issue description (verbatim)**  
> 1.  **High Component Coupling**: To add a single new card type ... must touch ... StreamItem union ... parsing chain ... components.ts ... webview handlers ...

**Surface mapping**  
Maintainability; long-term velocity; architecture boundaries.

**Root cause analysis**  
A monolithic switch-based renderer plus monolithic parsing logic creates a “shotgun surgery” maintenance mode (also raised separately later). This is structurally linked to the “host-renders-HTML” design, because every new card requires coordinated changes across host aggregation, host templating, and client interactivity routes.

**Concrete code/config changes**  
- Introduce a registry/plugin model per card type:
  - `CardDefinition<T>` encapsulates: schema validation, aggregation projection, renderer, and client action handlers (or action descriptors).  
- Move toward “data-first contract” (**Pattern A/D**) so renderer composition happens on client with a typed model.

**Testing steps**
- Unit: each `CardDefinition` has data-in/data-out tests.  
- Integration: one representative card per category.

**CI/packaging changes**
- No new packaging; add unit tests around registry.

**Risk/impact**
- Medium: slows feature velocity and increases regression rate.

**Priority**: P2 (Medium severity, L effort)

---

**GSUI-10 — Monolithic God Classes/Files (Pass 4)**

**Issue description (verbatim)**  
> 2.  **Monolithic God Classes/Files**: `GovernedStreamPanel.ts` (3,400+ LOC), `components.ts` (5,200+ LOC) and `styles.ts` (6,400+ LOC) act as catch-all boundaries ...

**Surface mapping**  
Maintainability; testability; performance (hot paths hidden in large files).

**Root cause analysis**  
Large, multi-responsibility files impede review, isolate little, and inhibit unit testing (explicitly called out later). This is a classic precondition for regressions.

**Concrete code/config changes**  
- Refactor by responsibility boundaries:
  - `panel/` (webview lifecycle + messaging),
  - `stream/` (aggregation + models),
  - `render/` (view model + templates),
  - `security/` (sanitization, CSP utilities),
  - `telemetry/` (if any).  
- Introduce module-level unit tests as you extract functions.

**Testing steps**
- Snapshot tests remain stable when refactoring templates.  
- Increase unit test coverage on extracted pure modules.

**CI/packaging changes**
- Add codeowners/lint rules to prevent re-growth; enforce TS strict (GSUI-35).citeturn10search0  

**Risk/impact**
- Medium: primarily long-term; refactor risk is non-trivial.

**Priority**: P2 (Medium severity, XL effort)

---

**GSUI-11 — Prompt Instruction Contradictions (Pass 5)**

**Issue description (verbatim)**  
> 1.  **Prompt Instruction Contradictions**: ... "Do NOT use markdown code fences"... yet ... include code fences ...

**Surface mapping**  
LLM integration correctness; parsing reliability.

**Root cause analysis**  
Contradictory instructions reduce determinism and can break downstream parsers that expect one format. (This is also repeated in Pass 9.)

**Concrete code/config changes**  
- Make format requirements self-consistent:
  - If “no code fences” is required, remove fenced examples from the prompt templates.
  - Alternatively: update the parser to accept fenced blocks and normalize.  
- Add output validation: any agent response that fails schema is rejected and re-asked.

**Testing steps**
- Golden tests: feed prompts to a mock LLM output generator and validate parsing rules.  
- Regression tests for “fence vs no-fence” cases.

**CI/packaging changes**
- Add prompt schema validation tests to CI.

**Risk/impact**
- Medium: correctness degradation and runtime parsing faults.

**Priority**: P2 (Medium severity, S effort)

---

**GSUI-12 — Inconsistent Tool Constraints (Pass 5)**

**Issue description (verbatim)**  
> 2.  **Inconsistent Tool Constraints**: The Executor Unit prompt ... constrains arbitrary tool-use, whereas ... Architecture ... omit these safety constraints.

**Surface mapping**  
Security; LLM tool governance; possible Workspace Trust interaction; command execution.

**Root cause analysis**  
If an architecture agent can call tools without the same constraints, it becomes a privilege escalation channel. The VS Code Language Model Tool API is designed to make tool calls explicit, schema-validated, and confirmation-gated.citeturn8view0

**Concrete code/config changes**  
- Enforce a single tool policy across all phases:
  - Architecture phase must route through the same tool allowlist and confirmation prompts as execution phases (**Pattern F**).citeturn8view0  
- If tools can trigger workspace/code execution, gate them on Workspace Trust:
  - Use `vscode.workspace.isTrusted` and/or manifest `capabilities.untrustedWorkspaces` (see **Pattern F** and Workspace Trust guidance).citeturn6search7turn10search11  

**Testing steps**
- Simulate tool call in each phase; verify confirmation is shown and allowlist enforced.

**CI/packaging changes**
- Add unit tests for allowlist enforcement and schema validation.

**Risk/impact**
- High: this is a governance and potential security issue.

**Priority**: P1 (High severity, M effort)

---

**GSUI-13 — Provider Routing Ambiguity (Pass 5)**

**Issue description (verbatim)**  
> 3.  **Provider Routing Ambiguity**: ... requires Context Engineering ... routes through TECHNICAL_EXPERT provider wrapper ... wrong underlying model or temperature ...

**Surface mapping**  
Reliability/correctness of LLM orchestration; cost/performance.

**Root cause analysis**  
Misrouting model profiles causes capability mismatch and unstable outputs. This interacts with GSUI-11/21 (format contradictions) and GSUI-24 (fail-open gating).

**Concrete code/config changes**  
- Explicit routing map:
  - `ContextEngineer -> CONTEXT_ENGINEER profile (temperature X, model Y)` (names as per your system).
  - Add a runtime assertion: if the selected provider does not match the phase type, log error and block.  
- Add “provider telemetry” (if you collect telemetry, it must respect `isTelemetryEnabled`).citeturn13search0turn13search1  

**Testing steps**
- Unit: phase-to-provider mapping test.  
- Integration: run a representative workflow and ensure expected provider IDs in logs.

**CI/packaging changes**
- None beyond tests.

**Risk/impact**
- Medium: reduces quality, increases variance.

**Priority**: P2 (Medium severity, M effort)

---

**GSUI-14 — Data Loss on DOM Swap (Pass 6)**

**Issue description (verbatim)**  
> 1.  **Data Loss on DOM Swap**: ... Gate Rationales (`state.gateRationales`) ... held solely in the webview memory ... `_update()` will flush the DOM and wipe out ... text input.

**Surface mapping**  
Webview persistence; UX; message passing.citeturn12view0turn2view0

**Root cause analysis**  
This is a direct consequence of full DOM replacement and missing `getState`/`setState` persistence for all in-progress inputs. VS Code’s webview documentation explicitly recommends persisting state via `setState` and restoring via `getState`.citeturn2view0turn12view0

**Concrete code/config changes**  
- Implement **Pattern C** specifically for `gateRationales`:
  - Persist per gate/card ID.
  - On render/hydrate, restore into input fields.  
- Preferably eliminate DOM swaps (GSUI-03 / Pattern D).

**Testing steps**
- Automated: type partial rationale, trigger `_update()`, assert input preserved.

**CI/packaging changes**
- Add regression test.

**Risk/impact**
- High: “lost work” in safety gating contexts undermines operator trust.

**Priority**: P1 (High severity, M effort)

---

**GSUI-15 — Weak Typed SerDes (Pass 6)**

**Issue description (verbatim)**  
> 2.  **Weak Typed SerDes**: `dataAggregator.ts` ... blindly calls `JSON.parse()` ... A poorly formed string ... will crash the aggregator loop ...

**Surface mapping**  
Reliability; error handling; schema validation.

**Root cause analysis**  
Blind `JSON.parse` failures throw synchronously, and without validation/guardrails can crash a timeline build. Node warns that JSON operations can be expensive and should be bounded; additionally, parsing failures should be contained.citeturn3search7turn11search9  

**Concrete code/config changes**  
- Implement **Pattern E**:
  - `safeJsonParse()` with try/catch returning `{ok:false, raw}`.
  - Zod schema validation (`safeParse`) for structured events to prevent unsafe casts. Zod’s docs emphasize schema-based parsing and error handling.citeturn11search3turn11search0  
- Ensure aggregator never throws on malformed event; instead, render a “Malformed event” card.

**Testing steps**
- Unit: malformed JSON does not crash; emits “bad_json” stream item.  
- Integration: simulate malformed LLM output stored in DB.

**CI/packaging changes**
- Add unit tests for malformed payload classes.

**Risk/impact**
- High: current failure mode “corrupts entire timeline view”.

**Priority**: P1 (High severity, M effort)

---

**GSUI-16 — Process-State Orphanage (Pass 6)**

**Issue description (verbatim)**  
> 3.  **Process-State Orphanage**: ... `_activeCLICommandId` ... If VS Code restarts mid-execution ... stream may indefinitely wait for ... event that will never emit.

**Surface mapping**  
Extension activation lifecycle; workspace trust; resilience; commands.

**Root cause analysis**  
In-memory process pointers cannot survive editor restart. You need a recoverable persisted representation and a startup reconciliation path.

**Concrete code/config changes**  
- Add startup reconciliation:
  - On activation, scan DB for “running” CLI commands older than a threshold and mark them “orphaned” or “unknown”; update UI accordingly.  
- If you track external processes, store durable identifiers (e.g., PID + start time) and implement explicit recovery commands.
- If actions involve workspace execution, also gate features behind Workspace Trust (see **Pattern F**, and Workspace Trust guide).citeturn6search7  

**Testing steps**
- Integration: start a CLI command, terminate extension host, restart dev host, confirm UI shows “orphaned” and offers recovery/cancel.

**CI/packaging changes**
- Add restart-style integration test if feasible; otherwise unit-test reconciliation.

**Risk/impact**
- High: user-facing “stuck processing” plus zombie state.

**Priority**: P1 (High severity, M effort)

---

**GSUI-17 — Webview HTML Injection Vector (Pass 7)**

**Issue description (verbatim)**  
> 1.  **Webview HTML Injection Vector**: ... Host generates unvalidated raw HTML templates ... transmits ... where the Webview likely assigns it to `innerHTML` ... any lapse ... creates a direct ... XSS vulnerability ...

**Surface mapping**  
Webview security: CSP, sanitization, unsafe sinks (`innerHTML`), `localResourceRoots`; supply chain risk from LLM-provided content.citeturn2view0turn9view0turn4search0turn4search1  

**Root cause analysis**  
VS Code’s webview security guide explicitly requires sanitizing all user input and recommends using a CSP to minimize injection impact.citeturn2view0  
entity["organization","OWASP","web security nonprofit"] guidance is also clear: avoid unsafe sinks like `innerHTML` for untrusted data; prefer `textContent`, or sanitize HTML with a dedicated library when HTML rendering is required.citeturn4search0turn4search1turn4search6

**Concrete code/config changes**  
Immediate containment (do these even if you later refactor):
- Implement strict CSP + disallow inline scripts/styles (**Pattern B**).citeturn2view0turn9view0  
- Restrict `localResourceRoots` to extension-owned folders only (typically `media/`), and avoid allowing workspace roots unless strictly needed.citeturn9view0turn4search5  
- Stop inserting untrusted HTML via `innerHTML`. Use:
  - `textContent` for pure text, or  
  - sanitization (DOMPurify) for rich HTML only when required.citeturn4search0turn4search6  

Long-term fix (preferred):
- Remove host-sent HTML fragments entirely: switch to structured JSON rendering in the client (Patterns A + D).

**Testing steps**
- Security regression tests:
  - Attempt injection payloads (`<img onerror=...>`, `javascript:` URLs) via LLM output and user inputs; ensure they render inert.  
- Static scan:
  - search for `innerHTML =` and ensure it’s only used with sanitized sources.

**CI/packaging changes**
- Add ESLint rule / custom lint to forbid direct `innerHTML` unless explicitly annotated.
- Add dependency update process for sanitizers.

**Risk/impact**
- Critical: XSS inside VS Code can exfiltrate data reachable in the webview context and may chain into privileged extension interactions.

**Priority**: P0 (Critical severity, M effort)

---

**GSUI-18 — Inadequate Tool Invocation Boundaries (Pass 7)**

**Issue description (verbatim)**  
> 2.  **Inadequate Tool Invocation Boundaries**: ... prompts lack explicit constraints against arbitrary tool use ... could invoke CLI tools unexpectedly ...

**Surface mapping**  
Language Model Tools (`contributes.languageModelTools`, `vscode.lm.registerTool`), user confirmations, Workspace Trust, command execution governance.citeturn8view0turn6search7  

**Root cause analysis**  
The correct place to enforce constraints is not only in natural-language prompts but in **tool API design**: schema validation, user confirmations, and strict allowlists. The Language Model Tool API explicitly supports:
- input schema validation via JSON schema defined in `package.json`, and  
- per-invocation user confirmation via `prepareInvocation`, with an always-present generic confirmation baseline.citeturn8view0

**Concrete code/config changes**  
- Implement **Pattern F**:
  - restrict tools to a minimal set with explicit “should and shouldn’t be used” descriptions (`modelDescription`),
  - define `inputSchema` and validate again in code,
  - require explicit confirmation text describing side effects.citeturn8view0  
- Gate any workspace-mutating tool behind Workspace Trust (see **Pattern F** and the Workspace Trust extension guide).citeturn6search7turn10search11

**Testing steps**
- Simulate tool invocation attempts outside allowed context; ensure tool returns “denied” and logs.  
- Verify confirmation prompts appear with correct text.

**CI/packaging changes**
- Add unit tests for allowlist enforcement and schema parse failures.

**Risk/impact**
- Critical: prevents uncontrolled side effects and reduces prompt-injection blast radius.

**Priority**: P0 (Critical severity, M effort)

---

**GSUI-19 — Tight HTML-JS Schema Coupling (Pass 8)**

**Issue description (verbatim)**  
> 1.  **Tight HTML-JS Schema Coupling**: ... migrating or upgrading ... requires synchronized atomic deployments ... backend upgrade ... client refresh ... soft-brick ...

**Surface mapping**  
Packaging, rollout/versioning, webview assets, message protocol.

**Root cause analysis**  
When the DOM structure is the API, any mismatch between host-side HTML and client-side JS breaks. This is amplified if webview JS is bundled and cached while host logic changes, or vice versa.

**Concrete code/config changes**  
- Add explicit version handshake (**Pattern A**):
  - Host embeds `buildVersion` in webview HTML.
  - Webview posts back `{type:'ready', buildVersion}`.
  - Host validates and, on mismatch, sends a “Reload required” UI state.  
- Move from DOM schema to JSON protocol (Patterns A + D).

**Testing steps**
- Integration: simulate version mismatch and ensure user sees an actionable error.

**CI/packaging changes**
- Ensure `vscode:prepublish` builds both host and webview bundles together (Pattern G).citeturn5search1  

**Risk/impact**
- High: prevents rollout-related “soft bricks”.

**Priority**: P1 (High severity, M effort)

---

**GSUI-20 — SQLite Schema Rigidity (Pass 8)**

**Issue description (verbatim)**  
> 2.  **SQLite Schema Rigidity**: ... hardcodes parsing logic ... If a DB schema migration occurs ... naive `JSON.parse` loops will throw type errors ...

**Surface mapping**  
Data migrations; backward compatibility; runtime validation; safe parsing.

**Root cause analysis**  
Schema evolution needs explicit versioning and tolerant reads. Without it, older records or newer schema fields can crash views.

**Concrete code/config changes**  
- Add `schema_version` to event records (if not present).  
- Update parsing to be tolerant:
  - unknown fields ignored,
  - required fields validated with Zod safeParse (Pattern E).citeturn11search3turn11search0  
- Implement a migration layer and feature flags.

**Testing steps**
- Fixture-based tests with:
  - old schema rows,
  - new schema rows,
  - malformed rows.

**CI/packaging changes**
- Add migration tests run in CI.

**Risk/impact**
- Medium: shows up during rollouts and upgrades.

**Priority**: P2 (Medium severity, M effort)

---

**GSUI-21 — Prompt Instruction Contradictions (Pass 9)**

**Issue description (verbatim)**  
> 1.  **Prompt Instruction Contradictions**: As noted, ... avoid Markdown code fences ... while presenting code fences ...

**Root cause / remediation**  
Same underlying issue as GSUI-11; treat this as confirmation that the contradiction is systemic. Apply GSUI-11 remediation (prompt consistency + parser robustness + output validation).

**Testing steps / CI**  
Same as GSUI-11.

**Priority**: P2 (Medium severity, S effort)

---

**GSUI-22 — Dual Indicator Discrepancy (Pass 9)**

**Issue description (verbatim)**  
> 2.  **Dual Indicator Discrepancy**: ... `.processing-cancel-bar` (Server) and `#processing-indicator` (Client) ... orphaned spinner ...

**Root cause / remediation**  
Same root cause as GSUI-05, but framed as correctness. Apply GSUI-05 remediation: single source-of-truth processing state machine + `finally` cleanup.

Cite: webview DOM reset risk when setting `webview.html`.citeturn12view0

**Priority**: P2 (Medium severity, S effort)

---

**GSUI-23 — Regex Injection in wrapResizable() (Pass 10)**

**Issue description (verbatim)**  
> 1.  **Regex Injection in `wrapResizable()`**: ... regex replacement ... fragile ... reliably silently loses resize capabilities.

**Root cause / remediation**  
Same as GSUI-06. Replace regex mutation with structured wrapper construction and avoid inline styles (aligns with CSP guidance that favors external styles/scripts).citeturn2view0turn3search0  

**Priority**: P3 (Low severity, S effort)

---

**GSUI-24 — Fallback Pathing Flaws (Pass 10)**

**Issue description (verbatim)**  
> 2.  **Fallback Pathing Flaws**: Evaluators fail-open to `PROCEED` upon provider failure ... silently allowing ... bypass quality gates ...

**Surface mapping**  
Correctness/safety gating; user trust; telemetry (optional); UI notifications.

**Root cause analysis**  
Fail-open may be appropriate for availability but is dangerous if it silently bypasses safety or quality gates. In such systems, “availability fallback” must be explicit and auditable.

**Concrete code/config changes**  
- Introduce explicit “degraded mode” state:
  - On provider failure, mark the gate as `NEEDS_REVIEW` not `PROCEED`.
  - Require explicit human authentication/acknowledgment to proceed (e.g., a “Proceed anyway” button with a rationale).  
- Emit structured logs/telemetry event for provider outage decisions (respect telemetry requirements).citeturn13search0turn13search1  

**Testing steps**
- Unit: provider failure leads to `NEEDS_REVIEW`.  
- Integration: UI shows explicit degraded indicator.

**CI/packaging changes**
- Add tests around fallback.

**Risk/impact**
- High: silent bypass undermines governance.

**Priority**: P1 (High severity, S effort)

---

**GSUI-25 — Cross-Site Scripting (XSS) (Pass 11)**

**Issue description (verbatim)**  
> 1.  **Cross-Site Scripting (XSS)**: ... LLM output ... string concatenation ... any missed `escapeHtml` call ... XSS vector ... manual escaping ... human error inevitable.

**Root cause / remediation**  
This is the same security class as GSUI-17, stated more directly. Apply GSUI-17 remediation with emphasis on:
- “No untrusted HTML over the boundary” (JSON protocol),
- CSP and minimal capabilities,
- sanitizer or `textContent`.

VS Code explicitly requires sanitization and CSP, and OWASP recommends avoiding unsafe sinks like `innerHTML` or sanitizing via specialized libraries.citeturn2view0turn4search0turn4search6  

**Priority**: P0 (Critical severity, M effort)

---

**GSUI-26 — Unconstrained Tool Access (Pass 11)**

**Issue description (verbatim)**  
> 2.  **Unconstrained Tool Access**: ... Architecture agents omit constraints ... could execute malicious commands ...

**Root cause / remediation**  
Same tool-governance class as GSUI-18. Implement Language Model Tools with schema + confirmation + allowlist, and gate with Workspace Trust as needed.citeturn8view0turn6search7  

**Priority**: P0 (Critical severity, M effort)

---

**GSUI-27 — O(N²) Rendering Bottleneck (Pass 12)**

**Issue description (verbatim)**  
> 1.  **O(N²) Rendering Bottleneck**: ... for every new event ... `_update()` ... iterates over all DB events ... regenerating ... monolithic HTML string ... `innerHTML` swap ...

**Surface mapping**  
Performance; webview lifecycle; event loop blocking; DOM thrashing.

**Root cause analysis**  
The combined system is effectively:
- O(N) aggregation per update  
- O(N) HTML generation per update  
- large DOM parse/layout per update  
=> O(N²) over the lifetime of a growing session.  
Additionally, repeated `webview.html` replacement resets state.citeturn12view0turn3search0turn3search7  

**Concrete code/config changes**  
- Stop full rebuilds:
  - incremental aggregation (GSUI-07),
  - patch updates (Pattern D),
  - UI virtualization (render only visible items for very long conversations).  
- Add throttling/coalescing: no more than e.g. 10 UI updates/sec while streaming.

**Testing steps**
- Perf: simulate streaming 5k tokens and 5k events; ensure UI remains responsive.  
- Memory: monitor peak memory during long run.

**CI/packaging changes**
- Add perf regression test.

**Risk/impact**
- High: UI stuttering and extension host unresponsiveness.

**Priority**: P1 (High severity, L effort)

---

**GSUI-28 — Synchronous God-Loop (Pass 12)**

**Issue description (verbatim)**  
> 2.  **Synchronous God-Loop**: `renderStream` handles 28 complex switch cases synchronously without yielding ... Extension Host unresponsiveness ...

**Surface mapping**  
Event loop blocking; rendering architecture.

**Root cause analysis**  
Long synchronous loops block Node’s event loop; Node explicitly warns about avoiding blocking callbacks and calls out expensive regex/JSON work as common culprits.citeturn3search0turn3search7  

**Concrete code/config changes**  
- Partition rendering:
  - chunk work into batches (e.g., 50 items), yield with `setImmediate` between batches, or move to client renderer.  
- Prefer “data-first + client render” to remove rendering burden from extension host.

**Testing steps**
- Unit/perf: ensure rendering yields and does not freeze for large N.

**Priority**: P2 (Medium severity, M effort)

---

**GSUI-29 — God Objects (Pass 13)**

**Issue description (verbatim)**  
> 1.  **God Objects**: ... violate SRP ... massive maintenance burden ...

**Root cause / remediation**  
Same as GSUI-10 (monolithic files), restated with SRP framing. Apply refactor plan in GSUI-10, emphasizing isolating messaging, aggregation, rendering, and workflow orchestration into testable units.

**Priority**: P2 (Medium severity, XL effort)

---

**GSUI-30 — Shotgun Surgery Anti-Pattern (Pass 13)**

**Issue description (verbatim)**  
> 2.  **Shotgun Surgery Anti-Pattern**: Adding a single new interactive visual card requires modifying ... types, aggregator, renderer, CSS, router ...

**Root cause / remediation**  
Same as GSUI-09. Apply card registry model and reduce cross-cutting by:
- having each card define its view model and render logic, and
- having shared infrastructure handle wiring.

**Priority**: P2 (Medium severity, L effort)

---

**GSUI-31 — Violates Separation of Concerns (MVC Boundary) (Pass 14)**

**Issue description (verbatim)**  
> 1.  **Violates Separation of Concerns (MVC Boundary)**: ... Host should serve structured JSON ... By hard-rendering raw HTML strings ... fails to establish a proper API boundary ...

**Surface mapping**  
Architecture; security boundary; testability.

**Root cause analysis**  
Server-side HTML rendering inside the extension host collapses the boundary between trusted orchestration code and untrusted UI rendering. VS Code’s webview model is explicitly message-passing-based; building a typed JSON boundary is the safe and testable approach.citeturn9view2turn2view0  

**Concrete code/config changes**  
- Execute the “target flow” migration:
  - Define JSON view models for stream items (Pattern A/E),
  - Render in webview (Pattern D),
  - Keep host rendering limited to the initial shell with CSP (Pattern B).  
- De-risk migration by first keeping HTML rendering but stop sending fragments and stop using `innerHTML` (GSUI-17), then progressively move to structured components.

**Testing steps**
- Contract tests for message protocol schema.  
- Snapshot tests for client renderer output.

**CI/packaging changes**
- Ensure prepublish builds both host and webview bundles (Pattern G).citeturn5search1  

**Risk/impact**
- High: significant refactor but unlocks security, performance, and maintainability improvements simultaneously.

**Priority**: P1 (High severity, XL effort)

---

**GSUI-32 — Testability Black Hole (Pass 15)**

**Issue description (verbatim)**  
> 1.  **Testability Black Hole**: Logic deeply nested inside ... HTML literal templates ... cannot be easily strictly unit-tested.

**Surface mapping**  
Testing strategy; maintainability.

**Root cause analysis**  
When logic is embedded in string templates and long handlers, you can’t isolate deterministic units. This is a structural testability problem.

**Concrete code/config changes**  
- Extract pure functions:
  - `toStreamItems(events)`, `renderViewModel(item)` should be pure and unit-tested.  
- Move webview rendering to a component system (GSUI-34) enabling DOM testing.

**Testing steps**
- Unit tests on pure functions.  
- Use VS Code integration tests for end-to-end flows.citeturn5search2turn5search7  

**CI/packaging changes**
- Add coverage thresholds on extracted modules.

**Priority**: P2 (Medium severity, L effort)

---

**GSUI-33 — Implicit Database Mocking (Pass 15)**

**Issue description (verbatim)**  
> 2.  **Implicit Database Mocking**: `dataAggregator.ts` relies ... global DB fetching singletons ... brittle mocking ...

**Surface mapping**  
Testing architecture; dependency injection.

**Root cause analysis**  
Global singletons prevent data-in/data-out testing.

**Concrete code/config changes**  
- Introduce interface-based DB access:
  - `IDataStore` with `getEvents(dialogueId, sinceId)` etc.
  - Pass it into aggregator constructor.  
- Provide in-memory fake in tests.

**Testing steps**
- Unit: aggregator tests with fake store.

**CI/packaging changes**
- Add unit tests; no packaging changes.

**Priority**: P2 (Medium severity, M effort)

---

**GSUI-34 — String Concatenation vs. Declarative UI (Pass 16)**

**Issue description (verbatim)**  
> 1.  **String Concatenation vs. Declarative UI**: ... non-idiomatic ... favors TSX/React/lit-html ... provide XSS protection ...

**Surface mapping**  
Maintainability; security; rendering strategy.

**Root cause analysis**  
String concatenation makes it easy to introduce injection bugs and hard to refactor safely. VS Code itself suggests using helper libraries to construct HTML strings and warns never to rely on sanitization alone.citeturn2view0  
OWASP recommends modern frameworks and warns that “escape hatches” (direct DOM/HTML insertion) are where XSS bugs reappear.citeturn4search0

**Concrete code/config changes**  
- Migrate to a component renderer in the webview:
  - minimal: template literals + strict escaping on all interpolations,
  - better: React/Preact/lit-html with strict CSP-compliant build pipeline.
- Use VS Code bundling guidance to package webview assets (Pattern G).citeturn5search1  

**Testing steps**
- Component unit tests; snapshot tests.

**Priority**: P3 (Low severity, L effort)

---

**GSUI-35 — Weak TypeScript Strictness (Pass 16)**

**Issue description (verbatim)**  
> 2.  **Weak TypeScript Strictness**: ... `JSON.parse(event.detail) : {}` ... opts-out of TS safety net ... without Zod/Joi ...

**Surface mapping**  
Type safety; reliability; runtime validation.

**Root cause analysis**  
TypeScript’s `strict` mode increases correctness guarantees and helps prevent runtime errors by strengthening type checking.citeturn10search0  
However, even strict typing cannot validate external/untrusted data at runtime; schema validation is necessary for DB/LLM-originated payloads. Zod is a common TS-first schema validator for this purpose.citeturn11search3turn11search0

**Concrete code/config changes**  
- Enable `strict: true` in `tsconfig.json`.citeturn10search0  
- Add runtime validation (Pattern E) around DB payloads and message protocol.

**Testing steps**
- CI typecheck (`tsc --noEmit`) and unit coverage increase.

**CI/packaging changes**
- Ensure CI runs type checks; bundling guidance recommends explicit `check-types` steps when using esbuild (Pattern G).citeturn5search1  

**Priority**: P2 (Medium severity, M effort)

## CI, packaging, and rollout guidance

### Build and packaging hardening

Given the reported “tight coupling” risks, your build must treat the extension host code and webview client code as an **atomic unit**:

- Use `vscode:prepublish` to build production bundles that `vsce` will package. VS Code’s bundling guide shows standard patterns for esbuild/webpack and explicitly ties packaging to `vscode:prepublish`.citeturn5search1  
- Ensure `.vscodeignore` includes source and excludes intermediate outputs appropriately (also shown in the bundling guide).citeturn5search1  
- Add a build-time version stamp (git sha) embedded into the webview HTML and enforced via the protocol handshake (GSUI-19).

### Continuous integration and automated tests

- Use `@vscode/test-electron` for extension integration tests; VS Code’s CI guide explicitly recommends it and provides examples.citeturn5search7turn5search2  
- Add contract tests for:
  - webview shell invariants (IDs, required elements),
  - protocol schema validity,
  - “no full dom swap during streaming” (guardrail).
- Add a lightweight performance regression test suite because Node warns that large JSON parsing and complex regex are common sources of event loop blocking.citeturn3search0turn3search7  

### Telemetry and diagnostics

The review does not explicitly mention telemetry, but multiple remediations benefit from structured diagnostics (render timing, parse failures, tool-invocation denials). If telemetry is added or already exists:

- Prefer `@vscode/extension-telemetry`, or otherwise respect `vscode.env.isTelemetryEnabled` / `onDidChangeTelemetryEnabled`.citeturn13search0turn13search1  
- Avoid PII and be transparent; consider shipping `telemetry.json` so telemetry is visible in `code --telemetry` dumps.citeturn13search0turn13search4  

### Workspace Trust and “permissions” posture

If your extension can execute commands/tools or consume workspace configuration that could trigger code execution, use Workspace Trust onboarding:

- Declare `capabilities.untrustedWorkspaces` and/or restrict settings via `restrictedConfigurations`; gate behavior via `vscode.workspace.isTrusted` and `isWorkspaceTrusted` context keys.citeturn6search7turn10search11  

This closes an important class of “malicious workspace” exploitation paths for powerful extensions.

## Appendix: reference patterns and diagrams

The following patterns are referenced throughout the per-issue remediations.

**Pattern A — Versioned JSON message protocol with validation**

Use a single protocol definition for host↔webview messaging; validate all inbound messages.

```ts
// protocol.ts
export const PROTOCOL_VERSION = 1 as const;

export type HostToWebview =
  | { v: 1; type: 'patch'; payload: StreamPatch }
  | { v: 1; type: 'processing'; payload: { isProcessing: boolean } }
  | { v: 1; type: 'error'; payload: { message: string } };

export type WebviewToHost =
  | { v: 1; type: 'ready'; payload: { buildVersion: string } }
  | { v: 1; type: 'action'; payload: { action: string; args: unknown } };
```

Rationale: message passing is the supported communication model for webviews.citeturn9view2

**Pattern B — Secure webview HTML shell (CSP + minimal capabilities)**

```ts
function getWebviewHtml(webview: vscode.Webview, context: vscode.ExtensionContext) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'main.js'));
  const styleUri  = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'main.css'));

  // CSP: start from default-src 'none' and allow only what you need.
  // Avoid inline scripts/styles.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; style-src ${webview.cspSource};"
  />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
</head>
<body data-schema-version="1">
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
```

Rationale: VS Code webview security guidance explicitly recommends strict CSP and sanitizing inputs, and shows the `default-src 'none'` approach plus use of `webview.cspSource`.citeturn2view0turn9view1turn2view2  
Also restrict `localResourceRoots` to reduce the local file exposure surface.citeturn9view0turn4search5

**Pattern C — Webview state persistence for drafts and UI state**

```ts
// webview/main.ts
const vscode = acquireVsCodeApi();

type PersistedState = {
  v: 1;
  drafts: Record<string, string>;
};

function loadState(): PersistedState {
  return (vscode.getState() as PersistedState) ?? { v: 1, drafts: {} };
}

function saveDraft(key: string, value: string) {
  const state = loadState();
  state.drafts[key] = value;
  vscode.setState(state);
}
```

Rationale: VS Code recommends `getState`/`setState` as the preferred persistence mechanism due to lower overhead than `retainContextWhenHidden`.citeturn2view0turn9view4

**Pattern D — Patch-based incremental updates instead of full DOM swaps**

Use `postMessage` to send patches; never replace the entire DOM during streaming.

Rationale: `webview.postMessage()` is the supported model and accepts JSON-serializable data.citeturn9view2  
Replacing `webview.html` resets script state and should be avoided for incremental updates.citeturn12view0

**Pattern E — Safe JSON parsing and schema validation**

```ts
// safeJson.ts
export function safeJsonParse(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

For structured records:
- define Zod schemas and use `.safeParse()` to avoid throw-based control flow and to get structured validation errors.citeturn11search0turn11search3

**Pattern F — Language Model Tool governance (schema + confirmation + allowlist)**

In `package.json`, define `contributes.languageModelTools` with `inputSchema`, and in code implement `prepareInvocation` confirmations. Tool inputs are validated against the JSON schema and the user sees confirmation prompts.citeturn8view0  
Gate tool functionality on Workspace Trust if workspace execution or reading is involved.citeturn6search7

**Pattern G — Build + CI wiring**

- Use `vscode:prepublish` to build bundles; the bundling guide documents standard scripts (esbuild/webpack) and a separate `tsc --noEmit` typecheck step.citeturn5search1  
- Use `@vscode/test-electron` in CI; VS Code’s CI guide and the `vscode-test` repository show typical setups.citeturn5search7turn5search2