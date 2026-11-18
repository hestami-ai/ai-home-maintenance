// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D74, D75, D85 (`REG-D-166` (3); `REG-D-167` (4)) — THE ASSURANCE STAGE'S HELPERS' HARNESS: the executor's
// harness, in a copy of the Undertaking's shared workspace made for the helper and removed after, the shared workspace's file hashes compared.
//
// ⭑ WHAT MUST HOLD (D74, D75; the lead's rulings on readings 8 to 12): Pi's selection alone runs a helper (it needs `write_file` and `run_command`); the
// copy is `<W>.<role>-<round id>`, removed after, and a copy an earlier press left is removed first and named; the helper's session is Pi's own
// file in `<D>.sessions/<role>/<round id>/`, a leftover moved aside, never continued; a change to the shared workspace while it runs is returned
// for its answer to be refused; its exchange is on the EXECUTION plane under a role of its own, its subject the round's opening verdict; its commands
// are captured through the evidence join, with no floor.
// ⭑ THE PRODUCER IS SCRIPTED OVER THE HOST'S REAL TOOLS: the opener a test hands in mints `write_file` and `run_command` for the context's grant over
// the context's own ports (`mintExecutionTools`), and its turn calls them as a model would — so the copy, the runner and the observer are the
// product's. ⛔ No model: nothing is sent; one real process runs, `node --version`, in the copy.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInMemoryArtifactStore, createInMemoryWorkspace } from '@janumipwb/rph-ports';
import type { RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { afterAll, describe, expect, it } from 'vitest';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import type { ExecutorSessionPlace, ProducerSession, ProducerSessionContext } from '../execution/producer-session.js';
import { sessionFolderOf } from '../execution/workspace-host.js';
import { mintExecutionTools } from '../tools/execution-tool-surface.js';
import { createProcessRunObserver } from '../tools/process-run-observer.js';
// ⭐ L17b3 — the lead's ruling 11: a helper's dropped replies, by the executor's writer.
import { droppedRepliesNameOf } from '../execution/dropped-replies.js';
import type { DroppedReply } from '../tools/backing-tool.js';
import { HELPER_INVOKER } from './assurance-stage-roles.js';
import { runStageHelper, type HelperRun } from './stage-helper-run.js';

const ROOT = mkdtempSync(join(tmpdir(), 'jpwb-stage-helper-'));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));
let n = 0;

/** One case's shared workspace — a FILESYSTEM workspace holding a file — its sessions root, and what the harness was handed and did. */
function arrange(script: (tools: ReturnType<typeof mintExecutionTools>, context: ProducerSessionContext) => Promise<void> = async () => undefined) {
	const at = join(ROOT, `case-${++n}`);
	const dir = join(at, 'demo.sqlite.workspaces', 'und_1-0123456789abcdef');
	mkdirSync(join(dir, 'src'), { recursive: true });
	writeFileSync(join(dir, 'src', 'reader.ts'), 'export const read = () => "";\n');
	const shared = createFilesystemWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_1', purgeability: 'RETAINED_BY_PARTICIPATION', directoryPath: dir });
	const opened: { dir: string | undefined; modelId: string; place: ExecutorSessionPlace; granted: readonly string[] }[] = [];
	const exchanges: RecordModelExchangePayload[] = [];
	const steps: (readonly [string, string, string, Record<string, unknown>])[] = [];
	let disposed = 0;
	let ids = 0;
	const deps = {
		store: createInMemoryArtifactStore(),
		tenantPrefix: 'tnt-test',
		newId: (prefix: string) => `${prefix}_${++ids}`,
		now: () => '2026-11-16T10:00:00.000Z',
		runSteps: (s: readonly (readonly [string, string, string, Record<string, unknown>])[]) => {
			steps.push(...s);
			return null;
		},
		dispatchExchange: (payload: RecordModelExchangePayload) => {
			exchanges.push(payload);
			return { status: 'ACCEPTED' };
		},
		sessionsRoot: join(at, 'demo.sqlite.sessions'),
		openPi: async (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace): Promise<ProducerSession> => {
			opened.push({ dir: context.workspace.directoryPath, modelId, place, granted: context.grantedCapabilities });
			const observer = createProcessRunObserver();
			const tools = mintExecutionTools({
				ports: { workspace: context.workspace, runner: context.runner, processRuns: observer },
				grantedCapabilities: context.grantedCapabilities,
				bindingAuthorizationStatus: context.bindingAuthorizationStatus
			});
			return {
				retainsHistory: true,
				mintedToolNames: [], // ⭐ L17b3 (D89) — arrangement: the session says the tools it minted (none), as every `ProducerSession` now does.
				turn: async () => {
					await script(tools, context);
					return JSON.stringify({ named: null, hypotheses: [], confidence: 'unsure', guidance: '' });
				},
				lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
				processRuns: () => observer.observed(),
				dispose: () => {
					disposed += 1;
				}
			};
		}
	};
	const run: HelperRun = {
		role: 'hypothesizer',
		roundId: 'asm_round',
		roundVersion: 1,
		undertakingId: 'und_1',
		shared,
		executor: { kind: 'PI', modelId: 'faux/model' },
		prompt: 'You are the Hypothesizer.',
		parse: () => ({ outcome: 'PARSED', detail: 'read as a diagnosis' }),
		// ⭐ L17b3 (D89) — arrangement: the record's files written into the copy before the turn, none here; `L17b3 (D89)` below holds them.
		recordFiles: []
	};
	return { at, dir, shared, opened, exchanges, steps, deps, run, disposed: () => disposed };
}

describe('⭐⭐ L17b1 (D74, D75) — a helper runs in a copy of the shared workspace, removed after', () => {
	it('⛔ RED FIRST — the copy is `<W>.<role>-<round id>`, handed to Pi’s opener with the executor’s grant and its session’s place; removed after, the session disposed', async () => {
		const a = arrange(async (tools) => {
			await tools.find((t) => t.name === 'write_file')!.run({ path: 'probe.txt', contents: 'written in the copy' });
		});

		const out = await runStageHelper(a.run, a.deps);

		expect(out.ran, out.ran ? '' : out.why).toBe(true);
		expect(
			a.opened.map((o) => [o.dir, o.modelId, o.granted, o.place]),
			'the opener was not handed the copy, the selection’s model, the grant and the round’s folder'
		).toEqual([
			[
				`${a.dir}.hypothesizer-asm_round`,
				'faux/model',
				['file-system', 'process-execution'],
				{ kind: 'DURABLE', folder: sessionFolderOf(a.deps.sessionsRoot, 'hypothesizer', 'asm_round'), opening: { kind: 'NEW' } }
			]
		]);
		expect([existsSync(`${a.dir}.hypothesizer-asm_round`), a.disposed()], 'the copy was left, or the session not disposed').toEqual([false, 1]);
		expect(existsSync(join(a.dir, 'probe.txt')), 'the helper’s write reached the shared workspace').toBe(false);
		expect(out.ran && out.sharedChanged, 'the shared workspace was read as changed').toEqual([]);
	});

	it('⛔ RED FIRST — a change to the shared workspace while it runs is returned, path by path, for its answer to be refused', async () => {
		const a = arrange(async () => {
			writeFileSync(join(a.dir, 'src', 'reader.ts'), 'export const read = () => "changed";\n');
			writeFileSync(join(a.dir, 'leaked.txt'), 'outside the copy');
		});

		const out = await runStageHelper(a.run, a.deps);

		expect(out.ran && out.sharedChanged, 'the shared workspace’s changes are not named').toEqual(['leaked.txt', 'src/reader.ts']);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — design D89 (`REG-D-173` (5)): the recorded conversations a helper is given are written into ITS copy before
	// its turn — never into the shared workspace, so no unit's workspace and no review holds them — and go with the copy after (D74).
	it('⛔ RED FIRST — L17b3 (D89): the record’s files are in the copy at the helper’s turn, never in the shared workspace, and go with the copy', async () => {
		const TEXT = 'part 1 of 1\nThe recorded conversation of "Source" (pwu_src), as the Governed Stream recorded it: 1 exchange(s).\n';
		let atTheTurn: { readonly exists: boolean; readonly text?: string } = { exists: false };
		const a = arrange(async (_tools, context) => {
			const file = join(context.workspace.directoryPath!, '.jpwb', 'record', 'source--pwu_src.md');
			atTheTurn = existsSync(file) ? { exists: true, text: readFileSync(file, 'utf8') } : { exists: false };
		});

		const out = await runStageHelper({ ...a.run, recordFiles: [{ path: '.jpwb/record/source--pwu_src.md', text: TEXT }] }, a.deps);

		expect(out.ran, out.ran ? '' : out.why).toBe(true);
		expect(atTheTurn.exists, 'the record’s file was not in the copy at the helper’s turn').toBe(true);
		expect(atTheTurn.text, 'the record’s file does not hold the rendering it was given').toBe(TEXT);
		expect(
			[existsSync(join(a.dir, '.jpwb', 'record')), existsSync(`${a.dir}.hypothesizer-asm_round`)],
			'a record file reached the shared workspace, or the copy holding it was left'
		).toEqual([false, false]);
		expect(out.ran && out.sharedChanged, 'the shared workspace was read as changed').toEqual([]);
	});

	it('⛔ RED FIRST — its exchange is on the EXECUTION plane under its own role, its subject the round’s opening verdict, never the rejected unit', async () => {
		const a = arrange();
		await runStageHelper(a.run, a.deps);

		expect(
			a.exchanges.map((x) => [x.plane, x.invokerId, x.subjectObjectId, x.subjectObjectType]),
			'the helper’s exchange is not its own role’s, over the round'
		).toEqual([['EXECUTION', HELPER_INVOKER.hypothesizer, 'asm_round', 'ASSURANCE_ASSESSMENT']]);
	});

	it('⛔ RED FIRST — the commands it runs in the copy are captured through the evidence join, its scope the helper’s and the round’s, with no floor', async () => {
		const a = arrange(async (tools) => {
			await tools.find((t) => t.name === 'run_command')!.run({ argv: ['node', '--version'] });
		});

		const out = await runStageHelper(a.run, a.deps);

		expect(out.ran && out.capturedArgv, 'the command is not captured').toEqual([['node', '--version']]);
		const proposed = a.steps.filter((s) => s[0] === 'ProposeEvidence');
		expect(
			proposed.map((s) => [s[3].evidenceType, s[3].scope]),
			'the command is not proposed as OBSERVATION evidence in the helper’s scope'
		).toEqual([['OBSERVATION', "commands run by the assurance stage's hypothesizer of round asm_round"]]);
		expect(out.ran && out.evidenceIds, 'the evidence is not returned').toEqual([proposed[0]![2]]);
		expect(a.exchanges.filter((x) => x.plane === 'ASSURANCE'), 'a floor review ran on the helper’s command').toEqual([]);
	});

	it('⛔ RED FIRST — a copy an earlier, killed press left is removed first and named; a session it left is moved aside, never continued', async () => {
		const a = arrange();
		mkdirSync(`${a.dir}.hypothesizer-asm_round`, { recursive: true });
		writeFileSync(join(`${a.dir}.hypothesizer-asm_round`, 'stale.txt'), 'left by a killed press');
		const folder = sessionFolderOf(a.deps.sessionsRoot, 'hypothesizer', 'asm_round');
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, 'left.jsonl'), '{"type":"session"}\n');

		const out = await runStageHelper(a.run, a.deps);

		expect(out.ran && out.limitations, 'the leftovers are not named').toEqual([
			'a copy of the workspace an earlier, unfinished press left (und_1-0123456789abcdef.hypothesizer-asm_round) was removed first, never reused (design D74)',
			'a session an earlier press of this round left (left.jsonl) was moved aside, never continued (design D85)'
		]);
		expect(readdirSync(folder).filter((f) => f.endsWith('.jsonl')), 'the leftover session is still where a session opens').toEqual([]);
		const aside = readdirSync(folder).find((f) => f.startsWith('left-by-an-earlier-press-'));
		expect(aside !== undefined && readFileSync(join(folder, aside, 'left.jsonl'), 'utf8'), 'the leftover session was not kept aside').toBe('{"type":"session"}\n');
		expect(a.opened[0]?.place, 'the helper continued the leftover session').toEqual({ kind: 'DURABLE', folder, opening: { kind: 'NEW' } });
	});

	it('⛔ RED FIRST — the copy is made afresh from the shared workspace: the helper finds the shared files there as they stand, and nothing an earlier press left', async () => {
		let found: (string | undefined)[] = [];
		const a = arrange(async (_tools, context) => {
			found = [await context.workspace.readFile('src/reader.ts'), await context.workspace.readFile('stale.txt')];
		});
		mkdirSync(`${a.dir}.hypothesizer-asm_round`, { recursive: true });
		writeFileSync(join(`${a.dir}.hypothesizer-asm_round`, 'stale.txt'), 'left by a killed press');

		const out = await runStageHelper(a.run, a.deps);

		expect(out.ran, out.ran ? '' : out.why).toBe(true);
		expect(found, 'the helper did not find the shared files as they stand, or found what an earlier press left').toEqual([
			'export const read = () => "";\n',
			undefined
		]);
	});

	it('⛔ RED FIRST — a helper that cannot be opened is not run: said, as a failure, and its copy removed — never a thrown press (the review’s defect 4)', async () => {
		const a = arrange();

		const out = await runStageHelper(a.run, {
			...a.deps,
			openPi: async () => {
				throw new Error('the model faux/model is not one Pi can resolve');
			}
		});

		expect(
			[out.ran, out.ran ? undefined : out.failed, out.ran ? '' : out.why],
			'an opening that threw is not the helper’s failure, said'
		).toEqual([false, true, 'the hypothesizer failed: the model faux/model is not one Pi can resolve']);
		expect(existsSync(`${a.dir}.hypothesizer-asm_round`), 'the copy was left').toBe(false);
	});

	it('⛔ RED FIRST — the copy is removed whatever the session’s close does, and a removal that fails is named in the part’s limitations (the review’s re-check, E)', async () => {
		const a = arrange();
		const open = a.deps.openPi;

		const closing = await runStageHelper(a.run, {
			...a.deps,
			// ⭑ The session answers, then throws as it is closed.
			openPi: async (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace): Promise<ProducerSession> => ({
				...(await open(context, modelId, place)),
				dispose: () => {
					throw new Error('the session could not be closed');
				}
			})
		});

		expect(
			[closing.ran, closing.ran ? undefined : closing.failed, closing.ran ? '' : closing.why],
			'a close that failed is not the helper’s failure, said'
		).toEqual([false, true, 'the hypothesizer failed: the session could not be closed']);
		expect(existsSync(`${a.dir}.hypothesizer-asm_round`), 'the copy was left because its session would not close').toBe(false);

		const b = arrange();
		const kept = await runStageHelper(b.run, {
			...b.deps,
			removeCopy: () => {
				throw new Error('the copy is held open');
			}
		});

		expect(
			[kept.ran, kept.limitations.some((l) => l === 'its copy of the workspace (und_1-0123456789abcdef.hypothesizer-asm_round) could not be removed: the copy is held open')],
			'a removal that failed is not named in the part’s limitations'
		).toEqual([true, true]);
	});

	it('⛔ RED FIRST — a value that cannot be described, thrown by a helper’s turn, its opening, its session’s close or its copy’s removal, is described by the one describer — the turn’s and the removal’s a limitation, the opening’s and the close’s the helper’s failure — never thrown out of the helper, and the copy removed whatever the close does (the lead’s ruling (k) on the review’s fifth re-check)', async () => {
		const UNDESCRIBED = 'a thrown value that cannot be described';
		/** A helper's outcome, or what it threw, as the test can say it: never a throw of the test's own. */
		const settled = (p: Promise<Awaited<ReturnType<typeof runStageHelper>>>) =>
			p.then(
				(o) => o,
				(e: unknown) => {
					let said = '(a value the test cannot describe)';
					try {
						said = e instanceof Error ? e.message : String(e);
					} catch {
						// The test's own describing failed: kept as said.
					}
					return { threw: said };
				}
			);
		const read = (o: Awaited<ReturnType<typeof settled>>) =>
			'threw' in o ? { threw: o.threw } : { ran: o.ran, ...(o.ran ? {} : { failed: o.failed, why: o.why }), limitations: o.limitations };

		// ⭑ Its turn throws `Object.create(null)`, which `String` cannot convert, as a transport that fails throws.
		const a = arrange();
		const openA = a.deps.openPi;
		const turned = await settled(
			runStageHelper(a.run, {
				...a.deps,
				openPi: async (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace): Promise<ProducerSession> => ({
					...(await openA(context, modelId, place)),
					turn: async () => {
						throw Object.create(null);
					}
				})
			})
		);
		// ⭑ Its opening throws one.
		const b = arrange();
		const opened = await settled(
			runStageHelper(b.run, {
				...b.deps,
				openPi: async () => {
					throw Object.create(null);
				}
			})
		);
		// ⭑ Its session answers, then throws one as it is closed.
		const c = arrange();
		const openC = c.deps.openPi;
		const closed = await settled(
			runStageHelper(c.run, {
				...c.deps,
				openPi: async (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace): Promise<ProducerSession> => ({
					...(await openC(context, modelId, place)),
					dispose: () => {
						throw Object.create(null);
					}
				})
			})
		);
		// ⭑ Its copy's removal throws one.
		const d = arrange();
		const removed = await settled(
			runStageHelper(d.run, {
				...d.deps,
				removeCopy: () => {
					throw Object.create(null);
				}
			})
		);

		expect(
			[read(turned), read(opened), read(closed), read(removed)],
			'a value that cannot be described was thrown out of the helper, or said wrongly'
		).toEqual([
			{ ran: true, limitations: [`its call failed: ${UNDESCRIBED}`] },
			{ ran: false, failed: true, why: `the hypothesizer failed: ${UNDESCRIBED}`, limitations: [] },
			{ ran: false, failed: true, why: `the hypothesizer failed: ${UNDESCRIBED}`, limitations: [] },
			{ ran: true, limitations: [`its copy of the workspace (und_1-0123456789abcdef.hypothesizer-asm_round) could not be removed: ${UNDESCRIBED}`] }
		]);
		expect(
			[a, b, c].map((x) => existsSync(`${x.dir}.hypothesizer-asm_round`)),
			'a helper’s copy was left after its turn, its opening or its close threw'
		).toEqual([false, false, false]);
	});

	it('⭑ CONTROL — any selection but Pi’s runs nothing and says why; a shared workspace with no directory runs nothing; no durable store holds the session in memory', async () => {
		const a = arrange();
		for (const executor of [{ kind: 'STAND_IN' } as const, { kind: 'AGY', modelId: 'g' } as const, { kind: 'REPLAY', recordingDir: 'r' } as const]) {
			const out = await runStageHelper({ ...a.run, executor }, a.deps);
			expect([out.ran, a.opened.length], `the ${executor.kind} selection ran the helper`).toEqual([false, 0]);
		}
		const inMemory = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_1', purgeability: 'RETAINED_BY_PARTICIPATION' });
		const noDir = await runStageHelper({ ...a.run, shared: inMemory }, a.deps);
		expect([noDir.ran, a.opened.length], 'a workspace with no directory ran the helper').toEqual([false, 0]);

		await runStageHelper(a.run, { ...a.deps, sessionsRoot: undefined });
		expect(a.opened[0]?.place, 'with no durable store the session was not held in memory').toEqual({ kind: 'IN_MEMORY' });
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 11 (§16; the independent review's question 3, L17C-11) — A HELPER'S DROPPED REPLIES ARE
// RECORDED BESIDE ITS EXCHANGE. The Hypothesizer and the Unsticking Agent run on Pi's adapter, so since D92 a reply Pi dropped leaves their answers
// too; each helper's exchange records them beside it, by the same writer and sentence as an executor try's (`recordDroppedReplies`,
// `droppedRepliesSentence`), under the exchange's own id. A helper's turn with none records byte for byte as today.
describe('⭐⭐ L17b3 (D92; the lead’s ruling 11) — a helper’s dropped replies, recorded beside its exchange', () => {
	const DIAGNOSIS = JSON.stringify({ named: null, hypotheses: [], confidence: 'unsure', guidance: '' });
	const DROPPED: readonly DroppedReply[] = [
		{ text: 'PARTIAL the diagnosis before the break.', stopReason: 'error', errorMessage: '503 Service Unavailable', wentOnBy: 'RETRY', attempt: 1, place: 1 }
	];
	/**
	 * ⭐ The record of a helper turn with no dropped reply — its exchange's payload and aggregate id, as one sha256 — measured at the base's code
	 * (`44b8482e` and the package as staged at `e7af50fb`), before ruling 11's code: a probe of this very case, run alone (`l17b3-facts.md` §19).
	 */
	const HELPER_RECORD_TODAY = '677f2bec079a2beb7718668439957ed5784c6307573a901affa2278ec7e38fac';
	/** One helper run whose turn answers as Pi's adapter does — the diagnosis, and `dropped` beside it where given: what it dispatched, and its store. */
	async function helperAnswering(dropped?: readonly DroppedReply[]) {
		const a = arrange();
		const dispatched: { readonly payload: RecordModelExchangePayload; readonly aggregateId: string }[] = [];
		const open = a.deps.openPi;
		const out = await runStageHelper(a.run, {
			...a.deps,
			dispatchExchange: (payload: RecordModelExchangePayload, aggregateId: string) => {
				dispatched.push({ payload, aggregateId });
				return { status: 'ACCEPTED' };
			},
			openPi: async (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace): Promise<ProducerSession> => {
				const session = await open(context, modelId, place);
				return {
					...session,
					turn: async () => ({
						answer: { arrived: true as const, text: DIAGNOSIS },
						rawOutput: DIAGNOSIS,
						producer: { agentId: 'assurance-stage.hypothesizer', modelId: 'faux/model', providerId: 'pi' },
						identityEvidence: 'PROVIDER_REPORTED' as const,
						observedToolCalls: { canObserve: true as const, mintedToolNames: [], calls: [] },
						...(dropped === undefined ? {} : { droppedReplies: dropped })
					})
				};
			}
		} as never);
		return { out, dispatched, store: a.deps.store };
	}

	it('⛔ RED FIRST — a helper’s turn whose result carries a reply Pi dropped records it beside the helper’s exchange, as an executor try’s is: bound to the exchange’s name, the detail naming where (the lead’s ruling 11)', async () => {
		const { out, dispatched, store } = await helperAnswering(DROPPED);
		expect(out.ran, out.ran ? '' : out.why).toBe(true);
		expect(dispatched.length, 'arrangement: one exchange').toBe(1);
		const { payload, aggregateId } = dispatched[0]!;
		const ref = await store.resolveName(droppedRepliesNameOf('tnt-test', aggregateId));
		const detail = String((payload as { parseOutcome?: { detail?: unknown } }).parseOutcome?.detail ?? '');
		expect(
			[ref !== undefined, ref !== undefined && detail.includes(ref.storageKey), detail.startsWith('read as a diagnosis')],
			'the helper’s dropped reply is not recorded beside its exchange, or the exchange’s detail does not name where'
		).toEqual([true, true, true]);
		const bytes = ref === undefined ? '{}' : ((await store.get(ref.storageKey)) ?? '{}');
		expect(JSON.parse(bytes), 'the record does not hold the dropped reply under its schema').toEqual({ schema: 'jpwb.dropped-replies/1', exchangeId: aggregateId, replies: DROPPED });
	});

	it('⭑ CONTROL — a helper’s turn with no dropped reply records its exchange byte for byte as today, and nothing beside it (the lead’s ruling 11)', async () => {
		const { out, dispatched, store } = await helperAnswering();
		expect([out.ran, dispatched.length], 'arrangement: the helper ran, one exchange').toEqual([true, 1]);
		const digest = createHash('sha256').update(JSON.stringify(dispatched), 'utf8').digest('hex');
		expect(digest, 'the exchange of a helper turn with no dropped reply moved from today’s').toBe(HELPER_RECORD_TODAY);
		expect(await store.resolveName(droppedRepliesNameOf('tnt-test', dispatched[0]!.aggregateId)), 'a record was bound for a turn that dropped nothing').toBeUndefined();
	});
});
