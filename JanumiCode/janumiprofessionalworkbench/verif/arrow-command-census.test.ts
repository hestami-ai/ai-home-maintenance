// THE ARROW × COMMAND CENSUS (C-0) — every declared transition can be performed by some command.
//
// ── WHY THIS EXISTS, AND WHY THE CONTROL THAT ALREADY EXISTED CANNOT DO IT (REG-F-063) ───────────────────────
//
// `packages/rph-domain/src/state-reachability.test.ts` asks: *is this state reachable from `initialState`,
// following the machine's own declared arrows?* It walks `m.transitions`. That is a question about the DIAGRAM.
//
// `Harness.status` declares nine states, eight arrows, a durable wait and a restart-recovery resume — a saga.
// It is fully connected, so that control reports ZERO stranded, correctly. And `handlers/harness.ts` is 49 lines
// with ONE handler, which writes `FRAMING`. **No command can traverse a single arrow.** A machine can be perfect
// on paper and immovable at runtime, and a control that reads the same artifact the defect is written in will
// always agree with it.
//
// So this instrument asks the other question: **for every declared arrow, is there a registered command whose
// handler can perform it?** It reads THREE artifacts that must agree — `transitions.data.ts` (the arrows),
// `registry.ts` (which commands exist), and the handler sources (which arrows each command declares) — and a
// defect in any one of them shows up as a disagreement between two others.
//
// ── DIRECTION OF ERROR, STATED SO NOBODY "FIXES" IT BACKWARDS ────────────────────────────────────────────────
//
// A transition performed WITHOUT `advanceStatus` (a direct state write in a bespoke handler) is invisible here,
// so its arrow is reported as having no command. That is a FALSE POSITIVE: noisy, and safe.
//
// The dangerous direction — reporting an arrow traversable when nothing can perform it — is unreachable by
// construction, because traversability is only ever asserted from an EXPLICIT declaration at a call site.
// If you find this census listing an arrow you believe is covered, the correct fix is to make the coverage
// declarative, not to loosen the census.
//
// ── AND THE COUNT IS NOT THE POINT ───────────────────────────────────────────────────────────────────────────
//
// `expect(uncovered.length).toBeLessThan(N)` would go GREEN when someone DELETES an arrow from
// `transitions.data.ts`. The number improves by destroying the evidence. So the arrow TOTAL is pinned too, and
// the failure output is the LIST — a reader must see which arrows, not how many.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STATE_MACHINES, STEP_COMMAND_SPECS } from '@janumipwb/rph-domain';
import * as CONTRACT_SCHEMAS from '@janumipwb/rph-contracts';

const ROOT = new URL('../packages/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const HANDLERS = `${ROOT}rph-application/src/handlers`;

/** Handler files that declare status advances. `kit.ts` is the DEFINITION of `advanceStatus`, not a call site. */
const HANDLER_FILES = [
	'assurance.ts',
	'decomposition.ts',
	'execution.ts',
	'governance.ts',
	'intent.ts',
	'pwa-authoring.ts',
	'runtime-binding.ts',
	'validator-registry.ts',
	'harness.ts',
	'pwu.ts',
	'baseline.ts',
	'undertaking.ts',
	'evidence.ts'
];

interface DeclaredArrow {
	readonly machine: string;
	readonly from: string;
	readonly to: string;
	readonly site: string;
}

/** Resolve `machine: MACHINE` / `target: SOME_CONST` against the file's own top-level string constants. */
function stringConstants(source: string): Map<string, string> {
	const consts = new Map<string, string>();
	const re = /^const\s+([A-Z][A-Z0-9_]*)\s*(?::\s*[^=]+)?=\s*'([^']*)'\s*;/gm;
	for (const m of source.matchAll(re)) consts.set(m[1] as string, m[2] as string);
	return consts;
}

/** The balanced `{ … }` argument object beginning at `open`. */
function objectLiteralAt(source: string, open: number): string {
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		if (source[i] === '{') depth += 1;
		else if (source[i] === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(open, i + 1);
		}
	}
	throw new Error(`arrow-command-census: unbalanced advanceStatus argument object at offset ${open}`);
}

function resolve(raw: string, consts: Map<string, string>, file: string, field: string): string {
	// `target: 'X',` — the property regex has to be line-greedy to catch an arrow function, so it keeps the
	// separator. Strip it here, not in the pattern, so the pattern stays one shape rather than two.
	const trimmed = raw.trim().replace(/,$/, '');
	const literal = /^'([^']*)'$/.exec(trimmed);
	if (literal) return literal[1] as string;
	const named = consts.get(raw.trim());
	if (named !== undefined) return named;
	// FAIL LOUD. A shape this cannot read is an arrow silently declared uncovered, and a census that quietly
	// narrows its own population is the exact failure this repository keeps recording.
	throw new Error(
		`arrow-command-census: cannot resolve ${field} \`${raw.trim()}\` in ${file}. ` +
			`Use a string literal or a top-level string const in the same file, or teach the extractor this shape ` +
			`deliberately — never let it skip a site.`
	);
}

/** The literal keys of a top-level `const NAME: … = { KEY: …, … };` object in the same file. */
function objectKeysOf(source: string, name: string, site: string): string[] {
	const decl = new RegExp(`(?:^|\\n)const ${name}\\b[^=]*=\\s*\\{`).exec(source);
	if (!decl) {
		throw new Error(
			`arrow-command-census: ${site} declares targetStates from Object.keys(${name}), but ${name} is not a ` +
				`top-level object literal in the same file. Resolve it to a literal list, or teach the extractor.`
		);
	}
	const body = objectLiteralAt(source, decl.index + decl[0].length - 1);
	const keys = [...body.matchAll(/(?:^|\n)\t*([A-Z][A-Z0-9_]*)\s*:/g)].map((m) => m[1] as string);
	if (keys.length === 0) throw new Error(`arrow-command-census: ${name} yielded no keys at ${site}`);
	return keys;
}

/**
 * Resolve a `target` that is a FACTORY PARAMETER rather than a value.
 *
 * Two handler families build their handlers from a factory — `makeDecisionEffective` in governance.ts and
 * `statusChange` in validator-registry.ts — so the arrows are declared at the factory's CALL SITES, not in the
 * `advanceStatus` literal. Without this the census would report eight built arrows as uncovered, which is the
 * safe direction but drowns the real finding in noise.
 *
 * Two rules, both narrow enough to be wrong loudly:
 *   1. the parameter carries a LITERAL TYPE (`target: 'EFFECTIVE'`, or a union) — that IS the range;
 *   2. otherwise the factory's own call sites supply it, taken from the argument at the parameter's position.
 */
function factoryParameterRange(source: string, before: number, site: string): string[] | null {
	const heads = [...source.slice(0, before).matchAll(/(?:^|\n)(?:export )?(?:function (\w+)|const (\w+) = )/g)];
	const head = heads.at(-1);
	if (!head) return null;
	const name = (head[1] ?? head[2]) as string;
	const sig = source.slice(head.index, before);
	const param = /(?:^|[(,]\s*)target(\?)?\s*:\s*([^,)\n]+)/.exec(sig);
	if (!param) return null;

	const literals = [...(param[2] as string).matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
	if (literals.length > 0) return literals; // rule 1 — the type says it

	// rule 2 — the callers say it. Position of `target` among the factory's parameters.
	const paramList = /\(([\s\S]*?)\)\s*(?::[^{]*)?\{/.exec(sig)?.[1] ?? '';
	const position = paramList
		.split(/,(?![^(]*\))/)
		.findIndex((p) => /(^|\s)target(\?)?\s*:/.test(p));
	if (position < 0) return null;
	const calls = [...source.matchAll(new RegExp(`\\b${name}\\(([^)]*)\\)`, 'g'))];
	const found = new Set<string>();
	for (const c of calls) {
		const arg = (c[1] as string).split(/,(?![^[]*\])/)[position]?.trim() ?? '';
		const lit = /^'([^']+)'$/.exec(arg);
		if (lit) found.add(lit[1] as string);
	}
	if (found.size === 0) {
		throw new Error(
			`arrow-command-census: ${site} takes its target from factory \`${name}\`, whose parameter has no ` +
				`literal type and whose call sites yielded no literal at position ${position}. The arrows this ` +
				`factory builds are invisible — give the parameter a literal type, or teach the extractor.`
		);
	}
	return [...found];
}

/**
 * The union of ARRAY-LITERAL arguments passed at the position of a factory's `name` parameter.
 *
 * Sibling of `factoryParameterRange`: `statusChange('DEGRADED', 'ValidatorDegraded', ['ACTIVE'])` declares its
 * source states at the CALL SITE, and the `advanceStatus` inside the factory only sees `...from`.
 */
function factoryArrayParameter(source: string, before: number, name: string): string[] | null {
	const heads = [...source.slice(0, before).matchAll(/(?:^|\n)(?:export )?(?:function (\w+)|const (\w+) = )/g)];
	const head = heads.at(-1);
	if (!head) return null;
	const factory = (head[1] ?? head[2]) as string;
	const sig = source.slice(head.index, before);
	const paramList = /\(([\s\S]*?)\)\s*(?::[^{]*)?(?:=>\s*)?\{/.exec(sig)?.[1] ?? '';
	const position = paramList
		.split(/,(?![^[]*\])/)
		.findIndex((p) => new RegExp(`(^|\\s)${name}(\\?)?\\s*:`).test(p));
	if (position < 0) return null;
	const found = new Set<string>();
	for (const c of source.matchAll(new RegExp(`\\b${factory}\\(([^)]*)\\)`, 'g'))) {
		const arg = (c[1] as string).split(/,(?![^[]*\])/)[position]?.trim() ?? '';
		for (const lit of arg.matchAll(/'([^']+)'/g)) found.add(lit[1] as string);
	}
	return found.size > 0 ? [...found] : null;
}

/** Every arrow some `advanceStatus` call site declares it can perform. */
function declaredArrows(): DeclaredArrow[] {
	const arrows: DeclaredArrow[] = [];
	let sites = 0;
	for (const file of HANDLER_FILES) {
		let source: string;
		try {
			source = readFileSync(`${HANDLERS}/${file}`, 'utf8');
		} catch {
			continue; // the file list is a superset; a handler family that does not exist yet is not an error
		}
		const consts = stringConstants(source);
		for (const call of source.matchAll(/advanceStatus\(\s*ctx\s*,\s*command\s*,\s*\{/g)) {
			sites += 1;
			const open = source.indexOf('{', call.index + 'advanceStatus('.length);
			const body = objectLiteralAt(source, open);
			const site = `${file}:${source.slice(0, call.index).split('\n').length}`;

			const machineRaw = /(?:^|\n)\s*machine:\s*([^,\n]+),/.exec(body);
			if (!machineRaw) {
				throw new Error(
					`arrow-command-census: an advanceStatus site at ${site} declares no \`machine\`. Every status ` +
						`advance names its machine; a site that does not is unreadable to this census and therefore ` +
						`unaudited.`
				);
			}
			const machine = resolve(machineRaw[1] as string, consts, site, 'machine');

			// TARGET — three shapes, and only the first is statically knowable:
			//   `target: 'X'` / `target: CONST`  → one arrow head
			//   `target: (state) => …`           → a deriver
			//   `target,`                        → shorthand, bound to a value computed in the handler body
			// The last two need a DECLARED range, which `advanceStatus` also enforces at runtime.
			const targetRaw = /(?:^|\n)\s*target:\s*([^\n]*)/.exec(body);
			const shorthand = /(?:^|\n)\s*target\s*,/.test(body);
			if (!targetRaw && !shorthand) {
				throw new Error(`arrow-command-census: no \`target\` at ${site}`);
			}
			const targetExpr = targetRaw ? (targetRaw[1] as string).trim().replace(/,$/, '') : '';
			const statik = !shorthand && (/^'[^']*'$/.test(targetExpr) || consts.has(targetExpr));
			let targets: string[];
			if (!statik) {
				const literalRange = /(?:^|\n)\s*targetStates:\s*\[([^\]]*)\]/.exec(body);
				// `targetStates: Object.keys(TABLE)` — resolved from TABLE's own keys, so a site already bounded
				// by a lookup table keeps ONE source of truth rather than a second list that can drift from it.
				const tableRange = /(?:^|\n)\s*targetStates:\s*Object\.keys\(\s*([A-Za-z_]\w*)\s*\)/.exec(body);
				// `targetStates: SomeSchema.options` — resolved from the RATIFIED enum itself, imported here. Same
				// principle as the table form: the range lives in one place, and a contract change moves both the
				// runtime guard and this census together.
				const schemaRange = /(?:^|\n)\s*targetStates:\s*([A-Za-z_]\w*Schema)\.options/.exec(body);
				let range: string[] | null = null;
				if (literalRange) {
					range = [...(literalRange[1] as string).matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
				} else if (tableRange) {
					range = objectKeysOf(source, tableRange[1] as string, site);
				} else if (schemaRange) {
					const name = schemaRange[1] as string;
					const schema = (CONTRACT_SCHEMAS as Record<string, { options?: readonly string[] }>)[name];
					if (!schema?.options) {
						throw new Error(
							`arrow-command-census: ${site} declares targetStates from ${name}.options, but that export ` +
								`is not an enum schema in @janumipwb/rph-contracts.`
						);
					}
					range = [...schema.options];
				} else {
					// LAST, and the order matters. Factory inference is a guess from surrounding source; an explicit
					// `targetStates` is a statement by the site itself. Trying inference first let it answer for a
					// site that had already declared its range, and the census then reported seven built
					// AssuranceAssessment.state arrows as uncovered — a false finding produced by the instrument.
					range = factoryParameterRange(source, call.index, site);
				}
				if (!range) {
					throw new Error(
						`arrow-command-census: ${site} computes its target and declares no \`targetStates\`. A ` +
							`computed range is not statically knowable; declare it (advanceStatus also checks it at ` +
							`runtime) rather than leaving the arrows it drives unaudited.`
					);
				}
				targets = range;
			} else {
				targets = [resolve(targetExpr, consts, site, 'target')];
			}

			// SOURCES — `fromStates(...)` anywhere in the precondition expression. Its absence is legal (a
			// `predicate`-only precondition), and means the command is not narrowed by source state: every arrow
			// the MACHINE declares into the target is then performable.
			const froms = /fromStates\(([^)]*)\)/.exec(body);
			let declaredFrom: string[] | null = null;
			if (froms) {
				declaredFrom = [...(froms[1] as string).matchAll(/'([^']+)'/g)].map((m) => m[1] as string);
				// `fromStates(...from)` — the sources are a factory parameter, so the CALL SITES hold them, exactly
				// as they hold the target. Resolved the same way rather than given a second mechanism.
				const spread = /^\s*\.\.\.(\w+)\s*$/.exec(froms[1] as string);
				if (declaredFrom.length === 0 && spread) {
					declaredFrom = factoryArrayParameter(source, call.index, spread[1] as string);
				}
				if (!declaredFrom || declaredFrom.length === 0) {
					// ⚠ THE CENSUS COMMITTED ITS OWN FAILURE MODE HERE AND IT TOOK A CONTRADICTION TO SEE IT.
					// `fromStates(...from)` — a SPREAD, in validator-registry.ts's factory — yields no literals, and
					// an empty array is TRUTHY, so `?? machineDef…` never fired and the site contributed ZERO arrows
					// instead of all of them. Four built ValidatorRegistryEntry arrows were reported uncovered AND
					// the machine appeared in the orphan list, which is impossible if it had declared even one:
					// the two outputs disagreed, which is the only reason it surfaced.
					//
					// So: a source list this cannot read is now LOUD. Not `null` (fall back to every machine
					// in-arrow, over-reporting coverage — the dangerous direction), and not `[]`.
					throw new Error(
						`arrow-command-census: ${site} declares fromStates(${froms[1]}) with no string literals — ` +
							`a spread or computed source list. Its source states are unreadable, so its arrows would be ` +
							`silently dropped. Pass literals, or teach the extractor this shape deliberately.`
					);
				}
			}

			const machineDef = STATE_MACHINES[machine];
			if (!machineDef) {
				throw new Error(
					`arrow-command-census: ${site} names machine \`${machine}\`, which transitions.data.ts does not ` +
						`declare. One of the two is wrong and neither can be assumed.`
				);
			}
			for (const to of targets) {
				const sources =
					declaredFrom ??
					machineDef.transitions.filter((t) => t.to === to).map((t) => t.from);
				for (const from of sources) arrows.push({ machine, from, to, site });
			}
		}
	}
	if (sites === 0) {
		throw new Error('arrow-command-census: found no advanceStatus call sites at all — the extractor is broken.');
	}

	// ── THE SECOND IDIOM, AND IT IS DATA RATHER THAN SOURCE ─────────────────────────────────────────────────
	// `ExecutionStep.stepState` is not driven by `advanceStatus`. Its nine commands are declared in
	// `STEP_COMMAND_SPECS` (rph-domain) as `{ commandType, target, sourceStates }` and executed by `advanceStep`.
	// That table is EXPORTED, so this reads the values rather than re-parsing the file — no extractor, no drift.
	// Omitting it would report all 20 stepState arrows uncovered: safe, but 20 false positives is how a real
	// finding gets lost in a baseline nobody reads.
	for (const spec of Object.values(STEP_COMMAND_SPECS)) {
		for (const from of spec.sourceStates) {
			arrows.push({
				machine: 'ExecutionStep.stepState',
				from,
				to: spec.target,
				site: `STEP_COMMAND_SPECS.${spec.commandType}`
			});
		}
	}
	return arrows;
}

const key = (machine: string, from: string, to: string) => `${machine}  ${from} -> ${to}`;

/**
 * Arrows deliberately not yet performable, each bound to the register entry that justifies it.
 *
 * ⚠ AN EXEMPTION LIST ROTS INTO AN ALLOWLIST. Every entry names an OPEN register id; when that id closes, the
 * arrow must have a command or this census fails. Nothing may be added here without an id.
 */
const EXEMPT: ReadonlyMap<string, string> = new Map([]);

/** The derived population: arrows nothing can perform, and machines no handler declares. */
function census(): { uncovered: string[]; orphans: string[] } {
	const arrows = declaredArrows();
	const covered = new Set(arrows.map((a) => key(a.machine, a.from, a.to)));
	const uncovered: string[] = [];
	for (const [machine, def] of Object.entries(STATE_MACHINES)) {
		for (const t of def.transitions) {
			const k = key(machine, t.from, t.to);
			if (!covered.has(k) && !EXEMPT.has(k)) uncovered.push(k);
		}
	}
	const declared = new Set(arrows.map((a) => a.machine));
	return {
		uncovered: uncovered.sort(),
		orphans: Object.keys(STATE_MACHINES)
			.filter((m) => !declared.has(m))
			.sort()
	};
}

/**
 * The baseline is DATA, in a committed JSON file, not a literal in this test.
 *
 * ⚠ AND THE REASON IS A MISTAKE THIS FILE MADE. The first version generated a 220-entry array literal by
 * scraping vitest's own failure output — which TRUNCATES long diffs, so the "baseline" silently lost an entry
 * and the census disagreed with itself. A baseline captured from a report of the thing, rather than from the
 * thing, is exactly the second-hand evidence this repository keeps finding. `bun run arrows:pin` writes it from
 * the census function below; nothing else may edit it.
 */
const BASELINE_PATH = new URL('./arrow-command-census.baseline.json', import.meta.url).pathname.replace(
	/^\/([A-Za-z]:)/,
	'$1'
);

if (process.env.PIN_ARROW_BASELINE === '1') {
	const { uncovered, orphans } = census();
	writeFileSync(BASELINE_PATH, `${JSON.stringify({ uncovered, orphans }, null, '\t')}\n`, 'utf8');
}

const BASELINE = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as {
	uncovered: string[];
	orphans: string[];
};

describe('C-0 — every declared arrow can be performed by some command', () => {
	it('pins the ARROW TOTAL, so an uncovered arrow cannot be resolved by deleting it', () => {
		const total = Object.values(STATE_MACHINES).reduce((n, m) => n + m.transitions.length, 0);
		// THE ANTI-REGRESSION THAT MAKES THE RATCHET BELOW HONEST. Without this, `ARROWS_WITHOUT_COMMAND` falls
		// when someone removes an arrow from transitions.data.ts — the number improves and the machine loses a
		// ratified transition. Deleting an arrow is legitimate; doing it silently is not.
		expect(total, 'the declared arrow total moved — update this pin DELIBERATELY').toBe(ARROW_TOTAL);
	});

	it('lists every arrow no registered command can perform', () => {
		const { uncovered } = census();
		// THE LIST IS THE OUTPUT. A count tells a reader nothing about which capability is missing, and a reader
		// who cannot see `Harness.status  COORDINATING -> WAITING` cannot tell that the coordinator is immovable.
		expect(uncovered, `arrows no command can perform:\n${uncovered.join('\n')}`).toEqual(
			UNCOVERED_BASELINE
		);
	});

	it('lists every machine no handler declares at all', () => {
		const { orphans } = census();
		expect(orphans, `machines with no advanceStatus site:\n${orphans.join('\n')}`).toEqual(
			ORPHAN_MACHINE_BASELINE
		);
	});
});

// ── BASELINES ────────────────────────────────────────────────────────────────────────────────────────────────
// These are a comparison TARGET, never a filter: the census derives its population from the data every run and
// this is what it must equal. A new uncovered arrow fails; so does an arrow that becomes covered, which is the
// point — closing one is a deliberate, reviewed edit here.
const ARROW_TOTAL = 304;
