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
//   · PI'S SETTINGS are still read — ⭐ the agent folder's, the operator's own, and no longer the workspace's (below) —
//     and each load still resolves the packages they list, fetching a missing one by npm or git unless `PI_OFFLINE` is
//     set (`dist/core/package-manager.js`, `resolve`), ~~though nothing in one reaches the executor~~ ⭐ (the check of
//     E4's polish round) and installing it ON THE HOST: npm runs the package's install scripts, and npm and git run
//     with the server's whole environment (`getEnv`, `spawnCommand`) — the model-provider keys among it, which the real
//     runner withholds from every command (`child-process-runner.ts`). The settings may also name npm's command
//     (`npmCommand`), which Pi then runs in npm's place — even under `PI_OFFLINE`, to find npm's global folder,
//     whenever the agent folder's settings list an npm package Pi's folder does not hold (`getGlobalNpmRoot`).
//     ⛔ THE WORKSPACE'S SETTINGS WERE AMONG THEM UNTIL THAT CHECK'S F1 WAS FIXED: Pi trusts a project's
//     `.pi/settings.json` by default (`SettingsManager.create`), and the executor can write that file — one unit's
//     `write_file` of it was read by every later unit's session, whose load installed what it listed and was missing,
//     by the command it named. ⭐ NOW `pi-executor.ts` makes its settings manager trusting no project
//     (`projectTrusted: false`), and the workspace's settings are not read at all. Driven by hand, 2026-10-15, over Pi's
//     real loader with these options and a workspace whose settings listed a package and named a stand-in command:
//     trusted, the command ran and saw a variable of the loading process's environment — under `PI_OFFLINE` too, where
//     the agent folder listed a package Pi's folder did not hold; untrusted, the workspace's settings read as empty and
//     no command ran, offline or not. ⭐ (R3-C) The live lanes' server sets `PI_OFFLINE` (`playwright.live-exec.config.ts`
//     says what that changes), so there a missing package the agent folder's settings list is not fetched;
//   · THE WORKING-DIRECTORY LINE names the server's folder, not the workspace: `pi-executor.ts` gives its session no
//     folder (`SessionManager.inMemory()`), so the session takes `process.cwd()` (`dist/core/sdk.js`).
// ⭐⭐ AND THE AUTHORING AGENT'S PI NOW TAKES THE SAME CLOSED OPTIONS (the lead's delegated decision of 2026-10-16, to be
// registered as REG-D-114; `REG-F-512`): `pi-agent.ts` builds its loader from `closedResourceLoaderOptions` with its own
// system prompt, and its settings manager trusts no project. ⚠ IT CHANGES THE AUTHORING AGENT'S BEHAVIOUR: `pi-agent.ts`
// says what it took by Pi's defaults until then.
// ⭑ A PI-FREE MODULE, as `pi-execution-tools.ts` is: it imports Pi's types alone, so its test loads no part of Pi —
// `pi-executor.ts` loads the coding agent at module scope~~, and the gate's one test that loads any of Pi is
// `pi-execution-tools.test.ts`, its core loop alone~~. Pi's real loader and session were driven over these options once,
// by hand (the commit that made this file quotes what they took). ⭐ (R3-C, `REG-F-512`'s predicted red) And now in the
// gate: `pi-executor.test.ts` opens the executor's own session over Pi's real loader, in a workspace holding the files
// Pi would take, with a faux provider and no model, and reads what its recorded composite carries.
import type { DefaultResourceLoader, SettingsManager } from '@earendil-works/pi-coding-agent';
import { EXECUTION_CONTRACT_PROMPT } from '../execution/execution-contract.js';

/**
 * What a session's `DefaultResourceLoader` is handed when its instruction is to be `systemPrompt`, with Pi's own date
 * and working-directory lines after it, and nothing Pi finds around `cwd` or in its agent folder. The executor's
 * (`executorResourceLoaderOptions`, below) and the authoring agent's (`pi-agent.ts`).
 */
export function closedResourceLoaderOptions(o: {
	readonly cwd: string;
	readonly agentDir: string;
	readonly settingsManager: SettingsManager;
	readonly systemPrompt: string;
}): ConstructorParameters<typeof DefaultResourceLoader>[0] {
	return {
		cwd: o.cwd,
		agentDir: o.agentDir,
		settingsManager: o.settingsManager,
		systemPromptOverride: () => o.systemPrompt,
		// ⭐ Each below was Pi's default until the lead's delegated decision of 2026-10-15, to be registered — and the
		// authoring agent's until the lead's delegated decision of 2026-10-16 (to be registered as REG-D-114).
		appendSystemPromptOverride: () => [],
		noContextFiles: true,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true
	};
}

/** What `pi-executor.ts` hands Pi's `DefaultResourceLoader` for an executor session: the execution contract, closed. */
export function executorResourceLoaderOptions(o: {
	readonly cwd: string;
	readonly agentDir: string;
	readonly settingsManager: SettingsManager;
}): ConstructorParameters<typeof DefaultResourceLoader>[0] {
	return closedResourceLoaderOptions({ ...o, systemPrompt: EXECUTION_CONTRACT_PROMPT });
}
