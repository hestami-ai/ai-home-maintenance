import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	BINDINGS,
	COMMANDS,
	CaptureIntentPayloadSchema,
	EVENTS,
	ExecutionStepSucceededPayloadSchema,
	FIRST_SLICE_COMMANDS
} from './messages.js';

const vocab = JSON.parse(
	readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), '..', 'vocab', 'm3-commands-events.json'),
		'utf8'
	)
) as {
	commands: { commandType: string }[];
	events: { eventType: string }[];
	firstSliceCommands: string[];
};

const cmd = COMMANDS as Record<
	string,
	{ firstSlice: boolean; emitsEvent: string; alsoEmitsEvents?: readonly string[] }
>;
/** Every event a command actually commits in one dispatch — `emitsEvent` plus any `alsoEvents` it declares. */
const committedBy = (ct: string): Set<string> =>
	new Set([cmd[ct]?.emitsEvent ?? '', ...(cmd[ct]?.alsoEmitsEvents ?? [])].filter(Boolean));

describe('M3 command/event registries + binding table', () => {
	it('registers every command + event from the catalog', () => {
		expect(Object.keys(COMMANDS).sort()).toEqual(vocab.commands.map((c) => c.commandType).sort());
		expect(Object.keys(EVENTS).sort()).toEqual(vocab.events.map((e) => e.eventType).sort());
	});

	// REG-F-027 — THIS ASSERTION USED TO BE UNFALSIFIABLE. It read `expect(binding.eventType).toBe(
	// cmd[ct].emitsEvent)` while the generator OVERWROTE every binding's eventType with exactly that value. It
	// could not fail for any vocab, and it stayed green through the whole period in which the generated table
	// attributed REQUESTED -> EVIDENCE_PENDING to an event that does not drive it. The generator now CHECKS
	// instead of rewriting, so the identity is no longer forced — and the assertion is written against what a
	// binding is actually allowed to say, which is a real constraint with a real way to be wrong.
	it('has all 14 first-slice commands, each flagged and bound only to events it commits', () => {
		expect([...FIRST_SLICE_COMMANDS].sort()).toEqual([...vocab.firstSliceCommands].sort());
		expect(FIRST_SLICE_COMMANDS).toHaveLength(14);
		for (const ct of FIRST_SLICE_COMMANDS) {
			expect(cmd[ct], ct).toBeDefined();
			expect(cmd[ct]!.firstSlice).toBe(true);
			const rows = BINDINGS.filter((b) => b.commandType === ct);
			expect(rows.length, `binding for ${ct}`).toBeGreaterThan(0);
			const committed = committedBy(ct);
			// EVERY row, not the first one found: a command committing several facts has several rows, and reading
			// only the first is how the wrong one stayed invisible.
			for (const b of rows)
				expect(
					[...committed],
					`${ct} binds ${b.eventType} for ${b.machine} ${b.from}->${b.to}, which it does not commit`
				).toContain(b.eventType);
			// The primary event must still be bound somewhere — otherwise a command could declare `emitsEvent` and
			// have every row point at a secondary one.
			expect(rows.map((b) => b.eventType)).toContain(cmd[ct]!.emitsEvent);
		}
	});

	it('CONTROL: the binding check can FAIL — a command does not commit an arbitrary event', () => {
		// Without this the loop above passes for the same reason its predecessor did: because nothing it examines
		// can differ. `committedBy` must be a real membership test, not a set that contains whatever it is asked for.
		expect(committedBy('RequestAssuranceAssessment').has('PwuMarkedReady')).toBe(false);
		// ...and the multi-event command really does declare BOTH, which is what makes its second row legal.
		expect([...committedBy('RequestAssuranceAssessment')].sort()).toEqual([
			'AssuranceAssessmentRequested',
			'AssuranceEvidenceRequired'
		]);
	});
});

describe('command payload validation', () => {
	it('validates a representative CaptureIntent payload and rejects unknown props', () => {
		const p = {
			intentId: 'int_x',
			originatingExpression: 'Build a field service SaaS',
			ontologyId: 'product-realization-pwa',
			ontologyVersion: '1.0.0'
		};
		expect(CaptureIntentPayloadSchema.safeParse(p).success).toBe(true);
		expect(CaptureIntentPayloadSchema.safeParse({ ...p, sneaky: 1 }).success).toBe(false);
	});
});

describe('RPH-CON-008: ExecutionStepSucceeded cannot carry an assurance mutation (§35.2 / property P1)', () => {
	it('its payload has NO assurance field — it drives the execution axis only', () => {
		const keys = Object.keys(ExecutionStepSucceededPayloadSchema.shape);
		expect(keys.some((k) => /assurance|satisfied/i.test(k))).toBe(false);
		const binding = BINDINGS.find((b) => b.eventType === 'ExecutionStepSucceeded');
		expect(binding?.machine ?? '').toMatch(/ExecutionStep/);
		expect(binding?.to).toBe('SUCCEEDED');
	});
});
