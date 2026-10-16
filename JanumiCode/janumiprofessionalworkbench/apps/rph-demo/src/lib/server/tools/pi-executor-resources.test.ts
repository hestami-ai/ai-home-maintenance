// ⭐⭐ `JAN-EXEC` Phase 8 (the lead's delegated decision of 2026-10-15, to be registered; the E4 finisher's open question)
// — THE EXECUTOR'S LOADER IS TOLD TO LEAVE OUT WHAT PI WOULD ADD FROM AROUND THE WORKSPACE TO ITS INSTRUCTION, ITS TOOLS
// OR ITS TURNS: context files, an appended prompt, extensions, skills and prompt templates (`pi-executor-resources.ts`).
//
// ⭑ WHAT IT ASKS, AND WHERE PI'S OWN ANSWER LIVES. Each option is Pi's (`@earendil-works/pi-coding-agent` 0.80.6,
// `dist/core/resource-loader.js`, `DefaultResourceLoader.reload`): `noContextFiles` loads no `AGENTS.md` or `CLAUDE.md`;
// `noExtensions`, `noSkills` and `noPromptTemplates` keep only the paths a caller names, and this one names none; and the
// appended prompt is what `appendSystemPromptOverride` returns. ⛔ AND EVERY RESOURCE PI DECLARES IT CAN BE TOLD TO LEAVE
// OUT IS LEFT OUT BUT ITS THEMES, which colour Pi's own screen and reach no instruction — read off the installed Pi's own
// declaration of those options (`dist/core/resource-loader.d.ts`) with the TypeScript parser, so a kind of resource a Pi
// upgrade adds reddens here until someone decides about it. ⛔ AND `pi-executor.ts` builds its loader from these options
// alone — read as source, since importing it would load Pi. ⛔ AND THE ONE SETTINGS MANAGER IT MAKES TRUSTS NO PROJECT,
// and its loader and its session both take that one (the check of E4's polish round, F1): Pi trusts a project's
// `.pi/settings.json` by default, and a load installs the packages it lists, running the command it names.
// ⚠ PI-FREE: the coding agent is not loaded here — the gate's one test that loads any part of Pi is
// `pi-execution-tools.test.ts`, its core loop alone. Pi's real loader and session were driven once, by hand, over a tree
// holding one of each resource (the commit that made this file quotes what they took), and that is not repeated in the
// gate.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { EXECUTION_CONTRACT_PROMPT } from '../execution/execution-contract.js';
import { executorResourceLoaderOptions } from './pi-executor-resources.js';

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

/** The `projectTrusted` an options argument gives, as a literal — or what stands there instead. */
function projectTrustedOf(options: ts.Expression | undefined): boolean | string {
	if (options === undefined) return 'no options';
	if (!ts.isObjectLiteralExpression(options)) return 'not an object literal';
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
		const path = fileURLToPath(new URL('./pi-executor.ts', import.meta.url));
		const source = ts.createSourceFile(
			path,
			readFileSync(path, 'utf8'),
			ts.ScriptTarget.Latest,
			true
		);
		const loaders: string[] = [];
		const visit = (node: ts.Node): void => {
			if (
				ts.isNewExpression(node) &&
				ts.isIdentifier(node.expression) &&
				node.expression.text === 'DefaultResourceLoader'
			) {
				const args = node.arguments ?? [];
				const only = args.length === 1 ? args[0] : undefined;
				loaders.push(
					only !== undefined && ts.isCallExpression(only) && ts.isIdentifier(only.expression)
						? only.expression.text
						: 'something else'
				);
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
		expect(loaders).toEqual(['executorResourceLoaderOptions']);
	});

	it('⛔ pi-executor.ts trusts no project’s settings: its one settings manager is made with projectTrusted false, and its loader and its session take that one', () => {
		// ⭑ Read as SOURCE, as above. Pi trusts a project's `.pi/settings.json` unless told otherwise
		// (`dist/core/settings-manager.js`, `projectTrusted ?? true`), and a session handed no manager makes its own, at
		// that default (`dist/core/sdk.js`, `createAgentSession`). Trusted, the workspace's settings are read on every load,
		// and the packages they list installed, by the command they name (the check of E4's polish round, F1).
		const path = fileURLToPath(new URL('./pi-executor.ts', import.meta.url));
		const source = ts.createSourceFile(
			path,
			readFileSync(path, 'utf8'),
			ts.ScriptTarget.Latest,
			true
		);
		const managers: { method: string; projectTrusted: boolean | string; boundTo: string }[] = [];
		const takers: Record<string, string[]> = {
			executorResourceLoaderOptions: [],
			createAgentSession: []
		};
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
		expect({ managers, takers }).toEqual({
			managers: [{ method: 'create', projectTrusted: false, boundTo: 'settingsManager' }],
			takers: {
				executorResourceLoaderOptions: ['settingsManager'],
				createAgentSession: ['settingsManager']
			}
		});
	});
});
