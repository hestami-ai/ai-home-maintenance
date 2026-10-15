// ⭐⭐ `JAN-EXEC` Phase 8 (the lead's delegated decision of 2026-10-15, to be registered; the E4 finisher's open question)
// — WHAT PI'S RESOURCE LOADER GIVES THE EXECUTOR: the execution contract, and nothing it finds around the workspace.
//
// ⛔ WHAT IT GAVE BEFORE, THE CONTRACT ALONE OVERRIDING THE SYSTEM PROMPT (`@earendil-works/pi-coding-agent` 0.80.6):
//   · CONTEXT FILES — `AGENTS.md` or `CLAUDE.md` from Pi's agent folder, and from the working folder and every folder
//     above it, folded into the instruction after the contract (`dist/core/resource-loader.js`,
//     `loadProjectContextFiles`; `dist/core/system-prompt.js`, `buildSystemPrompt`);
//   · AN APPENDED PROMPT — `APPEND_SYSTEM.md` from the agent folder, or from the project's `.pi/` when its settings are
//     trusted, appended under the override with no block to mark it (`discoverAppendSystemPromptFile`);
//   · EXTENSIONS — code from the agent folder, the project's `.pi/` and the packages the settings list, loaded into the
//     server: the tools they register become active beside the minted ones (`dist/core/agent-session.js`,
//     `_refreshToolRegistry`, `includeAllExtensionTools`), and their hooks may rewrite a turn, the system prompt, a
//     provider payload or a tool's result (`dist/core/extensions/runner.js`);
//   · SKILLS AND PROMPT TEMPLATES — which a turn beginning with `/` expands (`AgentSession.prompt`).
// The live lane refused some of these around a run's folder (`e2e-live-exec/run-folder.ts`, `REG-F-512`), the run
// archive reported others (`scripts/phase7/run-archive.ts`, K4), and the replay's keys would name stale a recording
// whose instruction or tools held one (`replay/recording.ts`).
// ⭐ NOW EACH IS SWITCHED OFF HERE, AT THE LOADER, so the executor's instruction is exactly the execution contract — with
// Pi's own date and working-directory lines after it — and its tools are exactly the minted ones.
// ⚠ IT CHANGES THE EXECUTOR'S BEHAVIOUR, and that is the point: a context file, an appended prompt, an extension, a skill
// or a prompt template no longer reaches the executor, wherever it lies. `SYSTEM.md` was already replaced by the override.
// ⚠ AND WHAT IT DOES NOT SWITCH OFF, each an open question of the E4 polish round:
//   · PI'S SETTINGS are still read, the workspace's `.pi/settings.json` among them — `SettingsManager.create` trusts a
//     project's by default — and each load still resolves the packages they list, fetching a missing one by npm or git
//     unless `PI_OFFLINE` is set (`dist/core/package-manager.js`, `resolve`), though nothing in one reaches the executor;
//   · THE WORKING-DIRECTORY LINE names the server's folder, not the workspace: `pi-executor.ts` gives its session no
//     folder (`SessionManager.inMemory()`), so the session takes `process.cwd()` (`dist/core/sdk.js`).
// ⭑ A PI-FREE MODULE, as `pi-execution-tools.ts` is: it imports Pi's types alone, so its test loads no part of Pi —
// `pi-executor.ts` loads the coding agent at module scope, and the gate's one test that loads any of Pi is
// `pi-execution-tools.test.ts`, its core loop alone. Pi's real loader and session were driven over these options once,
// by hand (the commit that made this file quotes what they took).
import type { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';
import { EXECUTION_CONTRACT_PROMPT } from '../execution/execution-contract.js';

/** What `pi-executor.ts` hands Pi's `DefaultResourceLoader` for an executor session. */
export function executorResourceLoaderOptions(o: {
	readonly cwd: string;
	readonly agentDir: string;
	readonly settingsManager: SettingsManager;
}): ConstructorParameters<typeof DefaultResourceLoader>[0] {
	return {
		cwd: o.cwd,
		agentDir: o.agentDir,
		settingsManager: o.settingsManager,
		systemPromptOverride: () => EXECUTION_CONTRACT_PROMPT,
		// ⭐ Each below was Pi's default until the lead's delegated decision of 2026-10-15, to be registered.
		appendSystemPromptOverride: () => [],
		noContextFiles: true,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true
	};
}
