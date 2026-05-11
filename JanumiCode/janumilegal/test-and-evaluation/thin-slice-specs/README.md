# Thin-slice specs

Per `docs/calibration/thin_slice_harness.md`.

A thin-slice spec is a **minimal matter scenario** that exercises every state of a target lens at least once, with shallow seed sets and minimal complexity. The point is to validate the **pipeline** and the **prompts**, not the substantive legal output.

The thin slice is to the gold matter what an integration smoke test is to a full regression suite: deliberately tiny, fast to run, exercises every prompt template and orchestrator path.

Each spec file is a markdown document with the same shape as a real client-message intake plus minimal context. The thin-slice runner consumes it, wraps it as a synthetic matter, and drives the full lens activation.

## Conventions

- File name: `<scenario_handle>.md`.
- First H1 is the scenario title.
- Sections: Product Overview, Matter Type, Inputs (client message, documents), Expected Lens, Out of Scope.
- Synthetic content only — no real client material.
