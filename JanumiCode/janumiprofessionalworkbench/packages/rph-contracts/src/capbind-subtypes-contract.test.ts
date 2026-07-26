// JAN-CAPBIND WP-0 — the three authored sub-types, tested from the ATTACKER'S side.
//
// N-5 recorded four ratified helper sub-types as `Source TBD`, so `gen-objects.ts` emitted
// `z.record(z.string(), z.unknown())` — "any object" — and three ratified rules had nothing to quantify over.
// Three are now authored under sponsor grant (JAN-CAPBIND-DS-001); `OutputBinding` is deliberately NOT, because no
// rule quantifies over its fields and only its array LENGTH is ever read.
//
// WHY THIS FILE IS NOT OPTIONAL. The failure mode for this work package is not "the shape is wrong" — it is "the
// shape looks authored and enforces nothing." `isPlaceholder`'s third limb is
// `!FORCE_FULL.has(h.name) && h.fields.length < 2`, so a single-field authoring silently stays a permissive
// `z.record` unless the name is in `FORCE_FULL`. Both capability types are single-field BY DESIGN. Without the
// negative assertions below, a missing `FORCE_FULL` entry would produce a green build, a plausible-looking vocab
// diff, and no enforcement whatever — a contract change that appears to land and does nothing, which is this
// lineage's signature defect.
import { describe, expect, it } from 'vitest';
import {
	CapabilityGrantSchema,
	CapabilityRequestSchema,
	InputBindingSchema,
	OutputBindingSchema
} from './objects.js';

describe('WP-0 — CapabilityRequest / CapabilityGrant carry a comparable IDENTITY', () => {
	it('accepts the key the codebase has already been writing for four milestones', () => {
		// ZERO-MIGRATION IS A CORRECTNESS CRITERION HERE, not a convenience. Those existing literals are the only
		// empirical evidence of intended shape that exists, so an authoring that broke them would be authoring
		// against the sole evidence available.
		for (const schema of [CapabilityRequestSchema, CapabilityGrantSchema]) {
			expect(schema.safeParse({ capability: 'file-system' }).success).toBe(true);
			expect(schema.safeParse({ capability: 'fs.read' }).success).toBe(true);
		}
	});

	it('REFUSES an entry naming no capability — the identity is what the subset rule compares', () => {
		// If this passes, `granted ⊆ requested` compares undefined against undefined and admits anything.
		for (const schema of [CapabilityRequestSchema, CapabilityGrantSchema]) {
			expect(schema.safeParse({}).success).toBe(false);
		}
	});

	it('IS STRICT — proving FORCE_FULL is in effect and the type is not still an "any object"', () => {
		// THE LOAD-BEARING ASSERTION OF THIS FILE. A permissive `z.record(z.string(), z.unknown())` accepts every
		// object, so it would pass every positive test above while enforcing nothing. Only a rejection can tell the
		// two apart, and `scope` is the specific undeclared key to try: it is the field the design deliberately
		// REFUSED to author (the runtime bound lives in the platform's policy plane), so its rejection also pins
		// that refusal against a later well-meaning re-introduction.
		for (const schema of [CapabilityRequestSchema, CapabilityGrantSchema]) {
			expect(schema.safeParse({ capability: 'file-system', scope: '/tmp' }).success).toBe(false);
		}
	});

	it('has the SAME shape for request and grant, which is what makes them comparable at all', () => {
		// §22.1's "requested capability is not granted capability" has no content unless the two sets are comparable.
		// The known cost — TypeScript cannot tell one from the other — is mitigated by `grantedWithinRequest` taking
		// NAMED parameters, not by padding either type with an invented field.
		const value = { capability: 'network' };
		expect(CapabilityRequestSchema.safeParse(value).success).toBe(
			CapabilityGrantSchema.safeParse(value).success
		);
	});
});

describe('WP-0 — InputBinding gives RPH-EXE-005 a subject', () => {
	it('accepts an artifact-backed required input', () => {
		expect(InputBindingSchema.safeParse({ artifactId: 'art_1', required: true }).success).toBe(true);
	});

	it('accepts an EMPTY binding — both fields optional, so no stored event becomes invalid', () => {
		// WP-1's invariant. `required` is read fail-closed as `required ?? true` at the point of use, which is where
		// the defaulting belongs: putting it in the schema would rewrite stored data on read.
		expect(InputBindingSchema.safeParse({}).success).toBe(true);
		expect(InputBindingSchema.safeParse({ artifactId: 'art_1' }).success).toBe(true);
	});

	it('IS STRICT — an undeclared key is refused', () => {
		// The same placeholder-vs-authored discrimination as above. `name` is the specific key to try: it is the most
		// plausible invention available for this type, and it was refused because nothing reads it.
		expect(InputBindingSchema.safeParse({ artifactId: 'a', name: 'the report' }).success).toBe(false);
	});

	it('refuses a mistyped requiredness rather than coercing it', () => {
		expect(InputBindingSchema.safeParse({ required: 'yes' }).success).toBe(false);
	});
});

describe('WP-0 — OutputBinding stays deliberately opaque, and that is asserted', () => {
	it('still accepts any object, because no rule quantifies over its fields', () => {
		// R-C. RPH-EXE-006 is about the COMPLETION PAYLOAD, not this declaration, and the only thing any code reads
		// is the array's length (`declaresOutputBindings`). Authoring fields would be invention with zero
		// enforcement value.
		//
		// ASSERTED RATHER THAN LEFT UNSAID, so the difference between "not yet authored" and "deliberately not
		// authored" is visible in the suite: N-5's harm was that nobody could tell those two apart.
		expect(OutputBindingSchema.safeParse({ anything: 1, at: 'all' }).success).toBe(true);
		expect(OutputBindingSchema.safeParse({}).success).toBe(true);
	});
});

describe('WP-0 — the existing fixture corpus still parses', () => {
	it('accepts every capability literal currently written in this repo', () => {
		// Mechanically harvested: `grep -rn "capability: '"` over packages and apps returns 13 lines across 4 files,
		// every one keyed `capability`. These are the exact values.
		for (const capability of ['fs.read', 'shell.exec', 'file-system']) {
			expect(CapabilityRequestSchema.safeParse({ capability }).success, capability).toBe(true);
			expect(CapabilityGrantSchema.safeParse({ capability }).success, capability).toBe(true);
		}
	});

	it('accepts the empty binding arrays every execution fixture uses', () => {
		// Every `inputBindings`/`outputBindings` literal in the repo is `[]`, so the authoring migrates nothing.
		expect(InputBindingSchema.array().safeParse([]).success).toBe(true);
		expect(OutputBindingSchema.array().safeParse([]).success).toBe(true);
	});
});
