// THE ARROW × COMMAND EXTRACTOR — which state-machine arrows a registered command can actually perform.
//
// ── WHY THIS IS AN AST WALK AND NOT A REGEX, WHICH IS A FINDING ABOUT THE FIRST ATTEMPT ──────────────────────
//
// The first version of this extractor was regexes, and every single failure it produced was a PARSE failure
// rather than a logic failure: a trailing comma, a shorthand property, a spread argument, a doc comment
// containing a comma inside a parameter list. Each was patched individually, and the fourth one shipped a
// SILENT DROP — `fromStates(...from)` yielded no string literals, `[]` is truthy so the fallback never fired,
// and that site contributed zero arrows instead of all of them. A census that quietly narrows its own
// population is the exact defect this instrument exists to catch, committed inside the instrument.
//
// It surfaced only because two outputs CONTRADICTED each other: `ValidatorRegistryEntry.status` appeared in the
// uncovered list AND in the orphan-machine list, which is impossible if it had declared even one arrow. That is
// luck, not method. `typescript` is already a dependency; parsing properly removes the whole class.
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { isExcludedMachine, STATE_MACHINES, STEP_COMMAND_SPECS,
	PWU_LIFECYCLE_COMMAND_SPECS,
	PWU_GENERIC_SETTER_SPECS,
	PWU_LIFECYCLE_MACHINE
} from '@janumipwb/rph-domain';
import * as CONTRACT_SCHEMAS from '@janumipwb/rph-contracts';

const HANDLERS = new URL('../packages/rph-application/src/handlers/', import.meta.url).pathname.replace(
	/^\/([A-Za-z]:)/,
	'$1'
);

export interface DeclaredArrow {
	readonly machine: string;
	readonly from: string;
	readonly to: string;
	readonly site: string;
}

/** Every `.ts` in the handler directory except tests and the kit that DEFINES `advanceStatus`. */
function handlerFiles(): string[] {
	// Derived from the filesystem, never a hand list: a new handler family must not be able to appear without
	// this census seeing it. That is the whole reason the population is not enumerated here.
	return readdirSync(HANDLERS)
		.filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'kit.ts')
		.sort();
}

const fail = (site: string, why: string): never => {
	throw new Error(`arrow-command-census: ${site} — ${why}`);
};

/** Top-level `const NAME = 'literal'` in this file. */
function stringConsts(sf: ts.SourceFile): Map<string, string> {
	const out = new Map<string, string>();
	for (const st of sf.statements) {
		if (!ts.isVariableStatement(st)) continue;
		for (const d of st.declarationList.declarations) {
			if (ts.isIdentifier(d.name) && d.initializer && ts.isStringLiteral(d.initializer)) {
				out.set(d.name.text, d.initializer.text);
			}
		}
	}
	return out;
}

/** Top-level `const NAME = { KEY: … }` in this file, by name. */
function objectLiterals(sf: ts.SourceFile): Map<string, ts.ObjectLiteralExpression> {
	const out = new Map<string, ts.ObjectLiteralExpression>();
	for (const st of sf.statements) {
		if (!ts.isVariableStatement(st)) continue;
		for (const d of st.declarationList.declarations) {
			if (ts.isIdentifier(d.name) && d.initializer && ts.isObjectLiteralExpression(d.initializer)) {
				out.set(d.name.text, d.initializer);
			}
		}
	}
	return out;
}

const prop = (o: ts.ObjectLiteralExpression, name: string) =>
	o.properties.find((p) => p.name !== undefined && ts.isIdentifier(p.name) && p.name.text === name);

/** String literals directly inside an expression (array literal, call arguments, a bare literal). */
function literalsIn(node: ts.Node): string[] {
	const out: string[] = [];
	const walk = (n: ts.Node) => {
		if (ts.isStringLiteral(n)) out.push(n.text);
		else ts.forEachChild(n, walk);
	};
	walk(node);
	return out;
}

/** The function (declaration or arrow) that lexically encloses `node`, with its name if it has one. */
function enclosingFunction(node: ts.Node): { fn: ts.SignatureDeclaration; name: string } | undefined {
	for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
		if (ts.isFunctionDeclaration(n) && n.name) return { fn: n, name: n.name.text };
		if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
			const decl = n.parent;
			if (ts.isVariableDeclaration(decl) && ts.isIdentifier(decl.name)) {
				return { fn: n, name: decl.name.text };
			}
		}
	}
	return undefined;
}

/**
 * Resolve a value that is a PARAMETER of the enclosing factory.
 *
 * Two handler families build handlers from a factory, so the arrows are declared at the factory's CALL SITES:
 * `makeDecisionEffective(target: 'EFFECTIVE', …)` states its range in the TYPE; `statusChange('DEGRADED', …,
 * ['ACTIVE'])` states it in the arguments. Both are read here — a parameter's literal type first, then callers.
 */
function factoryParameter(sf: ts.SourceFile, at: ts.Node, paramName: string): string[] | undefined {
	const enclosing = enclosingFunction(at);
	if (!enclosing) return undefined;
	const index = enclosing.fn.parameters.findIndex(
		(p) => ts.isIdentifier(p.name) && p.name.text === paramName
	);
	if (index < 0) return undefined;

	const declared = enclosing.fn.parameters[index]?.type;
	if (declared) {
		const fromType = literalsIn(declared);
		if (fromType.length > 0) return fromType; // the type says it
	}

	const found = new Set<string>();
	const walk = (n: ts.Node) => {
		if (
			ts.isCallExpression(n) &&
			ts.isIdentifier(n.expression) &&
			n.expression.text === enclosing.name
		) {
			const arg = n.arguments[index];
			if (arg) for (const lit of literalsIn(arg)) found.add(lit);
		}
		ts.forEachChild(n, walk);
	};
	walk(sf);
	return found.size > 0 ? [...found] : undefined;
}

/** The declared range of a computed `target`: a literal list, a table's keys, or a ratified enum's options. */
function declaredRange(
	sf: ts.SourceFile,
	spec: ts.ObjectLiteralExpression,
	site: string
): string[] | undefined {
	const p = prop(spec, 'targetStates');
	if (!p || !ts.isPropertyAssignment(p)) return undefined;
	const init = p.initializer;

	if (ts.isArrayLiteralExpression(init)) return literalsIn(init);

	// `Object.keys(TABLE)` — the table already bounds the target, so this keeps ONE source of truth.
	if (
		ts.isCallExpression(init) &&
		ts.isPropertyAccessExpression(init.expression) &&
		init.expression.name.text === 'keys' &&
		init.arguments[0] &&
		ts.isIdentifier(init.arguments[0])
	) {
		const name = (init.arguments[0] as ts.Identifier).text;
		const table = objectLiterals(sf).get(name);
		if (!table) fail(site, `targetStates reads Object.keys(${name}) but ${name} is not a top-level object`);
		const keys = (table as ts.ObjectLiteralExpression).properties
			.map((q) => (q.name && ts.isIdentifier(q.name) ? q.name.text : undefined))
			.filter((k): k is string => k !== undefined);
		if (keys.length === 0) fail(site, `${name} yielded no keys`);
		return keys;
	}

	// `SomeSchema.options` — resolved from the ratified enum itself, so a contract change moves both the runtime
	// guard and this census together.
	if (ts.isPropertyAccessExpression(init) && init.name.text === 'options' && ts.isIdentifier(init.expression)) {
		const name = init.expression.text;
		// `as unknown as` rather than a direct cast: the contracts module's type has no overlap with an index
		// signature (it carries `RPH_CONTRACTS_VERSION: '0.0.0'` among the schemas), so tsc rejects the one-step
		// form. The runtime guard on the next line is what makes the widening safe.
		const schema = (CONTRACT_SCHEMAS as unknown as Record<string, { options?: readonly string[] }>)[name];
		if (!schema?.options) fail(site, `targetStates reads ${name}.options, which is not an enum schema`);
		return [...(schema as { options: readonly string[] }).options];
	}

	return fail(site, 'targetStates is present but is not a literal list, Object.keys(…), or Schema.options');
}

/** Every arrow a command declares it can perform. Throws on any shape it cannot read — never skips a site. */
/**
 * ⚠ MEMOIZED — REG-F-116. Each of these two walks parses EVERY handler file with the TypeScript compiler
 * (`ts.createSourceFile`), and they are pure functions of a source tree that cannot change inside one vitest module
 * run. `declaredArrows()` alone is called three times in `arrow-census-coverage.test.ts` and again from other
 * suites, so the compiler was re-parsing the whole handler directory once per call.
 *
 * MEASURED UNDER LOAD, WHICH IS THE CONDITION THAT DECIDES A GATE. That file's CONTROL costs 4345ms in isolation
 * and **15727ms with a second vitest running — over its declared 15_000 budget, so it FAILS.** A declared control
 * runs the whole suite, so a control that tips its own timeout is reported as a verdict about an unrelated mutation
 * (REG-F-116's subject). The amplification is ~4×, far more than CPU contention explains: it is I/O between
 * workers, and the fix is to stop asking for the same bytes.
 *
 * SAFE BECAUSE THE INPUT IS FROZEN FOR THE RUN, and unsafe to memoize anywhere it is not — the mutation runner
 * mutates files BETWEEN vitest invocations, never during one, so a fresh process always re-reads.
 */
/**
 * The advance PRIMITIVES whose call sites declare an arrow — REG-F-117.
 *
 * ⚠ THIS IS A SET OF NAMES, NOT A SET OF IDIOMS, AND THE DIFFERENCE IS THE WHOLE POINT. Both entries are read by
 * the SAME walk below: `machine`, `target`, and `fromStates(...)` inside `precondition`. Nothing downstream
 * branches on which primitive it was. REG-F-114 weighed *"teach the reader every idiom"* — fragile, and how C-0b
 * dropped 30% — against normalising the handlers, and ruled a third way: **make the idiom self-declaring.**
 * `advanceIntent` already declared its source set (`fromStates`, REQUIRED since JAN-CMDPRE DWP-06) and already
 * enforced it before `checkTransition`; the only thing this reader could not recover was WHICH MACHINE, because
 * that primitive closed over a module constant instead of being told. It is now told, so the two idioms converge
 * and this list grows by a NAME rather than by a code path.
 *
 * ⚠ A THIRD ENTRY MUST EARN ITS PLACE THE SAME WAY. Adding a primitive here that does NOT declare `machine`,
 * `target` and its source set will `fail()` at its first call site rather than silently contributing partial
 * arrows — which is the behaviour that keeps this list from becoming a way to widen coverage without widening
 * declarations.
 */
const ADVANCE_PRIMITIVES: ReadonlySet<string> = new Set(['advanceStatus', 'advanceIntent']);

let arrowsCache: DeclaredArrow[] | undefined;
export function declaredArrows(): DeclaredArrow[] {
	arrowsCache ??= computeDeclaredArrows();
	return arrowsCache;
}

/**
 * Every arrow ONE source file declares, plus how many advance-primitive sites it holds.
 *
 * EXPORTED AS A SEAM, AND THE RATCHET'S OWN POSITIVE CASE IS WHY (REG-F-122). The refusals in the SOURCES block
 * below had exactly one live instance (`governance.ts:293`, a shorthand `precondition`), and it left the
 * repository in the same commit that made them refusals — so no test over the real handler tree can ever enter
 * their failing arms again. Only a SYNTHETIC source file can hold them red, which requires the per-file walk to
 * take a `ts.SourceFile` instead of closing over the handler directory.
 */
export function declaredArrowsInFile(sf: ts.SourceFile): { arrows: DeclaredArrow[]; sites: number } {
	const arrows: DeclaredArrow[] = [];
	let sites = 0;
	const consts = stringConsts(sf);

	const visit = (node: ts.Node): void => {
		ts.forEachChild(node, visit);
		if (!ts.isCallExpression(node)) return;
		if (!ts.isIdentifier(node.expression) || !ADVANCE_PRIMITIVES.has(node.expression.text)) return;
		const spec = node.arguments[2];
		if (!spec || !ts.isObjectLiteralExpression(spec)) return;
		sites += 1;
		const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
		const site = `${sf.fileName}:${line}`;

		// MACHINE
		const mp = prop(spec, 'machine');
		if (!mp || !ts.isPropertyAssignment(mp)) return fail(site, 'declares no `machine`');
		const machine = ts.isStringLiteral(mp.initializer)
			? mp.initializer.text
			: ts.isIdentifier(mp.initializer)
				? (consts.get(mp.initializer.text) ??
					fail(site, `machine \`${mp.initializer.text}\` is not a top-level string const`))
				: fail(site, 'machine is neither a string literal nor a named constant');
		if (!STATE_MACHINES[machine])
			fail(site, `names machine \`${machine}\`, which transitions.data.ts does not declare`);

		// TARGET — a literal/const head, or a computed one whose RANGE must be declared.
		const tp = prop(spec, 'target');
		if (!tp) return fail(site, 'declares no `target`');
		let targets: string[];
		const staticTarget =
			ts.isPropertyAssignment(tp) && ts.isStringLiteral(tp.initializer)
				? tp.initializer.text
				: ts.isPropertyAssignment(tp) && ts.isIdentifier(tp.initializer)
					? consts.get(tp.initializer.text)
					: undefined;
		if (staticTarget !== undefined) {
			targets = [staticTarget];
		} else {
			// An explicit declaration WINS over inference. Trying inference first once let it answer for a site
			// that had already declared its range, and the census reported four built arrows as uncovered.
			const declared = declaredRange(sf, spec, site);
			const name = ts.isShorthandPropertyAssignment(tp)
				? tp.name.text
				: ts.isPropertyAssignment(tp) && ts.isIdentifier(tp.initializer)
					? tp.initializer.text
					: undefined;
			targets =
				declared ??
				(name ? factoryParameter(sf, node, name) : undefined) ??
				fail(
					site,
					'computes its target and declares no `targetStates`. A computed range is not statically ' +
						'knowable; declare it (advanceStatus checks it at runtime too) rather than leaving the ' +
						'arrows it drives unaudited'
				);
		}

		// SOURCES — `fromStates(...)` read from the precondition AT THIS LITERAL, and from nowhere else.
		//
		// ⚠ THE EXPRESSION THAT USED TO CLOSE THIS BLOCK WAS THE CENSUS'S OWN REG-F-114 VIOLATION (REG-F-122):
		// `sources ?? def.transitions.filter((t) => t.to === to).map((t) => t.from)` — when no `fromStates` was
		// readable, the walk silently substituted the MACHINE'S in-edges for the site's declaration. Measured
		// before removal: exactly ONE of 46 sites ever reached it (`governance.ts:293`, a shorthand
		// `precondition` bound to a factory parameter), and there the substitution happened to coincide with the
		// callers' declared `fromStates('PROPOSED')` only because `Decision.status` has a single in-arrow to
		// EFFECTIVE — nil arithmetic effect by luck, not by soundness. That site now declares at the literal, and
		// this walk REFUSES rather than infers: reading a declaration cannot fabricate one; inferring a missing
		// half can.
		const pp = prop(spec, 'precondition');
		if (!pp)
			return fail(
				site,
				'declares no `precondition`. Every advance site names its source set with `fromStates(…)` in the ' +
					'literal; the census reads a from-half from nowhere else (REG-F-114)'
			);
		if (
			ts.isShorthandPropertyAssignment(pp) ||
			(ts.isPropertyAssignment(pp) && ts.isIdentifier(pp.initializer))
		)
			return fail(
				site,
				'passes its `precondition` through a bare name the walk cannot see into. A `fromStates(…)` hidden ' +
					'behind that name would leave this site read as un-narrowed and its from-half taken from the ' +
					"machine's in-edges — a fabricated declaration (REG-F-114). Compose the precondition in this " +
					'literal; `governance.ts:293` was this exact shape'
			);
		if (!ts.isPropertyAssignment(pp))
			return fail(site, '`precondition` is not a property assignment the walk can read');
		let call: ts.CallExpression | undefined;
		const find = (n: ts.Node) => {
			if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'fromStates') {
				call ??= n;
			}
			ts.forEachChild(n, find);
		};
		find(pp.initializer);
		if (call === undefined)
			return fail(
				site,
				'declares a precondition with no readable `fromStates(…)`. The census does NOT infer a from-half ' +
					'from STATE_MACHINES (REG-F-114) — if this command is genuinely un-narrowed by source state, ' +
					'that is a new idiom to be taught deliberately, with its own ruling, not defaulted into'
			);
		let sources: string[];
		const direct = call.arguments.filter(ts.isStringLiteral).map((a) => a.text);
		if (direct.length > 0) sources = direct;
		else {
			// `fromStates(...from)` — the sources are a factory parameter; the CALL SITES hold them.
			const spread = call.arguments.find(ts.isSpreadElement);
			const id = spread && ts.isIdentifier(spread.expression) ? spread.expression.text : undefined;
			sources =
				(id ? factoryParameter(sf, node, id) : undefined) ??
				fail(
					site,
					'declares a fromStates(…) whose source states are unreadable. Never dropped silently: ' +
						'an unreadable source list would contribute zero arrows and read as full coverage'
				);
		}

		for (const to of targets) {
			for (const f of sources) arrows.push({ machine, from: f, to, site });
		}
	};
	visit(sf);
	return { arrows, sites };
}

function computeDeclaredArrows(): DeclaredArrow[] {
	const arrows: DeclaredArrow[] = [];
	let sites = 0;

	for (const file of handlerFiles()) {
		const source = readFileSync(HANDLERS + file, 'utf8');
		const perFile = declaredArrowsInFile(ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true));
		arrows.push(...perFile.arrows);
		sites += perFile.sites;
	}

	if (sites === 0) fail('extractor', 'found no advanceStatus call sites at all — it is broken');

	// THE SECOND IDIOM, AND IT IS DATA. `ExecutionStep.stepState` is driven by `STEP_COMMAND_SPECS`, not by
	// `advanceStatus`. That table is exported, so this reads the values rather than re-parsing the file.
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
	// THE THIRD IDIOM, AND IT IS ALSO DATA (REG-F-114). `PWU.workLifecycleState` is driven by
	// `advancePwuLifecycle`, which took a bare `target` and resolved the source at RUNTIME — so its call sites
	// declared a DESTINATION and never an arrow, and 49 of this machine's 57 arrows were invisible here.
	//
	// ⚠ THE FIX WAS NOT TO TEACH THIS READER A NEW AST IDIOM, and that distinction is the whole ruling. To read
	// `advancePwuLifecycle` syntactically the census would have had to INFER the from-half from `STATE_MACHINES`
	// — reporting arrows the code never declared, turning an honest 38% into a dishonest 100%. Instead the
	// COMMANDS now declare their source sets, exactly as step commands do, and this reads the declaration.
	// **Reading a declaration cannot fabricate one; inferring a missing half can.**
	for (const spec of Object.values(PWU_LIFECYCLE_COMMAND_SPECS)) {
		for (const from of spec.sourceStates) {
			arrows.push({
				machine: PWU_LIFECYCLE_MACHINE,
				from,
				to: spec.target,
				site: `PWU_LIFECYCLE_COMMAND_SPECS.${spec.commandType}`
			});
		}
	}
	// THE FOURTH IDIOM, AND IT IS THE SAME DATA LOOP — REG-F-119. `ChangePwuState` takes its target from
	// `payload.newState` at runtime, so its call site declares nothing at all; the eight arrows it performs are the
	// PWU's main lifecycle spine and were invisible while forty-nine peripheral ones were visible. Keyed by TARGET
	// rather than by commandType, because one command performs all eight — the site must name WHICH row, or eight
	// arrows would share one locator and a drifted row could not be pointed at.
	for (const spec of Object.values(PWU_GENERIC_SETTER_SPECS)) {
		for (const from of spec.sourceStates) {
			arrows.push({
				machine: PWU_LIFECYCLE_MACHINE,
				from,
				to: spec.target,
				site: `PWU_GENERIC_SETTER_SPECS.${spec.target}`
			});
		}
	}
	return arrows;
}

/**
 * The states a CREATION can bring an object into existence in, read from the `births` declarations at the
 * `createObject` sites (`kit.ts`), which `createObject` also checks at runtime.
 *
 * ⚠ READ FROM THE DECLARATIONS AND NOT FROM `initialState`, WHICH LIES (REG-F-071). Four machines declare an
 * initial state the engine never writes. Seeding occupancy from `initialState` would mark a state occupied
 * because a diagram says so — the exact substitution of declaration for behaviour this whole file exists to
 * refuse.
 */
/** Memoized for the same reason as `declaredArrows` — a second full TypeScript parse of the same directory. */
let birthsCache: Map<string, Set<string>> | undefined;
export function birthStates(): Map<string, Set<string>> {
	birthsCache ??= computeBirthStates();
	return birthsCache;
}

/**
 * The primitives at whose call sites a BIRTH is declared — REG-F-086, and the same shape as `ADVANCE_PRIMITIVES`.
 *
 * `createObject` was the only one, which is exactly why `Intent.intentStatus` and `PWU.workLifecycleState` had no
 * declarable birth: `captureIntent` and `proposePwu` commit through `commitState` directly. REG-F-086 recorded that
 * as *"the birth cannot be declared"* — the blocker was real, the conclusion was not. **A declaration mechanism
 * attached to one primitive does not reach the sites that use another.**
 */
const BIRTH_PRIMITIVES: ReadonlySet<string> = new Set(['createObject', 'commitState']);

/** Does this commit spec CREATE the aggregate? `CommitArgs` defines it: `expectedRevision: undefined`. */
function createsAggregate(spec: ts.ObjectLiteralExpression): boolean {
	const p = prop(spec, 'expectedRevision');
	return (
		!!p &&
		ts.isPropertyAssignment(p) &&
		ts.isIdentifier(p.initializer) &&
		p.initializer.text === 'undefined'
	);
}

function computeBirthStates(): Map<string, Set<string>> {
	const out = new Map<string, Set<string>>();
	let declarations = 0;
	for (const file of handlerFiles()) {
		const source = readFileSync(HANDLERS + file, 'utf8');
		// A file matters if it DECLARES a birth or CONTAINS a creation — the second half is what the ratchet below
		// needs, and the old early-out (`births:` only) would have skipped every file it exists to catch.
		if (!source.includes('births:') && !source.includes('expectedRevision: undefined')) continue;
		const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
		const visit = (node: ts.Node): void => {
			ts.forEachChild(node, visit);
			if (!ts.isCallExpression(node)) return;
			if (!ts.isIdentifier(node.expression) || !BIRTH_PRIMITIVES.has(node.expression.text)) return;
			const spec = node.arguments[2];
			if (!spec || !ts.isObjectLiteralExpression(spec)) return;
			const p = prop(spec, 'births');
			const site = `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
			// ⚠ THE RATCHET (REG-F-086): A CREATION THAT DECLARES NO BIRTH IS A FAILURE, NOT A SKIP.
			//
			// Until now `births` was declare-if-you-like, so a new creation simply did not appear — and a machine
			// that never appears is `unanalysed`, which reads as "not yet reached" rather than "nobody said". The
			// two are opposite claims. `CommitArgs` defines a create in terms a reader can check —
			// `expectedRevision: undefined` means *"the aggregate must NOT yet exist"* — so the census asks that
			// question of the code rather than of a list someone maintains.
			//
			// ⚠ NO EXEMPTION IS NEEDED FOR `createObject`'s OWN DELEGATION, AND I SHIPPED ONE BEFORE CHECKING.
			//
			// `createObject` commits through `commitState`, so its inner call IS a creation declaring no `births` —
			// its caller declares them a frame up. I wrote a structural exemption for exactly that ("this call sits
			// inside another birth primitive"), and its mutant SURVIVED: `handlerFiles()` has excluded `kit.ts`
			// since long before any of this, so the census never walks the delegating site and the exemption
			// guarded a case that cannot arise. **A guard for an impossible case is a hollow** — the defect this
			// programme keeps recording, authored here inside the fix for a census. Deleted rather than kept "just
			// in case", because the mutant that proved it dead is the only thing that would have kept it honest.
			//
			// If `kit.ts` is ever brought into the population, this ratchet will fire on that delegating call —
			// which is CORRECT, and the moment to decide deliberately rather than to have pre-decided blindly.
			if (!p && createsAggregate(spec)) {
				return fail(
					site,
					'commits a CREATION (`expectedRevision: undefined`) and declares no `births`. The occupancy ' +
						'census seeds from births, so an undeclared creation makes its machine unanalysable — which ' +
						'reads as "no state is reachable yet" rather than "nobody said". Declare the machine and the ' +
						'state this command actually commits it into'
				);
			}
			if (!p || !ts.isPropertyAssignment(p)) return;
			if (!ts.isArrayLiteralExpression(p.initializer)) {
				return fail(site, '`births` must be an array literal so the census can read it');
			}
			for (const entry of p.initializer.elements) {
				if (!ts.isObjectLiteralExpression(entry)) fail(site, 'each `births` entry must be an object literal');
				const obj = entry as ts.ObjectLiteralExpression;
				const machineProp = prop(obj, 'machine');
				const valuesProp = prop(obj, 'values');
				if (
					!machineProp ||
					!ts.isPropertyAssignment(machineProp) ||
					!ts.isStringLiteral(machineProp.initializer)
				) {
					return fail(site, '`births[].machine` must be a string literal');
				}
				const machine = machineProp.initializer.text;
				if (!STATE_MACHINES[machine]) fail(site, `births names unknown machine \`${machine}\``);
				if (!valuesProp || !ts.isPropertyAssignment(valuesProp)) {
					return fail(site, '`births[].values` is required');
				}
				const values = literalsIn(valuesProp.initializer);
				if (values.length === 0) fail(site, '`births[].values` yielded no string literals');
				for (const v of values) {
					if (!STATE_MACHINES[machine]?.states.includes(v)) {
						fail(site, `births declares \`${v}\`, which is not a state of ${machine}`);
					}
					const set = out.get(machine) ?? new Set<string>();
					set.add(v);
					out.set(machine, set);
					declarations += 1;
				}
			}
		};
		visit(sf);
	}
	if (declarations === 0) {
		fail('births', 'no `births` declarations found at all — the occupancy census would be vacuous');
	}
	return out;
}

/**
 * The states an object can actually BE IN: born, or reached from an occupiable state by an arrow some command
 * can perform. A least-fixed-point, because occupancy propagates.
 */
export function occupiable(): Map<string, Set<string>> {
	const births = birthStates();
	const covered = declaredArrows();
	const out = new Map<string, Set<string>>();
	for (const [machine, seeds] of births) out.set(machine, new Set(seeds));
	let grew = true;
	while (grew) {
		grew = false;
		for (const a of covered) {
			const set = out.get(a.machine);
			if (!set?.has(a.from) || set.has(a.to)) continue;
			set.add(a.to);
			grew = true;
		}
	}
	return out;
}

/**
 * Arrows a command CAN perform but that can never fire, because their source state is never occupied.
 *
 * ⚠ SCOPED TO MACHINES WITH A DECLARED BIRTH, AND THE UNSCOPED SET IS RETURNED RATHER THAN IGNORED. A machine
 * with no `births` declaration cannot be analysed — every state would look unoccupiable and every covered arrow
 * dead, which is a 100% false-positive rate dressed as a finding. Silently skipping them would be the census
 * narrowing its own population again, so `unanalysed` is an output the test pins.
 *
 * ⚠⚠ AND A BIRTH IS NOT ENOUGH — COMPLETE ARROW COVERAGE IS ALSO REQUIRED (REG-F-118), which is the same argument
 * at a lower false-positive rate, and it went unstated for as long as this function has existed.
 *
 * `occupiable()` grows from the birth along DECLARED arrows. When a machine's declared set is a SUBSET of its
 * ratified set, occupancy is an UNDER-estimate — so reachability can be proven (you got there) but UNreachability
 * never can (you may simply not have been able to see the road). **"Never occupied" then means "not shown
 * reachable", and those are different claims.** The polarity is the dangerous one: a DEAD arrow invites deleting
 * code or a ratified arrow, so acting on a false one removes something real.
 *
 * MEASURED THE DAY THIS RULE WAS ADDED, and it is why the rule is not a precaution: **every single machine then
 * reporting dead arrows had PARTIAL coverage** — `PWU.workLifecycleState` 49/57 (35 dead), `Assumption.status`
 * 9/17 (5), `Claim.status` 7/15 (4), `AssuranceAssessment.state` 11/19 (1), `ExecutionPlan.status` 10/11 (1).
 * **Not one dead-arrow claim in the repository rested on complete coverage.** The PWU case is the clearest: its
 * eight undeclared arrows form one unbroken chain — READY -> PLANNED -> EXECUTING -> EVIDENCE_PENDING ->
 * UNDER_ASSURANCE -> SATISFIED -> RECOMPOSING -> RECOMPOSED, the main lifecycle spine the workbench drives every
 * day — so occupancy stopped at READY and called thirteen live states unreachable.
 *
 * `unanalysed` therefore carries TWO causes that share a remedy but not a diagnosis: **no declared birth**, and
 * **incomplete arrow coverage**. Both make occupancy unanswerable; only the first is about a missing `births`.
 */
export function deadCovered(): { dead: string[]; unanalysed: string[] } {
	const occ = occupiable();
	const arrows = declaredArrows();
	const complete = occupancyAnalysable();
	const provable = provablyUnoccupiable();
	const dead: string[] = [];
	for (const a of arrows) {
		const set = occ.get(a.machine);
		if (!set) continue; // no declared birth — reported as unanalysed, never as dead
		// TWO INDEPENDENT GROUNDS, and the first needs no arrow coverage: a source state the ratified machine gives
		// no in-arrow and no birth declares can never be occupied, whatever is or is not declared elsewhere.
		if (provable.get(a.machine)?.has(a.from)) {
			dead.push(arrowKey(a.machine, a.from, a.to));
			continue;
		}
		// INCOMPLETE COVERAGE CANNOT SUPPORT THE WEAKER, OCCUPANCY-BASED CLAIM. See the note above.
		if (!complete.has(a.machine)) continue;
		if (!set.has(a.from)) dead.push(arrowKey(a.machine, a.from, a.to));
	}
	const analysed = new Set([...occ.keys()].filter((m) => complete.has(m)));
	const unanalysed = [...new Set(arrows.map((a) => a.machine))].filter((m) => !analysed.has(m));
	return {
		dead: [...new Set(dead)].sort((x, y) => x.localeCompare(y)),
		unanalysed: unanalysed.sort((x, y) => x.localeCompare(y))
	};
}

/**
 * States that are PROVABLY unoccupiable — and this proof needs no arrow coverage at all (REG-F-118).
 *
 * ⚠ IT IS A DIFFERENT ARGUMENT FROM OCCUPANCY, WHICH IS WHY IT SURVIVES WHERE OCCUPANCY DOES NOT. `occupiable()`
 * reasons forward from a birth along DECLARED arrows, so an undeclared arrow can always rescue a state and no
 * negative claim is safe. This reasons from the RATIFIED machine: if the corpus declares **no arrow at all** into
 * a state, then no command can ever move into it — `checkTransition` would refuse, declared or not — so the state
 * is reachable ONLY by birth. If no birth declares it either, nothing can ever be in it. **Missing declarations
 * cannot rescue it, because the arrows that would do so are not ratified.**
 *
 * THIS IS WHAT SAVED REG-F-088 when the completeness rule withdrew the occupancy-based version of it.
 * `ExecutionPlan.status` has ZERO ratified arrows into `PROPOSED` and its handler births `UNDER_REVIEW`, so the
 * recorded claim that `ProposeExecutionPlan` lands in PROPOSED is false of the code — provably, on 10/11 coverage,
 * where the occupancy argument was worthless. **A sound rule and a weaker one disagree about the method, not
 * about the answer; keeping both is how the finding survived its own instrument being corrected.**
 */
export function provablyUnoccupiable(): Map<string, Set<string>> {
	const births = birthStates();
	const out = new Map<string, Set<string>>();
	for (const [machine, def] of Object.entries(STATE_MACHINES)) {
		const born = births.get(machine);
		// No birth declared at all is a DIFFERENT report (`unanalysed`) — it means nobody said, not that nothing can.
		if (!born) continue;
		const hasInArrow = new Set((def?.transitions ?? []).map((t) => t.to));
		const unreachable = (def?.states ?? []).filter((s) => !hasInArrow.has(s) && !born.has(s));
		if (unreachable.length > 0) out.set(machine, new Set(unreachable));
	}
	return out;
}

/**
 * The machines whose occupancy may be TRUSTED for a NEGATIVE claim — a declared birth AND complete arrow coverage.
 *
 * ⚠ EVERY CONSUMER OF UNREACHABILITY MUST ASK THIS, NOT `occupiable()` DIRECTLY (REG-F-118). `occupiable()`
 * answers *"which states did I reach"*, which is sound as a POSITIVE claim and unsound as a NEGATIVE one: with
 * arrows missing it UNDER-estimates, so "not in the set" means **not shown reachable**, never **unreachable**.
 * Three layers were reading it as the latter — C-0's `deadCovered`, C-0c's `auditClaims` (`deadFrom`/`deadTo`),
 * and C-0d through `auditClaims`. Shared here so the rule cannot hold in one layer and lapse in the next.
 */
export function occupancyAnalysable(): ReadonlySet<string> {
	const complete = machinesWithCompleteArrowCoverage(declaredArrows());
	const born = birthStates();
	return new Set([...complete].filter((m) => born.has(m)));
}

/**
 * The machines whose DECLARED arrows are the whole of their RATIFIED arrows — the only ones a deadness claim can
 * be made about (REG-F-118).
 *
 * Derived by comparing against `STATE_MACHINES`, never by a list: a machine joins the moment its last arrow is
 * declared and leaves the moment the ratified set grows, with no one to remember either.
 *
 * ⚠ THIS BLOCK SPENT THREE COMMITS ABOVE THE WRONG FUNCTION (REG-F-120). Inserting `provablyUnoccupiable` beneath
 * it left two docstrings stacked, so this one documented nothing and a reader met it as the preamble to a
 * different rule — the completeness argument attached to the proof that does NOT need completeness, which is the
 * one distinction those two functions exist to keep apart. Moved, not deleted: it was always correct about its
 * real owner.
 */
function machinesWithCompleteArrowCoverage(arrows: readonly DeclaredArrow[]): ReadonlySet<string> {
	const seen = new Set(arrows.map((a) => arrowKey(a.machine, a.from, a.to)));
	const out = new Set<string>();
	for (const [machine, def] of Object.entries(STATE_MACHINES)) {
		const all = def?.transitions ?? [];
		if (all.length > 0 && all.every((t) => seen.has(arrowKey(machine, t.from, t.to)))) out.add(machine);
	}
	return out;
}

export const arrowKey = (machine: string, from: string, to: string) => `${machine}  ${from} -> ${to}`;

/**
 * Arrows deliberately not yet performable, each bound to the register entry that justifies it.
 *
 * ⚠ AN EXEMPTION LIST ROTS INTO AN ALLOWLIST. Nothing may be added without a register id.
 */
export const EXEMPT: ReadonlyMap<string, string> = new Map();

/** The derived population: arrows nothing can perform, and machines no handler declares at all. */
export function census(): { uncovered: string[]; orphans: string[]; total: number } {
	const arrows = declaredArrows();
	const covered = new Set(arrows.map((a) => arrowKey(a.machine, a.from, a.to)));
	const uncovered: string[] = [];
	let total = 0;
	for (const [machine, def] of Object.entries(STATE_MACHINES)) {
		// EXCLUDED KEYS ARE NOT PART OF THE POPULATION AT ALL — see `machine-exclusions.ts`. They are keys the
		// controls should never have been asked about (a computed rollup; a machine over a field the ratified
		// schema does not have), not machines whose arrows are unbuilt. Counting their arrows in `total` would
		// also make the anti-deletion pin defend a number that includes nine impossible transitions.
		if (isExcludedMachine(machine)) continue;
		for (const t of def.transitions) {
			total += 1;
			const k = arrowKey(machine, t.from, t.to);
			if (!covered.has(k) && !EXEMPT.has(k)) uncovered.push(k);
		}
	}
	const declared = new Set(arrows.map((a) => a.machine));
	return {
		uncovered: uncovered.sort(),
		orphans: Object.keys(STATE_MACHINES)
			.filter((m) => !declared.has(m) && !isExcludedMachine(m))
			.sort(),
		total
	};
}
