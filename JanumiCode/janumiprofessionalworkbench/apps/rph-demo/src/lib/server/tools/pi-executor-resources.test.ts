// ⭐⭐ `JAN-EXEC` Phase 8 (the lead's delegated decision of 2026-10-15, to be registered; the E4 finisher's open question)
// — THE EXECUTOR'S LOADER IS TOLD TO LEAVE OUT WHAT PI WOULD ADD FROM AROUND THE WORKSPACE TO ITS INSTRUCTION, ITS TOOLS
// OR ITS TURNS: context files, an appended prompt, extensions, skills and prompt templates (`pi-executor-resources.ts`).
//
// ⭑ WHAT IT ASKS, AND WHERE PI'S OWN ANSWER LIVES. Each option is Pi's (`@earendil-works/pi-coding-agent` 0.80.6,
// `dist/core/resource-loader.js`, `DefaultResourceLoader.reload`): `noContextFiles` loads no `AGENTS.md` or `CLAUDE.md`;
// `noExtensions`, `noSkills` and `noPromptTemplates` keep only the paths a caller names, and this one names none; and the
// appended prompt is what `appendSystemPromptOverride` returns. ⭐ "Names none" is held too (the check of E4's polish
// round, F4): the options are exactly the nine this module sets, so a path, an override or an inline extension added
// beside them — each of which Pi takes past the switches — reddens here. ⛔ AND EVERY RESOURCE PI DECLARES IT CAN BE TOLD
// TO LEAVE OUT IS LEFT OUT BUT ITS THEMES, which colour Pi's own screen and reach no instruction — read off the installed
// Pi's own declaration of those options (`dist/core/resource-loader.d.ts`) with the TypeScript parser, so a kind of
// resource a Pi upgrade adds reddens here until someone decides about it. ⛔ AND `pi-executor.ts` builds its loader from
// these options alone — read as source, since importing it would load Pi. ⛔ AND THE ONE SETTINGS MANAGER IT MAKES TRUSTS
// NO PROJECT, and its loader and its session both take that one (the check of E4's polish round, F1): Pi trusts a
// project's `.pi/settings.json` by default, and a load installs a package it lists that is missing, by the command it
// names.
// ⭐⭐ AND THE AUTHORING AGENT'S LOADER IS THE SAME, CLOSED, WITH ITS OWN PROMPT (the lead's delegated decision of
// 2026-10-16, to be registered as REG-D-114): `closedResourceLoaderOptions` keeps the prompt it is given as the system
// prompt, with every switch the executor's options set, and `pi-agent.ts` — read as source, as `pi-executor.ts` is —
// builds its loader from it with `this.systemPrompt`, and makes one settings manager trusting no project, which its
// loader and its session both take.
// ⚠ PI-FREE: the coding agent is not loaded here~~ — the gate's one test that loads any part of Pi is
// `pi-execution-tools.test.ts`, its core loop alone~~. Pi's real loader and session were driven once, by hand, over a tree
// holding one of each resource (the commit that made this file quotes what they took)~~, and that is not repeated in the
// gate~~. ⭐ (R3-C) It is now: `pi-executor.test.ts` opens the executor's own session over Pi's real loader, in a
// workspace holding the files Pi would take, with a faux provider and no model, and reads its recorded composite.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { EXECUTION_CONTRACT_PROMPT } from '../execution/execution-contract.js';
import {
	closedResourceLoaderOptions,
	executorResourceLoaderOptions
} from './pi-executor-resources.js';

/** The options as `pi-executor.ts` builds them, over a stand-in settings manager: nothing here reads it. */
const OPTIONS = executorResourceLoaderOptions({
	cwd: 'the-workspace',
	agentDir: 'the-agent-folder',
	settingsManager: {} as never
}) as unknown as Readonly<Record<string, unknown>>;

/**
 * The boolean `no…` options Pi's `DefaultResourceLoaderOptions` declares, from the installed package's own `.d.ts` —
 * found where bun puts it, beside the app or hoisted to the repository's root, never imported.
 */
function declaredLeaveOuts(): string[] {
	const relative = 'node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.d.ts';
	const path = ['../../../../', '../../../../../../']
		.map((up) => fileURLToPath(new URL(`${up}${relative}`, import.meta.url)))
		.find((p) => existsSync(p));
	expect(path, 'arrangement: the installed Pi declares its loader options').toBeDefined();
	const source = ts.createSourceFile(
		path!,
		readFileSync(path!, 'utf8'),
		ts.ScriptTarget.Latest,
		true
	);
	const names: string[] = [];
	const visit = (node: ts.Node): void => {
		if (ts.isInterfaceDeclaration(node) && node.name.text === 'DefaultResourceLoaderOptions')
			for (const member of node.members)
				if (
					ts.isPropertySignature(member) &&
					ts.isIdentifier(member.name) &&
					/^no[A-Z]/.test(member.name.text) &&
					member.type?.kind === ts.SyntaxKind.BooleanKeyword
				)
					names.push(member.name.text);
		ts.forEachChild(node, visit);
	};
	visit(source);
	return names.sort();
}

/**
 * The `projectTrusted` an options argument gives, as a literal — or what stands there instead. ⚠ A spread is no
 * literal: one after the property may set it again.
 */
function projectTrustedOf(options: ts.Expression | undefined): boolean | string {
	if (options === undefined) return 'no options';
	if (!ts.isObjectLiteralExpression(options)) return 'not an object literal';
	if (options.properties.some(ts.isSpreadAssignment)) return 'a spread';
	const property = options.properties.find(
		(p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'projectTrusted'
	);
	if (property === undefined || !ts.isPropertyAssignment(property)) return 'absent';
	if (property.initializer.kind === ts.SyntaxKind.FalseKeyword) return false;
	if (property.initializer.kind === ts.SyntaxKind.TrueKeyword) return true;
	return 'not a literal';
}

/** The variable an options argument hands on as its `settingsManager` — or what stands there instead. */
function settingsManagerOf(options: ts.Expression | undefined): string {
	if (options === undefined || !ts.isObjectLiteralExpression(options))
		return 'not an object literal';
	if (options.properties.some(ts.isSpreadAssignment)) return 'a spread';
	const property = options.properties.find(
		(p) => p.name !== undefined && ts.isIdentifier(p.name) && p.name.text === 'settingsManager'
	);
	if (property === undefined) return 'absent';
	if (ts.isShorthandPropertyAssignment(property)) return property.name.text;
	if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer))
		return property.initializer.text;
	return 'something else';
}

/** A module beside this test, parsed — read as SOURCE, never imported (the tests that read one say why). */
function parsed(relative: string): ts.SourceFile {
	const path = fileURLToPath(new URL(relative, import.meta.url));
	return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
}

/** The one argument of every `new DefaultResourceLoader(…)` in `source` — undefined where there is not exactly one. */
function loaderArguments(source: ts.SourceFile): (ts.Expression | undefined)[] {
	const out: (ts.Expression | undefined)[] = [];
	const visit = (node: ts.Node): void => {
		if (
			ts.isNewExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === 'DefaultResourceLoader'
		) {
			const args = node.arguments ?? [];
			out.push(args.length === 1 ? args[0] : undefined);
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return out;
}

/** The function a loader's one argument calls — or what stands there instead. */
function calledBy(argument: ts.Expression | undefined): string {
	return argument !== undefined &&
		ts.isCallExpression(argument) &&
		ts.isIdentifier(argument.expression)
		? argument.expression.text
		: 'something else';
}

/** The `systemPrompt` a loader's options call hands on, as source text — or what stands there instead. */
function systemPromptOf(argument: ts.Expression | undefined, source: ts.SourceFile): string {
	const options =
		argument !== undefined && ts.isCallExpression(argument) ? argument.arguments[0] : undefined;
	if (options === undefined || !ts.isObjectLiteralExpression(options))
		return 'not an object literal';
	if (options.properties.some(ts.isSpreadAssignment)) return 'a spread';
	const property = options.properties.find(
		(p) => p.name !== undefined && ts.isIdentifier(p.name) && p.name.text === 'systemPrompt'
	);
	if (property === undefined) return 'absent';
	if (ts.isShorthandPropertyAssignment(property)) return property.name.text;
	return ts.isPropertyAssignment(property)
		? property.initializer.getText(source)
		: 'something else';
}

/**
 * Every `SettingsManager.…(…)` call in `source` — its method, the `projectTrusted` it gives and the variable it is bound
 * to — and the `settingsManager` that each call of a function `takerNames` names hands on.
 */
function settingsWiring(source: ts.SourceFile, takerNames: readonly string[]) {
	const managers: { method: string; projectTrusted: boolean | string; boundTo: string }[] = [];
	const takers: Record<string, string[]> = Object.fromEntries(takerNames.map((name) => [name, []]));
	const visit = (node: ts.Node): void => {
		if (ts.isCallExpression(node)) {
			const callee = node.expression;
			if (
				ts.isPropertyAccessExpression(callee) &&
				ts.isIdentifier(callee.expression) &&
				callee.expression.text === 'SettingsManager'
			)
				managers.push({
					method: callee.name.text,
					projectTrusted: projectTrustedOf(node.arguments[2]),
					boundTo:
						ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)
							? node.parent.name.text
							: 'nothing'
				});
			if (ts.isIdentifier(callee) && Object.hasOwn(takers, callee.text))
				takers[callee.text]!.push(settingsManagerOf(node.arguments[0]));
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return { managers, takers };
}

describe('⭐ the executor’s resource loader (the lead’s delegated decision of 2026-10-15, to be registered)', () => {
	it('⭐ leaves out the context files, extensions, skills and prompt templates, appends nothing, and keeps the contract as the system prompt', () => {
		expect({
			noContextFiles: OPTIONS.noContextFiles,
			noExtensions: OPTIONS.noExtensions,
			noSkills: OPTIONS.noSkills,
			noPromptTemplates: OPTIONS.noPromptTemplates
		}).toEqual({
			noContextFiles: true,
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true
		});
		const append = OPTIONS.appendSystemPromptOverride as ((base: string[]) => string[]) | undefined;
		expect(append?.(['APPEND_SYSTEM.md, as Pi found it']), 'what Pi would append').toEqual([]);
		const system = OPTIONS.systemPromptOverride as
			((base: string | undefined) => string | undefined) | undefined;
		expect(
			system?.('SYSTEM.md, as Pi found it') === EXECUTION_CONTRACT_PROMPT,
			'the system prompt is the contract'
		).toBe(true);
	});

	it('⛔ names nothing beside them — no path, override or inline extension: the options are exactly the nine it sets', () => {
		// ⭑ Each switch keeps only what a caller names, so what the options NAME is the other half of what they leave out.
		// In Pi's reload an extension path a caller names loads under `noExtensions`, and so does an inline extension
		// (`extensionFactories`); a skill or prompt-template path merges in under `noSkills` and `noPromptTemplates`; and
		// `agentsFilesOverride` applies after `noContextFiles` (`dist/core/resource-loader.js`, `reload`,
		// `loadFinalExtensionSet`) — so one more key here could undo a switch above while the switch still reads true.
		expect(Object.keys(OPTIONS).sort()).toEqual([
			'agentDir',
			'appendSystemPromptOverride',
			'cwd',
			'noContextFiles',
			'noExtensions',
			'noPromptTemplates',
			'noSkills',
			'settingsManager',
			'systemPromptOverride'
		]);
	});

	it('⛔ every resource the installed Pi declares it can be told to leave out is left out — but its themes, which reach no instruction', () => {
		const declared = declaredLeaveOuts();
		// ⭑ CONTROL: the declaration was found and read — the context files' option among what it names.
		expect(declared).toContain('noContextFiles');
		expect(declared.filter((name) => name !== 'noThemes' && OPTIONS[name] !== true)).toEqual([]);
	});

	it('⛔ pi-executor.ts builds its loader from these options, and from nothing else', () => {
		// ⭑ Read as SOURCE, never imported: that module loads Pi's coding agent at module scope — as
		// `model-loads-pi-lazily.test.ts` reads `model.ts`, and for the same reason. Every `new DefaultResourceLoader(…)` in it
		// must take exactly one argument, a call of `executorResourceLoaderOptions`.
		expect(loaderArguments(parsed('./pi-executor.ts')).map(calledBy)).toEqual([
			'executorResourceLoaderOptions'
		]);
	});

	it('⛔ pi-executor.ts trusts no project’s settings: its one settings manager is made with projectTrusted false, and its loader and its session take that one', () => {
		// ⭑ Read as SOURCE, as above. Pi trusts a project's `.pi/settings.json` unless told otherwise
		// (`dist/core/settings-manager.js`, `projectTrusted ?? true`), and a session handed no manager makes its own, at
		// that default (`dist/core/sdk.js`, `createAgentSession`). Trusted, the workspace's settings are read on every load,
		// and a package they list that is missing is installed, by the command they name (the check of E4's polish round,
		// F1).
		expect(
			settingsWiring(parsed('./pi-executor.ts'), [
				'executorResourceLoaderOptions',
				'createAgentSession'
			])
		).toEqual({
			managers: [{ method: 'create', projectTrusted: false, boundTo: 'settingsManager' }],
			takers: {
				executorResourceLoaderOptions: ['settingsManager'],
				createAgentSession: ['settingsManager']
			}
		});
	});
});

describe('⭐ the authoring agent’s resource loader (the lead’s delegated decision of 2026-10-16, to be registered as REG-D-114)', () => {
	it('⭐ closedResourceLoaderOptions keeps the prompt it is given as the system prompt, appends nothing, and leaves out the context files, extensions, skills and prompt templates', () => {
		const prompt = 'the authoring agent’s own system prompt';
		const closed = closedResourceLoaderOptions({
			cwd: 'the-server-folder',
			agentDir: 'the-agent-folder',
			settingsManager: {} as never,
			systemPrompt: prompt
		}) as unknown as Readonly<Record<string, unknown>>;
		const system = closed.systemPromptOverride as
			((base: string | undefined) => string | undefined) | undefined;
		expect(system?.('SYSTEM.md, as Pi found it'), 'the system prompt is the one it was given').toBe(
			prompt
		);
		const append = closed.appendSystemPromptOverride as ((base: string[]) => string[]) | undefined;
		expect(append?.(['APPEND_SYSTEM.md, as Pi found it']), 'what Pi would append').toEqual([]);
		expect({
			noContextFiles: closed.noContextFiles,
			noExtensions: closed.noExtensions,
			noSkills: closed.noSkills,
			noPromptTemplates: closed.noPromptTemplates
		}).toEqual({
			noContextFiles: true,
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true
		});
		// ⭑ And it names nothing beside them, for the reason the executor's test above gives: its keys are the nine.
		expect(Object.keys(closed).sort()).toEqual(Object.keys(OPTIONS).sort());
	});

	it('⛔ pi-agent.ts builds its loader from closedResourceLoaderOptions, with its own system prompt, and from nothing else', () => {
		// ⭑ Read as SOURCE, never imported: `pi-agent.ts` loads Pi's coding agent at module scope, as `pi-executor.ts`
		// does. ⚠ The prompt it hands on is held as written: an empty one would give Pi no prompt to override with, and Pi
		// would build its own coding agent's instead (`dist/core/system-prompt.js`, `buildSystemPrompt`).
		const source = parsed('../agent/pi-agent.ts');
		expect(
			loaderArguments(source).map((argument) => ({
				calls: calledBy(argument),
				systemPrompt: systemPromptOf(argument, source)
			}))
		).toEqual([{ calls: 'closedResourceLoaderOptions', systemPrompt: 'this.systemPrompt' }]);
	});

	it('⛔ pi-agent.ts trusts no project’s settings: its one settings manager is made with projectTrusted false, and its loader and its session take that one', () => {
		// ⭑ Read as SOURCE, as above. The project is the server's own folder (`process.cwd()`): trusted, its
		// `.pi/settings.json` was read on every run — a default model named there chose this agent's, where
		// `JPWB_AGENT_MODEL` named none, and a package listed there that was missing was installed, by the npm command
		// named there.
		expect(
			settingsWiring(parsed('../agent/pi-agent.ts'), [
				'closedResourceLoaderOptions',
				'createAgentSession'
			])
		).toEqual({
			managers: [{ method: 'create', projectTrusted: false, boundTo: 'settingsManager' }],
			takers: {
				closedResourceLoaderOptions: ['settingsManager'],
				createAgentSession: ['settingsManager']
			}
		});
	});
});
