// ⭐ `JAN-SELREV` SR-1 (D8) — the vitest setup file every gate test file starts behind: it removes ~~the eight~~ the
// live-backend variables (`LIVE_BACKEND_VARIABLES`: D8's, ⭐ `JPWB_REPLAY` since `JAN-EXEC` Phase 8 — the review of E4,
// finding 11 — ⭐ `JPWB_AGENT_MODEL` since the re-review of its fix round, and ⭐ `JPWB_EXECUTOR_EFFORT` and `JPWB_CODEX_BIN`
// since `JAN-MHX` MH-3) before the test file, or anything it imports, reads one. Wired into every project of both root configs by `vitest.projects.ts`, and
// into `apps/rph-demo`'s own `vitest run` by its `vitest.config.ts`. See `live-backend-isolation.ts` for why, and
// `live-backend-isolation.test.ts` for the child runs that hold it.
import { forgetLiveBackendSelections } from './live-backend-isolation.js';

forgetLiveBackendSelections();
