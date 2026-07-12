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

const cmd = COMMANDS as Record<string, { firstSlice: boolean; emitsEvent: string }>;

describe('M3 command/event registries + binding table', () => {
	it('registers every command + event from the catalog', () => {
		expect(Object.keys(COMMANDS).sort()).toEqual(vocab.commands.map((c) => c.commandType).sort());
		expect(Object.keys(EVENTS).sort()).toEqual(vocab.events.map((e) => e.eventType).sort());
	});

	it('has all 14 first-slice commands, each flagged and bound to its emitted event', () => {
		expect([...FIRST_SLICE_COMMANDS].sort()).toEqual([...vocab.firstSliceCommands].sort());
		expect(FIRST_SLICE_COMMANDS.length).toBe(14);
		for (const ct of FIRST_SLICE_COMMANDS) {
			expect(cmd[ct], ct).toBeDefined();
			expect(cmd[ct]!.firstSlice).toBe(true);
			const binding = BINDINGS.find((b) => b.commandType === ct);
			expect(binding, `binding for ${ct}`).toBeDefined();
			expect(binding!.eventType).toBe(cmd[ct]!.emitsEvent);
		}
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
