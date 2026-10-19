// ⭐⭐ `JAN-MHX` MH-1 (`DESIGN-multi-harness-executor.md` D12, D30) — THE TABLE A CLI EXECUTOR'S DRIVER IS FOUND IN.
//
// ⭑ ONE ENTRY PER DRIVER, ADDED BY THE PACKAGE THAT LANDS IT: agy's (MH-5), devin's (MH-4), Codex's (MH-6). Each driver is
// a top-level `tools/<tool>-executor-driver.ts`, exported as a function, so `verif/tool-adapter-exports-reachable.test.ts`
// holds it to a production caller — this table. ~~⚠ EMPTY TODAY: no CLI executor is wired, and nothing selects the `CLI`
// kind until a driver's package adds its tool to `WIRED_EXECUTORS` (`execution/executor-selection.ts`).~~ ⭐ MH-4 — devin's
// is here, and devin is in ~~`WIRED_EXECUTORS`~~ ⭐ `WIRED_IN_TEST_MODE_ONLY` (`execution/executor-selection.ts`; MH-4,
// the check's fix, D30), which is what selects the `CLI` kind — in test mode only, until a live devin turn is confirmed.
// ⭐ MH-5: agy's driver is here, and `WIRED_EXECUTORS` selects agy as the `CLI` kind. ⭑ Each lookup calls the driver's
// function, so every session gets a driver of its own: a driver may keep its session's state (agy's keeps each turn's
// model). ⭐ `JAN-MHX` MH-6 — it holds Codex's, which `WIRED_EXECUTORS` selects as the `CLI` kind
// (`execution/executor-selection.ts`).
import { agyExecutorDriver } from './agy-executor-driver.js';
import type { CliDriver } from './cli-executor-session.js';
import { codexExecutorDriver } from './codex-executor-driver.js';
import { devinExecutorDriver } from './devin-executor-driver.js';

/** ⭑ Each entry makes a fresh driver: one per session the opener opens, read against this host's places. */
const CLI_EXECUTOR_DRIVERS: Readonly<Record<string, () => CliDriver>> = {
	agy: agyExecutorDriver,
	devin: () => devinExecutorDriver(),
	codex: codexExecutorDriver
};

/** The driver for `toolId`, or `undefined` when none is wired. ⛔ Own keys only: a prototype name is not a tool. */
export function cliExecutorDriver(toolId: string): CliDriver | undefined {
	return Object.hasOwn(CLI_EXECUTOR_DRIVERS, toolId) ? CLI_EXECUTOR_DRIVERS[toolId]!() : undefined;
}
