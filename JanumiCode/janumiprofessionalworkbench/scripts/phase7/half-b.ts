// ⭐⭐ `JAN-EXEC` Phase 7 completion programme, package E3 — HALF B'S REQUEST, AND HOW ITS UNITS ARE READ FROM THE PUBLISHED
// PWA (`docs/_working/DESIGN-phase-7-completion.md` §4 C1, C2; `REG-D-110` (4); the run plan's P7-7,
// `docs/_working/DESIGN-the-live-end-to-end-run.md` §4, §6).
//
// Half B asks the live authoring agent to build the PWA, so the run's units are the AGENT's: their names, their kinds and
// their tree are whatever it authored and a person accepted. Half A's lane held a run to §3.2's five hand-typed titles
// (`run-archive.ts`, `PHASE7_ARCHIVE_UNITS`; `phase7-operator.ts`'s *"instantiation did not build one unit per type"*;
// `run-report-core.ts`, `PHASE7_UNITS`), which no agent-authored PWA could meet. This module holds what both the lane and
// the run report read instead:
//   · THE REQUEST — the run plan's, which names the engineering phases and not the types, kinds, policies or markers, AS
//     AMENDED by the sponsor to NAME THE PRODUCT (`REG-D-110` (4): *"Name wordfreq; measure traps"*);
//   · THE ORDER RULE (C2) — the root first, then the tree's order: each unit's children in the order its TYPE permits them
//     (`permittedChildTypeIds`), depth first — the order instantiation itself walks (`planComposition`,
//     `packages/rph-projections/src/composition-plan.ts`), read back from the store rather than from the store's listing;
//   · each unit's SLUG, from its title, so the archive and the report name the agent's units as they name §3.2's;
//   · ⭐ `REG-D-112` — the units HELD TO THE PLAN INSTANTIATION MAKES of the PWA, per (parent, type) (`treeAgainstPlan`);
//   · the authoring floor's dispositions, read from the assessments of the PWA.
// ⭑ PURE: Playwright, bun and vitest load it alike, and the run report reads an archive with nothing of the server in
// it. ~~It imports only the content module.~~ ⭐ `REG-D-112` (E3's review, finding 4): and the product's own planner,
// `planComposition` — a pure function of the types, from the projections package (data only, never a write target) —
// so stage 2 holds the units to what instantiation builds, never to a restatement of it.
import { planComposition } from '@janumipwb/rph-projections';
import { PRODUCT_BRIEF } from './pwa-content.js';

// ── THE REQUEST (C1; `REG-D-110` (4)) ───────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ THE RUN PLAN'S REQUEST, VERBATIM (`DESIGN-the-live-end-to-end-run.md` §6, P7-7: *"The request:"*), held to that line by
 * `verif/phase7-half-b.test.ts`. ⛔ It names the product's engineering phases and NOT the types, kinds, policies or markers
 * (§4: *"A request that dictated those would measure transcription, not authoring"*).
 */
export const PHASE7_RUN_PLAN_REQUEST =
	'Create a PWA for realizing a small command-line product through requirements, design, implementation with unit tests, and end-to-end verification, with the assurance policies each phase needs.';

/** Where the run plan's request is amended to name the product: right after the product it speaks of. */
const PRODUCT_PHRASE = 'a small command-line product';

/**
 * ⭐⭐ HALF B'S REQUEST — the run plan's, AMENDED BY THE SPONSOR TO NAME THE PRODUCT (`REG-D-110` (4): *"The request names
 * the product, `wordfreq`, so P7-4's checks apply"*): the product named where the request names a product, and its brief
 * (`product-brief.md`, `PRODUCT_BRIEF`, verbatim) after it, so the acceptance suite P7-4 runs tests what the agent was
 * asked for (round 1's BLOCKER: one product told, another tested). ⛔ STILL NOTHING OF THE PWA'S SHAPE: the brief is the
 * PRODUCT's — its usage, options, exit codes and files — and names no type, kind, policy, discharge or marker; the traps
 * an author meets there are MEASURED, never steered round (`REG-D-110` (4); design §4 C4). ⚠ An Undertaking still cannot
 * tell its units what to build (`REG-F-510`): whether the agent writes the product into its prompts is its own call, and
 * the candidate checks record it (`candidate-checks.ts`, `namesProduct`).
 */
export const PHASE7_HALF_B_REQUEST = `${PHASE7_RUN_PLAN_REQUEST.replace(
	PRODUCT_PHRASE,
	`${PRODUCT_PHRASE}, wordfreq,`
)}\n\nThe product, as its brief states it:\n\n${PRODUCT_BRIEF}`;

/**
 * The draft the lane creates for the agent to author into: §3.2's name and domain, so the two halves' reports name one
 * PWA alike. ⚠ The NAME is the operator's, not the agent's: the lane reads the PWA by the id the store gave the draft.
 */
export const PHASE7_HALF_B_DRAFT = { name: 'CLI Product Realization', domain: 'software product' } as const;

// ── THE UNITS, READ FROM THE PUBLISHED PWA (C2) ─────────────────────────────────────────────────────────────────────

/** A stored object as both readers hold one: the server's dump (`ObjectRow`) and the archived store (`StoredObject`). */
export interface Row {
	readonly id: string;
	readonly state: Readonly<Record<string, unknown>>;
}

/** One unit of the run, in the run's order. `order`, `slug` and `title` are what `ArchiveUnit` names a unit by. */
export interface TreeUnit {
	readonly order: number;
	readonly slug: string;
	readonly title: string;
	readonly unitId: string;
	/** The type it was instantiated from (`pwuTypeId`); '' when the store names none. */
	readonly typeId: string;
	readonly parentUnitId: string | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** The slugs a unit may not take: the root's own, and the final archive's (`06-final` would name a sixth unit too). */
const RESERVED_SLUGS: ReadonlySet<string> = new Set(['root', 'final']);

/**
 * A title as a slug: its accents dropped, lower case, every run of characters other than ASCII letters and digits one
 * `-`, none at either end, at most 40 characters. ⚠ `unit` when nothing is left, so an archive is never named `NN-`.
 */
export function slugOf(title: string): string {
	const words = title
		.normalize('NFKD')
		.replaceAll(/\p{M}/gu, '')
		.toLowerCase()
		.split(/[^a-z0-9]/)
		.filter((w) => w !== '');
	let slug = words.join('-').slice(0, 40);
	while (slug.endsWith('-')) slug = slug.slice(0, -1);
	return slug === '' ? 'unit' : slug;
}

/** `slug`, or `slug-2`, `slug-3` … — the first not yet taken, which it then takes. A reserved one is `<slug>-unit`. */
function uniqueSlug(slug: string, taken: Set<string>): string {
	const base = RESERVED_SLUGS.has(slug) ? `${slug}-unit` : slug;
	let candidate = base;
	let n = 1;
	while (taken.has(candidate)) {
		n += 1;
		candidate = `${base}-${n}`;
	}
	taken.add(candidate);
	return candidate;
}

/** A unit's parent, as the store records it; null for one with none. */
const parentOf = (u: Row): string | null => str(u.state.parentWorkUnitId) || null;

/**
 * ⭐⭐ C2 — THE RUN'S UNITS IN ITS ORDER: THE ROOT FIRST, THEN THE TREE'S ORDER. From the root, depth first, each unit's
 * children in the order its TYPE permits theirs (`permittedChildTypeIds`) — the walk instantiation made
 * (`planComposition`), so a phase runs only after the phases its tree puts before it, as §3.2's did. Ties, and a child
 * whose type its parent's does not list, keep the store's order.
 * ⚠ WHAT DOES NOT FIT IS SAID, NEVER DROPPED: a store with no root, or more than one, or a unit the root's tree does not
 * reach, gives a problem line, and every unit is still listed — the store's order after the tree's.
 */
export function unitsInTreeOrder(
	units: readonly Row[],
	types: readonly Row[]
): { readonly units: readonly TreeUnit[]; readonly problems: readonly string[] } {
	const permits = new Map(types.map((t) => [t.id, strs(t.state.permittedChildTypeIds)]));
	const position = new Map(units.map((u, i) => [u.id, i]));
	const rank = (parent: Row, child: Row): number => {
		const at = (permits.get(str(parent.state.pwuTypeId)) ?? []).indexOf(str(child.state.pwuTypeId));
		return at === -1 ? Number.MAX_SAFE_INTEGER : at;
	};
	const childrenOf = (parent: Row): Row[] =>
		units
			.filter((u) => parentOf(u) === parent.id)
			.sort((a, b) => rank(parent, a) - rank(parent, b) || position.get(a.id)! - position.get(b.id)!);
	const roots = units.filter((u) => parentOf(u) === null);
	const problems: string[] =
		roots.length === 1 ? [] : [`${roots.length} units have no parent unit, where a tree has one root`];
	const ordered: Row[] = [];
	const visit = (u: Row): void => {
		if (ordered.includes(u)) return;
		ordered.push(u);
		for (const child of childrenOf(u)) visit(child);
	};
	if (roots[0] !== undefined) visit(roots[0]);
	const unreached = units.filter((u) => !ordered.includes(u));
	for (const u of unreached) problems.push(`the unit "${str(u.state.title)}" is not under the root`);
	// ⭐ THE ROOT'S SLUG IS `root`, as half A's is: its archive is `01-root` in either half.
	const taken = new Set<string>(['root']);
	const slugFor = (u: Row): string =>
		u === roots[0] ? 'root' : uniqueSlug(slugOf(str(u.state.title)), taken);
	return {
		units: [...ordered, ...unreached].map((u, i) => ({
			order: i + 1,
			slug: slugFor(u),
			title: str(u.state.title),
			unitId: u.id,
			typeId: str(u.state.pwuTypeId),
			parentUnitId: parentOf(u)
		})),
		problems
	};
}

/** ⭐ `REG-D-112` — what holding an Undertaking's units to the plan instantiation makes of its PWA found (`treeAgainstPlan`). */
export interface TreeAgainstPlan {
	/** The units the plan makes: one for each mandatory child under each parent, and the root. */
	readonly planned: number;
	/** Each planned unit none was built for: `<type>`, or `<type> under <its parent's title>`. */
	readonly missing: readonly string[];
	/** Each (parent, type) built more than once: `<type> under <the parent's title>`, once each. */
	readonly duplicated: readonly string[];
	/** The ids of the units whose parent is no unit of the Undertaking. */
	readonly orphaned: readonly string[];
	/** The units the plan does not make under their parent: each id, and its parent's title. */
	readonly unplanned: readonly { readonly unitId: string; readonly parentTitle: string }[];
	/** The conditional children the plan OFFERS, which instantiation offers to no one (`REG-F-516`), by type name. */
	readonly conditional: readonly string[];
	/** Each permitted child the plan cannot resolve, `<parent type> → <child>`: instantiation refuses such a PWA. */
	readonly unresolved: readonly string[];
}

/** Each type as the product's planner reads one (`CompositionNode`), as `routes/undertakings/+page.server.ts` hands it. */
function compositionNodesOf(types: readonly Row[]): Parameters<typeof planComposition>[0] {
	return types.map((t) => ({
		id: t.id,
		isRoot: t.state.isRoot === true,
		permittedChildTypeIds: strs(t.state.permittedChildTypeIds),
		permittedChildren: Array.isArray(t.state.permittedChildren)
			? (t.state.permittedChildren as Parameters<typeof planComposition>[0][number]['permittedChildren'])
			: undefined
	}));
}

/**
 * ⭐⭐ `REG-D-112` (E3's re-review, finding 1) — THE TYPES THE PLAN GIVES A CHILD: each type planned by the product's own
 * planner (`planComposition`) from itself, and kept when the plan instantiates anything under it — an M1, M+ or rule-less
 * permitted child that resolves. ⛔ ~~A type that permits a live child type~~: one whose permitted children are all
 * conditional permits them and is given none — instantiation offers C1 and C+ to no one (`REG-F-516`) — so its unit is a
 * LEAF of the tree instantiation builds, and its work a model's to do or no one's.
 */
export function typesGivenChildren(types: readonly Row[]): ReadonlySet<string> {
	const nodes = compositionNodesOf(types);
	return new Set(types.filter((t) => planComposition(nodes, t.id).instances.length > 1).map((t) => t.id));
}

/**
 * ⭐⭐ `REG-D-112` (E3's review, finding 4) — THE UNDERTAKING'S UNITS, HELD TO THE PLAN INSTANTIATION MAKES OF ITS PWA,
 * PER (PARENT, TYPE): the product's own planner (`planComposition`, as `routes/undertakings/+page.server.ts` asks it) plans
 * one unit for each mandatory child under each parent, and each planned unit is matched to a unit of its type under the
 * unit matched to its parent. ⛔ ~~The mandatory TYPES, walked once per permitting parent, each matched by type alone~~:
 * a type two parents permit was listed twice, so its two units — one under each, as instantiation builds it — read as
 * "more than one work unit", and one parent's missing unit was hidden by the other's. ⚠ What is left over is said: a
 * second unit of a planned (parent, type) is a duplicate; one whose parent is no unit of the Undertaking, an orphan; one
 * of a type the plan does not put under its parent, unplanned.
 */
export function treeAgainstPlan(units: readonly Row[], types: readonly Row[]): TreeAgainstPlan {
	const nameOf = (typeId: string): string => str(types.find((t) => t.id === typeId)?.state.name) || typeId;
	const root = types.find((t) => t.state.isRoot === true);
	const plan =
		root === undefined
			? { instances: [], offered: [], unresolved: [] }
			: planComposition(compositionNodesOf(types), root.id);
	const typeOfKey = new Map(plan.instances.map((i) => [i.key, i.typeId]));
	/** Each planned key, and the unit matched to it. */
	const built = new Map<string, Row>();
	const matched = new Set<string>();
	const missing: string[] = [];
	for (const planned of plan.instances) {
		const parentKey = planned.parentKey;
		// null: the root, which has no parent; undefined: a parent the plan makes and no unit was built for.
		const parent = parentKey === undefined ? null : built.get(parentKey);
		const unit =
			parent === undefined
				? undefined
				: units.find(
						(u) => !matched.has(u.id) && str(u.state.pwuTypeId) === planned.typeId && parentOf(u) === (parent?.id ?? null)
					);
		if (unit === undefined) {
			const under = parent ? str(parent.state.title) : nameOf(typeOfKey.get(parentKey ?? '') ?? '');
			missing.push(`${nameOf(planned.typeId)}${parentKey === undefined ? '' : ` under ${under}`}`);
			continue;
		}
		matched.add(unit.id);
		built.set(planned.key, unit);
	}
	const ids = new Set(units.map((u) => u.id));
	const titleOf = (id: string): string => str(units.find((u) => u.id === id)?.state.title) || id;
	const plannedFor = (u: Row): boolean =>
		plan.instances.some(
			(i) =>
				i.typeId === str(u.state.pwuTypeId) &&
				(i.parentKey === undefined ? parentOf(u) === null : built.get(i.parentKey)?.id === parentOf(u))
		);
	const duplicated = new Set<string>();
	const orphaned: string[] = [];
	const unplanned: { unitId: string; parentTitle: string }[] = [];
	for (const u of units.filter((x) => !matched.has(x.id))) {
		const parent = parentOf(u);
		if (plannedFor(u))
			duplicated.add(`${nameOf(str(u.state.pwuTypeId))}${parent === null ? '' : ` under ${titleOf(parent)}`}`);
		else if (parent === null || !ids.has(parent)) orphaned.push(u.id);
		else unplanned.push({ unitId: u.id, parentTitle: titleOf(parent) });
	}
	return {
		planned: plan.instances.length,
		missing,
		duplicated: [...duplicated],
		orphaned,
		unplanned,
		conditional: plan.offered.map((o) => nameOf(o.typeId)),
		unresolved: plan.unresolved.map((u) => `${nameOf(u.parentTypeId)} → ${nameOf(u.typeId)}`)
	};
}

// ── THE AUTHORING FLOOR, AS THE RECORD HOLDS IT ─────────────────────────────────────────────────────────────────────

/**
 * ⭐ C1 — THE TURN STATES THE LANE STOPS WAITING AT: the turn has settled, assured or not (`authoring-turn-machine.ts`).
 * ⚠ COLLECTING, VALIDATING, ASSURING and COMMITTING are not among them: the agent or the floor is still at work.
 * ⭐ `REG-D-112` (E3's re-review, finding 2) — HERE, so the lane and the run report read one set: the lane asks the turn's
 * stream for its author only once its candidate has settled (`recordTheFloor`), and the report checks the author only then.
 */
export const TURN_SETTLED: ReadonlySet<string> = new Set([
	'READY_TO_COMMIT',
	'REVISION_REQUIRED',
	'BLOCKED_EXTERNAL',
	'CONFLICTED',
	'COMMIT_FAILED',
	'COMMITTED',
	'DISCARDED'
]);

/**
 * The authoring floor's three policies, in its plan's order (`rph-assurance` `deMinimisFloorPlan`). ⚠ RESTATED: the run
 * report's `FLOOR_POLICIES` is held to the product, and this to it, by `verif/phase7-half-b.test.ts`.
 */
export const AUTHORING_FLOOR_POLICIES = [
	'floor.schema-invariant',
	'floor.identity-provenance',
	'floor.reasoning-review'
] as const;

/** An actor as one line: `provider/model` when both are recorded, else whichever is, else its display name, else null. */
export function identityOf(actor: unknown): string | null {
	const a = typeof actor === 'object' && actor !== null ? (actor as Record<string, unknown>) : {};
	const model = str(a.modelId);
	const provider = str(a.providerId);
	if (model !== '' && provider !== '') return `${provider}/${model}`;
	return model || provider || str(a.displayName) || null;
}

/** One floor policy's latest assessment of the PWA: its state, who judged it, and whose work it judged. */
export interface FloorDisposition {
	readonly policyId: string;
	/** `MISSING` when the record holds no assessment of the PWA under this policy. */
	readonly state: string;
	readonly evaluator: string | null;
	readonly producer: string | null;
}

/**
 * ⭐ C1 — THE FLOOR'S DISPOSITIONS of the PWA `pwaId`: each policy's LATEST assessment of it, in the plan's order — the
 * last in `assessments`' order, which is the record's. Read from a candidate's fork before acceptance, and from the store
 * after, where the commit replayed them unchanged.
 * ⭐ The review in parts, B3 (`REG-D-125`): the floor reviews each type of the PWA as a part, under the type. Given the PWA's
 * types (`typeIds`), the Reasoning Review's row is their aggregate — each type's latest review, the strictest of them
 * (`partsState`) — its evaluator and producer the first type's. Without them, the PWA's own review, as before.
 */
export function floorDispositions(
	assessments: readonly Row[],
	pwaId: string,
	typeIds?: readonly string[]
): FloorDisposition[] {
	const latestOf = (subjectId: string, policyId: string) =>
		assessments
			.filter(
				(a) => strs(a.state.subjectObjectIds)[0] === subjectId && str(a.state.assurancePolicyId) === policyId
			)
			.at(-1);
	return AUTHORING_FLOOR_POLICIES.map((policyId) => {
		const parts =
			policyId === 'floor.reasoning-review' && typeIds !== undefined
				? typeIds.map((typeId) => latestOf(typeId, policyId))
				: undefined;
		const latest = parts === undefined ? latestOf(pwaId, policyId) : parts[0];
		return {
			policyId,
			state:
				parts !== undefined
					? partsState(parts)
					: latest === undefined
						? 'MISSING'
						: str(latest.state.assessmentState),
			evaluator: identityOf(latest?.state.evaluator),
			producer: identityOf(latest?.state.producer)
		};
	});
}

/**
 * ⭐ B3 — the strictest of the parts' review states: REJECTED where one is, else MISSING where a type has none (or there is no
 * type at all), else the first that is not SATISFIED, else SATISFIED.
 */
function partsState(parts: readonly (Row | undefined)[]): string {
	const states = parts.map((p) => (p === undefined ? 'MISSING' : str(p.state.assessmentState)));
	if (states.includes('REJECTED')) return 'REJECTED';
	if (states.length === 0 || states.includes('MISSING')) return 'MISSING';
	return states.find((s) => s !== 'SATISFIED') ?? 'SATISFIED';
}
