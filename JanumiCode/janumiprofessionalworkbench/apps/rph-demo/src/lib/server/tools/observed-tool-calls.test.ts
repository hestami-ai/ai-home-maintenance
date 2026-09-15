// ⭐⭐ R11 — THE TOOL-CALL RETENTION RULING, DRIVEN.
//
// `governedToolCallReport` is the ONE place that decides what a PERMANENT governed record may hold about what a
// model did with its tools. Every test here is a limb of that ruling, and each names the mutant it exists to
// catch. ⛔ The ruling's whole substance is in what it REFUSES, and a refusal nothing drives is a comment.
import { describe, expect, it } from 'vitest';
import { governedToolCallReport, OBSERVED_TOOL_CALL_LIMIT } from './observed-tool-calls.js';
import type { AdapterToolCall } from './backing-tool.js';

const call = (name: string, outcome: AdapterToolCall['outcome'] = 'COMPLETED'): AdapterToolCall => ({
	name,
	outcome
});

describe('R11 · the observed tool-call record', () => {
	// ── ⭐ Q1 — AN ABSENCE MUST STATE ITSELF, AND THE TWO ABSENCES ARE DIFFERENT FACTS ──────────────────────
	it('⭐ an adapter that CANNOT observe is NOT_OBSERVABLE — never NONE_OBSERVED', () => {
		// THE MUTANT: return `{ observation: 'NONE_OBSERVED', reason }` from the `canObserve: false` arm. It
		// type-checks, every other test in this file passes, and the governed record silently acquires a
		// MEASUREMENT nobody made — "a tool surface existed and the model used none" — where the truth is that
		// nothing was in a position to look. A reader deciding whether a step ran commands would be misled in
		// the one direction that matters.
		const report = governedToolCallReport({
			canObserve: false,
			reason: 'This adapter mints no tool surface and watches no session.'
		});
		expect(report.observation).toBe('NOT_OBSERVABLE');
		expect(report.reason, 'a disclosed absence must say why — PER-9 forbids the silent one').toContain(
			'mints no tool surface'
		);
		expect(
			report.calls,
			'an adapter that cannot see must not describe what it did not see'
		).toBeUndefined();
	});

	it('⭑ CONTROL — an adapter that CAN observe and saw nothing is NONE_OBSERVED, which is a measurement', () => {
		// ⭐ THE CONTROL NEEDS ITS OWN MUTANT (a control that cannot fail is not a control). THE MUTANT: return
		// NOT_OBSERVABLE from this arm too. The test above stays green — both arms would agree — and the
		// distinction the whole field exists for would be gone while the code still visibly branches.
		const report = governedToolCallReport({
			canObserve: true,
			mintedToolNames: ['run_command', 'write_file'],
			calls: []
		});
		expect(report.observation).toBe('NONE_OBSERVED');
		expect(
			report.reason,
			'and it must name the surface that went unused, or the measurement says nothing about what was possible'
		).toContain('run_command');
		expect(report.calls).toBeUndefined();
	});

	// ── ⭐⭐ Q2 — WHAT IS RECORDED, WHAT IS BOUNDED, WHAT IS REFUSED ────────────────────────────────────────
	it('⭐ a MINTED name is recorded, because it is the HOST’s word about its own tool surface', () => {
		const report = governedToolCallReport({
			canObserve: true,
			mintedToolNames: ['run_command'],
			calls: [call('run_command', 'COMPLETED')]
		});
		expect(report.observation).toBe('OBSERVED');
		expect(report.calls).toHaveLength(1);
		expect(report.calls![0]!.nameProvenance).toBe('MINTED_BY_HOST');
		expect(report.calls![0]!.toolName).toBe('run_command');
		expect(report.calls![0]!.outcome).toBe('COMPLETED');
		expect(report.calls![0]!.ordinal, '1-based, in observation order').toBe(1);
	});

	it('⛔ an UNMINTED name is REFUSED — the FACT is kept, the model’s spelling is not', () => {
		// ⭐⭐ THIS IS THE B5 LESSON ARRIVING IN A PERMANENT RECORD. Tool-call names the host did not mint are
		// arbitrary MODEL-CHOSEN strings, and this programme has twice found a host absolute path and an
		// operating username reaching a governed refusal through exactly that channel. `R10` confirmed a
		// `MODEL_EXCHANGE` is PERMANENT under `PER-8` — nothing deletes it, ever — and `PER-9` makes
		// record-plane omission illegal, so nothing can ever take such a string back out.
		//
		// THE MUTANT: emit `toolName: call.name` on the NOT_MINTED arm as well. Every other assertion here
		// still passes, the record looks richer, and a model that names its tool
		// `C:\\Users\\<someone>\\secrets` has written that into a record with no redaction path.
		const report = governedToolCallReport({
			canObserve: true,
			mintedToolNames: ['run_command'],
			calls: [call('C:\\Users\\mchen\\.ssh\\id_rsa --exfiltrate', 'REFUSED')]
		});
		expect(report.observation).toBe('OBSERVED');
		const only = report.calls![0]!;
		expect(only.nameProvenance, 'the fact that an unminted call was attempted is the point').toBe(
			'NOT_MINTED'
		);
		expect(only.outcome, 'and what happened to it is kept too').toBe('REFUSED');
		expect(only.toolName, 'but the model’s own string may not enter a permanent record').toBeUndefined();
		// ⛔ TOTAL, NOT FIELD-BY-FIELD. A future field could carry the string somewhere this test does not look,
		// so the assertion is over the SERIALIZED record rather than over the one property I thought of.
		expect(JSON.stringify(report), 'no part of the model-chosen string may survive anywhere').not.toContain(
			'mchen'
		);
		expect(JSON.stringify(report)).not.toContain('id_rsa');
	});

	it('⛔ the list is BOUNDED, and the bound is DECLARED rather than applied silently', () => {
		// ⭐ WITHOUT THE DECLARATION A TRUNCATED RECORD READS EXACTLY LIKE A COMPLETE ONE, which is
		// `REG-F-345`'s shape: two different realities producing indistinguishable records.
		//
		// THE MUTANT: drop the `.slice(0, OBSERVED_TOOL_CALL_LIMIT)`. An UNTRUSTED party then decides how many
		// entries a PERMANENT record holds — and the `observedCount` assertion below still passes, because the
		// count was right all along; only the bound was gone.
		const many = Array.from({ length: OBSERVED_TOOL_CALL_LIMIT + 7 }, (_unused, i) =>
			call(`run_command`, i % 2 === 0 ? 'COMPLETED' : 'FAILED')
		);
		const report = governedToolCallReport({
			canObserve: true,
			mintedToolNames: ['run_command'],
			calls: many
		});
		expect(report.calls).toHaveLength(OBSERVED_TOOL_CALL_LIMIT);
		expect(report.recordedLimit, 'the bound actually applied').toBe(OBSERVED_TOOL_CALL_LIMIT);
		expect(report.observedCount, 'the TOTAL observed, which is what makes truncation visible').toBe(
			many.length
		);
		expect(report.calls!.at(-1)!.ordinal).toBe(OBSERVED_TOOL_CALL_LIMIT);
	});

	it('⛔ NOTHING IN THE SHAPE CAN CARRY ARGUMENTS — the refusal is structural, not disciplinary', () => {
		// ⭐ THE STRONGEST FORM OF THIS RULING IS THAT THERE IS NOWHERE TO PUT THEM, which is the same move
		// `ExchangeContentRef` makes by having no `bytes` field. An adapter that hands over arguments-shaped
		// content in the only free field it has — the NAME — is the realistic leak, and it is refused above.
		// This asserts the complementary half: the emitted record's key set is closed and small.
		const report = governedToolCallReport({
			canObserve: true,
			mintedToolNames: ['run_command'],
			calls: [call('run_command')]
		});
		expect(Object.keys(report.calls![0]!).sort((a, b) => Number(a > b) - Number(a < b))).toEqual([
			'nameProvenance',
			'ordinal',
			'outcome',
			'toolName'
		]);
	});
});
