# Three-Layer Architecture

Per `docs/janumilegal_product_description.md` §Platform Architecture and `docs/janumilegal_product_description_evolution.md` §0/§1.

## Import direction (enforced by `scripts/lintLayers.ts`)

```
src/layer1_core/        ← may import nothing from layer 2 or layer 3
src/layer2_lens_packs/  ← may import from layer 1; may not import from layer 3
src/layer3_firm_config/ ← may import from layer 1 and layer 2
```

Layer 1 is the platform. Layer 2 is reusable practice-area lens packs. Layer 3 is firm-specific configuration.

The linter rejects:
- any `import` from layer 1 referencing a layer 2 or layer 3 path,
- any `import` from layer 2 referencing a layer 3 path,
- any layer 1 file mentioning layer 3 identifiers (firm names, jurisdictions hardcoded as branches, etc. — Wave 8 expands this).

These rules are CI-blocking.

## Cross-cutting modules

The following are platform infrastructure and live under `src/lib/`, not under any layer directory. They are layer 1 by import rule (importable everywhere).

- `src/lib/database/` — sidecar RPC client, scoped DAL.
- `src/lib/clv/` — CLV runtime interface.
- `src/lib/registry/` — agent registry runtime.
- `src/lib/orchestrator/` — state-machine orchestrator interface.
- `src/lib/scope/` — active matter context, scope envelope.
- `src/lib/types/` — shared TypeScript types.

The extension entry (`src/extension.ts`) and webview (`src/webview/`) are top-level UI shells; they consume layer 1 and layer 3, never layer 2 directly.
