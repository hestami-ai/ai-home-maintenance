// ⭐ `JAN-EXEC` Phase 7, P7-6R, R-1 (`docs/_working/DESIGN-the-stopped-unit-recovery.md` RD3, RD7; `REG-D-105` (3)) — THE
// RECOVERY MODULE'S OWN RULES, HELD WHERE NO ROUTE CAN REACH THEM: how a refusal is sorted, across one subject and across
// several; and each check a re-review's rebuild makes before it reviews anything — the fingerprint, the split, the
// producer, and one command's run rebuilt from its evidence and rendered back to the bytes it came from.
// ⭑ The route tests (`routes/undertakings/[id]/stopped-unit-recovery.route.test.ts`) drive these through the page's
// actions; what they cannot arrange — a template that moved, a stdout that holds the stderr heading — is arranged here.
import { createHash } from 'node:crypto';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { describe, expect, it } from 'vitest';
import { renderProcessResultEvidence } from '../assurance/process-result-render.js';
import type { FloorRemediationAction } from '../floor.js';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import {
	attemptStepOf,
	fingerprintRefusal,
	producerOf,
	rebuildProcessRun,
	refusalKindOf,
	splitRefusal,
	strictestKind
} from './stopped-unit-recovery.js';

describe('⭐ RD3 — a refusal is sorted by the floor’s own classification', () => {
	// ⭐ `P76F-A` A4: and save the two only a different or re-qualified reviewer can fix — a substituted model, a reviewer not
	// independent of the producer — which offer NEITHER re-run: each re-run is reviewed by that same reviewer.
	it('⛔ each of the classifier’s actions, sorted: an operational one did not conclude, save the escalation and the two the reviewer must change for; a subject finding concluded', () => {
		const actions: readonly FloorRemediationAction[] = [
			'RETRY_OR_CONFIGURE_REVIEWER',
			'REQUALIFY_OR_RESELECT_REVIEWER',
			'CHANGE_REVIEWER',
			'ESCALATE_REVIEW',
			'REFINE_SUBJECT',
			'RESOLVE_OTHER_FLOOR_FINDINGS'
		];
		expect(actions.map((a) => [a, refusalKindOf(a)])).toEqual([
			['RETRY_OR_CONFIGURE_REVIEWER', 'NOT_CONCLUDED'],
			['REQUALIFY_OR_RESELECT_REVIEWER', 'REVIEWER_MUST_CHANGE'],
			['CHANGE_REVIEWER', 'REVIEWER_MUST_CHANGE'],
			['ESCALATE_REVIEW', 'ESCALATED'],
			['REFINE_SUBJECT', 'CONCLUDED'],
			// ⛔⛔ `P76F-D` D1 — NOT A REVIEW THAT CONCLUDED AGAINST THE WORK: the review was SATISFIED and a deterministic floor
			// policy refused the work (`classifyFloorRemediation`'s last arm). Filed `CONCLUDED`, its re-run of the work cited
			// *"after a review that concluded against the work"* on the Decision's permanent record — the review concluded FOR it.
			['RESOLVE_OTHER_FLOOR_FINDINGS', 'FLOOR_FINDING']
		]);
	});

	it('⛔ across subjects the strictest wins: one concluded refusal makes the stop concluded, then one escalation', () => {
		// THE MUTANT: read the first subject alone — a re-review would then re-run a concluded review beside one that failed.
		expect(strictestKind(['NOT_CONCLUDED', 'CONCLUDED'])).toBe('CONCLUDED');
		expect(strictestKind(['ESCALATED', 'CONCLUDED'])).toBe('CONCLUDED');
		expect(strictestKind(['NOT_CONCLUDED', 'ESCALATED'])).toBe('ESCALATED');
		expect(strictestKind(['NOT_CONCLUDED', 'NOT_CONCLUDED'])).toBe('NOT_CONCLUDED');
		// ⭐ `P76F-A` A4 — and a reviewer that must change outranks them all: any re-run would be reviewed by it again.
		expect(strictestKind(['CONCLUDED', 'REVIEWER_MUST_CHANGE'])).toBe('REVIEWER_MUST_CHANGE');
		expect(strictestKind(['REVIEWER_MUST_CHANGE', 'ESCALATED'])).toBe('REVIEWER_MUST_CHANGE');
		expect(strictestKind(['NOT_CONCLUDED', 'REVIEWER_MUST_CHANGE'])).toBe('REVIEWER_MUST_CHANGE');
		expect(strictestKind([])).toBe('NOT_CONCLUDED');
	});

	// ⭐⭐ `P76F-D` D1 — A FLOOR FINDING'S PLACE AMONG THEM. ⭑ One floor finding WITHHOLDS a re-review: a re-review runs that
	// deterministic policy again over the same work, and the completion would be refused again by it. ⭑ But a REVIEW that
	// concluded — against the work, or escalated — beside it still decides the stop: `REG-D-105` (3) then rules the re-run of
	// the work, so its citation, and its reason for withholding the re-review, are that review's.
	it('⛔ P76F-D D1 — a floor finding outranks a review that did not conclude, and yields to one that concluded or escalated, and to a reviewer that must change', () => {
		expect(strictestKind(['FLOOR_FINDING'])).toBe('FLOOR_FINDING');
		// THE MUTANT: read the first subject alone — a re-review would then be offered beside a finding it cannot change.
		expect(strictestKind(['NOT_CONCLUDED', 'FLOOR_FINDING'])).toBe('FLOOR_FINDING');
		expect(strictestKind(['FLOOR_FINDING', 'CONCLUDED'])).toBe('CONCLUDED');
		// THE MUTANT: a floor finding ahead of an escalation — the re-run of the work would then cite (1) alone beside a
		// review that escalated, which (3) rules.
		expect(strictestKind(['FLOOR_FINDING', 'ESCALATED'])).toBe('ESCALATED');
		expect(strictestKind(['FLOOR_FINDING', 'REVIEWER_MUST_CHANGE'])).toBe('REVIEWER_MUST_CHANGE');
	});

	it('⭐ an attempt key names its step: everything before its last `#`', () => {
		expect(attemptStepOf('step_01ABC#3')).toBe('step_01ABC');
	});
});

describe('⭐ RD7 — what a re-review checks before it reviews anything', () => {
	const exchange = {
		exchangeId: 'mex_1',
		promptTemplateFingerprint: 'pwut_1@v2',
		resolvedModel: {
			availability: 'REPORTED',
			evidence: 'PROVIDER_REPORTED',
			value: 'executor-model'
		},
		resolvedProvider: {
			availability: 'REPORTED',
			evidence: 'PROVIDER_REPORTED',
			value: 'executor-provider'
		}
	};

	it('⛔ the re-rendered prompt’s fingerprint must be the one the producing exchange recorded', () => {
		expect(fingerprintRefusal('pwut_1@v2', exchange)).toBeNull();
		expect(fingerprintRefusal('pwut_1@v3', exchange)).toBe(
			'the prompt re-renders under pwut_1@v3, and exchange mex_1 records pwut_1@v2: the template is not the one that produced the work product.'
		);
		expect(fingerprintRefusal('pwut_1@v2', { exchangeId: 'mex_2' })).toBe(
			'the prompt re-renders under pwut_1@v2, and exchange mex_2 records no fingerprint: the template is not the one that produced the work product.'
		);
	});

	it('⛔ the answer span must split into the very work product the ARTIFACT names', () => {
		expect(splitRefusal('{"a":1}', '{"a":1}', 'mex_1', 'art_1')).toBeNull();
		expect(splitRefusal('{"a":2}', '{"a":1}', 'mex_1', 'art_1')).toBe(
			'exchange mex_1’s answer span does not split into the work product art_1 names, so the rationale beside it is not the one that was reviewed.'
		);
	});

	it('⛔ the producer is the model AND the provider the exchange recorded — both, or a refusal', () => {
		expect(producerOf(exchange)).toEqual({
			modelId: 'executor-model',
			providerId: 'executor-provider'
		});
		const unreported = {
			...exchange,
			resolvedProvider: { availability: 'UNREPORTED', evidence: 'NONE' }
		};
		expect(producerOf(unreported)).toEqual({
			refusedBecause:
				'exchange mex_1 records no producing model and provider, so the review’s independence cannot be decided.'
		});
		expect(producerOf({ ...exchange, resolvedModel: {} })).toHaveProperty('refusedBecause');
	});
});

describe('⭐ RD7 — one command’s run, rebuilt from its evidence and rendered back to the bytes it came from', () => {
	const sha256 = (s: string) => `sha256:${createHash('sha256').update(s, 'utf8').digest('hex')}`;
	const run = (over: Partial<ObservedProcessRun> = {}): ObservedProcessRun => ({
		ordinal: 1,
		argv: ['node', '--test', 'a b'],
		exitCode: 1,
		timedOut: false,
		durationMs: 37,
		outputComplete: false,
		omittedRegions: [{ stream: 'STDOUT', reason: 'cap', byteSize: 9, byteOffset: 40 }],
		retention: {
			retained: true,
			workspaceOwnerId: 'und_1',
			purgeability: 'PURGEABLE_AT_EXPIRY',
			stdoutPath: 'captures/1/stdout.txt',
			stderrPath: 'captures/1/stderr.txt',
			omittedRegions: [{ stream: 'STDOUT', reason: 'cap', byteSize: 9, byteOffset: 40 }],
			omissionsPath: 'captures/1/omissions.json'
		},
		stdout: 'ok 1 - parses\nnot ok 2 - counts\n',
		stderr: 'AssertionError: 3 !== 2\n',
		...over
	});
	/** The EVIDENCE the join records for `r`: its bytes minted, its content reference, as `evidence-join.ts` writes them. */
	async function evidenceOf(r: ObservedProcessRun, recorded: Partial<ObservedProcessRun> = {}) {
		const store = createInMemoryArtifactStore();
		const bytes = renderProcessResultEvidence(r);
		const minted = await store.put({
			tenantPrefix: 'tnt-test',
			bytes,
			mediaType: 'text/plain',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		const facts = { ...r, ...recorded };
		const evidence = {
			id: 'evd_1',
			contentReference: {
				mint: { storageKey: minted.storageKey, contentHash: minted.contentHash },
				capture: facts.retention.retained
					? {
							retained: true,
							workspaceOwnerId: facts.retention.workspaceOwnerId,
							purgeability: facts.retention.purgeability,
							stdoutPath: facts.retention.stdoutPath,
							stderrPath: facts.retention.stderrPath,
							omissionsPath: facts.retention.omissionsPath
						}
					: { retained: false, notRetainedBecause: facts.retention.notRetainedBecause },
				command: facts.argv,
				exitCode: facts.exitCode,
				timedOut: facts.timedOut,
				durationMs: facts.durationMs,
				producingExecutionAttemptId: 'step_1#1'
			}
		};
		return { store, evidence, bytes, minted };
	}

	it('⭐ a run with a cut stream and an incomplete capture is rebuilt whole: its streams, its cuts, its exit — and renders back to its bytes', async () => {
		const original = run();
		const { store, evidence, bytes } = await evidenceOf(original);
		const rebuilt = await rebuildProcessRun(evidence, store, 1);
		expect(rebuilt.ok).toBe(true);
		if (!rebuilt.ok) return;
		expect(renderProcessResultEvidence(rebuilt.value)).toBe(bytes);
		expect(rebuilt.value).toMatchObject({
			argv: original.argv,
			exitCode: 1,
			timedOut: false,
			durationMs: 37,
			outputComplete: false,
			stdout: original.stdout,
			stderr: original.stderr,
			omittedRegions: [{ stream: 'STDOUT', byteSize: 9, byteOffset: 40 }]
		});
		// ⚠ The cut's reason is not in the evidence, and the rebuild says so rather than inventing one.
		expect(rebuilt.value.omittedRegions[0]!.reason).toMatch(/^not in the evidence/);
	});

	it('⭐ a run whose output was not retained is rebuilt as not retained, with its reason', async () => {
		const { store, evidence } = await evidenceOf(
			run({
				retention: { retained: false, notRetainedBecause: 'the capture failed' },
				omittedRegions: []
			})
		);
		const rebuilt = await rebuildProcessRun(evidence, store, 2);
		expect(rebuilt.ok && rebuilt.value.retention).toEqual({
			retained: false,
			notRetainedBecause: 'the capture failed'
		});
	});

	it('⛔ AMBIGUOUS — a stdout that holds the stderr heading’s line could split two ways that render identically: refused', async () => {
		// THE MUTANT: take the first split — this run then renders back byte for byte, reviewed with the wrong streams.
		const { store, evidence } = await evidenceOf(
			run({ stdout: 'before\n--- stderr ---\nafter\n', stderr: 'real\n' })
		);
		expect(await rebuildProcessRun(evidence, store, 1)).toEqual({
			ok: false,
			refusedBecause:
				'evd_1: its streams hold the stderr heading’s line a second time, so where stdout ends cannot be told.'
		});
	});

	it('⛔ a record whose exit disagrees with its bytes does not render back to them: refused', async () => {
		// THE MUTANT: skip the render-back — the run would be reviewed with the record's exit beside the bytes' streams.
		const { store, evidence } = await evidenceOf(run(), { exitCode: 0 });
		expect(await rebuildProcessRun(evidence, store, 1)).toEqual({
			ok: false,
			refusedBecause:
				'evd_1: the run rebuilt from its bytes does not render back to them, so the rebuild is not the run.'
		});
	});

	it('⛔ bytes that do not hash to the record’s hash are refused before they are read', async () => {
		const { store, evidence, minted } = await evidenceOf(run());
		const tampered = {
			...evidence,
			contentReference: {
				...evidence.contentReference,
				mint: { ...evidence.contentReference.mint, contentHash: sha256('other') }
			}
		};
		expect(await rebuildProcessRun(tampered, store, 1)).toEqual({
			ok: false,
			refusedBecause: `evd_1: its bytes at '${minted.storageKey}' do not hash to the ${sha256('other')} it names.`
		});
	});
});
