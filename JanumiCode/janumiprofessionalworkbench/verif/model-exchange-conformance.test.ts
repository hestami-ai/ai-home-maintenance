// MXR-06 — the conformance limb of §16 item 23's conjunction.
//
// Item 23's instruction is not a menu: *"Evolve policy registry, schemas, persistence, projections, fixtures,
// and conformance tests TOGETHER before claiming support."* This is that last limb, and it asserts the
// properties `REG-D-055` was granted ON — not the ones that happen to be easy to check.
//
// ⭑ IT READS THE EMITTED JSON SCHEMA RATHER THAN INTROSPECTING ZOD. The schema is what `emit.ts` publishes and
// what any external consumer would validate against, so a divergence between the zod shape and the emitted
// contract is itself a defect this gate should catch — reading zod would make that divergence invisible.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const json = (p: string) => JSON.parse(readFileSync(`${ROOT}${p}`, 'utf8'));

const SCHEMA = json('packages/rph-contracts/schemas/objects/ModelExchange.json');
const VOCAB = json('packages/rph-contracts/vocab/canonical-vocabulary.json');

/** Every node in the schema tree, so a claim about "the shape" is not a claim about its top level only. */
function nodes(root: unknown): Record<string, unknown>[] {
	const out: Record<string, unknown>[] = [];
	const walk = (n: unknown) => {
		if (!n || typeof n !== 'object') return;
		const o = n as Record<string, unknown>;
		out.push(o);
		for (const v of Object.values(o)) {
			if (Array.isArray(v)) v.forEach(walk);
			else if (v && typeof v === 'object') walk(v);
		}
	};
	walk(root);
	return out;
}

describe('MXR-06 — MODEL_EXCHANGE carries PER-9 as TYPED relationships, not a bag', () => {
	it('every object node is CLOSED — there is no generic-JSON escape anywhere in the tree', () => {
		// ⭑ THIS IS THE PROPERTY REG-D-054 WAS GRANTED ON. The one untyped carrier the corpus already had —
		// an open `z.record` reachable through ProposeEvidence — was refused because using it would be PER-9's
		// "hide core relationships in one generic JSON document". A single open node ANYWHERE in this tree
		// reintroduces exactly that, one level down where nobody would look.
		const open = nodes(SCHEMA)
			.filter((n) => n.type === 'object')
			.filter((n) => n.additionalProperties !== false || !n.properties);

		// ⚠ EXACTLY ONE OPEN NODE IS EXPECTED, AND IT IS NOT THIS RECORD'S. `objectEnvelopeShape` carries
		// `extensions[]`, whose `data` is the corpus's own declared "ONLY forward-compatible extensibility
		// channel" — an open dictionary present on all thirty object types. Excluding it silently would make
		// this gate blind to a second one; asserting the COUNT is what keeps it sharp. A new open node reddens
		// here even though the envelope's is permitted.
		expect(
			open.length,
			`open object nodes: ${open.length}. Exactly one is expected — the envelope's extension channel. Any other is the generic-JSON bag PER-9 forbids and REG-D-054 refused.`
		).toBe(1);
	});

	it('⚠ and the ONE permitted open node is the envelope channel, which is an open door on this record too', () => {
		// Recorded rather than waved through. `extensions[].data` accepts anything, on a record whose entire
		// warrant is that its relationships are TYPED — so it is the one place model bytes could still be put.
		// Nothing writes it today, and that is a fact about the code rather than about the shape: the shape
		// permits it. If exchange content ever appears there, it is PER-9's generic JSON document arriving
		// through the one door the corpus left open.
		const open = nodes(SCHEMA)
			.filter((n) => n.type === 'object')
			.filter((n) => n.additionalProperties !== false || !n.properties);
		expect(open).toHaveLength(1);
		expect(
			(SCHEMA.properties as Record<string, Record<string, unknown>>).extensions,
			'the open node is not where this test believes it is'
		).toBeDefined();
	});

	it('POSITIVE CONTROL — the walker actually reaches nested nodes', () => {
		// Without this, a walker that returned only the root would report the same clean result as a clean
		// tree. The nested content refs are the nodes that matter, so their presence is the instrument check.
		const all = nodes(SCHEMA);
		expect(all.length, 'the walker found only the root').toBeGreaterThan(20);
		expect(
			all.some((n) => Array.isArray(n.enum) && (n.enum as string[]).includes('PENDING_CONTENT_PLANE')),
			'the walker never reached a content ref'
		).toBe(true);
	});

	it('no node can carry model BYTES — content travels by reference only', () => {
		// The record is CATALOGUED (REG-D-055), so PER-12's "never projected" holds because the record is
		// incapable of holding model text rather than because a filter removes it. A field that could carry
		// bytes would put that back on a filter someone can delete.
		const carriers = nodes(SCHEMA)
			.flatMap((n) => Object.keys((n.properties as Record<string, unknown>) ?? {}))
			.filter((k) => /^(bytes|content|text|body|raw|prompt|answer|output|response)$/i.test(k));
		expect(carriers, 'a field that could hold model text').toEqual([]);
	});

	it("PER-9's six elements and the per-try chain are each present and REQUIRED", () => {
		// The element -> field mapping is authored (PER-9 names elements in prose, not field names), so this
		// asserts each mapped field EXISTS and is REQUIRED. A rename or a demotion to optional reddens here
		// rather than silently producing records that satisfy the schema and not the obligation.
		const required = new Set(SCHEMA.required as string[]);
		const props = SCHEMA.properties as Record<string, unknown>;
		const ELEMENTS: Record<string, string> = {
			'E-1 materialized input': 'materializedInputRef',
			'E-2 pre-coercion output': 'rawOutputBeforeCoercionRef',
			'E-2 answer span': 'answerSpanRef',
			'E-2 volunteered reasoning': 'volunteeredReasoningRef',
			'E-3 provider': 'resolvedProvider',
			'E-3 model': 'resolvedModel',
			'E-3 version': 'resolvedModelVersion',
			'E-4 input truncation': 'inputTruncation',
			'E-4 output truncation': 'outputTruncation',
			'E-5 disposition': 'disposition',
			'E-5 parse outcome': 'parseOutcome',
			'E-6 redaction manifest': 'inputRedactionManifestRef',
			'E-6 redaction state': 'redactionState',
			'chain: role': 'exchangeRole',
			'chain: ordinal': 'attemptOrdinal',
			'chain: run': 'runToken',
			'PER-11 requested': 'requestedAt',
			'PER-11 responded': 'respondedAt'
		};
		for (const [element, field] of Object.entries(ELEMENTS)) {
			expect(props, `${element} has no field`).toHaveProperty(field);
			expect(required.has(field), `${element} (${field}) must be REQUIRED, not optional`).toBe(true);
		}
	});

	it('⭑ E-3 carries a VERSION, which ActorReference could not', () => {
		// PER-9 requires "the resolved provider, model, and VERSION actually invoked". ActorReference has seven
		// fields and no version, which is why this record does not reuse it. If someone ever collapses the three
		// facts back onto an ActorReference, this is what reddens.
		const version = (SCHEMA.properties as Record<string, Record<string, unknown> | undefined>)
			.resolvedModelVersion;
		expect(version, 'the version fact is gone').toBeDefined();
		expect(Object.keys(version?.properties as object)).toContain('availability');
	});

	it('the id prefix is registered in BOTH the vocabulary and ids.ts', () => {
		// §16 item 8's safe default: "extend the registry/schema/tests before adding an object prefix."
		// AUTHORING_CONVERSATION is the counter-example — it carries an idPrefixEntity that appears in neither.
		const registered = (VOCAB.idPrefixRegistry as { objectType: string; prefix: string }[]).find(
			(r) => r.objectType === 'MODEL_EXCHANGE'
		);
		expect(registered?.prefix, 'MODEL_EXCHANGE is absent from the vocabulary prefix registry').toBe('mex');
		const ids = readFileSync(`${ROOT}packages/rph-contracts/src/ids.ts`, 'utf8');
		expect(ids, 'MODEL_EXCHANGE is absent from ID_PREFIXES').toMatch(/MODEL_EXCHANGE:\s*'mex'/);
	});

	it("⛔ the event's payload gate is ENABLED — the trap that ships this silently wrong", () => {
		// `gen-messages` admits an event to RATIFIED_EVENT_PAYLOADS only when its provenance is free of the
		// unratified marker, and kit's commit gate skips payload validation for everything absent from that
		// map. A provenance note that merely DISCUSSES the marker by name disqualifies its own event — which is
		// what happened on the first draft of this shape, silently, with generation reporting success.
		const messages = readFileSync(`${ROOT}packages/rph-contracts/src/messages.ts`, 'utf8');
		expect(
			messages,
			'ModelExchangeRecorded is not in RATIFIED_EVENT_PAYLOADS — its payload is UNVALIDATED at commit'
		).toMatch(/ModelExchangeRecorded:\s*ModelExchangeRecordedPayloadSchema/);
	});

	it('POSITIVE CONTROL — the gate assertion above can fail', () => {
		// `ArtifactRecorded` is genuinely marked unratified, so it is ABSENT from that map. If this ever
		// matches, the instrument has stopped discriminating and the assertion above proves nothing.
		const messages = readFileSync(`${ROOT}packages/rph-contracts/src/messages.ts`, 'utf8');
		expect(
			/ArtifactRecorded:\s*ArtifactRecordedPayloadSchema/.test(messages),
			'the ratified-payload map no longer discriminates'
		).toBe(false);
	});
});
