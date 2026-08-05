// ENUMREF DEGRADATION CENSUS — every field that declares an enum and ships without one.
//
// ── WHY IT EXISTS (REG-F-026) ────────────────────────────────────────────────────────────────────────────────
// `gen-messages.ts` resolved a field's `enumRef` against the emitted enum set and, on a miss, returned
// `z.string()` under the comment *"never invent enum values"*. Not inventing values is right. Dropping the
// constraint and saying nothing is not: SEVEN command/event payload fields declared an enum and shipped as
// unvalidated strings — `AssuranceAssessmentCompleted.disposition` and both observation `severity` fields among
// them — and no gate anywhere reported it.
//
// The generator now THROWS on an unresolvable ref unless the field itself declares `enumRefUnresolved` with a
// reason. This census is the other half: the build refuses NEW ones, and this refuses the SEVEN quietly becoming
// eight by annotation, or an annotation outliving the problem it describes.
//
// ── READ FROM THE RUNTIME SCHEMAS ────────────────────────────────────────────────────────────────────────────
// The first draft of this measurement rebuilt the generator's lookup from `canonical-vocabulary.json`'s enum
// NAMES — but the generator regexes `export const XSchema = z.enum` out of the GENERATED `enums.ts`, a different
// set — and reported TWELVE degradations, of which twelve were false. `RiskConsequenceSchema` was on the list
// while `WorkRiskProfileSchema.consequence` is, and always was, `RiskConsequenceSchema`. So this asks the
// SCHEMA OBJECT what it actually is. An instrument that re-derives the thing it is checking agrees with it by
// construction; one that re-derives it WRONG invents work. Both failures are avoided by reading the artifact.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as CONTRACTS from './index.js';

interface VocabField {
	readonly field: string;
	readonly type?: string;
	readonly enumRef?: string;
	readonly enumRefUnresolved?: string;
}
interface Vocab {
	readonly commands: { commandType: string; payloadFields: VocabField[] }[];
	readonly events: { eventType: string; payloadFields: VocabField[] }[];
}

const vocab = JSON.parse(
	readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), '..', 'vocab', 'm3-commands-events.json'),
		'utf8'
	)
) as Vocab;

const reg = CONTRACTS as unknown as Record<string, unknown>;
type Node = { _def?: Record<string, unknown>; def?: Record<string, unknown> };

/** Peel optional/nullable/array wrappers down to the node that carries (or does not carry) the constraint. */
function core(s: Node): Node {
	for (let i = 0; i < 12 && s; i++) {
		const d = (s._def ?? s.def) as Record<string, unknown> | undefined;
		if (!d) return s;
		if (d.innerType) s = d.innerType as Node;
		else if (d.element) s = d.element as Node;
		else if (d.type && typeof d.type === 'object') s = d.type as Node;
		else return s;
	}
	return s;
}
const kindOf = (s: Node): string => {
	const d = (s?._def ?? s?.def ?? {}) as Record<string, unknown>;
	return String(d.type ?? d.typeName ?? 'unknown');
};

interface Row {
	readonly key: string;
	readonly enumRef: string;
	readonly kind: string;
	readonly declared: boolean;
}

/** Every vocab field carrying an enumRef, paired with what its emitted schema node actually is. */
function census(): { rows: Row[]; resolved: number } {
	const rows: Row[] = [];
	let resolved = 0;
	const owners: [string, string, VocabField[]][] = [
		...vocab.commands.map(
			(c) =>
				[c.commandType, `${c.commandType}PayloadSchema`, c.payloadFields] as [
					string,
					string,
					VocabField[]
				]
		),
		...vocab.events.map(
			(e) =>
				[e.eventType, `${e.eventType}PayloadSchema`, e.payloadFields] as [
					string,
					string,
					VocabField[]
				]
		)
	];
	for (const [owner, schemaName, fields] of owners) {
		const schema = reg[schemaName] as Node | undefined;
		const rawShape = (schema?._def ?? schema?.def)?.shape;
		const shape = (typeof rawShape === 'function' ? rawShape() : rawShape) as
			Record<string, Node> | undefined;
		if (!shape) continue;
		for (const f of fields ?? []) {
			if (!f.enumRef) continue;
			const node = shape[f.field];
			if (!node) continue;
			resolved++;
			rows.push({
				key: `${owner}.${f.field}`,
				enumRef: f.enumRef,
				kind: kindOf(core(node)),
				declared: Boolean(f.enumRefUnresolved)
			});
		}
	}
	return { rows, resolved };
}

const { rows, resolved } = census();
const degraded = rows.filter((r) => !/enum/i.test(r.kind));

describe('enumRef degradation census (REG-F-026)', () => {
	it('CONTROL: the census resolves a real population and can see a CONSTRAINED field', () => {
		// Without this, every green below is also what a census that resolved nothing would produce — which is the
		// exact instrument failure this file's header records, one draft earlier.
		expect(
			resolved,
			'no enumRef field resolved to a schema node — the census is reading nothing'
		).toBeGreaterThan(150);
		expect(
			rows.filter((r) => /enum/i.test(r.kind)).length,
			'every enumRef field came back unconstrained, which would mean the kind probe cannot see an enum at all'
		).toBeGreaterThan(100);
	});

	it('no field is degraded to an unconstrained type WITHOUT saying so in the vocab', () => {
		const silent = degraded
			.filter((r) => !r.declared)
			.map((r) => `${r.key} (${r.enumRef} -> ${r.kind})`);
		expect(
			silent,
			'these fields declare an enum and ship as unvalidated — the generator should have refused them, so ' +
				'either it was bypassed or the refusal has a hole'
		).toEqual([]);
	});

	it('the degraded population is ONE and may only fall', () => {
		// A ratchet, not a target. SEVEN on 2026-08-05; FOUR when group (a) closed (three enums that existed under
		// another identifier); THREE when group (b) closed — `ValidateDecomposition.disposition` left this census
		// entirely, because its constraint is a LITERAL UNION derived from the machine rather than an enumRef, and
		// this file only watches fields that name an enum. Its own gate is
		// `rph-domain/src/decomposition-disposition-derivation.test.ts`, which holds it to the ratified machine.
		//
		// ONE since group (c) closed (2026-08-05, REG-E-025 ratified): both `failureClass` fields now name
		// `ExecutionFailureClass`, minted from RPH-DOC-002 §36.2's seven prose items. Two things had to be true
		// before that was honest rather than convenient — the §36-wide rule "each failure class must map to
		// permitted control actions" is now MET for this family (`EXECUTION_FAILURE_CONTROL_ACTIONS`, total and
		// gated), and `TRANSIENT`, the only value ever in flight, was a test fixture with no production producer,
		// so constraining the field refuses nothing any shipped path emits.
		//
		// THE LAST ONE IS NOT A REMAPPING. `ControlActionRecommendation` is a shape the corpus has never defined,
		// so there is nothing to point the field at. It closes when the corpus defines it, or not at all.
		expect(degraded.map((r) => r.key).sort()).toEqual(
			['AssuranceAssessmentRejected.recommendedControlAction'].sort()
		);
	});

	it('group (c) is CONSTRAINED to §36.2 — all FOUR failureClass fields, not just the two censused', () => {
		// THE CENSUS COULD ONLY EVER SEE TWO OF THEM. It watches fields that NAME an enum, and
		// `FailExecutionPlan.failureClass` / `ExecutionPlanFailed.failureClass` were declared plain `string` with
		// no enumRef at all — carrying the same §36.2 classification, equally unvalidated, and structurally
		// invisible to the instrument that exists to find exactly this. A field is not safe because the census is
		// quiet about it; it may simply be below the census's floor.
		const SEVEN = [
			'DEPENDENCY_UNAVAILABLE',
			'INVALID_OUTPUT_SCHEMA',
			'MODEL_FAILURE',
			'RETRY_EXHAUSTION',
			'SANDBOX_FAILURE',
			'TIMEOUT',
			'TOOL_FAILURE'
		];
		for (const owner of [
			'FailExecutionStep',
			'ExecutionStepFailed',
			'FailExecutionPlan',
			'ExecutionPlanFailed'
		]) {
			const schema = reg[`${owner}PayloadSchema`] as Node | undefined;
			const raw = (schema?._def ?? schema?.def)?.shape;
			const shape = (typeof raw === 'function' ? raw() : raw) as Record<string, Node>;
			const d = (core(shape.failureClass!)._def ?? core(shape.failureClass!).def) as Record<
				string,
				unknown
			>;
			const e = (d.entries ?? d.values ?? d.options) as Record<string, string> | string[];
			expect(
				(Array.isArray(e) ? e : Object.keys(e)).slice().sort(),
				`${owner}.failureClass must be constrained to DOC-002 §36.2's seven execution failure classes`
			).toEqual(SEVEN);
		}
	});

	it('the three closed remappings are CONSTRAINED, and to the right values', () => {
		// The ratchet above only proves they left the degraded list. This proves what they landed ON — because
		// "constrained" was never the requirement; constrained TO THE RATIFIED SET was. `AssessmentDisposition`
		// resolves to AssuranceDispositionRecommendation (five values) and NOT to AssuranceDisposition, which the
		// name points at and which admits a sixth, WAIVED, that completion cannot produce.
		const values = (owner: string, field: string): string[] => {
			const schema = reg[`${owner}PayloadSchema`] as Node | undefined;
			const raw = (schema?._def ?? schema?.def)?.shape;
			const shape = (typeof raw === 'function' ? raw() : raw) as Record<string, Node>;
			const d = (core(shape[field]!)._def ?? core(shape[field]!).def) as Record<string, unknown>;
			const e = (d.entries ?? d.values ?? d.options) as Record<string, string> | string[];
			return (Array.isArray(e) ? e : Object.keys(e)).slice().sort();
		};
		const SEVERITY = ['ADVISORY', 'BLOCKING', 'CRITICAL', 'INFORMATIONAL', 'MATERIAL'];
		expect(values('RecordAssuranceObservation', 'severity')).toEqual(SEVERITY);
		expect(values('AssuranceObservationRecorded', 'severity')).toEqual(SEVERITY);
		expect(values('AssuranceAssessmentCompleted', 'disposition')).toEqual(
			['CONDITIONALLY_SATISFIED', 'ESCALATED', 'INCONCLUSIVE', 'REJECTED', 'SATISFIED'].sort()
		);
		expect(
			values('AssuranceAssessmentCompleted', 'disposition'),
			'WAIVED belongs to AssuranceDisposition, which is the enum the NAME suggested and the wrong one'
		).not.toContain('WAIVED');
	});

	it('CONTROL: no annotation outlives the degradation it describes', () => {
		// The mirror of the check above: a field declared unresolvable whose schema IS constrained means the
		// annotation is stale, and a stale exemption is how a list of known problems becomes a list of permissions.
		const stale = rows.filter((r) => r.declared && /enum/i.test(r.kind)).map((r) => r.key);
		expect(stale, 'this field is annotated as having no resolvable enum, and it has one').toEqual(
			[]
		);
	});

	it('every annotation states WHICH shape it is, in its FIRST clause, so none can be closed by guesswork', () => {
		// The group must be the annotation's OPENING claim, not a substring anywhere in it. The first version of
		// this check matched `group (x)` loosely, and passed a reason reading "RE-DISPOSITIONED out of group (a)"
		// — a sentence saying the field is NOT group (a) — as if it were a group (a) classification.
		const byKey = new Map<string, string>();
		for (const c of vocab.commands)
			for (const f of c.payloadFields ?? [])
				if (f.enumRefUnresolved) byKey.set(`${c.commandType}.${f.field}`, f.enumRefUnresolved);
		for (const e of vocab.events)
			for (const f of e.payloadFields ?? [])
				if (f.enumRefUnresolved) byKey.set(`${e.eventType}.${f.field}`, f.enumRefUnresolved);
		const unclassified = degraded
			.map((r) => r.key)
			.filter((k) => !/^REG-F-026 group \([b-d]\)/.test(byKey.get(k) ?? ''));
		expect(
			unclassified,
			'a reason that does not OPEN by saying whether the enum exists elsewhere (b), is contradicted by the ' +
				'runtime (c), or is blocked on an undefined helper (d) is a reason nobody can act on. Group (a) is ' +
				'CLOSED, so a field still degraded cannot be in it'
		).toEqual([]);
	});
});
