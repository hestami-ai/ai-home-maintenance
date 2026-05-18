# Test archive — pre-regression-suite captures

Material from earlier capture / probe systems that **rotted because they
weren't tied to the regular `pnpm test` run.** Preserved here for
historical reference. Not loaded by any active test path.

## What's here

| Path | What it was | Replaced by |
|---|---|---|
| `fixtures-pre-regression/hestami-product-description/` | LLM call captures from a Hestami product-description run | `src/test/regression/fixtures/` |
| `fixtures-pre-regression/todo-app/` | LLM call captures from a todo-app harness run | `src/test/regression/fixtures/` |
| `prompt-probes-pre-regression/` | Hand-authored Ollama prompt probes (one `.probe.ts` per prompt template) | `src/test/regression/` (extract → assertion-driven) |

Each capture preserved its `request.json`, `response.json`, `prompt.txt`,
and `thinking.txt` per invocation. The prompt probes were designed to
exercise individual prompts against live Ollama but had no assertion
contract — just shape sniffing.

## Why these rotted

The captures + probes lived in `src/test/fixtures/` and `src/test/prompt-probes/`
but the only way to run them was via `pnpm test:probes` or the
`test:harness` script — both manual, neither in the default `pnpm test`
path. Prompt template changes drifted away from the captures and nobody
fixed them. By the time the regression suite landed, the captures were
months out of sync with the templates they were supposed to validate.

## The replacement

`src/test/regression/` ([README](../regression/README.md)) is the canonical
prompt-template regression harness:

1. Fixtures are **assertion-driven** (T1/T2/T3) — the assertion block is
   the regression contract, not the captured response.
2. The **deterministic layer runs on every `pnpm test`** — template
   structure drift fails the build immediately.
3. The **live layer runs on every `pnpm test`** — re-invokes Ollama
   against the captured variables and re-applies assertions.
4. Skip flags are **forbidden by design** — Ollama unreachable means
   `pnpm test` fails, not silently skips.

## Reading from the archive

If a future migration wants to use these captures as ingredients for
new regression fixtures: the `request.json` carries the rendered prompt,
the `response.json` carries the parsed JSON, and timing/temperature
metadata is in the request. The captures pre-date the v2.3 prompt
template revisions, so most will require re-extraction from a current
thin-slice run rather than direct lift.
