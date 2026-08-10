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
export function declaredArrows(): DeclaredArrow[] {
	const arrows: DeclaredArrow[] = [];
	let sites = 0;

	for (const file of handlerFiles()) {
		const source = readFileSync(HANDLERS + file, 'utf8');
		const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
		const consts = stringConsts(sf);

		const visit = (node: ts.Node): void => {
			ts.forEachChild(node, visit);
			if (!ts.isCallExpression(node)) return;
			if (!ts.isIdentifier(node.expression) || node.expression.text !== 'advanceStatus') return;
			const spec = node.arguments[2];
			if (!spec || !ts.isObjectLiteralExpression(spec)) return;
			sites += 1;
			const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
			const site = `${file}:${line}`;

			// MACHINE
			const mp = prop(spec, 'machine');
			if (!mp || !ts.isPropertyAssignment(mp)) return fail(site, 'declares no `machine`');
			const machine = ts.isStringLiteral(mp.initializer)
				? mp.initializer.text
				: ts.isIdentifier(mp.initializer)
					? (consts.get(mp.initializer.text) ??
						fail(site, `machine \`${mp.initializer.text}\` is not a top-level string const`))
					: fail(site, 'machine is neither a string literal nor a named constant');
			const def = STATE_MACHINES[machine];
			if (!def) fail(site, `names machine \`${machine}\`, which transitions.data.ts does not declare`);

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

			// SOURCES — `fromStates(...)` anywhere in the precondition. Absent is legal (a predicate-only
			// precondition) and means the command is not narrowed by source state.
			const pp = prop(spec, 'precondition');
			let sources: string[] | undefined;
			if (pp && ts.isPropertyAssignment(pp)) {
				let call: ts.CallExpression | undefined;
				const find = (n: ts.Node) => {
					if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'fromStates') {
						call ??= n;
					}
					ts.forEachChild(n, find);
				};
				find(pp.initializer);
				if (call) {
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
				}
			}

			for (const to of targets) {
				const from = sources ?? def!.transitions.filter((t) => t.to === to).map((t) => t.from);
				for (const f of from) arrows.push({ machine, from: f, to, site });
			}
		};
		visit(sf);
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
export function birthStates(): Map<string, Set<string>> {
	const out = new Map<string, Set<string>>();
	let declarations = 0;
	for (const file of handlerFiles()) {
		const source = readFileSync(HANDLERS + file, 'utf8');
		if (!source.includes('births:')) continue;
		const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
		const visit = (node: ts.Node): void => {
			ts.forEachChild(node, visit);
			if (!ts.isCallExpression(node)) return;
			if (!ts.isIdentifier(node.expression) || node.expression.text !== 'createObject') return;
			const spec = node.arguments[2];
			if (!spec || !ts.isObjectLiteralExpression(spec)) return;
			const p = prop(spec, 'births');
			if (!p || !ts.isPropertyAssignment(p)) return;
			const site = `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
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
 */
export function deadCovered(): { dead: string[]; unanalysed: string[] } {
	const occ = occupiable();
	const arrows = declaredArrows();
	const dead: string[] = [];
	for (const a of arrows) {
		const set = occ.get(a.machine);
		if (!set) continue; // no declared birth — reported as unanalysed, never as dead
		if (!set.has(a.from)) dead.push(arrowKey(a.machine, a.from, a.to));
	}
	const analysed = new Set(occ.keys());
	const unanalysed = [...new Set(arrows.map((a) => a.machine))].filter((m) => !analysed.has(m));
	return {
		dead: [...new Set(dead)].sort((x, y) => x.localeCompare(y)),
		unanalysed: unanalysed.sort((x, y) => x.localeCompare(y))
	};
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
