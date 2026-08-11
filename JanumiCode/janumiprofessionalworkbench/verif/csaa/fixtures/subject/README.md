# CSAA subject-resolution fixtures

This is the governed fixture root for `JAN-CSAA-W4-DWP-002`.

The executable fixture builder lives in `packages/csaa/src/subject/subject.test.ts`. It materializes each case in a fresh operating-system temporary directory so the suite can safely exercise junctions/symlinks, unreadable files, concurrent mutation, missing outputs, case behavior, and post-freeze freshness without mutating this repository.

The suite covers canonical paths and collisions; workspace manifests and exports; JSONC, inherited/array TypeScript configuration, compiler roots, solution/build projects, references, cycles, missing roots, and hostile patterns; Svelte generated-context absence and CURRENT/STALE/UNKNOWN evidence; exact outputs and authored `.tmp` files; capture/replay, time/count/byte bounds, mutation retry/refusal, opaque copied bytes, and population reconciliation; explicit-project isolation; and live JPWB/inventory-projection equivalence.

OS-fragile cases use explicit Vitest platform gates. A skipped case is reported by the test runner and is never represented as passed.
