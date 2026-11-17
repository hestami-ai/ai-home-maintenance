#!/usr/bin/env node
// @ts-check
'use strict';
/**
 * The Sonar runner: one SonarLint language server, driven headless over LSP, analysing the census's files with the
 * committed rule set (JAN-SONARCM D-1; roadmap S1). It began as janumicode_v2's `.sonar-remediation/batch-runner.js`
 * (its LSP plumbing and its per-file settle logic); what it decides is in `runner-core.cjs`, beside it.
 *
 * usage: bun run sonar:scan -- --out <new folder> (--all | --files <list.txt>) [--resume] [--rules <rules.json>]
 *                              [--max-wait-ms <ms>]
 *   --all          every file of scripts/sonar/scope-census.json
 *   --files        a text file of paths, one per line, absolute or relative to the JPWB root; each must be in the census
 *   --resume       reuse an earlier run's result for each file whose bytes are unchanged, in that run's folder
 *   --rules        another rule set (a control; its file and hash are recorded); default scripts/sonar/rules.json
 * exit: 0 every listed file analysed; 2 refused (engine, Node, rule set, scope, the server's echo, a used folder, or
 *       usage); 3 nothing analysable; 4 a listed file not analysed (each named in run.json).
 *
 * WHAT IT WRITES, into the output folder: run.json (the engine, the rule set and the server's echo of it, the census
 * and the server's tsconfig list, each file's status: J2), results.json (each file's findings and the hash of the
 * bytes analysed), ls-log.txt (everything the server logged) and catalogue.json (the server's own rule list).
 *
 * It must run under node, not Bun: the Node running it is the Node the server's bridge runs on.
 */

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const core = require('./runner-core.cjs');

const JPWB_ROOT = path.resolve(__dirname, '..', '..');
const INPUTS = {
	matrix: 'scripts/toolchain/matrix.json',
	machinePaths: 'scripts/toolchain/machine-paths.json',
	rules: 'scripts/sonar/rules.json',
	census: 'scripts/sonar/scope-census.json'
};
const SETTINGS_ECHO_WAIT_MS = 60_000;
const BOOT_WAIT_MS = 180_000;

/**
 * @typedef {{ out: string, all: boolean, files: string | undefined, resume: boolean, rules: string, maxWaitMs: number }} Args
 */

/**
 * @param {readonly string[]} argv
 * @returns {Args}
 */
function parseArgs(argv) {
	/** @type {Args} */
	const a = { out: '', all: false, files: undefined, resume: false, rules: path.join(JPWB_ROOT, INPUTS.rules), maxWaitMs: 120_000 };
	for (let i = 0; i < argv.length; i++) {
		const flag = argv[i];
		const value = () => {
			const v = argv[++i];
			if (v === undefined) throw new core.Refusal(`usage: ${flag} needs a value`);
			return v;
		};
		if (flag === '--out') a.out = path.resolve(value());
		else if (flag === '--all') a.all = true;
		else if (flag === '--files') a.files = path.resolve(value());
		else if (flag === '--resume') a.resume = true;
		else if (flag === '--rules') a.rules = path.resolve(value());
		else if (flag === '--max-wait-ms') a.maxWaitMs = Number.parseInt(value(), 10);
		else throw new core.Refusal(`usage: unknown argument ${flag}`);
	}
	if (a.out === '') throw new core.Refusal('usage: --out <new folder> is required');
	if (a.all === (a.files !== undefined)) throw new core.Refusal('usage: give exactly one of --all and --files <list>');
	if (!Number.isFinite(a.maxWaitMs) || a.maxWaitMs <= 0) throw new core.Refusal('usage: --max-wait-ms takes a positive number');
	return a;
}

/** @param {string} rel */
function readInput(rel) {
	return fs.readFileSync(path.join(JPWB_ROOT, rel), 'utf8');
}

/** The commit the analysed tree is at, and whether it has uncommitted changes (a record, not a judgment). */
function treeState() {
	// S4036: kept - repository tooling asks the operator's own git, found on PATH, for the tree's commit; a fixed path would tie the runner to one machine (V-2).
	const head = spawnSync('git', ['-C', JPWB_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
	// S4036: kept - repository tooling asks the operator's own git, found on PATH, whether the tree has uncommitted changes; a fixed path would tie the runner to one machine (V-2).
	const status = spawnSync('git', ['-C', JPWB_ROOT, 'status', '--porcelain', '--', '.'], { encoding: 'utf8' }).stdout;
	return { head, uncommittedPaths: status.split('\n').filter((l) => l.trim() !== '').length };
}

/**
 * Everything decided before the server starts. Throws a Refusal for anything that makes the run untrustworthy.
 * @param {Args} args
 */
function prepare(args) {
	const pins = core.pinsFromMatrix(JSON.parse(readInput(INPUTS.matrix)));
	const nodeProblem = core.nodeProblem(pins, process.versions);
	if (nodeProblem !== undefined) throw new core.Refusal(nodeProblem);
	const engine = core.findEngine(core.sonarLintPaths(JSON.parse(readInput(INPUTS.machinePaths))), pins);
	const ruleSetText = fs.readFileSync(args.rules, 'utf8');
	const ruleSet = core.parseRuleSet(ruleSetText);
	const censusText = readInput(INPUTS.census);
	const census = core.parseCensus(censusText);
	const named = args.files === undefined ? undefined : fs.readFileSync(args.files, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== '');
	const selection = core.selectFiles(census, JPWB_ROOT, named);
	if (selection.outside.length > 0) {
		throw new core.Refusal(`not in the scope census (run bun run sonar:census if the scope changed): ${selection.outside.join(', ')}`);
	}
	const folderProblem = core.outputFolderProblem(args.out, args.resume);
	if (folderProblem !== undefined) throw new core.Refusal(folderProblem);
	const record = {
		engine: { ...engine.versions },
		ruleSet: { file: path.relative(JPWB_ROOT, args.rules).replaceAll('\\', '/'), sha256: core.sha256(ruleSetText) },
		census: { file: INPUTS.census, sha256: core.sha256(censusText) }
	};
	const earlier = args.resume ? readEarlier(args.out, record) : undefined;
	return { pins, engine, ruleSet, census, files: selection.files, record, earlier };
}

/**
 * The earlier run in the folder, refused unless its engine, rule set and census are this run's.
 * @param {string} dir
 * @param {{ engine: Record<string, string>, ruleSet: { sha256: string }, census: { sha256: string } }} now
 */
function readEarlier(dir, now) {
	const run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'));
	const problems = core.resumeProblems(run, now);
	if (problems.length > 0) throw new core.Refusal(`--resume refused: ${problems.join('; ')}`);
	return JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
}

/** @param {string} p */
function pathToUri(p) {
	let u = p.replaceAll('\\', '/');
	if (!u.startsWith('/')) u = `/${u}`;
	return `file://${encodeURI(u).replaceAll('%3A', ':')}`;
}

/** @param {string} file */
function languageIdOf(file) {
	return /\.[cm]?tsx?$/.test(file) ? 'typescript' : 'javascript';
}

/**
 * One run of the language server over the selected files.
 */
class Run {
	/**
	 * @param {Args} args
	 * @param {ReturnType<typeof prepare>} plan
	 */
	constructor(args, plan) {
		this.args = args;
		this.plan = plan;
		this.expectedCounts = core.expectedActiveCounts(plan.ruleSet);
		this.scope = core.scopeSettings(plan.census);
		/** @type {Record<string, any>} */
		this.results = {};
		/** @type {string[]} */
		this.queue = [];
		/** @type {any[]} */
		this.heldConfiguration = [];
		/** @type {core.RuleDiff | undefined} */
		this.diff = undefined;
		/** @type {Record<string, any>} */
		this.echoes = { settings: undefined, folder: undefined, pluginVersion: undefined, tsconfigs: undefined, activeRules: undefined };
		this.seq = 0;
		this.initId = -1;
		this.rulesId = -1;
		/** @type {{ file: string, uri: string, openTime: number, sha256: string } | undefined} */
		this.current = undefined;
		/** @type {any[] | undefined} */
		this.diagnostics = undefined;
		/** @type {NodeJS.Timeout | undefined} */
		this.settleTimer = undefined;
		/** @type {NodeJS.Timeout | undefined} */
		this.maxTimer = undefined;
		/** @type {NodeJS.Timeout | undefined} */
		this.stageTimer = undefined;
		this.buffer = Buffer.alloc(0);
		this.startedAt = new Date().toISOString();
		this.finished = false;
		this.logFile = path.join(args.out, 'ls-log.txt');
		/** @type {import('node:child_process').ChildProcessWithoutNullStreams | undefined} */
		this.child = undefined;
	}

	/** @param {string} line */
	log(line) {
		fs.appendFileSync(this.logFile, `${new Date().toISOString()} ${line}\n`);
	}

	start() {
		const e = this.plan.engine;
		this.child = spawn(e.java, ['-jar', e.languageServer, '-stdio', '-analyzers', ...e.analyzers], { stdio: ['pipe', 'pipe', 'pipe'] });
		this.child.stderr.on('data', (d) => this.log(`[stderr] ${String(d).trim()}`));
		this.child.stdout.on('data', (d) => this.receive(d));
		this.child.on('exit', (code) => {
			if (!this.finished) this.refuse(`the language server exited (${code}) before the run finished`);
		});
		this.stage('the server did not answer its initialisation', BOOT_WAIT_MS);
		this.initId = this.request('initialize', this.initializeParams());
	}

	initializeParams() {
		return {
			processId: process.pid,
			clientInfo: { name: 'jpwb-sonar-runner', version: '1' },
			rootUri: pathToUri(JPWB_ROOT),
			workspaceFolders: [{ uri: pathToUri(JPWB_ROOT), name: 'jpwb' }],
			capabilities: {
				workspace: { configuration: true, workspaceFolders: true },
				textDocument: { publishDiagnostics: { relatedInformation: true } },
				window: { workDoneProgress: true }
			},
			initializationOptions: {
				productKey: 'vscode',
				telemetryStorage: path.join(this.args.out, 'telemetry'),
				productName: 'SonarLint VSCode',
				productVersion: this.plan.engine.versions.extension,
				workspaceName: 'jpwb',
				firstSecretDetected: false,
				showVerboseLogs: true,
				platform: process.platform,
				architecture: process.arch,
				additionalAttributes: {},
				enableNotebooks: false,
				clientNodePath: process.execPath,
				eslintBridgeServerPath: this.plan.engine.eslintBridge,
				connections: { sonarqube: [], sonarcloud: [] },
				rules: {},
				focusOnNewCode: false
			}
		};
	}

	/**
	 * Fail the stage if it has not moved on within `ms`.
	 * @param {string} what
	 * @param {number} ms
	 */
	stage(what, ms) {
		if (this.stageTimer !== undefined) clearTimeout(this.stageTimer);
		this.stageTimer = setTimeout(() => this.refuse(what), ms);
	}

	/** @param {any} msg */
	send(msg) {
		const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...msg }), 'utf8');
		this.child?.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
		this.child?.stdin.write(body);
	}

	/**
	 * @param {string} method
	 * @param {unknown} params
	 */
	request(method, params) {
		const id = ++this.seq;
		this.send({ id, method, params });
		return id;
	}

	/**
	 * @param {string} method
	 * @param {unknown} params
	 */
	notify(method, params) {
		this.send({ method, params });
	}

	/** @param {Buffer} data */
	receive(data) {
		this.buffer = Buffer.concat([this.buffer, data]);
		for (;;) {
			const headerEnd = this.buffer.indexOf('\r\n\r\n');
			if (headerEnd < 0) return;
			const m = /Content-Length: (\d+)/i.exec(this.buffer.subarray(0, headerEnd).toString('utf8'));
			if (m === null) {
				this.buffer = this.buffer.subarray(headerEnd + 4);
				continue;
			}
			const start = headerEnd + 4;
			const end = start + Number.parseInt(m[1] ?? '0', 10);
			if (this.buffer.length < end) return;
			const body = this.buffer.subarray(start, end).toString('utf8');
			this.buffer = this.buffer.subarray(end);
			this.dispatch(body);
		}
	}

	/** @param {string} body */
	dispatch(body) {
		let msg;
		try {
			msg = JSON.parse(body);
		} catch {
			this.log(`[unparsable message] ${body.slice(0, 200)}`);
			return;
		}
		if (this.finished) return;
		if (msg.method === undefined) this.onResponse(msg);
		else if (msg.id === undefined) this.onNotification(msg);
		else this.onRequest(msg);
	}

	/** @param {any} msg */
	onResponse(msg) {
		if (msg.id === this.initId) {
			this.log('[runner] initialised; asking the server for its rules');
			this.notify('initialized', {});
			this.rulesId = this.request('sonarlint/listAllRules', null);
			this.stage('the server did not list its rules', BOOT_WAIT_MS);
		} else if (msg.id === this.rulesId) {
			this.onCatalogue(msg);
		}
	}

	/** @param {any} msg */
	onCatalogue(msg) {
		if (msg.error !== undefined) return this.refuse(`the server refused to list its rules: ${JSON.stringify(msg.error)}`);
		try {
			const catalogue = core.catalogueOf(msg.result, this.plan.ruleSet.repositories);
			fs.writeFileSync(path.join(this.args.out, 'catalogue.json'), JSON.stringify(msg.result, null, 1));
			this.diff = core.rulesDiff(this.plan.ruleSet, catalogue);
		} catch (e) {
			return this.refuse(e instanceof Error ? e.message : String(e));
		}
		this.log(`[runner] sending ${this.diff.included.length} rules on and ${this.diff.excluded.length} off`);
		for (const held of this.heldConfiguration.splice(0)) this.answerConfiguration(held);
		this.stage('the server did not echo the rule settings it was sent', SETTINGS_ECHO_WAIT_MS);
		return undefined;
	}

	/** @param {any} msg */
	onRequest(msg) {
		if (msg.method === 'workspace/configuration') {
			if (this.diff === undefined) this.heldConfiguration.push(msg);
			else this.answerConfiguration(msg);
			return;
		}
		/** @type {Record<string, unknown>} */
		const answers = {
			'sonarlint/isOpenInEditor': true,
			'sonarlint/shouldAnalyseFile': { shouldBeAnalysed: true },
			'sonarlint/isIgnoredByScm': false,
			'sonarlint/filterOutExcludedFiles': { fileUris: msg.params?.fileUris ?? [] },
			'sonarlint/listFilesInFolder': { foundFiles: [] },
			'sonarlint/hasJoinedIdeLabs': false
		};
		this.send({ id: msg.id, result: answers[msg.method] ?? null });
	}

	/** @param {any} msg */
	answerConfiguration(msg) {
		const diff = /** @type {core.RuleDiff} */ (this.diff);
		const sonarlint = {
			rules: core.rulesConfiguration(diff),
			analyzerProperties: this.scope.analyzerProperties,
			testFilePattern: this.scope.testFilePattern,
			pathToNodeExecutable: process.execPath,
			disableTelemetry: true
		};
		const items = msg.params?.items ?? [];
		this.send({ id: msg.id, result: items.map((/** @type {any} */ it) => (it?.section === 'sonarlint' ? sonarlint : {})) });
	}

	/** @param {any} msg */
	onNotification(msg) {
		if (msg.method === 'textDocument/publishDiagnostics') {
			if (this.current !== undefined && msg.params?.uri === this.current.uri) {
				this.diagnostics = msg.params.diagnostics;
				this.settle(2500);
			}
		} else if (msg.method === 'window/logMessage') {
			const text = String(msg.params?.message ?? '');
			this.log(text);
			this.onLog(text);
		}
	}

	/** @param {string} text */
	onLog(text) {
		this.checkEchoes(text);
		const am = /Analysis detected (\d+) issues?/.exec(text);
		if (am !== null && this.current !== undefined && Date.now() - this.current.openTime > 700) {
			if (am[1] === '0' && this.diagnostics === undefined) {
				this.diagnostics = [];
				this.settle(1500);
			} else this.settle(4000);
		}
	}

	/**
	 * Each echo the server gives of what it runs is checked as it arrives; a difference stops the run.
	 * @param {string} text
	 */
	checkEchoes(text) {
		const settings = core.parseSettingsEcho(text);
		if (settings !== undefined && this.diff !== undefined) this.onSettingsEcho(settings);
		const folder = core.parseFolderEcho(text);
		if (folder !== undefined && this.diff !== undefined) {
			this.echoes.folder = folder;
			const problems = core.folderEchoProblems(this.scope, folder);
			if (problems.length > 0) this.refuse(`the server applied other scope settings than were sent: ${problems.join('; ')}`);
		}
		const plugin = core.parsePluginVersion(text);
		if (plugin !== undefined) {
			this.echoes.pluginVersion = plugin;
			if (plugin !== this.plan.pins.sonarjs) this.refuse(`the server loaded SonarJS ${plugin}; the matrix pins ${this.plan.pins.sonarjs}`);
		}
		const tsconfigs = core.parseFoundTsconfigs(text, JPWB_ROOT);
		if (tsconfigs !== undefined) this.onTsconfigs(tsconfigs);
		const counts = core.parseActiveRules(text);
		if (counts !== undefined) {
			this.echoes.activeRules = counts;
			const problems = core.activeRuleProblems(this.expectedCounts, counts);
			if (problems.length > 0) this.refuse(`an analysis ran another rule set: ${problems.join('; ')}`);
		}
	}

	/** @param {core.SettingsEcho} echo */
	onSettingsEcho(echo) {
		this.echoes.settings = echo;
		const problems = core.echoProblems(/** @type {core.RuleDiff} */ (this.diff), echo);
		if (problems.length > 0) return this.refuse(`the server applied other rule settings than were sent: ${problems.join('; ')}`);
		if (this.queue.length === 0 && this.current === undefined && Object.keys(this.results).length === 0) this.begin();
		return undefined;
	}

	/** @param {string[]} found */
	onTsconfigs(found) {
		this.echoes.tsconfigs = found;
		const expected = [...this.plan.census.tsconfigs].sort(core.byCodePoint);
		if (JSON.stringify(found) !== JSON.stringify(expected)) {
			this.refuse(`the server found tsconfigs ${JSON.stringify(found)}; the census's are ${JSON.stringify(expected)} (V-3)`);
		}
	}

	begin() {
		if (this.stageTimer !== undefined) clearTimeout(this.stageTimer);
		this.queue = [...this.plan.files];
		this.log(`[runner] rule settings echoed as sent; analysing ${this.queue.length} files`);
		this.next();
	}

	next() {
		if (this.finished) return;
		const file = this.queue.shift();
		if (file === undefined) return this.finish();
		const abs = path.join(JPWB_ROOT, file);
		let text;
		try {
			text = fs.readFileSync(abs);
		} catch {
			this.results[file] = { status: 'unreadable', findings: [] };
			return setImmediate(() => this.next());
		}
		const sha256 = core.sha256(text);
		const earlier = core.reusableResult(this.plan.earlier, file, sha256);
		if (earlier !== undefined) {
			this.results[file] = { ...earlier, reused: true };
			return setImmediate(() => this.next());
		}
		this.current = { file, uri: pathToUri(abs), openTime: Date.now(), sha256 };
		this.diagnostics = undefined;
		this.notify('textDocument/didOpen', { textDocument: { uri: this.current.uri, languageId: languageIdOf(file), version: 1, text: text.toString('utf8') } });
		this.maxTimer = setTimeout(() => this.record('timeout'), this.args.maxWaitMs);
		return undefined;
	}

	/** @param {number} ms */
	settle(ms) {
		if (this.settleTimer !== undefined) clearTimeout(this.settleTimer);
		this.settleTimer = setTimeout(() => this.record('ok'), ms);
	}

	/** @param {'ok' | 'timeout'} status */
	record(status) {
		const c = this.current;
		if (c === undefined) return;
		if (this.settleTimer !== undefined) clearTimeout(this.settleTimer);
		if (this.maxTimer !== undefined) clearTimeout(this.maxTimer);
		const findings = (this.diagnostics ?? []).map((/** @type {any} */ d) => ({
			rule: d.code?.value ?? d.code ?? d.data?.ruleKey ?? '?',
			line: d.range.start.line + 1,
			column: d.range.start.character + 1,
			message: d.message,
			severity: d.severity,
			impacts: d.data?.impacts
		}));
		this.results[c.file] = { status, sha256: c.sha256, findings };
		const marker = status === 'ok' ? '' : status.concat(' ');
		console.log(`[${Object.keys(this.results).length}/${this.plan.files.length}] ${marker}${findings.length} findings  ${c.file}`);
		this.notify('textDocument/didClose', { textDocument: { uri: c.uri } });
		this.current = undefined;
		if (Object.keys(this.results).length % 15 === 0) this.write('running');
		setImmediate(() => this.next());
	}

	finish() {
		const listed = this.plan.files.length;
		const analysed = Object.values(this.results).filter((r) => r.status === 'ok').length;
		const anyTs = Object.entries(this.results).some(([f, r]) => r.status === 'ok' && !r.reused && languageIdOf(f) === 'typescript');
		const silent = [];
		if (anyTs && this.echoes.tsconfigs === undefined) silent.push('the tsconfigs it found');
		if (this.echoes.folder === undefined) silent.push('the scope settings it applied');
		if (analysed > 0 && this.echoes.pluginVersion === undefined && Object.values(this.results).some((r) => !r.reused)) silent.push('its SonarJS version');
		if (silent.length > 0) return this.refuse(`the server never reported ${silent.join(' or ')}, so the run cannot show what analysed it (J2)`);
		const code = core.exitCodeFor(listed, analysed);
		this.write(code === core.EXIT.OK ? 'complete' : 'incomplete');
		return this.stop(code);
	}

	/** @param {string} reason */
	refuse(reason) {
		if (this.finished) return;
		this.log(`[runner] REFUSED: ${reason}`);
		console.error(`sonar runner: refused: ${reason}`);
		this.write('refused', reason);
		this.stop(core.EXIT.REFUSED);
	}

	/** @param {number} code */
	stop(code) {
		this.finished = true;
		for (const t of [this.stageTimer, this.settleTimer, this.maxTimer]) if (t !== undefined) clearTimeout(t);
		try {
			this.request('shutdown', null);
			this.notify('exit', null);
		} catch {
			// The server may already be gone; the kill below covers it.
		}
		setTimeout(() => {
			this.child?.kill();
			process.exit(code);
		}, 1500);
	}

	/**
	 * @param {string} status
	 * @param {string} [refusal]
	 */
	write(status, refusal) {
		const results = this.results;
		const notAnalysed = this.plan.files.filter((f) => results[f]?.status !== 'ok').map((f) => ({ file: f, status: results[f]?.status ?? 'not reached' }));
		/** @type {Record<string, number>} */
		const byRule = {};
		for (const r of Object.values(results)) for (const f of r.findings ?? []) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
		const run = {
			schema: core.RUN_SCHEMA,
			status,
			refusal,
			startedAt: this.startedAt,
			writtenAt: new Date().toISOString(),
			tree: treeState(),
			node: { version: process.versions.node },
			engine: { ...this.plan.record.engine, sonarjsLogged: this.echoes.pluginVersion },
			ruleSet: {
				...this.plan.record.ruleSet,
				repositories: this.plan.ruleSet.repositories,
				counts: this.expectedCounts,
				sent: this.diff,
				echo: this.echoes.settings,
				activeRules: this.echoes.activeRules
			},
			census: {
				...this.plan.record.census,
				...this.scope,
				echo: this.echoes.folder,
				tsconfigs: this.plan.census.tsconfigs,
				serverTsconfigs: this.echoes.tsconfigs
			},
			files: {
				listed: this.plan.files.length,
				analysed: Object.values(results).filter((r) => r.status === 'ok').length,
				reused: Object.values(results).filter((r) => r.reused === true).length,
				notAnalysed
			},
			findings: { total: Object.values(byRule).reduce((a, b) => a + b, 0), byRule }
		};
		fs.writeFileSync(path.join(this.args.out, 'run.json'), `${JSON.stringify(run, null, 1)}\n`);
		fs.writeFileSync(path.join(this.args.out, 'results.json'), `${JSON.stringify(results, null, 1)}\n`);
	}
}

function main() {
	let args;
	let plan;
	try {
		args = parseArgs(process.argv.slice(2));
		plan = prepare(args);
	} catch (e) {
		if (!(e instanceof core.Refusal)) throw e;
		console.error(`sonar runner: refused: ${e.message}`);
		return process.exit(core.EXIT.REFUSED);
	}
	fs.mkdirSync(args.out, { recursive: true });
	if (plan.files.length === 0) {
		console.error('sonar runner: nothing analysable was selected');
		return process.exit(core.EXIT.NOTHING);
	}
	console.log(`sonar runner: SonarLint ${plan.engine.versions.extension} (SonarJS ${plan.engine.versions.sonarjs}), ${plan.files.length} files -> ${args.out}`);
	const run = new Run(args, plan);
	process.on('SIGINT', () => run.refuse('interrupted'));
	run.start();
	return undefined;
}

if (require.main?.filename === __filename) main();

module.exports = { parseArgs, JPWB_ROOT, INPUTS };
