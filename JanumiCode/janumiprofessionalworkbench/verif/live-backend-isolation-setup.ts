// ⭐ `JAN-SELREV` SR-1 (D8) — the vitest setup file every gate test file starts behind: it removes the eight
// live-backend variables before the test file, or anything it imports, reads one. Wired into every project of both
// root configs by `vitest.projects.ts`, and into `apps/rph-demo`'s own `vitest run` by its `vitest.config.ts`. See
// `live-backend-isolation.ts` for why, and `live-backend-isolation.test.ts` for the child runs that hold it.
import { forgetLiveBackendSelections } from './live-backend-isolation.js';

forgetLiveBackendSelections();
