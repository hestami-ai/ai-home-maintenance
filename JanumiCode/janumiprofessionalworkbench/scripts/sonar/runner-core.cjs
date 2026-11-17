// @ts-check
'use strict';
/**
 * The Sonar runner's decisions, apart from its input and output (JAN-SONARCM D-1; roadmap S1).
 *
 * `batch-runner.cjs` drives the SonarLint language server; every judgment it makes is a function here, so the gate can
 * test each one without starting an engine (`verif/sonar-runner.test.ts`):
 * - THE ENGINE (V-1). The extension is the one whose own `package.json` names the matrix's pinned version, never the
 *   highest installed. The language server, SonarJS and the bundled JRE it carries must equal their matrix rows
 *   (`check: "runner"`). Anything else is refused by name, both versions in the message.
 * - THE RULE SET (V-4). `rules.json` lists the rules to run. The server's settings are changes against its defaults
 *   (F-3), so the runner asks the server for them (`sonarlint/listAllRules`) and sends the differences: rules listed but
 *   off by default, on; defaults of the governed repositories not listed, off; and the listed parameters. A listed rule
 *   the engine does not have is refused. The server's echo of what it applied must equal what was sent.
 * - THE SCOPE (V-3). The census (`scope-census.json`, written from `sonar-project.properties`) names the files; a file
 *   outside it is refused. The properties' tsconfig globs go to the server as an analyzer property, and the server's
 *   own list of the tsconfigs it found must equal the census's.
 * - THE OUTPUT (V-20, J4). A run writes into a new, empty folder. Resuming is explicit and reuses a file's result only
 *   when the file's bytes, the engine, the rule set and the census are all unchanged. A listed file with no fresh
 *   result is reported as not analysed, never skipped in silence.
 *
 * No machine path is written here or in any file of this folder (V-2): locations come from
 * `scripts/toolchain/machine-paths.json`, relative to the profile or an environment variable.
 */

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RULE_SET_SCHEMA = 'jpwb-sonar-rule-set/1';
const CENSUS_SCHEMA = 'jpwb-sonar-scope-census/1';
const RUN_SCHEMA = 'jpwb-sonar-run/1';

/** The runner's exit codes. */
const EXIT = Object.freeze({ OK: 0, REFUSED: 2, NOTHING: 3, INCOMPLETE: 4 });

/** A refusal: the run cannot be trusted, so it does not start or does not go on (exit 2). */
class Refusal extends Error {
	/** @param {string} message */
	constructor(message) {
		super(message);
		this.name = 'Refusal';
	}
}

// ── the engine ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ extension: string, languageServer: string, sonarjs: string, jre: string, node: string }} Pins
 * @typedef {{ languageServer: string, jre: string, javaBin: string, analyzers: string, analyzerJars: string[], eslintBridge: string }} Layout
 * @typedef {{ roots: string[], extensionDir: string, layout: Layout }} SonarLintPaths
 */

/**
 * The engine the matrix pins: the extension's version, the three rows it bundles and the day-to-day Node.
 * @param {any} matrix the parsed `scripts/toolchain/matrix.json`
 * @returns {Pins}
 */
function pinsFromMatrix(matrix) {
	/** @param {string} component */
	const observed = (component) => {
		const row = (matrix?.machine ?? []).find((/** @type {any} */ m) => m?.component === component);
		if (typeof row?.observed !== 'string' || row.observed === '') throw new Refusal(`the matrix has no ${component} row`);
		return row.observed;
	};
	const node = matrix?.node?.dayToDay;
	if (typeof node !== 'string' || node === '') throw new Refusal('the matrix records no day-to-day Node');
	return {
		extension: observed('sonarlint'),
		languageServer: observed('sonarlint-language-server'),
		sonarjs: observed('sonarjs'),
		jre: observed('sonarlint-jre'),
		node
	};
}

/**
 * The SonarLint locations in `machine-paths.json`, refused when a part the runner needs is missing.
 * @param {any} machinePaths
 * @returns {SonarLintPaths}
 */
function sonarLintPaths(machinePaths) {
	const s = machinePaths?.sonarlint;
	const layout = s?.layout;
	const text = ['languageServer', 'jre', 'javaBin', 'analyzers', 'eslintBridge'];
	const missing = text.filter((k) => typeof layout?.[k] !== 'string' || layout[k] === '');
	if (!Array.isArray(s?.roots) || s.roots.length === 0) missing.push('roots');
	if (typeof s?.extensionDir !== 'string') missing.push('extensionDir');
	if (!Array.isArray(layout?.analyzerJars) || layout.analyzerJars.length === 0) missing.push('analyzerJars');
	if (missing.length > 0) throw new Refusal(`machine-paths.json: sonarlint lacks ${missing.join(', ')}`);
	return { roots: s.roots, extensionDir: s.extensionDir, layout };
}

/**
 * A root as T0's `machine.ts` expands it: `~/x` is the profile's `x`, `%VAR%/x` that variable's `x`; anything else,
 * or an unset variable, is undefined (a root naming a user is refused by `toolchain:check` before this runs).
 * @param {string} root
 * @param {NodeJS.ProcessEnv} env
 * @param {string} home
 * @returns {string | undefined}
 */
function expandRoot(root, env, home) {
	if (root.startsWith('~')) return path.join(home, root.slice(1));
	const m = /^%([^%]+)%(.*)$/.exec(root);
	if (m === null) return undefined;
	const base = env[m[1] ?? ''];
	return base === undefined || base === '' ? undefined : path.join(base, m[2] ?? '');
}

/**
 * The JRE's version, from its `release` file's `JAVA_VERSION`.
 * @param {string} releaseFile
 * @returns {string | undefined}
 */
function javaVersionOf(releaseFile) {
	if (!fs.existsSync(releaseFile)) return undefined;
	const m = /^JAVA_VERSION="([^"]+)"/m.exec(fs.readFileSync(releaseFile, 'utf8'));
	return m?.[1];
}

/**
 * @typedef {{ dir: string, version: string, languageServer: string | undefined, sonarjs: string | undefined,
 *   jre: string | undefined, jreDir: string | undefined, jreFolders: string[] }} ExtensionFacts
 */

/**
 * What one extension folder says about itself: its version, the two jars it bundles and its JRE.
 * @param {string} dir
 * @param {Layout} layout
 * @returns {ExtensionFacts}
 */
function extensionFacts(dir, layout) {
	const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
	/** @param {string} artifactId */
	const jar = (artifactId) => (manifest.jarDependencies ?? []).find((/** @type {any} */ d) => d?.artifactId === artifactId)?.version;
	const jreRoot = path.join(dir, layout.jre);
	const jreFolders = fs.existsSync(jreRoot) ? fs.readdirSync(jreRoot) : [];
	const jreDir = jreFolders.length === 1 ? path.join(jreRoot, jreFolders[0] ?? '') : undefined;
	return {
		dir,
		version: String(manifest.version ?? ''),
		languageServer: jar('sonarlint-language-server'),
		sonarjs: jar('sonar-javascript-plugin'),
		jre: jreDir === undefined ? undefined : javaVersionOf(path.join(jreDir, 'release')),
		jreDir,
		jreFolders
	};
}

/**
 * Every SonarLint extension folder under the roots, with what each says of itself.
 * @param {SonarLintPaths} paths
 * @param {NodeJS.ProcessEnv} env
 * @param {string} home
 * @returns {ExtensionFacts[]}
 */
function installedExtensions(paths, env, home) {
	const pattern = new RegExp(paths.extensionDir);
	/** @type {ExtensionFacts[]} */
	const found = [];
	for (const root of paths.roots) {
		const dir = expandRoot(root, env, home);
		if (dir === undefined || !fs.existsSync(dir)) continue;
		for (const name of fs.readdirSync(dir).filter((n) => pattern.test(n))) {
			if (fs.existsSync(path.join(dir, name, 'package.json'))) found.push(extensionFacts(path.join(dir, name), paths.layout));
		}
	}
	return found;
}

/**
 * Each way the pinned extension's bundle differs from the matrix, in words that name both versions.
 * @param {ExtensionFacts} ext
 * @param {Pins} pins
 * @returns {string[]}
 */
function bundleProblems(ext, pins) {
	const problems = [];
	const at = `the SonarLint ${ext.version} extension at ${ext.dir}`;
	if (ext.languageServer !== pins.languageServer) {
		problems.push(`${at} bundles language server ${ext.languageServer ?? '(none named)'}; the matrix pins ${pins.languageServer}`);
	}
	if (ext.sonarjs !== pins.sonarjs) problems.push(`${at} bundles SonarJS ${ext.sonarjs ?? '(none named)'}; the matrix pins ${pins.sonarjs}`);
	if (ext.jreDir === undefined) problems.push(`${at} holds ${ext.jreFolders.length} JRE folders, not one`);
	else if (ext.jre !== pins.jre) problems.push(`${at} bundles JRE ${ext.jre ?? '(no JAVA_VERSION)'}; the matrix pins ${pins.jre}`);
	return problems;
}

/**
 * @typedef {{ dir: string, java: string, languageServer: string, analyzers: string[], eslintBridge: string,
 *   versions: { extension: string, languageServer: string, sonarjs: string, jre: string } }} Engine
 */

/**
 * The pinned engine, or a refusal naming what differs (V-1). Never the highest installed: the one whose own
 * `package.json` names the pinned version, and then only if all it bundles is pinned too.
 * @param {SonarLintPaths} paths
 * @param {Pins} pins
 * @param {{ env?: NodeJS.ProcessEnv, home?: string, platform?: string }} [where]
 * @returns {Engine}
 */
function findEngine(paths, pins, where = {}) {
	const env = where.env ?? process.env;
	const home = where.home ?? os.homedir();
	const all = installedExtensions(paths, env, home);
	const pinned = all.filter((e) => e.version === pins.extension);
	if (pinned.length !== 1) {
		const seen = all.map((e) => `${e.version} (${path.basename(e.dir)})`).join(', ') || 'none';
		const how = pinned.length === 0 ? 'is not installed' : `is installed ${pinned.length} times`;
		throw new Refusal(`SonarLint ${pins.extension}, the matrix's pin, ${how} under ${paths.roots.join(', ')}: found ${seen}`);
	}
	const ext = /** @type {ExtensionFacts} */ (pinned[0]);
	const problems = bundleProblems(ext, pins);
	if (problems.length > 0) throw new Refusal(problems.join('; '));
	const l = paths.layout;
	const java = path.join(/** @type {string} */ (ext.jreDir), l.javaBin, (where.platform ?? process.platform) === 'win32' ? 'java.exe' : 'java');
	const languageServer = path.join(ext.dir, l.languageServer);
	const eslintBridge = path.join(ext.dir, l.eslintBridge);
	const missing = [java, languageServer, eslintBridge].filter((p) => !fs.existsSync(p));
	if (missing.length > 0) throw new Refusal(`the SonarLint ${ext.version} extension lacks ${missing.join(', ')}`);
	const analyzers = l.analyzerJars.map((n) => path.join(ext.dir, l.analyzers, `${n}.jar`)).filter((p) => fs.existsSync(p));
	return {
		dir: ext.dir,
		java,
		languageServer,
		analyzers,
		eslintBridge,
		versions: { extension: ext.version, languageServer: pins.languageServer, sonarjs: pins.sonarjs, jre: pins.jre }
	};
}

/**
 * The runner runs on node, at the matrix's day-to-day version: it hands its own executable to the server as the
 * bridge's Node, so this Node is part of the engine. Bun is refused (it reports a Node version it is not).
 * @param {Pins} pins
 * @param {NodeJS.ProcessVersions} versions
 * @returns {string | undefined} the refusal, or undefined
 */
function nodeProblem(pins, versions) {
	if (versions.bun !== undefined) return `the runner runs under Bun ${versions.bun}; run it with node ${pins.node}`;
	if (versions.node !== pins.node) return `the runner runs on Node ${versions.node}; the matrix's day-to-day Node is ${pins.node}`;
	return undefined;
}

// ── the rule set ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ schema: string, repositories: string[], rules: string[], parameters: Record<string, Record<string, string>> }} RuleSet
 */

/**
 * Every reason a parsed rule set is unusable; empty when it is usable.
 * @param {any} raw
 * @returns {string[]}
 */
function ruleSetProblems(raw) {
	if (raw === null || typeof raw !== 'object') return ['the rule set is not a JSON object'];
	const problems = [];
	if (raw.schema !== RULE_SET_SCHEMA) problems.push(`schema is ${JSON.stringify(raw.schema)}, not ${RULE_SET_SCHEMA}`);
	const repos = Array.isArray(raw.repositories) ? raw.repositories : [];
	if (repos.length === 0 || repos.some((/** @type {unknown} */ r) => typeof r !== 'string' || r === '')) problems.push('repositories is not a list of names');
	const rules = Array.isArray(raw.rules) ? raw.rules : [];
	if (rules.length === 0) problems.push('rules is empty: a rule set with no rules analyses nothing (J4)');
	const seen = new Set();
	for (const key of rules) {
		if (typeof key !== 'string' || !repos.includes(key.slice(0, key.indexOf(':')))) problems.push(`rule ${JSON.stringify(key)} is not in a listed repository`);
		else if (seen.has(key)) problems.push(`rule ${key} is listed twice`);
		seen.add(key);
	}
	const params = raw.parameters;
	if (params === null || typeof params !== 'object' || Array.isArray(params)) problems.push('parameters is not an object');
	else problems.push(...parameterProblems(params, seen));
	return problems;
}

/**
 * @param {Record<string, unknown>} params
 * @param {Set<unknown>} listed
 * @returns {string[]}
 */
function parameterProblems(params, listed) {
	const problems = [];
	for (const [key, values] of Object.entries(params)) {
		if (!listed.has(key)) problems.push(`parameters name ${key}, which the rule set does not list`);
		const bad = values === null || typeof values !== 'object' || Object.values(values).some((v) => typeof v !== 'string');
		if (bad) problems.push(`parameters of ${key} are not text values`);
	}
	return problems;
}

/**
 * @param {string} text
 * @returns {RuleSet}
 */
function parseRuleSet(text) {
	const raw = JSON.parse(text);
	const problems = ruleSetProblems(raw);
	if (problems.length > 0) throw new Refusal(`the rule set is not usable: ${problems.join('; ')}`);
	return raw;
}

/**
 * @typedef {{ all: Set<string>, defaults: Set<string> }} Catalogue
 */

/**
 * The engine's rules in the governed repositories, and those on by default, from the server's answer to
 * `sonarlint/listAllRules` (a map from language to its rules, each with `key` and `activeByDefault`).
 * @param {any} answer
 * @param {readonly string[]} repositories
 * @returns {Catalogue}
 */
function catalogueOf(answer, repositories) {
	/** @type {Set<string>} */
	const all = new Set();
	/** @type {Set<string>} */
	const defaults = new Set();
	for (const rules of Object.values(answer ?? {})) {
		for (const rule of Array.isArray(rules) ? rules : []) {
			const key = rule?.key;
			if (typeof key !== 'string' || !repositories.includes(key.slice(0, key.indexOf(':')))) continue;
			all.add(key);
			if (rule.activeByDefault === true) defaults.add(key);
		}
	}
	if (all.size === 0) throw new Refusal(`the server listed no rule in ${repositories.join(', ')}`);
	return { all, defaults };
}

/**
 * @typedef {{ included: string[], excluded: string[], parameters: Record<string, Record<string, string>> }} RuleDiff
 */

/**
 * What the server must be told: the differences between the rule set and the engine's defaults (D-1). A listed rule
 * the engine does not have is refused by name.
 * @param {RuleSet} ruleSet
 * @param {Catalogue} catalogue
 * @returns {RuleDiff}
 */
function rulesDiff(ruleSet, catalogue) {
	const listed = new Set(ruleSet.rules);
	const unknown = ruleSet.rules.filter((k) => !catalogue.all.has(k));
	if (unknown.length > 0) throw new Refusal(`the rule set names rules this engine does not have: ${unknown.join(', ')}`);
	return {
		included: ruleSet.rules.filter((k) => !catalogue.defaults.has(k)).sort(byCodePoint),
		excluded: [...catalogue.defaults].filter((k) => !listed.has(k)).sort(byCodePoint),
		parameters: ruleSet.parameters
	};
}

/**
 * The `rules` value of the `sonarlint` configuration section: each difference as the IDE's settings write it.
 * @param {RuleDiff} diff
 * @returns {Record<string, { level: 'on' | 'off', parameters?: Record<string, string> }>}
 */
function rulesConfiguration(diff) {
	/** @type {Record<string, { level: 'on' | 'off', parameters?: Record<string, string> }>} */
	const out = {};
	for (const k of diff.included) out[k] = { level: 'on' };
	for (const k of diff.excluded) out[k] = { level: 'off' };
	for (const [k, parameters] of Object.entries(diff.parameters)) out[k] = { level: 'on', parameters };
	return out;
}

/**
 * How many rules of each governed repository the server must count in each analysis.
 * @param {RuleSet} ruleSet
 * @returns {Record<string, number>}
 */
function expectedActiveCounts(ruleSet) {
	/** @type {Record<string, number>} */
	const out = {};
	for (const repo of ruleSet.repositories) out[repo] = 0;
	for (const key of ruleSet.rules) {
		const repo = key.slice(0, key.indexOf(':'));
		out[repo] = (out[repo] ?? 0) + 1;
	}
	return out;
}

// ── the server's echoes ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} list the inside of a Java list's brackets
 * @returns {string[]}
 */
function javaList(list) {
	return list
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s !== '')
		.sort(byCodePoint);
}

/**
 * @typedef {{ includedRules: string[], excludedRules: string[], ruleParameters: string }} SettingsEcho
 */

/**
 * The server's echo of the rule settings it applied, from its "Global settings updated: WorkspaceSettings[...]" line.
 * @param {string} message
 * @returns {SettingsEcho | undefined}
 */
function parseSettingsEcho(message) {
	if (!message.includes('Global settings updated: WorkspaceSettings[')) return undefined;
	const included = /includedRules=\[([^\]]*)\]/.exec(message);
	const excluded = /excludedRules=\[([^\]]*)\]/.exec(message);
	const params = bracedAfter(message, 'ruleParameters=');
	if (included === null || excluded === null || params === undefined) return undefined;
	return { includedRules: javaList(included[1] ?? ''), excludedRules: javaList(excluded[1] ?? ''), ruleParameters: params };
}

/**
 * The balanced `{...}` that follows `label` in `text` (a Java map's text, which may nest), or undefined.
 * @param {string} text
 * @param {string} label
 * @returns {string | undefined}
 */
function bracedAfter(text, label) {
	const start = text.indexOf(label) + label.length;
	if (start < label.length || text.charAt(start) !== '{') return undefined;
	let depth = 0;
	for (let i = start; i < text.length; i++) {
		const c = text.charAt(i);
		if (c === '{') depth++;
		else if (c === '}') depth--;
		if (depth === 0) return text.slice(start, i + 1);
	}
	return undefined;
}

/**
 * Every way the echo differs from what was sent; empty when the server applied exactly the differences.
 * Parameters are judged by containment: each rule's key and each `name=value` must appear in the echo.
 * @param {RuleDiff} sent
 * @param {SettingsEcho} echo
 * @returns {string[]}
 */
function echoProblems(sent, echo) {
	const problems = [];
	const included = [...new Set([...sent.included, ...Object.keys(sent.parameters)])].sort(byCodePoint);
	const excluded = [...sent.excluded].sort(byCodePoint);
	const text = (/** @type {string[]} */ list) => JSON.stringify(list);
	if (text(included) !== text(echo.includedRules)) problems.push(`included rules: sent ${text(included)}, echoed ${text(echo.includedRules)}`);
	if (text(excluded) !== text(echo.excludedRules)) problems.push(`excluded rules: sent ${text(excluded)}, echoed ${text(echo.excludedRules)}`);
	const entries = Object.entries(sent.parameters);
	if (entries.length === 0 && echo.ruleParameters !== '{}') problems.push(`rule parameters: sent none, echoed ${echo.ruleParameters}`);
	for (const [key, values] of entries) {
		const missing = [key, ...Object.entries(values).map(([n, v]) => `${n}=${v}`)].filter((s) => !echo.ruleParameters.includes(s));
		if (missing.length > 0) problems.push(`rule parameters of ${key}: ${missing.join(', ')} not echoed in ${echo.ruleParameters}`);
	}
	return problems;
}

/**
 * @typedef {{ analyzerProperties: string, testFilePattern: string }} FolderEcho
 */

/**
 * The server's echo of the folder settings it applied: "configuration updated: WorkspaceFolderSettings[...]".
 * @param {string} message
 * @returns {FolderEcho | undefined}
 */
function parseFolderEcho(message) {
	const label = 'testFilePattern=';
	if (!message.includes('WorkspaceFolderSettings[') || !message.includes(label)) return undefined;
	const analyzerProperties = bracedAfter(message, 'analyzerProperties=');
	const start = message.indexOf(label) + label.length;
	const end = message.lastIndexOf(']');
	if (analyzerProperties === undefined || end < start) return undefined;
	return { analyzerProperties, testFilePattern: message.slice(start, end) };
}

/**
 * Every way the folder echo differs from the scope settings sent (the analyzer property and the test pattern).
 * @param {{ analyzerProperties: Record<string, string>, testFilePattern: string }} sent
 * @param {FolderEcho} echo
 * @returns {string[]}
 */
function folderEchoProblems(sent, echo) {
	const problems = [];
	const properties = `{${Object.entries(sent.analyzerProperties)
		.map(([k, v]) => `${k}=${v}`)
		.join(', ')}}`;
	if (echo.analyzerProperties !== properties) problems.push(`analyzer properties: sent ${properties}, echoed ${echo.analyzerProperties}`);
	if (echo.testFilePattern !== sent.testFilePattern) problems.push(`test pattern: sent ${sent.testFilePattern}, echoed ${echo.testFilePattern}`);
	return problems;
}

/**
 * The server's list of the tsconfigs it found, relative to the root, sorted: "Found N tsconfig.json file(s): [...]".
 * @param {string} message
 * @param {string} root
 * @returns {string[] | undefined}
 */
function parseFoundTsconfigs(message, root) {
	const m = /Found \d+ tsconfig\.json file\(s\): \[([^\]]*)\]/.exec(message);
	if (m === null) return undefined;
	const slashedRoot = root.replaceAll('\\', '/');
	const base = (slashedRoot.endsWith('/') ? slashedRoot : `${slashedRoot}/`).toLowerCase();
	return javaList(m[1] ?? '').map((p) => {
		const slashed = p.replaceAll('\\', '/');
		return slashed.toLowerCase().startsWith(base) ? slashed.slice(base.length) : slashed;
	});
}

/**
 * SonarJS's version as the server reports loading it: "Plugin version: [14.4.0.46458]".
 * @param {string} message
 * @returns {string | undefined}
 */
function parsePluginVersion(message) {
	return /Plugin version: \[([^\]]+)\]/.exec(message)?.[1];
}

/**
 * The active-rule counts an analysis reports, by repository: "activeRules: [23 kubernetes, ..., 440 typescript]".
 * @param {string} message
 * @returns {Record<string, number> | undefined}
 */
function parseActiveRules(message) {
	const m = /activeRules: \[([^\]]*)\]/.exec(message);
	if (m === null) return undefined;
	/** @type {Record<string, number>} */
	const out = {};
	for (const item of javaList(m[1] ?? '')) {
		const [count, repo] = item.split(' ');
		if (repo !== undefined) out[repo] = Number.parseInt(count ?? '', 10);
	}
	return out;
}

/**
 * Every governed repository whose count in an analysis differs from the rule set's.
 * @param {Record<string, number>} expected
 * @param {Record<string, number>} reported
 * @returns {string[]}
 */
function activeRuleProblems(expected, reported) {
	return Object.entries(expected)
		.filter(([repo, n]) => (reported[repo] ?? 0) !== n)
		.map(([repo, n]) => `${repo}: the rule set has ${n} rules, the analysis ran ${reported[repo] ?? 0}`);
}

// ── the scope ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ schema: string, properties: Record<string, string[]>, files: string[], tsconfigs: string[] }} Census
 */

/**
 * @param {string} text
 * @returns {Census}
 */
function parseCensus(text) {
	const raw = JSON.parse(text);
	const problems = [];
	if (raw?.schema !== CENSUS_SCHEMA) problems.push(`schema is ${JSON.stringify(raw?.schema)}, not ${CENSUS_SCHEMA}`);
	if (!Array.isArray(raw?.files) || raw.files.length === 0) problems.push('it lists no file (J4)');
	if (!Array.isArray(raw?.tsconfigs) || raw.tsconfigs.length === 0) problems.push('it lists no tsconfig');
	if (!Array.isArray(raw?.properties?.['sonar.typescript.tsconfigPaths'])) problems.push('it records no tsconfig globs');
	if (problems.length > 0) throw new Refusal(`the scope census is not usable: ${problems.join('; ')}`);
	return raw;
}

/**
 * The files to analyse: every census file, or the named ones, each of which must be in the census.
 * @param {Census} census
 * @param {string} root
 * @param {readonly string[] | undefined} named absolute or root-relative paths; undefined for every census file
 * @returns {{ files: string[], outside: string[] }}
 */
function selectFiles(census, root, named) {
	if (named === undefined) return { files: [...census.files], outside: [] };
	const inCensus = new Set(census.files);
	/** @type {string[]} */
	const files = [];
	/** @type {string[]} */
	const outside = [];
	for (const name of named) {
		const rel = path.relative(root, path.resolve(root, name)).replaceAll('\\', '/');
		if (inCensus.has(rel)) files.push(rel);
		else outside.push(rel);
	}
	return { files: [...new Set(files)], outside };
}

/**
 * The analyzer properties and test pattern the server is given from the census's record of the properties file.
 * @param {Census} census
 * @returns {{ analyzerProperties: Record<string, string>, testFilePattern: string }}
 */
function scopeSettings(census) {
	const inclusions = census.properties['sonar.test.inclusions'] ?? [];
	return {
		analyzerProperties: { 'sonar.typescript.tsconfigPaths': (census.properties['sonar.typescript.tsconfigPaths'] ?? []).join(',') },
		testFilePattern: inclusions.length === 1 ? (inclusions[0] ?? '') : `{${inclusions.join(',')}}`
	};
}

// ── the output folder ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Why the folder cannot take this run, or undefined. A run starts in a new or empty folder; `--resume` needs the
 * record of an earlier run there.
 * @param {string} dir
 * @param {boolean} resume
 * @returns {string | undefined}
 */
function outputFolderProblem(dir, resume) {
	const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
	if (!resume) {
		return entries.length === 0 ? undefined : `the output folder ${dir} is not empty: a run writes into a new, empty folder (or pass --resume)`;
	}
	const missing = ['run.json', 'results.json'].filter((f) => !entries.includes(f));
	return missing.length === 0 ? undefined : `--resume: ${dir} holds no earlier run (no ${missing.join(' or ')})`;
}

/**
 * Every way an earlier run's configuration differs from this one's; a result is reused only when there are none.
 * @param {any} earlier the earlier `run.json`
 * @param {{ engine: Record<string, string>, ruleSet: { sha256: string }, census: { sha256: string } }} now
 * @returns {string[]}
 */
function resumeProblems(earlier, now) {
	const problems = [];
	for (const [k, v] of Object.entries(now.engine)) {
		if (earlier?.engine?.[k] !== v) problems.push(`engine ${k}: earlier ${earlier?.engine?.[k]}, now ${v}`);
	}
	if (earlier?.ruleSet?.sha256 !== now.ruleSet.sha256) problems.push('the rule set changed');
	if (earlier?.census?.sha256 !== now.census.sha256) problems.push('the scope census changed');
	return problems;
}

/**
 * An earlier result to reuse for a file, only when it was analysed and its bytes are unchanged.
 * @param {any} earlierResults the earlier `results.json`
 * @param {string} file
 * @param {string} sha256 of the file's bytes now
 * @returns {any}
 */
function reusableResult(earlierResults, file, sha256) {
	const r = earlierResults?.[file];
	return r?.status === 'ok' && r.sha256 === sha256 ? r : undefined;
}

// ── shared ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * @param {string | Buffer} bytes
 * @returns {string}
 */
function sha256(bytes) {
	return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Code-point order, the census's and the rule set's.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function byCodePoint(a, b) {
	return Number(a > b) - Number(a < b);
}

/**
 * The exit code for a finished run (J4: a listed file with no fresh result makes it incomplete).
 * @param {number} listed
 * @param {number} analysed
 * @returns {number}
 */
function exitCodeFor(listed, analysed) {
	if (listed === 0) return EXIT.NOTHING;
	return analysed === listed ? EXIT.OK : EXIT.INCOMPLETE;
}

module.exports = {
	RULE_SET_SCHEMA,
	CENSUS_SCHEMA,
	RUN_SCHEMA,
	EXIT,
	Refusal,
	pinsFromMatrix,
	sonarLintPaths,
	expandRoot,
	javaVersionOf,
	extensionFacts,
	findEngine,
	nodeProblem,
	ruleSetProblems,
	parseRuleSet,
	catalogueOf,
	rulesDiff,
	rulesConfiguration,
	expectedActiveCounts,
	parseSettingsEcho,
	echoProblems,
	parseFolderEcho,
	folderEchoProblems,
	parseFoundTsconfigs,
	parsePluginVersion,
	parseActiveRules,
	activeRuleProblems,
	parseCensus,
	selectFiles,
	scopeSettings,
	outputFolderProblem,
	resumeProblems,
	reusableResult,
	sha256,
	byCodePoint,
	exitCodeFor
};
