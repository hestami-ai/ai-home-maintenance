// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D74 to D77 with D85 and D87 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.28 to §12.31, §12.39,
// §12.41; `REG-D-166` (3), (4); `REG-D-167` (2), (4); `REG-D-170`) — THE ASSURANCE STAGE AT A REJECTED SIGN-OFF, AND WHAT EACH SUCCESSOR'S FIRST TURN AND
// D71'S RE-RUN IN PLACE CARRY — THROUGH THE PAGE'S OWN ACTIONS.
//
// ⭑ WHAT MUST HOLD (the sponsor's rulings `REG-D-166` (3), (4) and `REG-D-167` (2); the stage's trigger the lead's ruling (B); the parts, the records
// and the turn the lead's, D74 to D77):
//   · on a unit its declared reviews rejected at its sign-off the page offers "Run the assurance stage", once per round, the round named by its
//     opening verdict; one press writes the narrative's chapter first — one call to the selected reviewer's harness, its exchange on the ASSURANCE
//     plane under `pol_historical_consistency` — then runs the Hypothesizer on Pi's harness in a copy of the shared workspace, then, only on an open
//     `KNOWN_FAILURE_RECURRENCE` recorded on the round, the Unsticking Agent; each part recorded, a failing one as failing, and the stage going on;
//     no Decision, no state moved, no unit redefined;
//   · D71's re-run in place after the stage carries, after its findings, the narrative and the request for its tactic record, which is read,
//     recorded and overwritten before the deliverable view is taken, and which no view and no review holds;
//   · the faulty unit's successor — derived from the record as the unit the act was pressed for — carries the narrative, the round's failed
//     criteria and the request; each other successor the narrative and the line naming the replaced unit and the Decision.
// ⭑ THE ARRANGEMENT: package L17a's (`send-back.route.test.ts`), its seams byte for byte but two, named in its assembler: the scripted producer may
// write into the workspace as it is sent a turn (`seam.onTurn`), as a model's `write_file` would; `press` carries the stage's outcome; and a case may
// give the page a sessions root (`seam.sessionsRoot`, as a serving store's), every opener's place kept (`seam.places`) — D85's durable arm through
// the page, the producer still the harness's scripted one, Pi selected by the environment.
// ⭑ THE HELPERS ON PI are pressed directly (`runAssuranceStage`) over the route's own store: the route's executor is the stand-in, and a helper
// runs on Pi alone, in a copy of a FILESYSTEM workspace, its opener a scripted session.
// ⭐ PACKAGE L17b3 (designs D89 to D92) — THREE MORE SEAMS, each named where it is: every producer's context kept (`seam.contexts`), and the tools the
// scripted producer minted said as Pi's adapter says them — the record's tool under its grant with a record to read (`mintedToolNames`); the scripted
// producer answering as Pi's adapter does, with the stops of the messages its answer was gathered from, where a case gives them (`seam.gatheredFrom`),
// or as a result with no such field — the fail-safe's case (the lead's ruling 2 on Stage 1's writing); and a content-store key a case makes unreadable
// (`seam.unreadable`, `getArtifactStore`). A helper's copy is listed at its turn (`onPi`'s `recordFiles`).
// ⛔ HERMETIC: devin's exec seam starts nothing; no process is started; PATH finds no program; the decision model is the product's double.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the seams saw and answer. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	/** Every prompt the floor's validator handed devin, in order. */
	prompts: [] as string[],
	/** What devin answers a prompt (a throw fails the call at its transport): undefined is a clean review over its own rubric. */
	review: undefined as undefined | ((prompt: string) => string | undefined),
	/** Every turn a producer was sent, in order. */
	turns: [] as string[],
	/** One in-memory sandbox per Undertaking, held across requests. */
	workspaces: new Map<string, unknown>(),
	/** How many producer sessions the route opened. */
	opens: 0,
	/** Every declared review the route asked for: its policy, the instruction it was shown, and the work it was shown. */
	declared: [] as { readonly policyId: string; readonly prompt: string; readonly content: string }[],
	/** Set, the workspace refuses a write to a path this answers true for, with this reason (D69's route test's seam). */
	refuseWrite: undefined as undefined | { readonly when: (path: string) => boolean; readonly because: string },
	/** ⭐ L17b1 — what the scripted producer does as it is sent a turn, before it answers: a case's write into the workspace, as a model's would be. */
	onTurn: undefined as undefined | ((text: string) => Promise<void>),
	/** ⭐ L17b1 — the sessions root the page is given (`durableSessionsRoot`), as a serving store's; undefined, none, as test mode has. */
	sessionsRoot: undefined as undefined | string,
	/** ⭐ The lead's ruling (k) on the review's fifth re-check — set, asking for the sessions root throws this very value. */
	sessionsRootThrows: undefined as undefined | { readonly value: unknown },
	/** ⭐ L17b1 — the place each producer the route opened was handed, in order (the opener's second argument, D85). */
	places: [] as unknown[],
	/** ⭐ The review's defect 1 — each input the page handed the step, in order (`runModelInvocationStep`, passed through). */
	stepInputs: [] as unknown[],
	/** ⭐ The review's defect 7 — each tactic take the page asked for (whether the step had ended), and a case's answer in place of the take's own. */
	takes: [] as boolean[],
	takeAnswer: undefined as undefined | ((stepEnded: boolean) => unknown),
	/** ⭐ The review's re-check (D) — set, the page's batch is refused where this names a reason (`dispatchBatch`, passed through otherwise). */
	refuseBatch: undefined as undefined | ((commands: readonly { readonly commandType: string; readonly payload: Record<string, unknown> }[]) => string | undefined),
	/** ⭐ The review's re-check (D) — set, a try's command evidence cannot be recorded, for this reason (`joinProcessEvidence`, passed through otherwise). */
	refuseJoin: undefined as undefined | string,
	/**
	 * ⭐ The review's second re-check (D) — set, the workspace's listing throws, as a file removed between the walk and its stat throws it. ⭐ The lead's
	 * ruling (k) on the fifth — a string throws a new `Error` saying it, as before; `{ value }` throws that very value.
	 */
	listThrows: undefined as undefined | string | { readonly value: unknown },
	/** ⭐ The review's second re-check (D) — set, recording a try's deliverable view throws, as a store that cannot be written does; ⭐ ruling (k) — or the value. */
	viewThrows: undefined as undefined | string | { readonly value: unknown },
	/**
	 * ⭐ The review's second re-check (D) — set, reading the producer's process runs throws: an exception that escapes the try. ⭐ The lead's ruling (c) on
	 * the third — a string throws a new `Error` saying it, as before; `{ value }` throws that very value, so a case can hold what escapes by identity.
	 */
	processRunsThrows: undefined as undefined | string | { readonly value: unknown },
	/** ⭐ The lead's ruling (b) on the review's third re-check — how many times a producer's session was closed; and, set, what its close throws. */
	disposes: 0,
	disposeThrows: undefined as undefined | { readonly error: unknown },
	/** ⭐ The lead's ruling (c) on the review's third re-check — set, the page's batch throws this where `when` answers true, as a store that cannot be written throws. */
	throwBatch: undefined as
		| undefined
		| { readonly when: (commands: readonly { readonly commandType: string }[]) => boolean; readonly error: unknown },
	/** ⭐ L17b3 (D89) — each context a producer the route opened was handed, in order (the opener's first argument): its grant, and the record's port. */
	contexts: [] as unknown[],
	/**
	 * ⭐ L17b3 (D91) — set, the scripted producer answers its session's `n`th turn as Pi's adapter does: a result, these the stops of the messages it
	 * gathered its answer from (`gatheredFrom`), or no such field where this gives none — the fail-safe's case. Unset, a bare string, as before.
	 */
	gatheredFrom: undefined as undefined | ((n: number) => readonly { readonly stopReason: string }[] | undefined),
	/** ⭐ L17b3 (D91) — set, the content store answers nothing for a key this answers true for, as a store that lost its bytes does. */
	unreadable: undefined as undefined | ((storageKey: string) => boolean),
	/** ⭐ L17b3 (the review's L17-10) — set, the content store answers these bytes for a key, in place of its own: bytes present that do not match their hash. */
	tampered: undefined as undefined | ((storageKey: string) => string | undefined),
	/** ⭐ L17b3 (the review's L17-08) — set, the scripted producer's answer is this of the envelope it would give: prose about it, say. */
	answerShape: undefined as undefined | ((envelope: string) => string),
	/** ⭐ L17b3 (the review's L17-05) — set, the commands the scripted producer ran this turn, each with its exit, through the host's real observer. */
	runs: undefined as undefined | (() => readonly { readonly argv: readonly string[]; readonly exitCode: number }[]),
	/** ⭐ L17b3 (the review's L17-05) — set, the scripted producer's work product's document is this of the one it would give. */
	documentOf: undefined as undefined | ((document: string) => string),
	/** ⭐ L17b3 (the review's L17-14) — set, the page's batch is dispatched, and then throws this where `when` answers true: committed, and an exception after. */
	throwAfterCommit: undefined as
		| undefined
		| { readonly when: (commands: readonly { readonly commandType: string }[]) => boolean; readonly error: unknown },
	/** ⭐ L17b3 (the review's L17-14) — what a step did on its way out, in order: each close of a producer, each take at a step's end, each failure asked for. */
	trace: [] as string[],
	/** ⭐ L17b3 (the lead's ruling §10.1 (4)) — set, a try of the unit this answers a reason for is refused before its exchange is captured, for that reason. */
	refuseStepOf: undefined as undefined | ((pwuId: string) => string | undefined),
	/** ⭐ L17b3 (the lead's ruling 5) — set, reading a replaced unit's recorded conversation throws this value, as a store that cannot be read throws. */
	conversationThrows: undefined as undefined | { readonly value: unknown },
	/** ⭐ L17b3 (the lead's §18.2 (1)) — set, reading a unit's governing declared policies throws this value. */
	// ⭐ The lead's ruling 4 of §23 — ~~`{ readonly value: unknown }`~~: and where `onlyWithin` names a function, only a read made within it
	// (`reviewCriteriaOf`, the criteria's reader), so D71's offer, which reads the same policies before it, reads them whole.
	criteriaThrows: undefined as undefined | { readonly value: unknown; readonly onlyWithin?: string },
	/** ⭐ L17b3 (the lead's §18.2 (2)) — set, reading a step's attempt throws this value, as an event log that cannot be read throws. */
	attemptKeyThrows: undefined as undefined | { readonly value: unknown },
	/** ⭐ L17b3 (the lead's §18.2 (3)) — set, resolving a step's context policy throws this value. */
	policyThrows: undefined as undefined | { readonly value: unknown },
	/** ⭐ L17b3 (the lead's ruling 1 of §23) — set, opening the producer throws this value, before anything of its session is made. */
	openThrows: undefined as undefined | { readonly value: unknown },
	/** What the declared reviewer answers a policy's review: set in `beforeEach`, every criterion MET. */
	answer: (() => {
		throw new Error('arrangement: no declared answer set');
	}) as (policyId: string) => unknown
}));

vi.mock('./workspace-host.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./workspace-host.js')>();
	const { createInMemoryWorkspace, createRefusingProcessRunner } = await import('@janumipwb/rph-ports');
	return {
		...actual,
		// ⭐ L17b1 — the sessions root a serving store would give, where a case sets one; else the product's own answer.
		durableSessionsRoot: vi.fn((env: NodeJS.ProcessEnv) => {
			// ⭐ The lead's ruling (k) — a case makes asking for the root throw a value of its choosing.
			if (seam.sessionsRootThrows !== undefined) throw seam.sessionsRootThrows.value;
			return seam.sessionsRoot ?? actual.durableSessionsRoot(env);
		}),
		resolveUndertakingSandbox: vi.fn((undertakingId: string) => {
			if (!seam.workspaces.has(undertakingId)) {
				const workspace = createInMemoryWorkspace({
					ownerKind: 'UNDERTAKING',
					ownerId: undertakingId,
					purgeability: 'RETAINED_BY_PARTICIPATION'
				});
				seam.workspaces.set(undertakingId, {
					workspace: {
						...workspace,
						// ⭑ A WRITE A CASE REFUSES, as the port refuses one: an outcome, never a throw (D69's route test's seam).
						writeFile: async (path: string, contents: string) =>
							seam.refuseWrite?.when(path)
								? { written: false as const, refusedBecause: seam.refuseWrite.because }
								: workspace.writeFile(path, contents),
						// ⭐ The review's second re-check (D) — a listing a case makes throw, as the port's one throwing method does.
						list: async (...args: Parameters<typeof workspace.list>) => {
							if (seam.listThrows !== undefined) throw typeof seam.listThrows === 'string' ? new Error(seam.listThrows) : seam.listThrows.value;
							return workspace.list(...args);
						}
					},
					outputWorkspace: createInMemoryWorkspace({
						ownerKind: 'UNDERTAKING',
						ownerId: undertakingId,
						purgeability: 'PURGEABLE_AT_EXPIRY'
					}),
					runner: createRefusingProcessRunner()
				});
			}
			return seam.workspaces.get(undertakingId);
		})
	};
});

// ⭐ The review's re-check (D) — THE PAGE'S BATCH, refused where a case says so, as the engine refuses one: an outcome, never a throw. Passed through
// otherwise, so every other dispatch is the engine's own.
vi.mock('../workbench.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../workbench.js')>();
	return {
		...actual,
		// ⭐ L17b3 (D91) — THE CONTENT STORE, a key a case makes unreadable answering nothing, as a store that lost its bytes does; every other read the store's own.
		getArtifactStore: vi.fn(() => {
			const store = actual.getArtifactStore();
			// ⭑ A proxy, every other member the store's own, bound to it — so a store whose methods are a class's keeps them.
			return new Proxy(store, {
				get: (target, property) => {
					// ⭐ L17-10 — and a key a case tampers with answering other bytes, as a store whose bytes no longer match their hash does.
					if (property === 'get')
						return async (key: string) => (seam.unreadable?.(key) === true ? undefined : (seam.tampered?.(key) ?? target.get(key)));
					const value: unknown = Reflect.get(target, property, target);
					return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
				}
			});
		}),
		dispatchBatch: vi.fn((commands: Parameters<typeof actual.dispatchBatch>[0]) => {
			// ⭐ The lead's ruling (c) on the review's third re-check — a batch a case makes throw, as a store that cannot be written throws.
			// ⭐ L17b3 (the review's L17-14) — each failure asked for, in the step's trace, before anything answers it.
			if (commands.some((c) => c.commandType === 'FailExecutionStep')) seam.trace.push('fail-request');
			if (seam.throwBatch?.when(commands as never) === true) throw seam.throwBatch.error;
			const why = seam.refuseBatch?.(commands as never);
			if (why !== undefined)
				return { ok: false, results: [{ status: 'REJECTED', error: { message: why } }], failedIndex: 0 } as unknown as ReturnType<typeof actual.dispatchBatch>;
			const committed = actual.dispatchBatch(commands);
			// ⭐ L17b3 (the review's L17-14) — a batch committed, and an exception after it, where a case says so.
			if (seam.throwAfterCommit?.when(commands as never) === true) throw seam.throwAfterCommit.error;
			return committed;
		})
	};
});

// ⭐ The review's re-check (D) — A TRY'S COMMAND EVIDENCE, refused where a case says so, as a store that refused its batch would leave it.
// ⭐ The review's second re-check (D) — A TRY'S DELIVERABLE VIEW, its recording made to throw where a case says so; passed through otherwise.
vi.mock('./deliverable-view.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./deliverable-view.js')>();
	return {
		...actual,
		recordDeliverableView: vi.fn(async (...args: Parameters<typeof actual.recordDeliverableView>) => {
			if (seam.viewThrows !== undefined) throw typeof seam.viewThrows === 'string' ? new Error(seam.viewThrows) : seam.viewThrows.value;
			return actual.recordDeliverableView(...args);
		})
	};
});

vi.mock('./evidence-join.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./evidence-join.js')>();
	return {
		...actual,
		joinProcessEvidence: vi.fn(async (...args: Parameters<typeof actual.joinProcessEvidence>) =>
			seam.refuseJoin === undefined
				? actual.joinProcessEvidence(...args)
				: ({ joined: [], refusedBecause: seam.refuseJoin } as unknown as Awaited<ReturnType<typeof actual.joinProcessEvidence>>)
		)
	};
});

// ⭐ The review's defect 7 — EACH TACTIC TAKE THE PAGE ASKS FOR, kept, then the take itself run — or a case's answer in its place, as a store that refused
// the record would answer: what the page does with a take's outcome is the page's part.
vi.mock('./successor-feedback.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./successor-feedback.js')>();
	return {
		...actual,
		takeTacticRecord: vi.fn(async (deps: Parameters<typeof actual.takeTacticRecord>[0], t: Parameters<typeof actual.takeTacticRecord>[1]) => {
			seam.takes.push(t.stepEnded);
			// ⭐ L17b3 (the review's L17-14) — a take at the step's end, in the step's trace.
			if (t.stepEnded) seam.trace.push('take-at-end');
			const answered = seam.takeAnswer?.(t.stepEnded);
			return answered === undefined ? actual.takeTacticRecord(deps, t) : (answered as Awaited<ReturnType<typeof actual.takeTacticRecord>>);
		})
	};
});

// ⭐ The review's defect 1 — THE STEP'S INPUT, KEPT AS THE PAGE HANDS IT, then the step itself run: what a later try is handed is the page's part.
vi.mock('./run-model-step.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./run-model-step.js')>();
	return {
		...actual,
		runModelInvocationStep: vi.fn(async (input: Parameters<typeof actual.runModelInvocationStep>[0]) => {
			seam.stepInputs.push(input);
			// ⭐ L17b3 (the lead's ruling §10.1 (4)) — a try a case refuses before its exchange is captured, standing in for the step's own refusals
			// before its render (`run-model-step.ts`: the binding's, `stepCapabilityRefusal`; the plan's, `prepareModelInvocation` not ready).
			const refusal = seam.refuseStepOf?.(String((input as { readonly subject?: { readonly id?: unknown } }).subject?.id ?? ''));
			if (refusal !== undefined) return { ran: false as const, refusedBecause: refusal };
			return actual.runModelInvocationStep(input);
		})
	};
});

// ⭐ L17b3 (the lead's ruling 5 and §18.2) — FOUR READS A CASE CAN MAKE THROW, each passed through otherwise: a replaced unit's recorded conversation,
// a unit's governing declared policies, a step's attempt, and a step's context policy.
vi.mock('./earlier-attempt-record.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./earlier-attempt-record.js')>();
	return {
		...actual,
		unitConversationOf: vi.fn(async (...args: Parameters<typeof actual.unitConversationOf>) => {
			if (seam.conversationThrows !== undefined) throw seam.conversationThrows.value;
			return actual.unitConversationOf(...args);
		})
	};
});
vi.mock('../assurance/declared-policy-signoff.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../assurance/declared-policy-signoff.js')>();
	/** ⭐ L17b3 (the lead's ruling 4 of §23) — whether this read is made within the function `name`: its frame on the stack, read whole. */
	const calledWithin = (name: string): boolean => {
		const limit = Error.stackTraceLimit;
		Error.stackTraceLimit = 100;
		try {
			return (new Error('where this read is made').stack ?? '').includes(`at ${name} (`);
		} finally {
			Error.stackTraceLimit = limit;
		}
	};
	return {
		...actual,
		governingDeclaredPolicies: vi.fn((...args: Parameters<typeof actual.governingDeclaredPolicies>) => {
			// ⭐ The lead's ruling 4 of §23 — ~~`if (seam.criteriaThrows !== undefined) throw …`~~: and, where the case says, only within the reader it names.
			if (seam.criteriaThrows !== undefined && (seam.criteriaThrows.onlyWithin === undefined || calledWithin(seam.criteriaThrows.onlyWithin)))
				throw seam.criteriaThrows.value;
			return actual.governingDeclaredPolicies(...args);
		})
	};
});
vi.mock('./stopped-unit-recovery.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./stopped-unit-recovery.js')>();
	return {
		...actual,
		attemptKeyOf: vi.fn((...args: Parameters<typeof actual.attemptKeyOf>) => {
			if (seam.attemptKeyThrows !== undefined) throw seam.attemptKeyThrows.value;
			return actual.attemptKeyOf(...args);
		})
	};
});
vi.mock('./context-policy.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./context-policy.js')>();
	return {
		...actual,
		// ⭐ L17b3 (the lead's ruling 1 of §23) — ~~`vi.fn(…)`~~: a plain function, so the value a case throws reaches the page as thrown. Vitest's spy
		// reads a thrown value (`error instanceof TypeError`), and a revoked `Proxy` throws as it is read, so through the spy the page was handed that
		// TypeError, never the value (§26).
		resolveContextPolicy: (...args: Parameters<typeof actual.resolveContextPolicy>) => {
			if (seam.policyThrows !== undefined) throw seam.policyThrows.value;
			return actual.resolveContextPolicy(...args);
		}
	};
});

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	const { createProcessRunObserver } = await import('../tools/process-run-observer.js');
	return {
		...actual,
		// ⭑ A SCRIPTED PRODUCER OVER THE HOST'S REAL OBSERVER: it writes nothing, and answers the execution contract's envelope, its work
		// product one JSON object naming its SESSION's number and the turn's first line — so a re-run's work is not the first attempt's.
		// ⭐ L17b3 — ~~`async (_context: unknown, place?: unknown)`~~: the context kept (`seam.contexts`), for the tools the producer mints from it.
		getExecutionSession: vi.fn(() => async (context: unknown, place?: unknown) => {
			// ⭐ L17b3 (the lead's ruling 1 of §23) — an opening that throws the case's value, as a refused sandbox throws.
			if (seam.openThrows !== undefined) throw seam.openThrows.value;
			seam.places.push(place);
			seam.contexts.push(context);
			const observer = createProcessRunObserver();
			seam.opens += 1;
			const session = seam.opens;
			// ⭐ L17b3 (D89) — the tools it minted, as Pi's adapter says them: the record's tool where the grant names its capability and the context
			// hands in a record to read (`mintExecutionTools`'s rule); no tool of the workspace's, since this producer writes nothing.
			const opened = (context ?? {}) as { readonly grantedCapabilities?: readonly string[]; readonly earlierAttempt?: unknown };
			const mintedToolNames =
				(opened.grantedCapabilities ?? []).includes('earlier-attempt-record') && opened.earlierAttempt !== undefined ? ['read_earlier_attempt'] : [];
			// ⭐ L17b3 (D91) — its turns counted, so a case can answer each as Pi's adapter does.
			let turnsTaken = 0;
			return {
				mintedToolNames,
				turn: async (text: string) => {
					seam.turns.push(text);
					await seam.onTurn?.(text);
					turnsTaken += 1;
					// ⭐ L17b3 (the review's L17-05) — the commands a case says it ran this turn, each through the host's real observer, as a model's would be.
					for (const run of seam.runs?.() ?? [])
						observer.ran({
							argv: [...run.argv],
							exitCode: run.exitCode,
							timedOut: false,
							durationMs: 7,
							outputComplete: true,
							omittedRegions: [],
							retention: {
								retained: true,
								workspaceOwnerId: 'und_l17b3',
								purgeability: 'PURGEABLE_AT_EXPIRY',
								stdoutPath: 'captures/l17b3/stdout.txt',
								stderrPath: 'captures/l17b3/stderr.txt',
								omittedRegions: [],
								omissionsPath: 'captures/l17b3/omissions.json'
							},
							stdout: '',
							stderr: ''
						});
					const document = `ATTEMPT ${session}: ${text.split('\n')[0]}`;
					const envelope = JSON.stringify({
						// ⭐ L17b3 (the review's L17-05) — ~~`document: \`ATTEMPT ${session}: ${text.split('\n')[0]}\``~~ as the case gives it, else as before.
						workProduct: { document: seam.documentOf?.(document) ?? document },
						rationale: { rationale: 'An account.', assumptions: [], limitations: [], residualUncertainty: [] }
					});
					// ⭐ L17b3 (the review's L17-08) — as the case shapes it, else the envelope alone, as before.
					const answer = seam.answerShape?.(envelope) ?? envelope;
					// ⭐ L17b3 (D91) — where a case sets `seam.gatheredFrom`, the answer as Pi's adapter gives it: a result, with the stops of the messages it
					// was gathered from where the case gives them, and without the field where it gives none. Unset, a bare string, as before.
					if (seam.gatheredFrom === undefined) return answer;
					const gatheredFrom = seam.gatheredFrom(turnsTaken);
					return {
						answer: { arrived: true as const, text: answer },
						rawOutput: answer,
						producer: { agentId: 'execution.model-invocation', modelId: 'faux/model', providerId: 'faux' },
						identityEvidence: 'PROVIDER_REPORTED' as const,
						observedToolCalls: { canObserve: false as const, reason: 'a scripted fixture observes no tool calls' },
						...(gatheredFrom === undefined ? {} : { gatheredFrom })
					};
				},
				lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
				processRuns: () => {
					// ⭐ The review's second re-check (D) — an exception a case makes escape the try; ⭐ the lead's ruling (c) — or the very value a case gives.
					const throws = seam.processRunsThrows;
					if (throws !== undefined) throw typeof throws === 'string' ? new Error(throws) : throws.value;
					return observer.observed();
				},
				// ⭐ The lead's ruling (b) — each close counted, and one a case makes throw, as Pi's `cleanupSessionResources` throws an `AggregateError`.
				dispose: () => {
					seam.disposes += 1;
					// ⭐ L17b3 (the review's L17-14) — each close, in the step's trace.
					seam.trace.push('close');
					if (seam.disposeThrows !== undefined) throw seam.disposeThrows.error;
				},
				retainsHistory: true
			};
		})
	};
});

// ⭑ THE REAL devin ADAPTER FOR THE FLOOR'S REVIEW, ITS PROGRAM REPLACED AT THE SEAM — each prompt answered by the case (`seam.review`), else
// clean over the prompt's own rubric.
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (_file, args) => {
				seam.prompts.push(prompt);
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(exportPath, JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }), 'utf8');
				const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
				return {
					stdout:
						seam.review?.(prompt) ??
						JSON.stringify({
							findings: ids.map((id) => ({ criterionId: id, failed: false, statement: 'met' })),
							recommendation: 'SATISFIED',
							residualUncertainty: []
						})
				};
			})
		)
	};
});

// ⭑ THE DECLARED POLICIES' REVIEWER, STOOD IN FOR AT ITS SEAM: what it was shown is kept, and its answer is the case's (`seam.answer`), so a
// criterion can be recorded with any of the five outcomes — a reviewer's own reply reaches three (MET, NOT_MET, UNABLE_TO_DETERMINE).
vi.mock('../assurance/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../assurance/index.js')>();
	return {
		...actual,
		createDeclaredPolicyReviewer: vi.fn(() => ({
			validatorId: 'fixture.declared-policy',
			review: async (
				_subject: unknown,
				input: { readonly declaredPolicy?: { readonly policyId: string }; readonly prompt?: string; readonly content?: string }
			) => {
				const policyId = input.declaredPolicy?.policyId ?? '';
				seam.declared.push({ policyId, prompt: input.prompt ?? '', content: input.content ?? '' });
				return seam.answer(policyId);
			}
		}))
	};
});

// ⭑ The product's configured decision model, stood in for by a double that calls no model (package N's route test's).
vi.mock('../assurance/decision-model.js', async (importOriginal) => {
	const { TEST_INDICATIONS } = await import('../assurance/indications.testing.js');
	return { ...(await importOriginal<typeof import('../assurance/decision-model.js')>()), configuredIndications: () => TEST_INDICATIONS };
});

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RecordModelExchangePayload } from '@janumipwb/rph-contracts';
import { getObject, listByType, listPwus } from '@janumipwb/rph-engine';
import type { Workspace } from '@janumipwb/rph-ports';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actions as undertakings } from '../../../routes/undertakings/+page.server.js';
import { actions as unitPage, load as unitLoad } from '../../../routes/undertakings/[id]/+page.server.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { dispatch, dispatchBatch, getArtifactStore, getEngine, mintUiId, resetEngine } from '../workbench.js';
import { resolveUndertakingSandbox, sessionFolderOf } from './workspace-host.js';
import { runAssuranceStage } from '../assurance/assurance-stage.js';
import { chapterRecordsOf } from '../assurance/narrative-chapter.js';
import { HELPER_INVOKER, NARRATIVE_WRITER_INVOKER } from '../assurance/assurance-stage-roles.js';
// ⭐ L17b3 (the review's L17-04) — the page's own demo policy, for an assessment of two units a recurrence can be recorded on.
import { DEMO_POLICY_ID, DEMO_POLICY_PAYLOAD, DEMO_POLICY_VERSION } from '../assurance/demo-policy.js';
import { createProcessRunObserver } from '../tools/process-run-observer.js';
import { admittedViewRef, readDeliverableView } from './deliverable-view.js';
// ⭐ L17b3 (D89) — ~~`predecessorWithoutSessionNameOf`~~: the fork's note goes with the fork; its name is restated where the case says nothing is noted.
import { CARRIED_FINDINGS_LINE, FEEDBACK_HEADING } from './executor-session.js';
import { createFilesystemWorkspace } from './filesystem-workspace.js';
import type { ProducerSession, ProducerSessionContext } from './producer-session.js';
import { successorRoundOf, tacticRecordNotice, tacticRecordPath, tacticRecordRequest, takeTacticRecord } from './successor-feedback.js';

const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN'
] as const;

const RISK = {
	'risk.consequence': 'HIGH',
	'risk.uncertainty': 'MEDIUM',
	'risk.irreversibility': 'LOW',
	'risk.securitySensitivity': 'LOW',
	'risk.regulatoryExposure': 'NONE'
};

type ActionEvent = Parameters<typeof undertakings.create>[0];
const event = (path: string, action: string, fields: Readonly<Record<string, string>>, id?: string): ActionEvent => {
	const form = new FormData();
	for (const [k, v] of Object.entries(fields)) form.set(k, v);
	return {
		request: new Request(`http://localhost${path}?/${action}`, { method: 'POST', body: form }),
		params: id === undefined ? {} : { id }
	} as unknown as ActionEvent;
};

/** One type of the fixture PWA: its name, its children by name, what it requires and produces, who discharges it, and its policies. */
interface FixtureType {
	readonly name: string;
	readonly isRoot?: boolean;
	readonly children?: readonly string[];
	readonly inputs?: readonly string[];
	readonly outputs?: readonly string[];
	readonly model?: boolean;
	readonly policies?: readonly string[];
	readonly kind?: string;
}

/**
 * A PWA of `types`, authored and published through the commands, then an Undertaking of it created through the portfolio's own action —
 * package L15's arrangement, each MODEL type's prompt `Write the {subject}.`.
 */
async function instantiated(types: readonly FixtureType[]): Promise<{
	readonly undertakingId: string;
	readonly unitOf: (title: string) => { readonly id: string; readonly state: Record<string, unknown> };
}> {
	const pwaId = mintUiId('pwa');
	const idOf = new Map(types.map((t) => [t.name, mintUiId('pwut')]));
	const r = (commandType: string, aggregateType: string, aggregateId: string, payload: unknown): void => {
		const result = dispatch(commandType, aggregateType, aggregateId, payload);
		expect(result.status, `arrangement: ${commandType} — ${result.error?.message ?? ''}`).toBe('ACCEPTED');
	};
	r('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Criteria and Rework PWA',
		description: 'A PWA whose types declare the policies their sign-off reviews.',
		domain: 'software product',
		version: '0.1.0'
	});
	for (const t of [...types].reverse())
		r('DefinePwuType', 'PWU_TYPE', idOf.get(t.name)!, {
			pwuTypeId: idOf.get(t.name)!,
			pwaId,
			pwuKind: t.kind ?? t.name.toUpperCase().replaceAll(/[^A-Z]/g, '_'),
			name: t.name,
			purpose: `Do the ${t.name}`,
			isRoot: t.isRoot === true,
			permittedChildTypeIds: (t.children ?? []).map((c) => idOf.get(c)!),
			requiredInputs: [...(t.inputs ?? [])],
			requiredOutputs: [...(t.outputs ?? [])],
			requiredAssurancePolicyIds: [...(t.policies ?? [])],
			workDischarge: t.model === true ? 'MODEL' : 'HUMAN',
			...(t.model === true
				? {
						promptTemplate: {
							templateText: 'Write the {subject}.',
							templateVersion: 1,
							declaredPlaceholders: ['subject'],
							status: 'ACTIVE'
						}
					}
				: {})
		});
	r('SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {});
	r('ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {});
	r('PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		rootPwuTypeId: idOf.get(types.find((t) => t.isRoot === true)!.name)!
	});
	const created = (await undertakings.create(
		event('/undertakings', 'create', { name: 'Criteria and Rework', pwaId, ...RISK })
	)) as { created?: string; data?: { error?: string } };
	expect(created.created, `arrangement: the Undertaking — ${created.data?.error ?? ''}`).toBeDefined();
	const undertakingId = created.created!;
	return {
		undertakingId,
		unitOf: (title) => {
			const u = listPwus(getEngine(), undertakingId).find((p) => p.state.title === title);
			if (u === undefined) throw new Error(`arrangement: no unit titled ${title}`);
			return { id: u.id, state: u.state as Record<string, unknown> };
		}
	};
}

/** ⭐ L17b1 — one part of a press of the assurance stage, as the page returns it. */
interface StagePartSeen {
	readonly part: string;
	readonly status: string;
	readonly artifactId?: string;
	readonly why?: string;
}

/** A page action on the fixture's Undertaking, as the page posts it. ⚠ An action the page does not have answers as an error, never a throw. */
async function press(
	u: Fixture,
	action: Action,
	fields: Readonly<Record<string, string>>
): Promise<{
	readonly advanced?: string;
	readonly error?: string;
	readonly supersededWorkNotNoticed?: string;
	readonly stage?: readonly StagePartSeen[];
	readonly tacticRecordNote?: string;
	readonly sessionCloseNote?: string;
}> {
	const act = (unitPage as Record<string, ((e: never) => Promise<unknown>) | undefined>)[action];
	if (act === undefined) return { error: `the page has no action ${action}` };
	const r = (await act(event(`/undertakings/${u.undertakingId}`, action, fields, u.undertakingId) as never)) as
		| {
				advanced?: string;
				supersededWorkNotNoticed?: string;
				stage?: readonly StagePartSeen[];
				tacticRecordNote?: string;
				sessionCloseNote?: string;
				data?: { error?: string; tacticRecordNote?: string; sessionCloseNote?: string };
		  }
		| undefined;
	// ⭐ The review's defect 7 — the tactic record's note, on an outcome or beside a refusal.
	const note = r?.tacticRecordNote ?? r?.data?.tacticRecordNote;
	// ⭐ The lead's ruling (b) on the review's third re-check — why the producer's session could not be closed, on an outcome or beside a refusal.
	const closeNote = r?.sessionCloseNote ?? r?.data?.sessionCloseNote;
	return {
		...(r?.advanced === undefined ? {} : { advanced: r.advanced }),
		...(r?.stage === undefined ? {} : { stage: r.stage }),
		...(r?.supersededWorkNotNoticed === undefined ? {} : { supersededWorkNotNoticed: r.supersededWorkNotNoticed }),
		...(r?.data?.error === undefined ? {} : { error: r.data.error }),
		...(note === undefined ? {} : { tacticRecordNote: note }),
		...(closeNote === undefined ? {} : { sessionCloseNote: closeNote })
	};
}

/** The stored policy's name and criteria, as the sign-off's reader reads them. */
const policyOf = (id: string) =>
	getObject(getEngine(), id) as unknown as { name: string; criteria: { id: string; name: string; description: string }[] };

/** A declared review's answer: each of the policy's criteria with `outcomes[i]` (MET where none is said; `null` gives no answer). */
function answerOf(
	policyId: string,
	outcomes: Readonly<Record<number, readonly [string, string | undefined] | null>> = {},
	blocking?: string
): unknown {
	const criteria = policyOf(policyId).criteria.flatMap((c, i) => {
		const o = outcomes[i];
		if (o === null) return [];
		const [outcome, rationale] = o ?? ['MET', 'met'];
		return [{ criterionId: c.id, outcome, mandatory: false, ...(rationale === undefined ? {} : { rationale }) }];
	});
	return {
		policyId,
		validatorId: 'fixture.declared-policy',
		evaluator: { actorType: 'AGENT', agentId: 'fixture-declared-reviewer', modelId: 'fixture-declared-model', providerId: 'fixture-provider' },
		criteria,
		observations: blocking === undefined ? [] : [{ code: blocking, severity: 'BLOCKING', statement: `${blocking} blocks.`, open: true }],
		recommendation: blocking === undefined ? 'SATISFIED' : 'REJECTED',
		residualUncertainty: [],
		limitations: []
	};
}

/** The Undertaking's workspace, as the route resolves it. */
const workspaceOf = (u: Fixture): Workspace => (resolveUndertakingSandbox(u.undertakingId) as unknown as { workspace: Workspace }).workspace;
const axesOf = (pwuId: string) => {
	const s = getObject(getEngine(), pwuId) ?? {};
	return [s.workLifecycleState, s.executionState, s.assuranceState];
};
/** The latest declared verdict of each policy over the unit, by policy: its assessment id and state. */
const verdictsOf = (pwuId: string, policyIds: readonly string[]) =>
	policyIds.map((policyId) => {
		const mine = listByType(getEngine(), 'ASSURANCE_ASSESSMENT').filter(
			(a) => a.state.assurancePolicyId === policyId && ((a.state.subjectObjectIds as string[] | undefined) ?? []).includes(pwuId)
		);
		const last = mine.at(-1);
		return { policyId, assessmentId: last?.id ?? '', state: String(last?.state.assessmentState ?? '') };
	});

/** Begin & Execute, Record Assurance (every criterion MET), then Mark Satisfied on `title`: the unit SATISFIED. */
async function accept(u: Fixture, title: string): Promise<void> {
	const pwuId = u.unitOf(title).id;
	for (const action of ['beginExecute', 'recordAssurance', 'markSatisfied'] as const)
		expect((await press(u, action, { pwuId })).error, `arrangement: ${action} on ${title}`).toBeUndefined();
	expect(getObject(getEngine(), pwuId)?.workLifecycleState, `arrangement: ${title} accepted`).toBe('SATISFIED');
}

/** Two declared policies the reference seed holds, each governing REQUIREMENT_DEFINITION — the two that reject Verification. */
const COVERAGE = 'pol_requirement_coverage';
const INTENT = 'pol_intent_preservation';
/** The person's words for the act. */
const TYPED = 'The verification found the fault in Source’s reader; send the work back to Source.';

/**
 * The ninth run's shape, smaller: a root (an operator's) over the Specification; Build, a model's composite over Source, Tests — which needs
 * Source's work — and Lint, which needs only the Specification's; Verification, which needs Build's work and declares the two policies that
 * reject it; and Docs, which needs only the Specification's: a branch the fault did not reach. `specPolicies` and `buildPolicies` give the
 * Specification and Build declared reviews of their own, where a case needs them.
 */
const TYPES = (specPolicies: readonly string[] = [], buildPolicies: readonly string[] = []): readonly FixtureType[] => [
	{ name: 'Product', isRoot: true, children: ['Specification', 'Build', 'Verification', 'Docs'], inputs: ['originating-intent'] },
	{
		name: 'Specification',
		inputs: ['originating-intent'],
		outputs: ['specification'],
		model: true,
		...(specPolicies.length === 0 ? {} : { policies: specPolicies, kind: 'REQUIREMENT_DEFINITION' })
	},
	{
		name: 'Build',
		children: ['Source', 'Tests', 'Lint'],
		outputs: ['build'],
		model: true,
		...(buildPolicies.length === 0 ? {} : { policies: buildPolicies, kind: 'REQUIREMENT_DEFINITION' })
	},
	{ name: 'Source', inputs: ['specification'], outputs: ['source'], model: true },
	{ name: 'Tests', inputs: ['source'], outputs: ['tests'], model: true },
	{ name: 'Lint', inputs: ['specification'], outputs: ['lint'], model: true },
	{ name: 'Verification', inputs: ['build'], outputs: ['verdict'], model: true, policies: [COVERAGE, INTENT], kind: 'REQUIREMENT_DEFINITION' },
	{ name: 'Docs', inputs: ['specification'], outputs: ['docs'], model: true }
];

type Fixture = Awaited<ReturnType<typeof instantiated>>;
// ⭐ L17b3 (the review's L17-06, L17-09) — and RD8's re-run of a stopped unit (`rerunWork`), the binding's third minting site.
type Action = 'beginExecute' | 'recordAssurance' | 'markSatisfied' | 'rerunRejectedWork' | 'sendWorkBack' | 'runAssuranceStage' | 'rerunWork';

/** The unit titled `title` that is CURRENT — after a replacement, one title names an old unit and its successor. */
const currentOf = (u: Fixture, title: string) => {
	const found = listPwus(getEngine(), u.undertakingId).filter((p) => p.state.title === title && p.state.workLifecycleState !== 'SUPERSEDED');
	expect(found.length, `arrangement: one current unit titled ${title}`).toBe(1);
	return { id: found[0]!.id, state: found[0]!.state as Record<string, unknown> };
};
/** Each unit of `titles` accepted, in order (`accept`). */
async function acceptAll(u: Fixture, titles: readonly string[]): Promise<void> {
	for (const title of titles) await accept(u, title);
}

/**
 * Every unit but the root accepted — the Specification, Source, Tests, Lint, Build and Docs — then Verification run and REJECTED at its
 * sign-off by both its declared reviews, each its first criterion NOT_MET and a BLOCKING finding open. Returns the units and the verdicts.
 */
async function verificationRejected(types: readonly FixtureType[] = TYPES()) {
	const u = await instantiated(types);
	await acceptAll(u, ['Specification', 'Source', 'Tests', 'Lint', 'Build', 'Docs']);
	const verification = u.unitOf('Verification');
	expect((await press(u, 'beginExecute', { pwuId: verification.id })).error, 'arrangement: Verification ran').toBeUndefined();
	const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
	const intent = policyOf(INTENT).criteria.map((c) => c.id);
	seam.answer = (policyId) =>
		policyId === COVERAGE
			? answerOf(COVERAGE, { 0: ['NOT_MET', 'The standard-input mode exits 1: the reader Source wrote cannot read a pipe.'] }, cov[0])
			: answerOf(INTENT, { 0: ['NOT_MET', 'A documented usage does not work.'] }, intent[0]);
	const signed = await press(u, 'recordAssurance', { pwuId: verification.id });
	expect(signed.error ?? '', 'arrangement: the declared reviews rejected Verification').toContain(
		"Assurance recorded, and the declared review did not conclude in this PWU's favour"
	);
	expect(axesOf(verification.id), 'arrangement: Verification rejected at its sign-off').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
	seam.answer = (policyId) => answerOf(policyId);
	const unit = (title: string) => u.unitOf(title).id;
	return {
		u,
		ids: {
			product: unit('Product'),
			spec: unit('Specification'),
			build: unit('Build'),
			source: unit('Source'),
			tests: unit('Tests'),
			lint: unit('Lint'),
			verification: verification.id,
			docs: unit('Docs')
		},
		verdicts: verdictsOf(verification.id, [COVERAGE, INTENT])
	};
}

/** The act, as the page posts it: the work of Verification sent back to Source, the person's words typed. */
const sendBackToSource = (r: Awaited<ReturnType<typeof verificationRejected>>) =>
	press(r.u, 'sendWorkBack', { pwuId: r.ids.verification, targetId: r.ids.source, rationale: TYPED });

// ── ⭐⭐ L17b1 — this file's cases, over package L17a's harness above ────────────────────────────────────────────────────────────────────────────

/** What the Undertaking page offers each unit for the assurance stage (`assuranceStageByPwu`), read as the page loads. */
const stageOffers = (u: Fixture): Record<string, unknown> | undefined =>
	(unitLoad({ params: { id: u.undertakingId } } as never) as { assuranceStageByPwu?: Record<string, unknown> }).assuranceStageByPwu;
/** The writer's prompt's opening (`narrativeChapterPrompt`), restated. */
const WRITER_PROMPT = 'You are writing chapter';
/** The records a writer's prompt gives, by their ids (`- [<id>] <text>`). */
const recordIdsOf = (prompt: string): string[] => [...prompt.matchAll(/^- \[([^\]]+)\] /gm)].map((m) => m[1]!);
/** The narrative writer, answering the chapter's form: one statement per record it was given, citing it; every other prompt as the floor's seam does. */
const chapterAnswering = (prompt: string): string | undefined => {
	if (!prompt.includes(WRITER_PROMPT)) return undefined;
	const ids = recordIdsOf(prompt);
	return JSON.stringify({
		chapter: 1,
		covers: ids,
		statements: ids.map((id) => ({ text: `The record ${id} stands as it was given.`, cites: [id] })),
		openItems: [],
		knownOmissions: [],
		previousChapter: null
	});
};
/** The tactic record a model writes when its turn asks for one (D77's fields). */
const RECORD = JSON.stringify({
	priorTactic: 'read the whole input as a file',
	whatItProduced: 'a reader that cannot read a pipe',
	whyChange: 'the verification ran the tool on a pipe',
	newTactic: 'read standard input as a stream, in chunks',
	expectedImprovement: 'the standard-input mode exits 0'
});
/** The path a turn asks its tactic record at (`tacticRecordRequest`'s words), or undefined. */
const askedTacticPath = (text: string): string | undefined => /write ONE JSON object to (\S+) with these fields/.exec(text)?.[1];
/** The scripted producer's write, as a model's would be: where its turn asks for a tactic record, the record, into the Undertaking's workspace. */
const writesItsTacticRecord = (u: Fixture) => async (text: string) => {
	const path = askedTacticPath(text);
	if (path !== undefined) await workspaceOf(u).writeFile(path, RECORD);
};
/**
 * ⭐ The lead's ruling (a) on the review's third re-check — the state of the step of the unit's latest plan, and each failure recorded on that plan, as
 * package N's check reads them (`package-n.route.test.ts`).
 */
const latestStepOf = (pwuId: string): { readonly stepState: unknown; readonly failed: readonly unknown[] } => {
	const plan = listByType(getEngine(), 'EXECUTION_PLAN')
		.filter((p) => p.state.workUnitId === pwuId)
		.at(-1);
	const step = ((plan?.state.steps ?? []) as { stepState?: unknown }[])[0];
	const failed = getEngine()
		.readAllEvents()
		.filter((e) => e.eventType === 'ExecutionStepFailed' && e.aggregateId === plan?.id)
		.map((e) => (e.payload as { failureReason?: unknown }).failureReason);
	return { stepState: step?.stepState, failed };
};
/** ⭐ The lead's ruling (k) — what the test can say of a value that escaped, where the code under test could not: never a throw of the test's own. */
const saidOf = (e: unknown): string => {
	try {
		return e instanceof Error ? e.message : String(e);
	} catch {
		return '(a value the test cannot describe)';
	}
};
/**
 * ⭐ L17b3 (the review's L17-18) — the declared reviews shown, as one sha256: each test-mode id (`mintUiId`'s `<prefix>_<26 characters>`) renamed
 * `<prefix>_#<n>` in the order it first appears, every other byte as shown.
 */
const declaredReviewsDigest = (shown: readonly { readonly policyId: string; readonly prompt: string; readonly content: string }[]): string => {
	const names = new Map<string, string>();
	const normalized = JSON.stringify(shown).replaceAll(/\b([a-z]+)_0{6}[0-9A-Z]{20}\b/g, (id: string, prefix: string) => {
		if (!names.has(id)) names.set(id, `${prefix}_#${names.size + 1}`);
		return names.get(id)!;
	});
	return createHash('sha256').update(normalized, 'utf8').digest('hex');
};
/**
 * ⭐ L17b3 (the review's L17-18) — that digest for the CONTROL's fixture, measured at the base, `44b8482e`, before any of the package's code: the
 * CONTROL run alone, twice, each giving this (`l17b3-facts.md` §8.4).
 */
const DECLARED_REVIEWS_TODAY = 'b649d695b6d38440dc7949df41e90b133f74886551bd85610b5b2b85a6053e01';
/** The stage's records of a part, as their SOURCE evidence names them. */
const stageEvidenceOf = (part: string) =>
	listByType(getEngine(), 'EVIDENCE').filter(
		(e) => ((e.state.contentReference as { stage?: { part?: string } } | undefined)?.stage?.part ?? '') === part
	);
/** The page's batch, as a direct call of the stage is handed it: one atomic dispatch, its refusal said. */
const runStepsHere = (steps: readonly (readonly [string, string, string, Record<string, unknown>])[]): string | null => {
	const batch = dispatchBatch(steps.map(([commandType, targetAggregateType, targetAggregateId, payload]) => ({ commandType, targetAggregateType, targetAggregateId, payload })));
	return batch.ok ? null : String(batch.results[batch.failedIndex ?? 0]?.error?.message ?? 'REJECTED');
};
const TMP = mkdtempSync(join(tmpdir(), 'jpwb-assurance-stage-route-'));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
let tmpCase = 0;
/**
 * A direct press of the stage on Pi's selection, over the route's store: the shared workspace a FILESYSTEM one in a temporary folder (the route's
 * own is in memory, and a helper needs a directory to copy), and Pi's opener a scripted session answering each helper's prompt. ⛔ No model.
 */
function onPi(answers: { readonly diagnosis: string; readonly stepBack: string }) {
	const dir = join(TMP, `case-${++tmpCase}`, 'demo.sqlite.workspaces', 'und-0123456789abcdef');
	mkdirSync(join(dir, 'src'), { recursive: true });
	writeFileSync(join(dir, 'src', 'reader.ts'), 'export const read = () => "";\n');
	const shared = createFilesystemWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und', purgeability: 'RETAINED_BY_PARTICIPATION', directoryPath: dir });
	/** ⭐ L17b3 (D89) — and, at each helper's turn, the record's files its copy holds (`.jpwb/record/`). */
	// ⭐ L17-04 — and what each of those files holds (`recordTexts`, by its name), so a file under its expected name but of the wrong unit is seen.
	const asked: {
		readonly dir: string | undefined;
		readonly prompt: string;
		readonly recordFiles: readonly string[];
		readonly recordTexts: Readonly<Record<string, string>>;
	}[] = [];
	const deps = {
		engine: getEngine(),
		store: getArtifactStore(),
		tenantPrefix: 'tnt-local',
		newId: mintUiId,
		now: () => '2026-11-16T12:00:00.000Z',
		runSteps: runStepsHere,
		dispatchExchange: (payload: RecordModelExchangePayload, aggregateId: string) => dispatch('RecordModelExchange', 'MODEL_EXCHANGE', aggregateId, payload),
		testMode: true,
		executor: { kind: 'PI', modelId: 'faux/model' } as const,
		sandboxOf: () => ({ workspace: shared }) as never,
		sessionsRoot: join(TMP, `case-${tmpCase}`, 'demo.sqlite.sessions'),
		openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => ({
			retainsHistory: true,
			mintedToolNames: [], // ⭐ L17b3 (D89) — arrangement: the session says the tools it minted (none), as every `ProducerSession` now does.
			turn: async (prompt: string) => {
				const records = join(context.workspace.directoryPath ?? '', '.jpwb', 'record');
				const recordFiles = existsSync(records) ? readdirSync(records).sort() : [];
				asked.push({
					dir: context.workspace.directoryPath,
					prompt,
					recordFiles,
					recordTexts: Object.fromEntries(recordFiles.map((f) => [f, readFileSync(join(records, f), 'utf8')]))
				});
				return prompt.includes('You are the Hypothesizer') ? answers.diagnosis : answers.stepBack;
			},
			lastTurnObservation: () => ({ canObserve: false, reason: 'a scripted fixture observes no tool calls' }),
			processRuns: () => createProcessRunObserver().observed(),
			dispose: () => undefined
		})
	};
	return { dir, asked, deps };
}
const DIAGNOSIS = JSON.stringify({
	hypotheses: [
		{
			candidate: 'SOURCE',
			statement: 'Source’s reader treats a pipe as a file.',
			evidence: ['src/reader.ts'],
			checks: [{ command: ['node', 'bin/wf.js', '-'], why: 'reads a pipe', ifHeld: 'exit 1', showed: 'exit 1' }]
		}
	],
	named: 'SOURCE',
	confidence: 'fairly sure',
	guidance: 'Build the reader in parts and check each against a pipe before the whole.'
});
const STEP_BACK = JSON.stringify({
	questions: [{ reconsider: 'the reader', question: 'What does the reader assume about its input that a pipe does not give?' }],
	facts: [{ fact: 'The reader calls fstat before it reads.', source: 'src/reader.ts' }]
});

describe('⭐⭐ L17b1 (D74 to D76; the lead’s ruling (B)) — the page offers the assurance stage on a rejected sign-off, once per round', () => {
	it('⛔ RED FIRST — on the unit its declared reviews rejected, its round named by its opening verdict; nowhere else; and not again once the round’s stage has run', async () => {
		const r = await verificationRejected();
		const roundId = r.verdicts[0]!.assessmentId;

		expect(stageOffers(r.u), 'the stage is not offered on the rejected unit alone, naming its round').toEqual({ [r.ids.verification]: { roundId } });
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page renders no form for the stage').toContain('action="?/runAssuranceStage"');
		expect(page, 'the page renders no button for the stage').toContain('data-testid="run-assurance-stage"');

		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).advanced, 'arrangement: the stage ran').toBe('assurance-stage');

		expect(stageOffers(r.u)?.[r.ids.verification], 'the stage is offered again for a round whose stage ran').toBeUndefined();
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error ?? '', 'a second press of one round was not refused').toContain(
			`the assurance stage has run for this round (${roundId})`
		);
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.docs })).error ?? '', 'the stage ran on a unit never rejected').toContain(
			'the assurance stage runs on a unit its declared reviews rejected at its sign-off'
		);
	});

	it('⛔ RED FIRST — not offered once the unit is re-run in place: its state is no longer the rejected one, though its last verdict still is', async () => {
		const r = await verificationRejected();
		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the findings.' })).error, 'arrangement: the re-run').toBeUndefined();
		expect(axesOf(r.ids.verification), 'arrangement: the re-run left the rejected state').not.toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);

		expect(stageOffers(r.u)?.[r.ids.verification], 'the stage is offered on a unit re-run in place, before its new sign-off').toBeUndefined();
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error ?? '', 'the stage ran on a unit re-run in place').toContain(
			'the assurance stage runs on a unit its declared reviews rejected at its sign-off'
		);
	});
});

describe('⭐⭐ L17b1 (D76, D74, D75) — one press: the chapter first, then the Hypothesizer, then the Unsticking Agent on an open recurrence', () => {
	it('⛔ RED FIRST — the chapter, written once by the selected reviewer’s harness from the records each with its id, its exchange on the ASSURANCE plane under pol_historical_consistency over the round; the Hypothesizer not run where the executor is not Pi, said; no recurrence, no Unsticking Agent; no Decision, no state moved, no unit redefined', async () => {
		const r = await verificationRejected();
		const roundId = r.verdicts[0]!.assessmentId;
		seam.review = chapterAnswering;
		const prompts = seam.prompts.length;
		const decisions = listByType(getEngine(), 'DECISION').length;
		const definitions = JSON.stringify([getObject(getEngine(), r.ids.verification), getObject(getEngine(), String(getObject(getEngine(), r.ids.verification)?.pwuTypeId ?? ''))]);

		const pressed = await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification });

		expect([pressed.advanced, pressed.error], 'the stage did not run').toEqual(['assurance-stage', undefined]);
		expect(pressed.stage?.map((p) => [p.part, p.status]), 'the parts are not the chapter, then the Hypothesizer, then the Unsticking Agent').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'not-run'],
			['step-back', 'not-run']
		]);
		expect(pressed.stage?.[1]?.why ?? '', 'the Hypothesizer’s not running is not said').toContain("the hypothesizer runs on Pi's harness alone");
		expect(pressed.stage?.[2]?.why, 'the Unsticking Agent’s not running is not said').toBe('the round has no open KNOWN_FAILURE_RECURRENCE observation (design D75)');

		const written = seam.prompts.slice(prompts).filter((p) => p.includes(WRITER_PROMPT));
		expect(written.length, 'the writer was not called once').toBe(1);
		expect(recordIdsOf(written[0]!), 'the writer was not given the round’s verdicts and the units, each with its id').toEqual(
			expect.arrayContaining([roundId, r.verdicts[1]!.assessmentId, r.ids.verification, r.ids.source])
		);
		const writer = listByType(getEngine(), 'MODEL_EXCHANGE').filter((x) => x.state.invokerId === NARRATIVE_WRITER_INVOKER);
		expect(
			writer.map((x) => [x.state.plane, x.state.assurancePolicyId, x.state.subjectObjectId, x.state.subjectObjectType]),
			'the writer’s exchange is not its role’s on the ASSURANCE plane, over the round'
		).toEqual([['ASSURANCE', 'pol_historical_consistency', roundId, 'ASSURANCE_ASSESSMENT']]);
		const chapter = stageEvidenceOf('narrative-chapter');
		expect(
			chapter.map((e) => (e.state.contentReference as { stage: Record<string, unknown> }).stage),
			'the chapter is not recorded for the round'
		).toEqual([{ part: 'narrative-chapter', round: roundId, undertakingId: r.u.undertakingId, unitId: r.ids.verification, status: 'recorded' }]);
		const artifact = getObject(getEngine(), String((chapter[0]!.state.contentReference as { artifactId: string }).artifactId)) ?? {};
		expect(artifact.artifactType, 'the chapter is not an artifact of its own').toBe('narrative-chapter');
		expect(await getArtifactStore().get(String(artifact.storageKey)), 'the chapter’s bytes are not the writer’s answer').toBe(chapterAnswering(written[0]!));
		expect(listByType(getEngine(), 'DECISION').length, 'the stage recorded a Decision').toBe(decisions);
		expect(axesOf(r.ids.verification), 'the stage moved the unit').toEqual(['UNDER_ASSURANCE', 'SUCCEEDED', 'REJECTED']);
		expect(
			JSON.stringify([getObject(getEngine(), r.ids.verification), getObject(getEngine(), String(getObject(getEngine(), r.ids.verification)?.pwuTypeId ?? ''))]),
			'the stage changed the unit’s definition, its outputs or its criteria'
		).toBe(definitions);
	});

	it('⛔ RED FIRST — a chapter that fails its check is recorded as failing, its limb named, with no second call; and the stage goes on', async () => {
		const r = await verificationRejected();
		seam.review = (prompt) =>
			prompt.includes(WRITER_PROMPT) ? JSON.stringify({ chapter: 1, statements: [{ text: 'The harness is at fault.', cites: ['art_invented'] }] }) : undefined;
		const prompts = seam.prompts.length;

		const pressed = await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification });

		expect(pressed.stage?.map((p) => [p.part, p.status]), 'the failing chapter is not recorded as failing, the stage going on').toEqual([
			['narrative-chapter', 'failing'],
			['fault-diagnosis', 'not-run'],
			['step-back', 'not-run']
		]);
		expect(pressed.stage?.[0]?.why, 'the failed limb is not named').toBe('statement 1 cites art_invented, which is not among the records it was given');
		expect(seam.prompts.slice(prompts).filter((p) => p.includes(WRITER_PROMPT)).length, 'a repair call was made').toBe(1);
	});

	it('⛔ RED FIRST — on Pi: the Hypothesizer, in a copy, is shown the candidates, the failed criteria and the chapter; its diagnosis recorded with its guidance, a claimed check it did not run named; with no recurrence the Unsticking Agent runs not', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });

		const done = await runAssuranceStage(r.ids.verification, pi.deps);

		expect('parts' in done && done.parts.map((p) => [p.part, p.status]), 'the Hypothesizer’s diagnosis is not recorded').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'recorded'],
			['step-back', 'not-run']
		]);
		expect(pi.asked.length, 'the Unsticking Agent ran with no recurrence').toBe(1);
		expect(pi.asked[0]?.dir, 'the Hypothesizer did not run in the copy').toBe(`${pi.dir}.hypothesizer-${r.verdicts[0]!.assessmentId}`);
		for (const part of [
			`- ${r.ids.source} "Source"`,
			'The standard-input mode exits 1: the reader Source wrote cannot read a pipe.',
			'The narrative memory of the Undertaking so far, this round’s chapter included:'
		])
			expect(pi.asked[0]?.prompt, `the Hypothesizer was not shown: ${part}`).toContain(part);
		const diagnosis = stageEvidenceOf('fault-diagnosis');
		expect(diagnosis.map((e) => e.state.limitations), 'a claimed check the host did not capture is not named').toEqual([
			['its check ["node","bin/wf.js","-"] is not among the commands the host captured it running (design D74)']
		]);
		const artifact = getObject(getEngine(), String((diagnosis[0]!.state.contentReference as { artifactId: string }).artifactId)) ?? {};
		expect(JSON.parse((await getArtifactStore().get(String(artifact.storageKey))) ?? '{}').guidance, 'the guidance is not recorded').toBe(
			'Build the reader in parts and check each against a pipe before the whole.'
		);
		const helper = listByType(getEngine(), 'MODEL_EXCHANGE').filter((x) => x.state.invokerId === HELPER_INVOKER.hypothesizer);
		expect(helper.map((x) => [x.state.plane, x.state.subjectObjectId]), 'the Hypothesizer’s exchange is not its role’s, over the round').toEqual([
			['EXECUTION', r.verdicts[0]!.assessmentId]
		]);
	});

	it('⛔ RED FIRST — a named unit outside the candidates refuses the diagnosis, recorded as refused', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.docs), stepBack: STEP_BACK });

		const done = await runAssuranceStage(r.ids.verification, pi.deps);

		expect('parts' in done && done.parts[1]?.status, 'a diagnosis naming a unit outside the candidates was not refused').toBe('refused');
		expect(stageEvidenceOf('fault-diagnosis')[0]?.state.limitations, 'the refusal is not named').toEqual(
			expect.arrayContaining([`its diagnosis is refused: it names ${r.ids.docs}, which is not among the candidates (design D74)`])
		);
	});

	it('⛔ RED FIRST — with an open KNOWN_FAILURE_RECURRENCE recorded on the round, the Unsticking Agent runs after the Hypothesizer, shown the recurrence, and its step-back is recorded', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const observationId = mintUiId('obs');
		const recorded = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', observationId, {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recorded.status, `arrangement: the recurrence — ${recorded.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });

		const done = await runAssuranceStage(r.ids.verification, pi.deps);

		expect('parts' in done && done.parts.map((p) => [p.part, p.status]), 'the step-back is not recorded after the diagnosis').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'recorded'],
			['step-back', 'recorded']
		]);
		expect(
			pi.asked.map((a) => ['You are the Hypothesizer', 'You are the Unsticking Agent'].find((opening) => a.prompt.startsWith(opening))),
			'the helpers did not run in their order'
		).toEqual(['You are the Hypothesizer', 'You are the Unsticking Agent']);
		expect(pi.asked[1]?.prompt, 'the Unsticking Agent was not shown the recurrence').toContain(
			`- [${observationId}] The standard-input mode fails again, as it did in the round before.`
		);
		expect(pi.asked[1]?.dir, 'the Unsticking Agent did not run in its own copy').toBe(`${pi.dir}.unsticking-${r.verdicts[0]!.assessmentId}`);
		expect(stageEvidenceOf('step-back').length, 'the step-back is not recorded').toBe(1);
	});

	it('⛔ RED FIRST — on Pi, the stage’s records reach the faulty unit’s successor: the diagnosis, the unit it names and beside it its guidance, as advice, and the step-back with its facts; and the Hypothesizer was shown the round’s chapter', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const roundId = r.verdicts[0]!.assessmentId;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: roundId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		const done = await runAssuranceStage(r.ids.verification, pi.deps);
		expect('parts' in done && done.parts.map((p) => p.status), 'arrangement: the stage recorded its three parts').toEqual(['recorded', 'recorded', 'recorded']);
		expect(pi.asked[0]?.prompt, 'the Hypothesizer was not shown the round’s chapter').toContain(`- The record ${roundId} stands as it was given. [${roundId}]`);
		const [diagnosisId, stepBackId] = ['fault-diagnosis', 'step-back'].map((part) =>
			String((stageEvidenceOf(part)[0]!.state.contentReference as { artifactId: string }).artifactId)
		);
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id })).error, 'the new Source did not run').toBeUndefined();

		const turn = seam.turns[turns] ?? '';
		for (const part of [
			`The diagnosis (${diagnosisId}) — advice, not a verdict:`,
			`- Source’s reader treats a pipe as a file. (points to ${r.ids.source})`,
			`It names ${r.ids.source} as the unit whose work most likely holds the fault.`,
			'Its guidance on how you might proceed — advice only, which changes nothing of this unit’s definition, its outputs or its criteria:\nBuild the reader in parts and check each against a pipe before the whole.',
			`The step-back (${stepBackId}) — questions and facts to help you reconsider, never what to do:`,
			'- Fact: The reader calls fstat before it reads. (source: src/reader.ts)'
		])
			expect(turn, `the faulty successor’s turn does not carry: ${part}`).toContain(part);
	});

	it('⛔ RED FIRST — a helper that changes the shared workspace has its diagnosis refused, the paths named', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		const open = pi.deps.openPi;
		const deps = {
			...pi.deps,
			// ⭑ The helper's turn writes outside its copy, into the shared workspace itself, as a command run there could.
			openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => {
				const session = await open(context);
				return {
					...session,
					turn: async (prompt: string) => {
						writeFileSync(join(pi.dir, 'leaked.txt'), 'outside the copy');
						return session.turn(prompt);
					}
				};
			}
		};

		const done = await runAssuranceStage(r.ids.verification, deps);

		expect('parts' in done && done.parts[1]?.status, 'a diagnosis made while the shared workspace changed was not refused').toBe('refused');
		expect(stageEvidenceOf('fault-diagnosis')[0]?.state.limitations, 'the changed paths are not named').toEqual(
			expect.arrayContaining(['the shared workspace changed while it ran (leaked.txt), so its diagnosis is refused (design D74)'])
		);
	});

	it('⛔ RED FIRST — two presses of one round at once run one stage: the second is refused while the first runs, named (the review’s defect 5)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;

		const [a, b] = await Promise.all([
			press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification }),
			press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })
		]);

		expect([a.advanced, b.advanced].filter((x) => x === 'assurance-stage').length, 'two presses of one round both ran').toBe(1);
		expect([a.error ?? '', b.error ?? ''].join(' '), 'the second press is not refused as running').toContain(
			`the assurance stage of this round (${r.verdicts[0]!.assessmentId}) is running now`
		);
		expect(stageEvidenceOf('narrative-chapter').length, 'one round was given two chapters').toBe(1);
	});

	it('⭑ CONTROL — a press that ends, however it ends, lets its round go: a press after one that threw runs the stage (the review’s defect 5)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });

		const first = await runAssuranceStage(r.ids.verification, {
			...pi.deps,
			runSteps: () => {
				throw new Error('the batch could not be run');
			}
		}).then(
			() => 'it ended',
			(e: unknown) => (e instanceof Error ? e.message : String(e))
		);
		const second = await runAssuranceStage(r.ids.verification, pi.deps);

		expect(first, 'arrangement: the first press threw').toBe('the batch could not be run');
		expect('parts' in second ? second.parts.map((p) => p.part) : second.refusedBecause, 'the round was held after a press that threw').toEqual([
			'narrative-chapter',
			'fault-diagnosis',
			'step-back'
		]);
	});

	it('⛔ RED FIRST — a helper that cannot be opened is recorded as that part’s failure, and the stage goes on to the Unsticking Agent (the review’s defect 4)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		let opened = 0;
		const open = pi.deps.openPi;
		const deps = {
			...pi.deps,
			// ⭑ The first helper's session cannot be opened, as a model Pi cannot resolve fails `openPiExecutionSession`; the second opens.
			openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => {
				opened += 1;
				if (opened === 1) throw new Error('the model faux/model is not one Pi can resolve');
				return open(context);
			}
		};

		const done = await runAssuranceStage(r.ids.verification, deps);

		expect('parts' in done && done.parts.map((p) => [p.part, p.status]), 'the failed helper is not recorded as failing, the stage going on').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'failing'],
			['step-back', 'recorded']
		]);
		expect('parts' in done ? (done.parts[1]?.why ?? '') : '', 'why it failed is not said').toContain('the model faux/model is not one Pi can resolve');
		expect(existsSync(`${pi.dir}.hypothesizer-${r.verdicts[0]!.assessmentId}`), 'the failed helper’s copy was left').toBe(false);
	});

	it('⛔ RED FIRST — a helper whose session cannot be closed is recorded as that part’s failure, and the stage goes on (the review’s defect 4)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		let opened = 0;
		const open = pi.deps.openPi;
		const deps = {
			...pi.deps,
			// ⭑ The first helper's session throws as it is closed, after its turn; the second closes.
			openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => {
				opened += 1;
				const session = await open(context);
				return opened === 1
					? {
							...session,
							dispose: () => {
								throw new Error('the session could not be closed');
							}
						}
					: session;
			}
		};

		const done = await runAssuranceStage(r.ids.verification, deps);

		expect('parts' in done && done.parts.map((p) => [p.part, p.status]), 'a helper whose session could not be closed is not recorded as failing, the stage going on').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'failing'],
			['step-back', 'recorded']
		]);
		expect('parts' in done ? (done.parts[1]?.why ?? '') : '', 'why it failed is not said').toContain('the hypothesizer failed: the session could not be closed');
	});

	it('⛔ RED FIRST — a value that cannot be described, thrown by the narrative writer, by the shared workspace’s resolution or by a helper’s session’s close, is that part’s, described by the one describer: recorded failing, or not run, a helper’s copy removed, and the stage goes on (the lead’s ruling (k) on the review’s fifth re-check)', async () => {
		const UNDESCRIBED = 'a thrown value that cannot be described';
		const seen: { parts: string; why: string; copyLeft: boolean }[] = [];
		for (const throws of ['writer', 'shared', 'close'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
				assessmentId: r.verdicts[0]!.assessmentId,
				observationType: 'FINDING',
				findingCode: 'KNOWN_FAILURE_RECURRENCE',
				severity: 'INFORMATIONAL',
				statement: 'The standard-input mode fails again, as it did in the round before.'
			});
			expect(recurrence.status, `arrangement: the recurrence (${throws}) — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
			const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
			let opened = 0;
			const open = pi.deps.openPi;
			// ⭑ `Object.create(null)`, which `String` cannot convert: thrown by the writer's transport, by the sandbox's resolution, or as the first helper's
			// session is closed after its turn (the second closes).
			const deps = {
				...pi.deps,
				...(throws === 'writer'
					? {
							writerPrint: async (): Promise<string> => {
								throw Object.create(null);
							}
						}
					: {}),
				...(throws === 'shared'
					? {
							sandboxOf: (): never => {
								throw Object.create(null);
							}
						}
					: {}),
				openPi: async (context: ProducerSessionContext): Promise<ProducerSession> => {
					opened += 1;
					const session = await open(context);
					return throws === 'close' && opened === 1
						? {
								...session,
								dispose: () => {
									throw Object.create(null);
								}
							}
						: session;
				}
			};

			const done = await runAssuranceStage(r.ids.verification, deps).then(
				(d) => d,
				(e: unknown) => ({ threw: saidOf(e) })
			);

			seen.push({
				parts: 'parts' in done ? done.parts.map((p) => `${p.part} ${p.status}`).join(', ') : 'threw' in done ? `threw: ${done.threw}` : done.refusedBecause,
				why: 'parts' in done ? done.parts.map((p) => p.why ?? '').join(' | ') : '',
				copyLeft: existsSync(`${pi.dir}.hypothesizer-${r.verdicts[0]!.assessmentId}`)
			});
		}

		expect(seen.map((s) => s.parts), 'a value that cannot be described threw the press, or its part was not recorded as its own, the stage going on').toEqual([
			'narrative-chapter failing, fault-diagnosis recorded, step-back recorded',
			'narrative-chapter recorded, fault-diagnosis not-run, step-back not-run',
			'narrative-chapter recorded, fault-diagnosis failing, step-back recorded'
		]);
		expect(
			[
				seen[0]!.why.includes(`the writer's call failed: ${UNDESCRIBED}`),
				seen[1]!.why.includes(`the Undertaking's shared workspace could not be resolved: ${UNDESCRIBED}`),
				seen[2]!.why.includes(`the hypothesizer failed: ${UNDESCRIBED}`)
			],
			'why a part failed, or did not run, is not said through the one describer'
		).toEqual([true, true, true]);
		expect(seen.map((s) => s.copyLeft), 'a helper’s copy was left').toEqual([false, false, false]);
	});

	it('⛔ RED FIRST — the records a later chapter is given hold an earlier round’s diagnosis and step-back, each by its id with its content and the host’s findings on it (the review’s defect 6)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });
		const done = await runAssuranceStage(r.ids.verification, pi.deps);
		expect('parts' in done && done.parts.map((p) => p.status), 'arrangement: the stage recorded its three parts').toEqual(['recorded', 'recorded', 'recorded']);
		const idOf = (part: string) => String((stageEvidenceOf(part)[0]!.state.contentReference as { artifactId: string }).artifactId);
		const chapterAt = getEngine()
			.readAllEvents()
			.findIndex((e) => e.aggregateId === idOf('narrative-chapter'));

		const records = await chapterRecordsOf(getEngine(), getArtifactStore(), r.u.undertakingId, chapterAt);

		const textOf = (id: string) => records.find((x) => x.id === id)?.text ?? '';
		expect(textOf(idOf('fault-diagnosis')), 'the diagnosis is given by its label alone').toContain(
			'Build the reader in parts and check each against a pipe before the whole.'
		);
		expect(textOf(idOf('fault-diagnosis')), 'the host’s finding on the diagnosis is not given').toContain(
			'is not among the commands the host captured it running'
		);
		expect(textOf(idOf('step-back')), 'the step-back is given by its label alone').toContain('The reader calls fstat before it reads.');
	});

	it('⛔ RED FIRST — a stage record past the bound is given cut, and said to be cut (the review’s defect 6)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const long = 'The reader treats a pipe as a file, on every path it reads. '.repeat(60);
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source).replace('Source’s reader treats a pipe as a file.', long), stepBack: STEP_BACK });
		await runAssuranceStage(r.ids.verification, pi.deps);
		const idOf = (part: string) => String((stageEvidenceOf(part)[0]!.state.contentReference as { artifactId: string }).artifactId);
		const chapterAt = getEngine()
			.readAllEvents()
			.findIndex((e) => e.aggregateId === idOf('narrative-chapter'));

		const records = await chapterRecordsOf(getEngine(), getArtifactStore(), r.u.undertakingId, chapterAt);

		const text = records.find((x) => x.id === idOf('fault-diagnosis'))?.text ?? '';
		expect([text.includes('… (cut at 2000 characters)'), text.length < long.length], 'a record past the bound is given whole, or cut without saying so').toEqual([true, true]);
	});

	it('⛔ RED FIRST — a record accepted inside a Markdown fence is read back whole by a later chapter: its diagnosis, its step-back and its tactic record (the review’s re-check, B)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId: r.verdicts[0]!.assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, as it did in the round before.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const fenced = (json: string) => ['```json', json, '```'].join('\n');
		const pi = onPi({ diagnosis: fenced(DIAGNOSIS.replaceAll('SOURCE', r.ids.source)), stepBack: fenced(STEP_BACK) });
		const done = await runAssuranceStage(r.ids.verification, pi.deps);
		expect('parts' in done && done.parts.map((p) => p.status), 'arrangement: the fenced answers were accepted').toEqual(['recorded', 'recorded', 'recorded']);
		// ⭑ And a tactic record a model wrote fenced, taken as the page takes one.
		const workspace: Workspace = createFilesystemWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und', purgeability: 'RETAINED_BY_PARTICIPATION', directoryPath: pi.dir });
		const path = tacticRecordPath('Verification', r.ids.verification);
		await workspace.writeFile(path, fenced(RECORD));
		const took = await takeTacticRecord(
			{ store: getArtifactStore(), tenantPrefix: 'tnt-local', newId: mintUiId, now: () => '2026-11-16T12:00:00.000Z', runSteps: runStepsHere },
			{
				workspace,
				path,
				unitId: r.ids.verification,
				undertakingId: r.u.undertakingId,
				roundId: r.verdicts[0]!.assessmentId,
				attemptKey: 'step_fenced#1',
				producerModelId: 'faux/model',
				atStart: undefined,
				stepEnded: false
			}
		);
		expect([took?.part, took?.recorded], 'arrangement: the fenced tactic record was taken').toEqual(['tactic-record', true]);
		const idOf = (part: string) => String((stageEvidenceOf(part)[0]!.state.contentReference as { artifactId: string }).artifactId);

		const records = await chapterRecordsOf(getEngine(), getArtifactStore(), r.u.undertakingId, -1);

		const textOf = (id: string) => records.find((x) => x.id === id)?.text ?? '';
		expect(textOf(idOf('fault-diagnosis')), 'the fenced diagnosis is called unreadable').toContain(
			'Build the reader in parts and check each against a pipe before the whole.'
		);
		expect(textOf(idOf('step-back')), 'the fenced step-back is called unreadable').toContain('The reader calls fstat before it reads.');
		expect(textOf(idOf('tactic-record')), 'the fenced tactic record is called unreadable').toContain('read standard input as a stream, in chunks');
		expect(
			[idOf('fault-diagnosis'), idOf('step-back'), idOf('tactic-record')].filter((id) => textOf(id).includes('could not be read back whole')),
			'a record whose bytes are whole is said not to be'
		).toEqual([]);
	});

	it('⭑ CONTROL — a sign-off that accepts its unit offers no stage; and a declared review’s prompt does not carry the narrative', async () => {
		const r = await verificationRejected();
		expect(Object.keys(stageOffers(r.u) ?? {}), 'a unit its reviews accepted is offered the stage').toEqual([r.ids.verification]);
		seam.review = chapterAnswering;
		await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification });
		const declared = seam.declared.length;

		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the findings.' })).error, 'arrangement: the re-run').toBeUndefined();
		expect((await press(r.u, 'recordAssurance', { pwuId: r.ids.verification })).error, 'arrangement: the re-run’s sign-off').toBeUndefined();

		const shown = seam.declared.slice(declared);
		expect(shown.length, 'arrangement: the declared reviews ran').toBeGreaterThan(0);
		for (const d of shown) {
			expect(d.prompt, `${d.policyId}’s prompt carries the narrative`).not.toContain('narrative memory');
			expect(d.content, `${d.policyId}’s content carries the narrative`).not.toContain(FEEDBACK_HEADING);
		}
		// ⭐ STRENGTHENED 2026-11-18 (`JAN-EXEC` Phase 7, package L17b3 — the independent review's L17-18; D89: "a declared review's prompt byte for byte
		// today's"): the two negative checks above kept, and every declared review this fixture shows — its policy, its prompt and the work it is
		// shown — held whole against TODAY'S, measured at the base (`44b8482e`) by this very fixture before any of the package's code
		// (`l17b3-facts.md` §8): one sha256 over them, each minted id renamed in the order it first appears, so an id minted elsewhere does not move it.
		const digest = declaredReviewsDigest(shown);
		expect(digest, `a declared review’s prompt, or the work it is shown, is not byte for byte today’s (this run’s digest: ${digest})`).toBe(DECLARED_REVIEWS_TODAY);
	});
});

describe('⭐⭐ L17b1 (D77) — D71’s re-run in place after the stage: the same feedback, after its findings, and the tactic record', () => {
	it('⛔ RED FIRST — its first turn: the instruction, the findings, then the narrative, then the request for its tactic record; the record taken before the view and overwritten; no view and no review holds it', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		seam.onTurn = writesItsTacticRecord(r.u);
		const turns = seam.turns.length;
		const eventsBefore = getEngine().readAllEvents().length;

		const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' });

		expect(rerun.error, 'the re-run did not run').toBeUndefined();
		const turn = seam.turns[turns] ?? '';
		const path = tacticRecordPath('Verification', r.ids.verification);
		const at = [CARRIED_FINDINGS_LINE, 'This is a fresh session', FEEDBACK_HEADING, 'The loop so far', tacticRecordRequest(path)].map((part) => turn.indexOf(part));
		expect(at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]!), `the turn’s parts are not in their order: ${JSON.stringify(at)}`).toBe(true);
		expect(turn.endsWith(`\n\n${tacticRecordRequest(path)}`), 'the turn does not end with the request').toBe(true);

		const tactic = listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record');
		expect(tactic.length, 'the tactic record is not recorded').toBe(1);
		expect(await getArtifactStore().get(String(tactic[0]!.state.storageKey)), 'the record’s bytes are not the model’s').toBe(RECORD);
		expect(await workspaceOf(r.u).readFile(path), 'the record was left in the shared workspace').toBe(tacticRecordNotice(tactic[0]!.id));
		// ⭑ Taken before the try's view, and so before the try's review: its record precedes the first ASSURANCE exchange the re-run recorded.
		const since = getEngine().readAllEvents().slice(eventsBefore);
		const takenAt = since.findIndex((e) => e.eventType === 'ArtifactRecorded' && e.aggregateId === tactic[0]!.id);
		const reviewedAt = since.findIndex(
			(e) => e.eventType === 'ModelExchangeRecorded' && getObject(getEngine(), e.aggregateId)?.plane === 'ASSURANCE'
		);
		expect([takenAt >= 0, reviewedAt >= 0, takenAt < reviewedAt], 'the record was not taken before the try’s review').toEqual([true, true, true]);
		// ⭑ The view the re-run's completion admits, read from its pointer as a sign-off reads it — the notice is a file the unit's baseline did not
		// hold, so without the folder left out the view would list it.
		const plans = new Set(listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === r.ids.verification).map((p) => p.id));
		const completed = getEngine()
			.readAllEvents()
			.filter((e) => e.eventType === 'ExecutionStepSucceeded' && plans.has(e.aggregateId))
			.at(-1);
		const pointer = admittedViewRef((completed?.payload as { structuredResult?: unknown } | undefined)?.structuredResult, []);
		const view = pointer.ok && pointer.ref !== undefined ? await readDeliverableView(getArtifactStore(), pointer.ref) : undefined;
		expect(view?.ok, 'arrangement: the re-run’s completion points at no view it can read').toBe(true);
		expect(
			view?.ok ? view.view.deliverable.files.map((f) => f.path).filter((f) => f.startsWith('.jpwb/tactic')) : undefined,
			'the re-run’s view lists the tactic record’s folder'
		).toEqual([]);
		const declared = seam.declared.length;
		expect((await press(r.u, 'recordAssurance', { pwuId: r.ids.verification })).error, 'arrangement: the re-run’s sign-off').toBeUndefined();
		for (const d of seam.declared.slice(declared)) expect(d.content, `${d.policyId}’s review was shown the tactic record`).not.toContain('priorTactic');
	});

	it('⛔ RED FIRST — a notice that cannot be written is said on the page, and recorded as a finding beside the record (the review’s defect 7)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		// ⭑ The model writes its record; then the file turns read-only, so the host's notice over it is refused, as the port refuses a write.
		seam.onTurn = async (text) => {
			await writesItsTacticRecord(r.u)(text);
			seam.refuseWrite = { when: (path) => path.startsWith('.jpwb/tactic/'), because: 'the file is read-only' };
		};

		const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' });

		expect(rerun.tacticRecordNote ?? '', 'a notice not written is not said on the page').toContain(
			'the notice could not be written: the file is read-only'
		);
		const artifacts = listByType(getEngine(), 'ARTIFACT').map((a) => a.state.artifactType);
		expect(
			[artifacts.filter((t) => t === 'tactic-record').length, artifacts.filter((t) => t === 'tactic-record-finding').length],
			'the record, and the finding that its notice was not written, are not both recorded'
		).toEqual([1, 1]);
	});

	it('⛔ RED FIRST — a take whose record the store refused is no take: the page takes it again at the step’s end, and says what was refused (the review’s defect 7)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		seam.onTurn = writesItsTacticRecord(r.u);
		// ⭑ The try's take is refused as a store refuses a batch; the take at the step's end runs as the product's.
		seam.takeAnswer = (stepEnded) =>
			stepEnded ? undefined : { part: 'tactic-record', recorded: false, failure: 'its record was refused: REJECTED: the store refused the batch' };

		const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' });

		expect(seam.takes, 'the refused take ended the takes: none at the step’s end').toEqual([false, true]);
		expect(listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length, 'the record was not taken at the step’s end').toBe(1);
		expect(rerun.tacticRecordNote ?? '', 'the refused take is not said on the page').toContain('its record was refused: REJECTED: the store refused the batch');
	});

	it('⛔ RED FIRST — a record never written by the step’s end is said on the page beside the step’s outcome, never discarded (the review’s defect 7)', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();

		const begun = await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id });

		expect(begun.error, 'arrangement: the new Source ran').toBeUndefined();
		expect(begun.tacticRecordNote ?? '', 'a record never written is not said on the page').toContain('no tactic record was written at');
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page does not render the tactic record’s note').toContain(
			'data-testid="tactic-record-note">The tactic record: {form.tacticRecordNote}</p>'
		);
	});

	it('⛔ RED FIRST — a step refused at its end says its tactic record’s note beside the refusal (the review’s defect 7)', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		// ⭑ The floor refuses every try’s work product with a finding, so the step ends refused (package N’s arrangement).
		seam.review = (prompt) => {
			if (!prompt.includes('The WORK PRODUCT to review')) return undefined;
			const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
			return JSON.stringify({
				findings: ids.map((id, i) =>
					i === 0 ? { criterionId: id, failed: true, statement: 'The reader cannot read a pipe.', severity: 'BLOCKING' } : { criterionId: id, failed: false, statement: 'met' }
				),
				recommendation: 'REJECTED',
				residualUncertainty: []
			});
		};

		const begun = await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id });

		expect(begun.error ?? '', 'arrangement: the step was not refused at its end').not.toBe('');
		expect(begun.tacticRecordNote ?? '', 'a record never written is not said beside the refusal').toContain('no tactic record was written at');
	});

	it('⛔ RED FIRST — a step refused in the middle of a try still ends: its last take runs and the notes it gathered are said beside the refusal — its invocation refused at its first try or a later one, its work product’s record refused, a command’s evidence refused (the review’s re-check, D)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const seen: { error: string; note: string; takes: readonly boolean[]; records: number }[] = [];
		for (const refuse of ['first-invocation', 'invocation', 'work-product', 'evidence'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${refuse})`).toBeUndefined();
			const takes = seam.takes.length;
			const records = tacticRecords();
			// ⭑ The model writes its record on its first turn; a case refusing the invocation fails a turn instead, as an unreachable provider does — the
			// first, before any try answered, or the second.
			let turns = 0;
			seam.onTurn = async (text) => {
				turns += 1;
				if (refuse === 'first-invocation' || (refuse === 'invocation' && turns === 2)) throw new Error('the provider is unreachable');
				if (turns === 1) await writesItsTacticRecord(r.u)(text);
			};
			// ⭑ A try's take is refused, as a store refuses a batch: the note gathered before the refusal. The step's last take is the product's.
			seam.takeAnswer = (stepEnded) => (stepEnded ? undefined : { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE });
			// ⭑ Refusing the invocation needs a second try: the floor refuses the first try's work product with a finding (package N's arrangement).
			let rejected = false;
			seam.review = (prompt) => {
				if (prompt.includes(WRITER_PROMPT)) return chapterAnswering(prompt);
				if (refuse !== 'invocation' || rejected || !prompt.includes('The WORK PRODUCT to review')) return undefined;
				rejected = true;
				const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
				return JSON.stringify({
					findings: ids.map((id, i) =>
						i === 0 ? { criterionId: id, failed: true, statement: 'The reader cannot read a pipe.', severity: 'BLOCKING' } : { criterionId: id, failed: false, statement: 'met' }
					),
					recommendation: 'REJECTED',
					residualUncertainty: []
				});
			};
			if (refuse === 'work-product')
				seam.refuseBatch = (commands) =>
					commands.some((c) => c.commandType === 'RecordArtifact' && c.payload.artifactType === 'work-product') ? 'the store refused the work product' : undefined;
			if (refuse === 'evidence') seam.refuseJoin = 'the evidence batch was refused';

			const rerun = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' });

			seam.refuseBatch = undefined;
			seam.refuseJoin = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ error: rerun.error ?? '', note: rerun.tacticRecordNote ?? '', takes: seam.takes.slice(takes), records: tacticRecords() - records });
		}

		// ⭑ Refused at its first try, the model wrote nothing: the last take records that none was written, a finding, and no tactic record.
		expect(seen.map((s) => [s.takes.at(-1), s.records]), 'a step refused in the middle of a try ran no last take').toEqual([
			[true, 0],
			[true, 1],
			[true, 1],
			[true, 1]
		]);
		expect(
			seen.map((s) => s.error.split(':')[0]),
			'arrangement: each step refused where its case refuses it'
		).toEqual([
			'The model invocation did not run',
			'The model invocation did not run',
			'Recording the work product failed',
			'The model ran 0 command(s) and one could not be recorded as evidence'
		]);
		expect(
			[seen[0]!.note.includes('no tactic record was written at'), seen[1]!.note.includes(REFUSED_TAKE), seen[3]!.note.includes(REFUSED_TAKE)],
			'the notes a step gathered before its refusal, or its last take’s finding, are not said beside it'
		).toEqual([true, true, true]);
	});

	it('⛔ RED FIRST — a step that fails before its try’s review, or whose try an exception escapes, still ends: its last take runs, its notes beside the failure, and an exception goes on as it was, the end’s own failure named on it (the review’s second re-check, D)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		// ⭐ The lead's ruling (a) on the review's third re-check — a take that throws at the step's end, said among the end's notes.
		const TAKE_FAILED = "its take at the step's end failed: the record could not be taken";
		const seen: { error: string; note: string; thrown: string; takes: readonly boolean[]; records: number; step: ReturnType<typeof latestStepOf> }[] = [];
		for (const ending of ['manifest', 'view', 'escaping', 'escaping-and-its-end', 'manifest-and-its-end'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${ending})`).toBeUndefined();
			const takes = seam.takes.length;
			const records = tacticRecords();
			// ⭑ The model writes its record; a case reading the workspace after the try makes the listing throw once the turn is done.
			seam.onTurn = async (text) => {
				await writesItsTacticRecord(r.u)(text);
				if (ending.startsWith('manifest')) seam.listThrows = 'a file was removed between the walk and its stat';
			};
			// ⭑ The try's take is refused, as a store refuses a batch: a note gathered first. A case whose end fails makes the last take throw.
			seam.takeAnswer = (stepEnded) => {
				if (!stepEnded) return { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE };
				if (ending.endsWith('and-its-end')) throw new Error('the record could not be taken');
				return undefined;
			};
			if (ending === 'view') seam.viewThrows = 'the store refused the view';
			if (ending.startsWith('escaping')) seam.processRunsThrows = 'the process runs could not be read';

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ error: p.error ?? '', note: p.tacticRecordNote ?? '', thrown: '' }),
				(e: unknown) => ({ error: '', note: '', thrown: e instanceof Error ? e.message : String(e) })
			);

			seam.listThrows = undefined;
			seam.viewThrows = undefined;
			seam.processRunsThrows = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ ...out, takes: seam.takes.slice(takes), records: tacticRecords() - records, step: latestStepOf(r.ids.verification) });
		}

		expect(seen.map((s) => s.takes), 'a step that ended this way ran no last take, or ran it twice').toEqual([
			[false, true],
			[false, true],
			[false, true],
			[false, true],
			[false, true]
		]);
		expect(seen.map((s) => s.records), 'the last take recorded no tactic record where it ran whole').toEqual([1, 1, 1, 0, 0]);
		expect(
			[seen[0]!.note.includes(REFUSED_TAKE), seen[1]!.note.includes(REFUSED_TAKE)],
			'the notes a step gathered are not said beside its failure before review'
		).toEqual([true, true]);
		expect(
			[seen[0]!.error.split(':')[0], seen[0]!.error.includes("the host could not read the unit's workspace after try 1"), seen[1]!.error.includes('the host could not record the files the unit changed after try 1')],
			'arrangement: each failed before its review where its case fails it'
		).toEqual(['The model invocation did not run to its review', true, true]);
		expect(
			[seen[2]!.thrown, seen[3]!.thrown, seen[4]!.thrown],
			'the exception that escaped is not the one thrown, or the end’s own failure is not named on it, or the end ran twice'
		).toEqual([
			// ⭐ RESTATED 2026-11-17 (the lead's rulings (a) and (c) on the review's third re-check): the step's end cannot throw — a take that throws is the
			// take's failure, said among the end's notes — and an exception that escapes a try goes on as the same value, the end's notes named on it. The
			// superseded expectation, struck: ~~'the process runs could not be read',~~ ~~"the process runs could not be read — and the step's end, run
			// before it went on, failed too: the record could not be taken",~~ ~~'the record could not be taken'~~ — the fifth case's, a handled failure
			// whose end's take threw, the take's throw going on in the failure's place.
			`the process runs could not be read — the step's end, run before it went on: The tactic record: ${REFUSED_TAKE}`,
			`the process runs could not be read — the step's end, run before it went on: The tactic record: ${REFUSED_TAKE} ${TAKE_FAILED}`,
			''
		]);
		// ⭐ RESTATED 2026-11-17 (the lead's ruling (a)): the fifth case — a handled failure whose end's take throws — is recorded with its own reason, its
		// step FAILED, and the take's failure among the notes beside it.
		expect(
			[seen[4]!.error, seen[4]!.step, seen[4]!.note.includes(TAKE_FAILED)],
			'a handled failure whose end’s take threw lost its own reason, left its step RUNNING, or did not say the take’s failure among its notes'
		).toEqual([
			"The model invocation did not run to its review: the host could not read the unit's workspace after try 1: a file was removed between the walk and its stat",
			{ stepState: 'FAILED', failed: ["the host could not read the unit's workspace after try 1: a file was removed between the walk and its stat"] },
			true
		]);
	});

	it('⛔ RED FIRST — the step’s end cannot throw: a take that throws at the step’s end is the take’s failure, said among the end’s notes, and the step goes on — a refusal in a try returns its refusal, and the ordinary way out reaches its completion (the lead’s ruling (a) on the review’s third re-check)', async () => {
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const TAKE_FAILED = "its take at the step's end failed: the record could not be taken";
		const seen: { outcome: string; note: string; step: ReturnType<typeof latestStepOf> }[] = [];
		for (const ending of ['refused', 'ordinary'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${ending})`).toBeUndefined();
			seam.onTurn = writesItsTacticRecord(r.u);
			// ⭑ The try's take is refused, as a store refuses a batch; the step's end takes it again, and that take throws, as a store that cannot be
			// written throws (package N's check: "the content store is read-only").
			seam.takeAnswer = (stepEnded) => {
				if (stepEnded) throw new Error('the record could not be taken');
				return { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE };
			};
			if (ending === 'refused')
				seam.refuseBatch = (commands) =>
					commands.some((c) => c.commandType === 'RecordArtifact' && c.payload.artifactType === 'work-product') ? 'the store refused the work product' : undefined;

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ outcome: p.advanced ?? (p.error ?? '').split(':')[0]!, note: p.tacticRecordNote ?? '' }),
				(e: unknown) => ({ outcome: `thrown: ${e instanceof Error ? e.message : String(e)}`, note: '' })
			);

			seam.refuseBatch = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ ...out, step: latestStepOf(r.ids.verification) });
		}

		expect(seen.map((s) => s.outcome), 'the step’s end threw: its take’s failure went on in the step’s outcome’s place').toEqual([
			'Recording the work product failed',
			'rejected-work-rerun'
		]);
		expect(seen.map((s) => s.note.includes(TAKE_FAILED)), 'the take’s failure is not said among the step’s end’s notes').toEqual([true, true]);
		expect(seen[1]!.step, 'the ordinary way out did not reach its completion').toEqual({ stepState: 'SUCCEEDED', failed: [] });
	});

	it('⛔ RED FIRST — the producer’s close is part of the step’s end: closed once, best-effort, whichever call closes it, its failure said among the end’s notes on every way the step ends — never in the step’s outcome’s place, never skipping the last take (the lead’s ruling (b) on the review’s third re-check)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const CLOSE = "The executor's session could not be closed: Failed to cleanup session resources";
		const seen: { outcome: string; close: string; takes: readonly boolean[]; records: number; disposes: number }[] = [];
		for (const ending of ['ordinary', 'refused', 'failed', 'escaping', 'closed'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${ending})`).toBeUndefined();
			const takes = seam.takes.length;
			const records = tacticRecords();
			const disposes = seam.disposes;
			// ⭑ The model writes its record; the try's take is refused, so the step's end must take it again. A case failing before the try's review makes
			// the listing throw once the turn is done.
			seam.onTurn = async (text) => {
				await writesItsTacticRecord(r.u)(text);
				if (ending === 'failed') seam.listThrows = 'a file was removed between the walk and its stat';
			};
			seam.takeAnswer = (stepEnded) => (stepEnded ? undefined : { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE });
			// ⭑ Pi's close fails as its cleanup does (`pi-ai`, `session-resources.js`): an `AggregateError`. The control's close succeeds.
			if (ending !== 'closed')
				seam.disposeThrows = { error: new AggregateError([new Error('the bash process would not stop')], 'Failed to cleanup session resources') };
			if (ending === 'refused')
				seam.refuseBatch = (commands) =>
					commands.some((c) => c.commandType === 'RecordArtifact' && c.payload.artifactType === 'work-product') ? 'the store refused the work product' : undefined;
			const escaped = new Error('the process runs could not be read');
			if (ending === 'escaping') seam.processRunsThrows = { value: escaped };

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ outcome: p.advanced ?? (p.error ?? '').split(':')[0]!, close: p.sessionCloseNote ?? '' }),
				(e: unknown) => ({ outcome: e === escaped ? 'the exception that escaped' : `another: ${String(e)}`, close: e instanceof Error ? e.message : '' })
			);

			seam.disposeThrows = undefined;
			seam.refuseBatch = undefined;
			seam.processRunsThrows = undefined;
			seam.listThrows = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ ...out, takes: seam.takes.slice(takes), records: tacticRecords() - records, disposes: seam.disposes - disposes });
		}

		expect(seen.map((s) => s.outcome), 'the close’s failure took the step’s outcome’s place').toEqual([
			'rejected-work-rerun',
			'Recording the work product failed',
			'The model invocation did not run to its review',
			'the exception that escaped',
			'rejected-work-rerun'
		]);
		expect(seen.map((s) => [s.takes.at(-1), s.records]), 'the close’s failure skipped the step’s last take').toEqual([
			[true, 1],
			[true, 1],
			[true, 1],
			[true, 1],
			[true, 1]
		]);
		expect(seen.map((s) => s.disposes), 'the producer’s session was not closed once').toEqual([1, 1, 1, 1, 1]);
		expect(
			seen.map((s) => s.close.includes(CLOSE)),
			'the close’s failure is not said among the step’s end’s notes, or a close that succeeded is said to have failed'
		).toEqual([true, true, true, true, false]);
		const page = readFileSync(new URL('../../../routes/undertakings/[id]/+page.svelte', import.meta.url), 'utf8');
		expect(page, 'the page does not render the close’s note').toContain('data-testid="session-close-note">{form.sessionCloseNote}</p>');
	});

	it('⛔ RED FIRST — an exception that escapes a try goes on as the very value thrown: an Error whose message can be written carries the step’s end’s notes after its own message; any other value, and an Error whose message cannot be written, go on unchanged; a handled failure that then throws is given the end that already ran (the lead’s ruling (c) on the review’s third re-check)', async () => {
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const NOTES = ` — the step's end, run before it went on: The tactic record: ${REFUSED_TAKE}`;
		const writable = new Error('the process runs could not be read');
		const notAnError = { code: 'E_RUNS', reason: 'the process runs could not be read' };
		const frozen = Object.freeze(new Error('the process runs could not be read, the error frozen'));
		const domException = new DOMException('the process runs could not be read, a DOMException', 'InvalidStateError');
		const noNotes = new Error('the process runs could not be read, the step’s end with nothing to say');
		const afterItsEnd = new Error('the failure could not be recorded: the store is read-only');
		const cases = [
			['writable', writable],
			['notAnError', notAnError],
			['frozen', frozen],
			['domException', domException],
			['noNotes', noNotes],
			['afterItsEnd', afterItsEnd]
		] as const;
		const caught: unknown[] = [];
		const takes: (readonly boolean[])[] = [];
		for (const [kind, value] of cases) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			// ⭑ The stage runs, so the re-run takes a tactic record, its try's take refused: a note for the end to name. The control whose end has nothing to
			// say runs none, so its re-run is asked for no tactic record.
			if (kind !== 'noNotes') {
				expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${kind})`).toBeUndefined();
				seam.onTurn = async (text) => {
					await writesItsTacticRecord(r.u)(text);
					if (kind === 'afterItsEnd') seam.listThrows = 'a file was removed between the walk and its stat';
				};
				seam.takeAnswer = (stepEnded) => (stepEnded ? undefined : { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE });
			}
			// ⭑ An exception escapes the try where its process runs are read; or, the try's workspace unread, the failure's own record throws after the end ran.
			if (kind === 'afterItsEnd') seam.throwBatch = { when: (commands) => commands.some((c) => c.commandType === 'FailExecutionStep'), error: value };
			else seam.processRunsThrows = { value };
			const before = seam.takes.length;

			caught.push(
				await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
					() => 'returned',
					(e: unknown) => e
				)
			);

			seam.processRunsThrows = undefined;
			seam.throwBatch = undefined;
			seam.listThrows = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			takes.push(seam.takes.slice(before));
		}

		for (const [i, [kind, value]] of cases.entries()) expect(caught[i], `the ${kind} value that escaped is not the one thrown`).toBe(value);
		expect(
			[writable.message, noNotes.message, afterItsEnd.message],
			'the step’s end’s notes are not named after the first message, or a step whose end said nothing had its message changed'
		).toEqual([
			`the process runs could not be read${NOTES}`,
			'the process runs could not be read, the step’s end with nothing to say',
			`the failure could not be recorded: the store is read-only${NOTES}`
		]);
		expect(
			[notAnError, frozen.message, domException.message],
			'a value that is not an Error, or an Error whose message cannot be written, was changed'
		).toStrictEqual([
			{ code: 'E_RUNS', reason: 'the process runs could not be read' },
			'the process runs could not be read, the error frozen',
			'the process runs could not be read, a DOMException'
		]);
		expect([takes[0], takes[5]], 'the step’s end did not run once, or ran again where it had run').toEqual([
			[false, true],
			[false, true]
		]);
	});

	it('⛔ RED FIRST — the try’s own take cannot throw: a take that throws in a try is the take’s failure, said among the notes, and the try goes on to its view — a content store that fails at the take and at the view is met where package N meets it, the step FAILED with the view’s own reason; the take, not on the record, is taken again at the step’s end (the lead’s ruling (g) on the review’s fourth re-check)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const STORE = 'the content store is read-only';
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		const takes = seam.takes.length;
		const records = tacticRecords();
		seam.onTurn = writesItsTacticRecord(r.u);
		// ⭑ The content store fails at the try's take — its record's write throws, as package N's check makes the store throw — and then at the try's view;
		// the step's end's take is the product's own.
		seam.takeAnswer = (stepEnded) => {
			if (!stepEnded) throw new Error(STORE);
			return undefined;
		};
		seam.viewThrows = STORE;

		const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
			(p) => ({ thrown: '', error: p.error ?? '', note: p.tacticRecordNote ?? '' }),
			(e: unknown) => ({ thrown: e instanceof Error ? e.message : String(e), error: '', note: '' })
		);

		expect(
			[out.thrown, out.error, latestStepOf(r.ids.verification), out.note.includes(`its take after try 1 failed: ${STORE}`), seam.takes.slice(takes), tacticRecords() - records],
			'a take that threw in its try left the step RUNNING, lost the view’s own reason, did not say the take’s failure, or was not taken again at the step’s end'
		).toEqual([
			'',
			`The model invocation did not run to its review: the host could not record the files the unit changed after try 1: ${STORE}`,
			{ stepState: 'FAILED', failed: [`the host could not record the files the unit changed after try 1: ${STORE}`] },
			true,
			[false, true],
			1
		]);
	});

	it('⛔ RED FIRST — describing a thrown value cannot throw: a value that cannot be described, thrown by the producer’s close — the finally’s backstop on the ordinary way out, or the end’s own close — or by the end’s take or the try’s own, and a revoked Proxy thrown from inside a try: the same value goes on, the end runs once and its take happens, and the notes say what they can (the lead’s ruling (h) on the review’s fourth re-check)', async () => {
		const tacticRecords = () => listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length;
		const REFUSED_TAKE = 'its record was refused: REJECTED: the store refused the batch';
		const UNDESCRIBED = 'a thrown value that cannot be described';
		/** What the test can say of a value that escaped, where the code under test could not: never a throw of its own. */
		const said = (e: unknown): string => {
			try {
				return e instanceof Error ? e.message : String(e);
			} catch {
				return '(a value the test cannot describe)';
			}
		};
		const seen: { outcome: string; notes: string; takes: readonly boolean[]; records: number; disposes: number }[] = [];
		for (const ending of ['close-backstop', 'close-in-the-end', 'take-in-the-end', 'take-in-the-try', 'revoked-proxy'] as const) {
			const r = await verificationRejected();
			seam.review = chapterAnswering;
			expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, `arrangement: the stage (${ending})`).toBeUndefined();
			const takes = seam.takes.length;
			const records = tacticRecords();
			const disposes = seam.disposes;
			seam.onTurn = writesItsTacticRecord(r.u);
			// ⭑ The try's take is refused, as a store refuses a batch, so the step's end takes the record — save where a case makes the try's take throw a value
			// that cannot be described; another makes the end's take throw one, and two the producer's close (`Object.create(null)`: `String` throws on it).
			seam.takeAnswer = (stepEnded) => {
				if (!stepEnded && ending === 'take-in-the-try') throw Object.create(null);
				if (!stepEnded) return { part: 'tactic-record', recorded: false, failure: REFUSED_TAKE };
				if (ending === 'take-in-the-end') throw Object.create(null);
				return undefined;
			};
			if (ending === 'close-backstop' || ending === 'close-in-the-end') seam.disposeThrows = { error: Object.create(null) };
			// ⭑ An exception escapes the try where its process runs are read: an Error, the end's close then throwing; or a revoked Proxy, which throws as it is
			// inspected.
			const escaped = new Error('the process runs could not be read');
			const revoked = Proxy.revocable(new Error('the process runs could not be read, through a proxy'), {});
			revoked.revoke();
			if (ending === 'close-in-the-end') seam.processRunsThrows = { value: escaped };
			if (ending === 'revoked-proxy') seam.processRunsThrows = { value: revoked.proxy };

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ outcome: p.advanced ?? `refused: ${p.error ?? ''}`, notes: `${p.tacticRecordNote ?? ''} | ${p.sessionCloseNote ?? ''}` }),
				(e: unknown) => ({
					outcome: e === escaped || e === revoked.proxy ? 'the value thrown' : `another: ${said(e)}`,
					notes: e === escaped ? escaped.message : ''
				})
			);

			seam.disposeThrows = undefined;
			seam.processRunsThrows = undefined;
			seam.onTurn = undefined;
			seam.takeAnswer = undefined;
			seen.push({ ...out, takes: seam.takes.slice(takes), records: tacticRecords() - records, disposes: seam.disposes - disposes });
		}

		expect(seen.map((s) => s.outcome), 'a value that cannot be described took the step’s outcome’s place, or the value thrown did not go on').toEqual([
			'rejected-work-rerun',
			'the value thrown',
			'rejected-work-rerun',
			'rejected-work-rerun',
			'the value thrown'
		]);
		expect(
			seen.map((s) => [s.takes, s.records, s.disposes]),
			'the step’s end did not run once, its take did not happen, or the producer’s session was not closed once'
		).toEqual([
			[[false, true], 1, 1],
			[[false, true], 1, 1],
			[[false, true], 0, 1],
			[[false, true], 1, 1],
			[[false, true], 1, 1]
		]);
		expect(
			[seen[0]!.notes, seen[1]!.notes, seen[2]!.notes, seen[3]!.notes],
			'the notes do not say what they can of a value that cannot be described'
		).toEqual([
			`${REFUSED_TAKE} | The executor's session could not be closed: ${UNDESCRIBED}`,
			`the process runs could not be read — the step's end, run before it went on: The tactic record: ${REFUSED_TAKE} The executor's session could not be closed: ${UNDESCRIBED}`,
			`${REFUSED_TAKE} its take at the step's end failed: ${UNDESCRIBED} | `,
			`its take after try 1 failed: ${UNDESCRIBED} | `
		]);
	});

	it('⛔ RED FIRST — package N’s two failures before a try’s review describe whatever value is thrown, through the one describer: a workspace whose listing, or a view whose record, throws a value that cannot be described FAILS THE STEP with its reason, never an escape (the lead’s ruling (k) on the review’s fifth re-check)', async () => {
		const UNDESCRIBED = 'a thrown value that cannot be described';
		const seen: { thrown: string; error: string; step: ReturnType<typeof latestStepOf> }[] = [];
		for (const failing of ['listing', 'view'] as const) {
			const r = await verificationRejected();
			// ⭑ Once the turn is done the listing throws `Object.create(null)`, or the try's view's record does, where package N's check makes each throw an Error.
			seam.onTurn = async () => {
				if (failing === 'listing') seam.listThrows = { value: Object.create(null) };
			};
			if (failing === 'view') seam.viewThrows = { value: Object.create(null) };

			const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the reviews’ findings.' }).then(
				(p) => ({ thrown: '', error: p.error ?? '' }),
				(e: unknown) => ({ thrown: saidOf(e), error: '' })
			);

			seam.listThrows = undefined;
			seam.viewThrows = undefined;
			seam.onTurn = undefined;
			seen.push({ ...out, step: latestStepOf(r.ids.verification) });
		}

		expect(seen, 'a value that cannot be described escaped package N’s catch, left its step RUNNING, or was said wrongly').toEqual([
			{
				thrown: '',
				error: `The model invocation did not run to its review: the host could not read the unit's workspace after try 1: ${UNDESCRIBED}`,
				step: { stepState: 'FAILED', failed: [`the host could not read the unit's workspace after try 1: ${UNDESCRIBED}`] }
			},
			{
				thrown: '',
				error: `The model invocation did not run to its review: the host could not record the files the unit changed after try 1: ${UNDESCRIBED}`,
				step: { stepState: 'FAILED', failed: [`the host could not record the files the unit changed after try 1: ${UNDESCRIBED}`] }
			}
		]);
	});
});

describe('⭐⭐ L17b1 (D77, reading 16) — each successor’s first turn, and the faulty unit’s successor derived from the record', () => {
	it('⛔ RED FIRST — the faulty unit’s successor: the instruction, then the narrative, the round’s failed criteria and the request for its tactic record; each other successor: the narrative and the line naming the replaced unit and the Decision', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const decisionId = listByType(getEngine(), 'DECISION').find((d) => d.state.selectedOption === 'REPLACE_REACHED_WORK')!.id;
		const source2 = currentOf(r.u, 'Source').id;
		seam.onTurn = writesItsTacticRecord(r.u);
		let turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: source2 })).error, 'the new Source did not run').toBeUndefined();

		const faulty = seam.turns[turns] ?? '';
		const path = tacticRecordPath('Source', source2);
		const at = [
			FEEDBACK_HEADING,
			'The loop so far',
			'The criteria the review that rejected the work found not met, each with its rationale:',
			'The standard-input mode exits 1: the reader Source wrote cannot read a pipe.',
			'A documented usage does not work.',
			tacticRecordRequest(path)
		].map((part) => faulty.indexOf(part));
		expect(at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]!), `the faulty successor’s parts are not in their order: ${JSON.stringify(at)}`).toBe(true);
		expect(faulty.indexOf(FEEDBACK_HEADING) > faulty.indexOf('Write the'), 'the feedback does not follow the instruction').toBe(true);
		expect(listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record').length, 'the faulty successor’s record is not taken').toBe(1);

		for (const action of ['recordAssurance', 'markSatisfied'] as const)
			expect((await press(r.u, action, { pwuId: source2 })).error, `arrangement: ${action} on the new Source`).toBeUndefined();
		turns = seam.turns.length;
		expect((await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Tests').id })).error, 'the new Tests did not run').toBeUndefined();

		const other = seam.turns[turns] ?? '';
		expect(other, 'the other successor’s turn does not carry the narrative').toContain('The loop so far');
		expect(other, 'the other successor’s turn does not name the replaced unit and the Decision').toContain(
			`This unit is redone because a unit its work used was replaced: "Source" (${r.ids.source}), under the person’s Decision ${decisionId}.`
		);
		expect(other, 'another successor was asked for a tactic record').not.toContain('Your tactic record');
	});

	it('⛔ RED FIRST — with no stage run, the faulty unit’s successor still carries the round’s failed criteria and the request, and no narrative', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id })).error, 'the new Source did not run').toBeUndefined();

		const turn = seam.turns[turns] ?? '';
		expect([turn.includes(FEEDBACK_HEADING), turn.includes('The standard-input mode exits 1'), turn.includes('Your tactic record'), turn.includes('The loop so far')], 'the parts recorded are not the ones carried').toEqual([
			true,
			true,
			true,
			false
		]);
		// ⭑ The model wrote no record: at the step's end that is a finding, recorded, and the step went on.
		const findings = listByType(getEngine(), 'ARTIFACT').filter((a) => a.state.artifactType === 'tactic-record-finding');
		expect(findings.length, 'a record never written is not a finding, recorded').toBe(1);
		expect(await getArtifactStore().get(String(findings[0]!.state.storageKey)), 'the finding does not say no record was written').toContain(
			'no tactic record was written at'
		);
	});

	it('⭑ CONTROL — a unit that replaces none starts with its instruction alone, byte for byte as before', async () => {
		const r = await verificationRejected();
		expect(seam.turns.every((t) => !t.includes(FEEDBACK_HEADING)), 'a unit that replaces none was given feedback').toBe(true);
		expect(successorRoundOf(getEngine(), r.ids.source), 'a unit that replaces none has a round').toBeUndefined();
	});

	it('⛔ RED FIRST — the derivation names the unit the act was pressed for: a target that is a reached composite’s child, at the head of a chain of producers (Source)', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const decisionId = listByType(getEngine(), 'DECISION').find((d) => d.state.selectedOption === 'REPLACE_REACHED_WORK')!.id;
		const source2 = currentOf(r.u, 'Source').id;

		for (const title of ['Source', 'Tests', 'Build', 'Verification']) {
			const round = successorRoundOf(getEngine(), currentOf(r.u, title).id);
			expect(
				[round?.faultyId, round?.decisionId, round?.rejectedUnitId, round?.roundId, round?.faultyPredecessor?.id],
				`${title}’s successor does not derive the faulty unit as Source’s successor`
			).toEqual([source2, decisionId, r.ids.verification, r.verdicts[0]!.assessmentId, r.ids.source]);
		}
	});

	it('⛔ RED FIRST — the derivation names the unit the act was pressed for: a composite target (Build)', async () => {
		const r = await verificationRejected();
		expect((await press(r.u, 'sendWorkBack', { pwuId: r.ids.verification, targetId: r.ids.build, rationale: TYPED })).error, 'arrangement: the act').toBeUndefined();
		const build2 = currentOf(r.u, 'Build').id;

		for (const title of ['Build', 'Verification'])
			expect(successorRoundOf(getEngine(), currentOf(r.u, title).id)?.faultyId, `${title}’s successor does not derive Build’s`).toBe(build2);
	});
});

// ⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89): ~~'… each step’s session is kept, reopened and forked'~~ — no step forks since
// D89: a replacement's session is a new one, as any unit's first step's.
describe('⭐⭐ L17b1 (D85; REG-D-169) — through the page: with a durable store and Pi, each step’s session is kept and reopened ~~and forked~~ ⭐ — a replacement’s new, as any unit’s (D89)', () => {
	/** A serving store's sessions root for one case, and Pi selected (its producer still the harness's scripted one, which writes no file). */
	const durableOnPi = (): string => {
		const root = join(TMP, `sessions-${++tmpCase}`, 'demo.sqlite.sessions');
		seam.sessionsRoot = root;
		vi.stubEnv('JPWB_EXECUTOR', 'pi');
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'faux/model');
		return root;
	};
	/**
	 * A session file in `folder`, as Pi writes one: its header and one turn. ⭐ AMENDED IN FORM AT STAGE 2 (package L17b3, design D91; `l17b3-facts.md`
	 * §12): the turn's text may be given (`turnText`, `'Write the work.'` where it is not, as before) — D91 finds the reviewed try in a reopened file by
	 * its turn's text, so a case about a file holding the unit's reviewed try writes that try's own turn, as Pi would have.
	 */
	const sessionFileIn = (folder: string, name = '2026-11-16T00-00-00-000Z_s.jsonl', turnText = 'Write the work.'): string => {
		mkdirSync(folder, { recursive: true });
		const file = join(folder, name);
		const header = { type: 'session', version: 3, id: 's', timestamp: '2026-11-16T00:00:00.000Z', cwd: TMP };
		const turn = { type: 'message', id: 'u1', parentId: null, timestamp: '2026-11-16T00:00:01.000Z', message: { role: 'user', content: [{ type: 'text', text: turnText }], timestamp: 1 } };
		// ⭐ The review's defect 8 — and its answer, as an earlier step that returned a work product left it (`stopReason` "stop").
		const answer = { type: 'message', id: 'a1', parentId: 'u1', timestamp: '2026-11-16T00:00:02.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'The work.' }], stopReason: 'stop', timestamp: 2 } };
		writeFileSync(file, `${JSON.stringify(header)}\n${JSON.stringify(turn)}\n${JSON.stringify(answer)}\n`);
		return file;
	};
	/** ⭐ The review's defects 1 and 8 — what that file holds, as the place carries it: its answer, no findings, no feedback. */
	const HOLDS_AN_ANSWER = { returnedAnswer: true, ownFindings: false, crossUnitFeedback: false } as const;
	const purposesOf = (pwuId: string): string[] =>
		listByType(getEngine(), 'EXECUTION_PLAN')
			.filter((p) => p.state.workUnitId === pwuId)
			.flatMap((p) => ((p.state.steps as { purpose?: unknown }[] | undefined) ?? []).map((s) => String(s.purpose ?? '')));

	it('⛔ RED FIRST — a unit’s first step opens a NEW file in its folder; D71’s re-run in place reopens the one it finds there, its plan’s purpose and its first turn saying so', async () => {
		const root = durableOnPi();
		const r = await verificationRejected();
		const spec = r.ids.spec;
		expect(seam.places[0], 'the first step’s session is not a new file in its folder').toEqual({
			kind: 'DURABLE',
			folder: sessionFolderOf(root, 'executor', spec),
			opening: { kind: 'NEW' }
		});
		const folder = sessionFolderOf(root, 'executor', r.ids.verification);
		// ⭐ RESTATED IN FORM AT STAGE 2 (package L17b3, design D91): ~~`sessionFileIn(folder)`~~, a file whose one turn is `'Write the work.'` — under D91 a
		// reopened file whose user entries hold no turn equal to the reviewed try's cannot show that it holds the reviewed answer, so the work is sent
		// again and the held sentence says so (that case is D91's own test, beside). The promise kept: a file holding the unit's reviewed try, its answer
		// one Pi replays — its turn the reviewed try's own, as Pi writes it — is reopened, and its first turn says what it holds.
		const reviewedTurn = seam.turns.filter((t) => t.startsWith('Write the Verification.')).at(-1) ?? '(no turn of Verification was sent)';
		const file = sessionFileIn(folder, undefined, reviewedTurn);
		const places = seam.places.length;
		const turns = seam.turns.length;

		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the findings.' })).error, 'the re-run did not run').toBeUndefined();

		expect(seam.places[places], 'the re-run did not reopen the unit’s one file').toEqual({
			kind: 'DURABLE',
			folder,
			// ⭐ RESTATED for the review's defects 1 and 8: the place carries what the file holds, read from it.
			opening: { kind: 'REOPEN', file, held: HOLDS_AN_ANSWER }
		});
		expect(purposesOf(r.ids.verification).filter((p) => p.startsWith('Re-attempt the work in its continued session')), 'the purpose does not say the session is continued').toHaveLength(1);
		const turn = seam.turns[turns] ?? '';
		expect(turn, 'the reopened session’s turn does not say what it holds').toContain(
			'This session holds that attempt: the turns above are your earlier work on this unit, with the work product you returned and your rationale.'
		);
		expect(turn, 'the reopened session’s turn says it is fresh').not.toContain('This is a fresh session');
	});

	// ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89, `REG-D-173`): ~~'⛔ RED FIRST — a replacement’s first step forks its
	// predecessor’s file, its first turn saying whose conversation it holds; a predecessor with none starts new, and that is recorded for the run report'~~,
	// its places ~~`opening: { kind: 'FORK', from, predecessorId: r.ids.source, heldFindings: false, returnedAnswer: true }`~~ (~~'the new Source did not
	// fork its predecessor’s file'~~) and ~~`opening: { kind: 'NEW', predecessorWithoutSession: r.ids.tests }`~~ (~~'a successor whose predecessor left no
	// file did not start new, saying so'~~), its turn's words ~~`This session holds the conversation of the unit this one replaces, "Source" (…)`~~ (~~'the
	// forked turn does not say whose conversation it holds'~~), and its note ~~`expect(await getArtifactStore().resolveName(predecessorWithoutSessionNameOf(
	// 'tnt-local', tests2)), 'no note is recorded for the run report').toBeDefined()`~~ — nothing forks since D89: a replacement's first step opens a new
	// file of its own, whatever its predecessor left, its predecessor's file left byte for byte, and its first turn says the record of the unit it replaces
	// is in reach; nothing is noted, since every replacement begins so. The promise kept: a replacement's first step has a session in its own folder, and
	// its first turn names the unit it replaces.
	it('⛔ RED FIRST — a replacement’s first step opens a NEW file of its own, its predecessor’s left byte for byte, its first turn saying the record of the unit it replaces is in reach; one whose predecessor left no file opens one too, and nothing is noted (D89)', async () => {
		const root = durableOnPi();
		const r = await verificationRejected();
		const from = sessionFileIn(sessionFolderOf(root, 'executor', r.ids.source));
		const before = readFileSync(from, 'utf8');
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const source2 = currentOf(r.u, 'Source').id;
		let places = seam.places.length;
		const turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: source2 })).error, 'the new Source did not run').toBeUndefined();

		expect(seam.places[places], 'the new Source did not open a new file of its own').toEqual({
			kind: 'DURABLE',
			folder: sessionFolderOf(root, 'executor', source2),
			opening: { kind: 'NEW' }
		});
		expect(readFileSync(from, 'utf8'), 'the predecessor’s file was changed').toBe(before);
		expect(seam.turns[turns] ?? '', 'the new Source’s first turn does not say the record of the unit it replaces is in reach').toContain(
			`The unit this one replaces, "Source" (${r.ids.source}), was worked on before, and its conversation is on the record.`
		);
		for (const action of ['recordAssurance', 'markSatisfied'] as const)
			expect((await press(r.u, action, { pwuId: source2 })).error, `arrangement: ${action} on the new Source`).toBeUndefined();
		const tests2 = currentOf(r.u, 'Tests').id;
		places = seam.places.length;

		expect((await press(r.u, 'beginExecute', { pwuId: tests2 })).error, 'the new Tests did not run').toBeUndefined();

		expect(seam.places[places], 'a successor whose predecessor left no file did not open a new file of its own').toEqual({
			kind: 'DURABLE',
			folder: sessionFolderOf(root, 'executor', tests2),
			opening: { kind: 'NEW' }
		});
		// ⭑ The note's name as package L17b1 bound it (`predecessorWithoutSessionNameOf`, gone with the fork), restated: nothing is bound to it now.
		expect(await getArtifactStore().resolveName(`tnt-local/executor-session/${tests2}/predecessor-without-session`), 'a note was recorded for a missing fork').toBeUndefined();
	});

	it('⛔ RED FIRST — two session files in a unit’s folder refuse its start before anything is dispatched, naming the folder', async () => {
		const root = durableOnPi();
		const u = await instantiated(TYPES());
		const spec = u.unitOf('Specification').id;
		const folder = sessionFolderOf(root, 'executor', spec);
		sessionFileIn(folder, 'a.jsonl');
		sessionFileIn(folder, 'b.jsonl');
		const events = getEngine().readAllEvents().length;

		const started = await press(u, 'beginExecute', { pwuId: spec });

		expect(started.error ?? '', 'two files did not refuse the start, naming the folder').toContain(`the session folder ${folder} holds 2 session files`);
		expect(getEngine().readAllEvents().length, 'the refused start dispatched something').toBe(events);
	});

	// ⭐⭐ RESTATED 2026-11-17 (`JAN-EXEC` Phase 7, package L17b3 — design D89): ~~'⛔ RED FIRST — a later try on a forked session is handed what its session
	// held when the step began, and its first turn’s feedback, which it declares (the review’s defect 1)'~~, its expectation ~~`[undefined, 'PREDECESSOR',
	// r.ids.source, true]`~~ (~~'the later try is not handed what its forked session holds'~~) — a replacement's session is a new one since D89, holding
	// nothing when its step begins; what puts another unit's work in reach is the record's tool, on every turn of that session. The promise kept: a later
	// try is handed what its session held when the step began, and its first turn's feedback; and now the record its session's tool reads, its sentence
	// said on the first turn alone.
	it('⛔ RED FIRST — a later try on a replacement’s session is handed what its session held when the step began — ~~a fork~~ ⭐ nothing — and its first turn’s feedback, ⭐ and the record its session’s tool reads, which it declares (the review’s defect 1; D89)', async () => {
		const root = durableOnPi();
		const r = await verificationRejected();
		sessionFileIn(sessionFolderOf(root, 'executor', r.ids.source));
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		// ⭑ The floor refuses the first try's work product with a finding, so the producer is asked again (package N's arrangement).
		let refusedOnce = false;
		seam.review = (prompt) => {
			if (!prompt.includes('The WORK PRODUCT to review') || refusedOnce) return undefined;
			refusedOnce = true;
			const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
			return JSON.stringify({
				findings: ids.map((id, i) =>
					i === 0 ? { criterionId: id, failed: true, statement: 'The reader cannot read a pipe.', severity: 'BLOCKING' } : { criterionId: id, failed: false, statement: 'met' }
				),
				recommendation: 'REJECTED',
				residualUncertainty: []
			});
		};
		const inputs = seam.stepInputs.length;

		expect((await press(r.u, 'beginExecute', { pwuId: currentOf(r.u, 'Source').id })).error, 'the new Source did not run').toBeUndefined();

		const tries = seam.stepInputs.slice(inputs) as {
			readonly stillHeld?: { readonly holds: { readonly kind: string; readonly unitId?: string }; readonly feedback?: { readonly crossUnit: boolean } };
			readonly earlierAttempt?: { readonly sentence?: string; readonly toolMinted: boolean; readonly holds: { readonly answer: boolean; readonly findings: boolean } };
		}[];
		expect(tries.length, 'arrangement: the floor’s finding sent no second try').toBe(2);
		expect(
			[tries[0]?.stillHeld, tries[1]?.stillHeld?.holds.kind, tries[1]?.stillHeld?.feedback?.crossUnit],
			'the later try is not handed what its session held when the step began and its first turn’s feedback'
		).toEqual([undefined, 'NOTHING', true]);
		expect(
			[
				tries[0]?.earlierAttempt?.toolMinted,
				typeof tries[0]?.earlierAttempt?.sentence,
				tries[1]?.earlierAttempt?.toolMinted,
				tries[1]?.earlierAttempt?.sentence,
				tries[1]?.earlierAttempt?.holds.answer
			],
			'a try of the replacement is not handed the record its session’s tool reads, the sentence on its first try alone'
		).toEqual([true, 'string', true, undefined, true]);
	});

	it('⛔ RED FIRST — the session place’s refusal describes whatever value is thrown, through the one describer: a sessions root that throws a value that cannot be described refuses the re-run, said, never an escape (the lead’s ruling (k) on the review’s fifth re-check)', async () => {
		durableOnPi();
		const r = await verificationRejected();
		seam.sessionsRootThrows = { value: Object.create(null) };

		const out = await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it.' }).then(
			(p) => ({ thrown: '', error: p.error ?? '' }),
			(e: unknown) => ({ thrown: saidOf(e), error: '' })
		);
		seam.sessionsRootThrows = undefined;

		expect(out, 'the session place’s refusal threw, or was said wrongly').toEqual({
			thrown: '',
			error: 'Re-running the work its declared reviews rejected refused: a thrown value that cannot be described'
		});
	});

	it('⭑ CONTROL — with no durable store, or an executor that is not Pi, every step is held in memory, as before', async () => {
		const r = await verificationRejected();
		expect(seam.places.length > 0 && seam.places.every((p) => JSON.stringify(p) === JSON.stringify({ kind: 'IN_MEMORY' })), 'a step with no durable store was not held in memory').toBe(true);
		seam.sessionsRoot = join(TMP, `sessions-${++tmpCase}`, 'demo.sqlite.sessions');
		const places = seam.places.length;
		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it.' })).error, 'arrangement: the re-run').toBeUndefined();
		expect(seam.places.slice(places), 'a stand-in’s step was given a session file').toEqual([{ kind: 'IN_MEMORY' }]);
	});
});

// ── ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — designs D89, D90 and D91, through the page ───────────────────────────────────────────────────────────────

/** ⭐ L17b3 (D89) — the context policy the binding of each of the unit's steps names, in the order its plans were made (a step names its binding). */
const bindingPoliciesOf = (pwuId: string): string[] =>
	listByType(getEngine(), 'EXECUTION_PLAN')
		.filter((p) => p.state.workUnitId === pwuId)
		.flatMap((p) => ((p.state.steps as { runtimeBindingId?: unknown }[] | undefined) ?? []).map((s) => s.runtimeBindingId))
		.filter((id): id is string => typeof id === 'string')
		.map((id) => String(getObject(getEngine(), id)?.contextAssemblyPolicyId ?? ''));

describe('⭐⭐ L17b3 (D89; REG-D-173) — through the page: the binding’s policy, the record’s sentence, and the record the roles are given', () => {
	it('⛔ RED FIRST — the page names each step’s context policy: ctx-default for a step outside the loop; ctx-default-loop for a replacement’s, and for D71’s re-run in place where the round’s stage ran; ctx-default for that re-run where it did not (REG-D-173 (2))', async () => {
		const sent = await verificationRejected();
		expect((await sendBackToSource(sent)).error, 'arrangement: the act').toBeUndefined();
		const source2 = currentOf(sent.u, 'Source').id;
		expect((await press(sent.u, 'beginExecute', { pwuId: source2 })).error, 'arrangement: the new Source ran').toBeUndefined();
		const staged = await verificationRejected();
		seam.review = chapterAnswering;
		expect((await press(staged.u, 'runAssuranceStage', { pwuId: staged.ids.verification })).error, 'arrangement: the stage').toBeUndefined();
		seam.onTurn = writesItsTacticRecord(staged.u);
		expect((await press(staged.u, 'rerunRejectedWork', { pwuId: staged.ids.verification, rationale: 'Re-run it.' })).error, 'arrangement: the re-run after the stage').toBeUndefined();
		seam.onTurn = undefined;
		const plain = await verificationRejected();
		expect((await press(plain.u, 'rerunRejectedWork', { pwuId: plain.ids.verification, rationale: 'Re-run it.' })).error, 'arrangement: the re-run with no stage').toBeUndefined();

		expect(
			[
				bindingPoliciesOf(sent.ids.spec),
				bindingPoliciesOf(sent.ids.verification),
				bindingPoliciesOf(source2),
				bindingPoliciesOf(staged.ids.verification),
				bindingPoliciesOf(plain.ids.verification)
			],
			'a step is bound to a policy its kind does not call for'
		).toEqual([['ctx-default'], ['ctx-default'], ['ctx-default-loop'], ['ctx-default', 'ctx-default-loop'], ['ctx-default', 'ctx-default']]);
	});

	it('⛔ RED FIRST — a replacement’s first turn ends with the record’s sentence, naming the unit it replaces, its step granted the record’s capability and handed the record; a unit that is not a replacement is given neither (D89)', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const source2 = currentOf(r.u, 'Source').id;
		const contexts = seam.contexts.length;
		const turns = seam.turns.length;

		expect((await press(r.u, 'beginExecute', { pwuId: source2 })).error, 'the new Source did not run').toBeUndefined();

		const SENTENCE =
			`The unit this one replaces, "Source" (${r.ids.source}), was worked on before, and its conversation is on the record. You can read it with the read_earlier_attempt tool. ` +
			'The feedback above says what that work got wrong; read the record only if you need more detail than the feedback gives — it shows what was tried and failed, ' +
			'so that you do not try it again, unless something material has changed that would let it succeed now.';
		expect((seam.turns[turns] ?? '').endsWith(`\n\n${SENTENCE}`), 'the replacement’s first turn does not end with the record’s sentence').toBe(true);
		const opened = (i: number) => seam.contexts[i] as { readonly grantedCapabilities?: readonly string[]; readonly earlierAttempt?: { readonly units?: readonly { readonly unitId: string }[] } };
		expect(
			[opened(contexts).grantedCapabilities?.includes('earlier-attempt-record'), opened(contexts).earlierAttempt?.units?.map((x) => x.unitId)],
			'the replacement’s step was not granted the record’s capability, or not handed the record of the unit it replaces'
		).toEqual([true, [r.ids.source]]);
		expect(
			[opened(0).grantedCapabilities?.includes('earlier-attempt-record'), opened(0).earlierAttempt],
			'a unit that is not a replacement was granted the record’s capability or handed a record'
		).toEqual([false, undefined]);
	});

	// ⭐⭐ The lead's ruling §10.1 (4) — L17-01 THROUGH THE PAGE: a replaced unit that left NO executor exchange. A try refused before its exchange is
	// captured leaves none — the step's own refusals before its render (`run-model-step.ts`: the binding's, `stepCapabilityRefusal`; the plan's,
	// `prepareModelInvocation` not ready; a throw and a turn with no answer each record one), stood in for at the step's seam (`seam.refuseStepOf`) —
	// and the reach takes a started unit in whatever state (D72): Docs, started and refused, reached by the work sent back to the Specification.
	it('⛔ RED FIRST — a replacement whose line left no record, through the page: its first turn ends with the no-record sentence, it is given no tool, and its step is handed no pair of the record (D89; the review’s L17-01; §10.1 (4))', async () => {
		const u = await instantiated(TYPES());
		await acceptAll(u, ['Specification', 'Source', 'Tests', 'Lint', 'Build']);
		const docs = u.unitOf('Docs').id;
		seam.refuseStepOf = (pwuId) => (pwuId === docs ? 'a try refused before its render (arrangement)' : undefined);
		const refused = await press(u, 'beginExecute', { pwuId: docs });
		seam.refuseStepOf = undefined;
		expect(refused.error ?? '', 'arrangement: Docs started, its only try refused').toContain('a try refused before its render (arrangement)');
		expect(listByType(getEngine(), 'MODEL_EXCHANGE').filter((x) => x.state.subjectObjectId === docs).length, 'arrangement: Docs left no exchange').toBe(0);
		const verification = u.unitOf('Verification').id;
		expect((await press(u, 'beginExecute', { pwuId: verification })).error, 'arrangement: Verification ran').toBeUndefined();
		const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
		seam.answer = (policyId) =>
			policyId === COVERAGE ? answerOf(COVERAGE, { 0: ['NOT_MET', 'The reader cannot read a pipe.'] }, cov[0]) : answerOf(policyId);
		await press(u, 'recordAssurance', { pwuId: verification });
		seam.answer = (policyId) => answerOf(policyId);
		expect(axesOf(verification)[2], 'arrangement: Verification rejected').toBe('REJECTED');
		const sent = await press(u, 'sendWorkBack', { pwuId: verification, targetId: u.unitOf('Specification').id, rationale: TYPED });
		expect(sent.error, 'arrangement: the work sent back to the Specification').toBeUndefined();
		const docs2 = currentOf(u, 'Docs').id;
		expect(docs2, 'arrangement: Docs replaced').not.toBe(docs);
		const spec2 = currentOf(u, 'Specification').id;
		for (const action of ['beginExecute', 'recordAssurance', 'markSatisfied'] as const)
			expect((await press(u, action, { pwuId: spec2 })).error, `arrangement: the new Specification — ${action}`).toBeUndefined();
		const [turns, contexts, inputs] = [seam.turns.length, seam.contexts.length, seam.stepInputs.length];

		expect((await press(u, 'beginExecute', { pwuId: docs2 })).error, 'the new Docs did not run').toBeUndefined();

		const NO_RECORD = 'The unit this one replaces left no recorded conversation.';
		expect((seam.turns[turns] ?? '').endsWith(`\n\n${NO_RECORD}`), 'the first turn of a replacement whose line left no record does not end with the no-record sentence').toBe(true);
		const context = seam.contexts[contexts] as { readonly earlierAttempt?: unknown } | undefined;
		const input = seam.stepInputs[inputs] as { readonly earlierAttempt?: unknown } | undefined;
		expect(
			[context?.earlierAttempt, input?.earlierAttempt],
			'a replacement whose line left no record was handed a record to read, or its step a pair of the record'
		).toEqual([undefined, { sentence: NO_RECORD, toolMinted: false, holds: { answer: false, findings: false } }]);
	});

	// ⭐⭐ STRENGTHENED 2026-11-18 (the independent review's L17-05): ~~one chapter, `expect.arrayContaining(tries)`, and a line holding `ATTEMPT`~~ —
	// TWO chapters, the first over every try before it and the second over the tries since it alone, each set exact; the later try's line its unit,
	// the commands it ran with their exits (`<argv joined> (exit <n>)`, my form) and its answer cut at `STAGE_RECORD_BOUND` and said so. The promise
	// kept: the writer is given the tries by their exchanges' ids, each line naming its unit and holding its answer.
	it('⛔ RED FIRST — the narrative writer is given each executor try since the last chapter, by its exchange’s id: the first chapter every try before it, the second only those since; a try’s line its unit, the commands it ran with their exits, and its answer, cut at 2,000 characters and said so (D89; the review’s L17-05)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		/** The executor tries on the record, by id: each EXECUTION exchange of a unit's model invocation. */
		const tryIds = (): string[] =>
			listByType(getEngine(), 'MODEL_EXCHANGE')
				.filter((x) => x.state.plane === 'EXECUTION' && String(x.state.invokerId ?? '').startsWith('execution.model-invocation'))
				.map((x) => x.id);
		const writerPrompts = (): string[] => seam.prompts.filter((p) => p.includes(WRITER_PROMPT));
		const before = tryIds();
		expect(before.length, 'arrangement: executor tries on the record').toBeGreaterThan(0);

		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the first round’s stage').toBeUndefined();

		// ⭑ A later try: D71's re-run in place, which runs two commands, one failing, and answers past the bound; its sign-off rejected again — a second round.
		seam.onTurn = writesItsTacticRecord(r.u);
		seam.runs = () => [
			{ argv: ['node', '--test'], exitCode: 1 },
			{ argv: ['node', 'bin/wf.js', '-'], exitCode: 0 }
		];
		seam.documentOf = (document) => `${document} ${'R'.repeat(2_400)} PAST-THE-BOUND`;
		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the findings.' })).error, 'arrangement: the re-run').toBeUndefined();
		seam.onTurn = undefined;
		seam.runs = undefined;
		seam.documentOf = undefined;
		const since = tryIds().filter((id) => !before.includes(id));
		expect(since.length, 'arrangement: the re-run’s try on the record').toBeGreaterThan(0);
		const cov = policyOf(COVERAGE).criteria.map((c) => c.id);
		seam.answer = (policyId) =>
			policyId === COVERAGE ? answerOf(COVERAGE, { 0: ['NOT_MET', 'The standard-input mode still exits 1.'] }, cov[0]) : answerOf(policyId);
		await press(r.u, 'recordAssurance', { pwuId: r.ids.verification });
		seam.answer = (policyId) => answerOf(policyId);
		expect(axesOf(r.ids.verification)[2], 'arrangement: the re-run rejected again, a second round').toBe('REJECTED');

		expect((await press(r.u, 'runAssuranceStage', { pwuId: r.ids.verification })).error, 'arrangement: the second round’s stage').toBeUndefined();

		const [first, second] = writerPrompts();
		const triesIn = (prompt: string | undefined): string[] => recordIdsOf(prompt ?? '').filter((id) => tryIds().includes(id)).sort();
		expect([triesIn(first), triesIn(second)], 'a chapter was not given exactly the executor tries since the chapter before it').toEqual([[...before].sort(), [...since].sort()]);
		const later = since.at(-1)!;
		const line = (second ?? '').split('\n').find((l) => l.startsWith(`- [${later}] `)) ?? '';
		expect(
			[
				line.includes(`"Verification" (${r.ids.verification})`),
				line.includes('node --test (exit 1)'),
				line.includes('node bin/wf.js - (exit 0)'),
				line.includes('ATTEMPT'),
				line.includes('… (cut at 2000 characters)'),
				line.includes('PAST-THE-BOUND')
			],
			'a try’s line does not name its unit, the commands it ran with their exits, or its answer cut at the bound and said so'
		).toEqual([true, true, true, true, true, false]);
	});

	// ⭐⭐ STRENGTHENED 2026-11-18 (the independent review's L17-04): ~~two names `expect.arrayContaining`, the prompt naming them, the shared workspace
	// clean~~ — the stage run on a recurrence over Verification and Docs, so the two helpers' sets differ: the Hypothesizer's copy holding EXACTLY the
	// rejected unit's and each candidate's record (D72's candidates: the Specification, Build, Source, Tests and Lint), Docs and the root not among
	// them; the Unsticking Agent's EXACTLY the rejected unit's and the recurrence's other unit's, Docs (D75), no candidate among them; each file the
	// unit's rendering from the record, read at the helper's turn; each named in its prompt; each copy removed after, and the shared workspace clean.
	// ⭑ "The units the recurrence names" read as its subjects (an observation's, inherited from its assessment, `assurance.ts`'s
	// `recordAssuranceObservation`) — my reading, said in §8. ⭑ A file holds the unit's parts joined by a blank line — mine, said in §8.
	it('⛔ RED FIRST — on Pi, the Hypothesizer is given the recorded conversations of the rejected unit and of each candidate, and the Unsticking Agent, on a recurrence, those of the rejected unit and of each unit the recurrence names — exactly those, each file the unit’s rendering from the record, named in its prompt, the copies removed after; none reaches the shared workspace (D89; REG-D-173 (5); the review’s L17-04)', async () => {
		const r = await verificationRejected();
		seam.review = chapterAnswering;
		// ⭑ The recurrence's assessment under the page's own demo policy, as its evidence journey opens one (`openAssessmentFor`) — never under one of
		// Verification's declared policies, where a further request would unseat its REJECTED verdict (`declared-assurance.ts`, its header's item 1).
		if (getObject(getEngine(), DEMO_POLICY_ID) === undefined)
			for (const [commandType, payload] of [
				['CreateAssurancePolicy', DEMO_POLICY_PAYLOAD],
				['ActivateAssurancePolicy', { policyId: DEMO_POLICY_ID }]
			] as const)
				expect(dispatch(commandType, 'ASSURANCE_POLICY', DEMO_POLICY_ID, payload).status, `arrangement: ${commandType}`).toBe('ACCEPTED');
		const assessmentId = mintUiId('asm');
		const versionOf = (id: string) => Number((getObject(getEngine(), id) ?? {}).semanticVersion ?? 1);
		const requested = dispatch('RequestAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {
			assessmentId,
			assurancePolicyId: DEMO_POLICY_ID,
			policyVersion: DEMO_POLICY_VERSION,
			subjectObjectIds: [r.ids.verification, r.ids.docs],
			subjectSemanticVersions: { [r.ids.verification]: versionOf(r.ids.verification), [r.ids.docs]: versionOf(r.ids.docs) },
			claimIds: []
		});
		expect(requested.status, `arrangement: an assessment of Verification and Docs — ${requested.error?.message ?? ''}`).toBe('ACCEPTED');
		const recurrence = dispatch('RecordAssuranceObservation', 'ASSURANCE_OBSERVATION', mintUiId('obs'), {
			assessmentId,
			observationType: 'FINDING',
			findingCode: 'KNOWN_FAILURE_RECURRENCE',
			severity: 'INFORMATIONAL',
			statement: 'The standard-input mode fails again, and the documented usage with it.'
		});
		expect(recurrence.status, `arrangement: the recurrence — ${recurrence.error?.message ?? ''}`).toBe('ACCEPTED');
		const pi = onPi({ diagnosis: DIAGNOSIS.replaceAll('SOURCE', r.ids.source), stepBack: STEP_BACK });

		const done = await runAssuranceStage(r.ids.verification, pi.deps);

		expect('parts' in done && done.parts.map((p) => [p.part, p.status]), 'arrangement: both helpers ran').toEqual([
			['narrative-chapter', 'recorded'],
			['fault-diagnosis', 'recorded'],
			['step-back', 'recorded']
		]);
		const fileOf = (title: string, id: string) => `${title.toLowerCase()}--${id}.md`;
		const hypothesizer = [
			['Verification', r.ids.verification],
			['Specification', r.ids.spec],
			['Build', r.ids.build],
			['Source', r.ids.source],
			['Tests', r.ids.tests],
			['Lint', r.ids.lint]
		] as const;
		const unsticking = [
			['Verification', r.ids.verification],
			['Docs', r.ids.docs]
		] as const;
		expect(
			[pi.asked[0]?.recordFiles, pi.asked[1]?.recordFiles],
			'a helper’s copy did not hold exactly the records of the units it judges at its turn'
		).toEqual([hypothesizer.map(([t, id]) => fileOf(t, id)).sort(), unsticking.map(([t, id]) => fileOf(t, id)).sort()]);
		for (const [i, set] of [hypothesizer, unsticking].entries())
			for (const [title, id] of set)
				expect(pi.asked[i]?.prompt, `a helper’s prompt does not name the record of ${title}`).toContain(`- ${id} "${title}": .jpwb/record/${fileOf(title, id)}`);
		expect(
			pi.asked.map((a) => existsSync(a.dir ?? '')),
			'a helper’s copy, and the record files in it, was not removed after its turn'
		).toEqual([false, false]);
		expect(existsSync(join(pi.dir, '.jpwb', 'record')), 'a record file reached the shared workspace').toBe(false);
		// ⭑ Each file the unit's own rendering, from the record — read through the renderer the tool serves (imported here, at the case, so the file loads
		// before the package's module exists).
		const record = await import('./earlier-attempt-record.js');
		const rows = record.recordRowsOf(getEngine());
		for (const [i, set] of [hypothesizer, unsticking].entries())
			for (const [title, id] of set)
				expect(pi.asked[i]?.recordTexts[fileOf(title, id)], `the file of ${title} is not its recorded conversation, rendered`).toBe(
					record.renderUnitConversation(await record.unitConversationOf(rows, getArtifactStore(), 'tnt-local', id)).join('\n\n')
				);
	});

	// ⭐⭐ The independent review's L17-06 — THE BINDING'S POLICY AT EVERY MINTING SITE: RD8's re-run of a stopped unit (`rerunWork`, the page's plan
	// revision) by the same rule as Begin & Execute and D71's re-run — ctx-default for a unit outside the loop, ctx-default-loop for a replacement's
	// every step; and a step on a reopened file that holds D77's feedback bound to ctx-default-loop at D71's re-run and at RD8's (REG-D-173 (2)).
	/** The floor's review of a try's work product failing at its transport, while `down()` says so: the unit stops, waiting (RD3). */
	const transportDownWhile = (down: () => boolean) => {
		seam.review = (prompt) => {
			if (down() && prompt.includes('The WORK PRODUCT to review')) throw new Error('devin exited with code 1: connection reset by peer');
			return chapterAnswering(prompt);
		};
	};
	/** `pwuId`'s first step stopped at its review's transport, then RD8's re-run of it: what the re-run answered. */
	async function stoppedThenRerun(u: Fixture, pwuId: string, beforeRerun?: () => void) {
		let down = true;
		transportDownWhile(() => down);
		const first = await press(u, 'beginExecute', { pwuId });
		expect(first.error ?? '', 'arrangement: the step stopped at its review’s transport').toMatch(/VALIDATOR_EXECUTION_FAILED/);
		down = false;
		beforeRerun?.();
		return press(u, 'rerunWork', { pwuId, rationale: 'The reviewer failed at the transport; run the work again.' });
	}
	it('⛔ RED FIRST — RD8’s re-run of a stopped unit names its step’s policy by the same rule: ctx-default for a unit outside the loop, ctx-default-loop for a replacement’s (the review’s L17-06; REG-D-173 (2))', async () => {
		const { u, spec } = await aSpecification();
		expect((await stoppedThenRerun(u, spec)).advanced, 'arrangement: the Specification’s work re-run').toBe('work-rerun');
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const source2 = currentOf(r.u, 'Source').id;
		expect((await stoppedThenRerun(r.u, source2)).advanced, 'arrangement: the new Source’s work re-run').toBe('work-rerun');

		expect([bindingPoliciesOf(spec), bindingPoliciesOf(source2)], 'RD8’s re-run bound its step to a policy its kind does not call for').toEqual([
			['ctx-default', 'ctx-default'],
			['ctx-default-loop', 'ctx-default-loop']
		]);
	});

	it('⛔ RED FIRST — a step on a reopened file that holds D77’s feedback is bound to ctx-default-loop: at D71’s re-run with no stage run, and at RD8’s re-run of a unit outside the loop (the review’s L17-06; D89)', async () => {
		const root = durableHere();
		const holdingFeedback = (pwuId: string) =>
			sessionFileWith(sessionFolderOf(root, 'executor', pwuId), [
				{ user: `Write the work.\n\n${FEEDBACK_HEADING}\n- The round’s failed criterion.`, assistant: 'The work.', stopReason: 'stop' }
			]);
		const r = await verificationRejected();
		holdingFeedback(r.ids.verification);
		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it.' })).error, 'arrangement: the re-run').toBeUndefined();
		const { u, spec } = await aSpecification();
		expect((await stoppedThenRerun(u, spec, () => holdingFeedback(spec))).advanced, 'arrangement: the work re-run').toBe('work-rerun');

		expect(
			[bindingPoliciesOf(r.ids.verification), bindingPoliciesOf(spec)],
			'a step on a reopened file holding the loop’s feedback was not bound to the loop’s policy'
		).toEqual([
			['ctx-default', 'ctx-default-loop'],
			['ctx-default', 'ctx-default-loop']
		]);
	});

	// ⭐ L17b3 — the lead's ruling 4 (§16; the independent review's L17C-04), THROUGH THE PAGE: a replacement's later step reads its reopened file against
	// the sentence its step would say (`sessionPlaceFor`, `executorSessionPlaceOf(root, unit, sentence)`), so a file whose first turn ended with it is not
	// told again, and one whose first turn did not is. ⭑ Written after the code, for the round's mutant P6X-L17B3-M60 (the page passing no sentence),
	// which no test reached: run-model-step's own test of ruling 4 reads its file through `executorSessionPlaceOf` itself, never through the page.
	it('⭑ CONTROL — a replacement’s later step on its reopened file does not say the record’s sentence again where the file’s first turn ended with it, and says it where the first turn did not (the lead’s ruling 4)', async () => {
		const root = durableHere();
		/** A replacement's first step, stopped at its review's transport; its file as Pi leaves one, its first turn as sent or without the sentence; then RD8's re-run's first turn. */
		const laterTurn = async (toldInFile: boolean) => {
			const r = await verificationRejected();
			expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
			const source2 = currentOf(r.u, 'Source').id;
			const sentence =
				`The unit this one replaces, "Source" (${r.ids.source}), was worked on before, and its conversation is on the record. You can read it with the read_earlier_attempt tool. ` +
				'The feedback above says what that work got wrong; read the record only if you need more detail than the feedback gives — it shows what was tried and failed, ' +
				'so that you do not try it again, unless something material has changed that would let it succeed now.';
			const turns = seam.turns.length;
			let first = '';
			let rerunFrom = 0;
			const rerun = await stoppedThenRerun(r.u, source2, () => {
				first = seam.turns[turns] ?? '';
				rerunFrom = seam.turns.length;
				const inFile = toldInFile ? first : first.slice(0, first.length - `\n\n${sentence}`.length);
				sessionFileWith(sessionFolderOf(root, 'executor', source2), [{ user: inFile, assistant: 'The work.', stopReason: 'stop' }]);
			});
			expect(first.endsWith(`\n\n${sentence}`), 'arrangement: the replacement’s first turn ended with the record’s sentence').toBe(true);
			expect(rerun.advanced, 'arrangement: the new Source’s work re-run').toBe('work-rerun');
			return { again: seam.turns[rerunFrom] ?? '', sentence };
		};
		const told = await laterTurn(true);
		const untold = await laterTurn(false);

		expect(told.again.includes(told.sentence), 'a replacement’s later step on a file whose first turn ended with the record’s sentence said it again').toBe(false);
		expect(
			untold.again.endsWith(`\n\n${untold.sentence}`),
			'a replacement’s later step on a file whose first turn did not end with the record’s sentence did not say it'
		).toBe(true);
	});
});

/** ⭐ L17b3 (the review's L17-06, L17-09) — a serving store's sessions root for one case, and Pi selected (its producer still the scripted one, which writes no file). */
function durableHere(): string {
	const root = join(TMP, `sessions-${++tmpCase}`, 'demo.sqlite.sessions');
	seam.sessionsRoot = root;
	vi.stubEnv('JPWB_EXECUTOR', 'pi');
	vi.stubEnv('JPWB_EXECUTOR_MODEL', 'faux/model');
	return root;
}

/**
 * ⭐ L17b3 (the review's L17-06, L17-09) — a session file in `folder`, as Pi writes one: its header, then each turn's user entry and its answer, ended
 * as `stopReason` says, each the child of the one before (L17b1's `sessionFileIn`, its turns given).
 */
// ⭐ L17b3 (the lead's ruling 2) — a turn may be given with no answer (`assistant` absent): its user entry alone, as Pi's file holds one whose answer
// never landed; every other turn as before.
function sessionFileWith(folder: string, turns: readonly { readonly user: string; readonly assistant?: string; readonly stopReason?: string }[]): string {
	mkdirSync(folder, { recursive: true });
	const file = join(folder, '2026-11-16T00-00-00-000Z_s.jsonl');
	const lines: unknown[] = [{ type: 'session', version: 3, id: 's', timestamp: '2026-11-16T00:00:00.000Z', cwd: TMP }];
	let parentId: string | null = null;
	for (const [i, t] of turns.entries()) {
		const u: { readonly id: string } & Record<string, unknown> = { type: 'message', id: `u${i + 1}`, parentId, timestamp: '2026-11-16T00:00:01.000Z', message: { role: 'user', content: [{ type: 'text', text: t.user }], timestamp: 1 } };
		const a: { readonly id: string } & Record<string, unknown> = {
			type: 'message',
			id: `a${i + 1}`,
			parentId: u.id,
			timestamp: '2026-11-16T00:00:02.000Z',
			message: { role: 'assistant', content: [{ type: 'text', text: t.assistant }], stopReason: t.stopReason, timestamp: 2 }
		};
		lines.push(...(t.assistant === undefined ? [u] : [u, a]));
		parentId = t.assistant === undefined ? u.id : a.id;
	}
	writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
	return file;
}

/** ⭐ L17b3 (D90, D91) — a fresh Undertaking of the fixture PWA, and its Specification, a model's unit no other depends on yet. */
async function aSpecification(): Promise<{ readonly u: Fixture; readonly spec: string }> {
	const u = await instantiated(TYPES());
	return { u, spec: u.unitOf('Specification').id };
}
/** ⭐ L17b3 (D90) — whether a batch asks to record a step's failure. */
const failing = (commands: readonly { readonly commandType: string }[]): boolean => commands.some((c) => c.commandType === 'FailExecutionStep');
/** ⭐ L17b3 (D90) — whether a batch records a try's work product. */
const recordingTheWorkProduct = (commands: readonly { readonly commandType: string; readonly payload: Record<string, unknown> }[]): boolean =>
	commands.some((c) => c.commandType === 'RecordArtifact' && c.payload.artifactType === 'work-product');

describe('⭐⭐ L17b3 (D90; REG-F-650) — a started model step records its failure on every way out of a try', () => {
	it('⛔ RED FIRST — a work product the record refuses fails the step with its reason, and the refusal still answers the page', async () => {
		const { u, spec } = await aSpecification();
		seam.refuseBatch = (commands) => (recordingTheWorkProduct(commands) ? 'the store refused the work product' : undefined);

		const begun = await press(u, 'beginExecute', { pwuId: spec });

		expect((begun.error ?? '').split(':')[0], 'arrangement: the work product’s record was refused').toBe('Recording the work product failed');
		expect(latestStepOf(spec), 'the step was left RUNNING, or failed with no reason').toEqual({
			stepState: 'FAILED',
			failed: [expect.stringContaining('the store refused the work product')]
		});
	});

	it('⛔ RED FIRST — a command the evidence join refuses fails the step with its reason, and the refusal still answers the page', async () => {
		const { u, spec } = await aSpecification();
		seam.refuseJoin = 'the evidence batch was refused';

		const begun = await press(u, 'beginExecute', { pwuId: spec });

		expect(begun.error ?? '', 'arrangement: the evidence was refused').toContain('could not be recorded as evidence: the evidence batch was refused');
		expect(latestStepOf(spec), 'the step was left RUNNING, or failed with no reason').toEqual({
			stepState: 'FAILED',
			failed: [expect.stringContaining('the evidence batch was refused')]
		});
	});

	it('⛔ RED FIRST — an exception that escapes a try fails the step, the exception described, and still goes on as the same value', async () => {
		const { u, spec } = await aSpecification();
		const escaped = new Error('the process runs could not be read');
		seam.processRunsThrows = { value: escaped };

		const caught = await press(u, 'beginExecute', { pwuId: spec }).then(
			() => 'returned',
			(e: unknown) => e
		);

		expect(caught, 'the exception that escaped is not the one thrown').toBe(escaped);
		expect(latestStepOf(spec), 'the step was left RUNNING, or failed with no reason').toEqual({
			stepState: 'FAILED',
			failed: [expect.stringContaining('the process runs could not be read')]
		});
	});

	it('⛔ RED FIRST — the two refusals’ failure, refused or thrown by the store, is said beside the refusal, the refusal’s own reason still the answer, and nothing escapes', async () => {
		const seen: { readonly error: string; readonly thrown: string }[] = [];
		for (const [way, recording] of [
			['work-product', 'refused'],
			['work-product', 'throws'],
			['evidence', 'refused'],
			['evidence', 'throws']
		] as const) {
			const { u, spec } = await aSpecification();
			seam.refuseBatch = (commands) => {
				if (way === 'work-product' && recordingTheWorkProduct(commands)) return 'the store refused the work product';
				return recording === 'refused' && failing(commands) ? 'the store refused the failure' : undefined;
			};
			if (way === 'evidence') seam.refuseJoin = 'the evidence batch was refused';
			if (recording === 'throws') seam.throwBatch = { when: failing, error: new Error('the store could not be written') };

			seen.push(
				await press(u, 'beginExecute', { pwuId: spec }).then(
					(p) => ({ error: p.error ?? '', thrown: '' }),
					(e: unknown) => ({ error: '', thrown: saidOf(e) })
				)
			);

			seam.refuseBatch = undefined;
			seam.refuseJoin = undefined;
			seam.throwBatch = undefined;
			expect(latestStepOf(spec).stepState, `arrangement: nothing could record ${way}’s failure`).toBe('RUNNING');
		}

		expect(seen.map((s) => s.thrown), 'a failure the store threw on escaped in the refusal’s place').toEqual(['', '', '', '']);
		// ⭐ STRENGTHENED 2026-11-18 (the independent review's L17-13): ~~`s.error.split(':')[0]` and two `includes`~~ — each answer whole: the refusal with
		// its own reason, then the recording's failure beside it (the page's `batchError` form, `<command>: <message>`, for one the store refused; the one
		// describer's for one it threw), so a refusal that lost its reason is seen.
		const workProduct = 'Recording the work product failed: RecordArtifact: the store refused the work product';
		const evidence = 'The model ran 0 command(s) and one could not be recorded as evidence: the evidence batch was refused';
		expect(seen.map((s) => s.error), 'the refusal with its own reason is not the answer, or the failure’s recording is not said beside it').toEqual([
			`${workProduct} — and the failure could not be recorded: FailExecutionStep: the store refused the failure`,
			`${workProduct} — and the failure could not be recorded: the store could not be written`,
			`${evidence} — and the failure could not be recorded: FailExecutionStep: the store refused the failure`,
			`${evidence} — and the failure could not be recorded: the store could not be written`
		]);
	});

	it('⛔ RED FIRST — an exception’s failure, refused or thrown by the store, is named on the exception, which still goes on as the same value', async () => {
		const seen: { readonly same: boolean; readonly message: string; readonly step: unknown }[] = [];
		for (const recording of ['refused', 'throws'] as const) {
			const { u, spec } = await aSpecification();
			const escaped = new Error('the process runs could not be read');
			seam.processRunsThrows = { value: escaped };
			if (recording === 'refused') seam.refuseBatch = (commands) => (failing(commands) ? 'the store refused the failure' : undefined);
			else seam.throwBatch = { when: failing, error: new Error('the store could not be written') };

			const caught = await press(u, 'beginExecute', { pwuId: spec }).then(
				() => 'returned',
				(e: unknown) => e
			);

			seam.processRunsThrows = undefined;
			seam.refuseBatch = undefined;
			seam.throwBatch = undefined;
			seen.push({ same: caught === escaped, message: escaped.message, step: latestStepOf(spec).stepState });
		}

		expect(seen.map((s) => s.same), 'the exception that escaped is not the one thrown').toEqual([true, true]);
		// ⭐ AMENDED AT STAGE 2 (the builder's instrument defect, of L17-13's class; `l17b3-facts.md` §12): ~~`'the failure could not be recorded: the store
		// refused the failure'`~~ — a recording the store refuses is said in the page's form, `<command>: <message>` (`batchError`), as package N's refused
		// recordings are said (D90) and as the two refusals' test pins it; a thrown one by the one describer. Red at the base either way: nothing is named.
		expect(
			[
				seen[0]!.message.includes('the failure could not be recorded: FailExecutionStep: the store refused the failure'),
				seen[1]!.message.includes('the failure could not be recorded: the store could not be written')
			],
			'the failure’s recording is not named on the exception'
		).toEqual([true, true]);
		expect(seen.map((s) => [s.message.startsWith('the process runs could not be read'), s.step]), 'the exception’s own message was replaced, or a failure was recorded').toEqual([
			[true, 'RUNNING'],
			[true, 'RUNNING']
		]);
	});

	it('⛔ RED FIRST — the refused invocation’s failure, refused or thrown by the store, is said beside its refusal, never in its place (the lead’s ruling 13)', async () => {
		const seen: { readonly error: string; readonly thrown: string }[] = [];
		for (const recording of ['refused', 'throws'] as const) {
			const { u, spec } = await aSpecification();
			seam.onTurn = async () => {
				throw new Error('the provider is unreachable');
			};
			if (recording === 'refused') seam.refuseBatch = (commands) => (failing(commands) ? 'the store refused the failure' : undefined);
			else seam.throwBatch = { when: failing, error: new Error('the store could not be written') };

			seen.push(
				await press(u, 'beginExecute', { pwuId: spec }).then(
					(p) => ({ error: p.error ?? '', thrown: '' }),
					(e: unknown) => ({ error: '', thrown: saidOf(e) })
				)
			);

			seam.onTurn = undefined;
			seam.refuseBatch = undefined;
			seam.throwBatch = undefined;
		}

		expect(seen.map((s) => s.thrown), 'a failure the store threw on escaped in the refusal’s place').toEqual(['', '']);
		// ⭐ STRENGTHENED 2026-11-18 (the independent review's L17-13): ~~the prefix and two `includes`~~ — each answer whole, the invocation's own reason
		// (`the provider is unreachable`, as the scripted turn threw it) kept before the recording's failure.
		const refused = 'The model invocation did not run: The model call failed: the provider is unreachable';
		expect(seen.map((s) => s.error), 'the refused invocation with its own reason is not the answer, or its failure’s recording is not said beside it').toEqual([
			`${refused} — and the failure could not be recorded: FailExecutionStep: the store refused the failure`,
			`${refused} — and the failure could not be recorded: the store could not be written`
		]);
	});

	// ⭐ STRENGTHENED 2026-11-18 (the independent review's L17-14): ~~the failure EVENTS counted~~ — the `FailExecutionStep` REQUESTS counted, so a
	// second request the store refused is seen; and a third case, package N's failure RECORDED and an exception after it (the batch committed, then
	// throwing), so the catch meets a step whose failure is already on the record. The promises kept: recorded once; asked once, the exception going on.
	it('⭑ CONTROL — a step whose failure was asked for on its way out is not failed again: package N’s failure, recorded once; and one whose recording threw, asked once, the exception going on', async () => {
		const recorded = await aSpecification();
		seam.onTurn = async () => {
			seam.listThrows = 'a file was removed between the walk and its stat';
		};
		let requested = 0;
		seam.refuseBatch = (commands) => {
			if (failing(commands)) requested += 1;
			return undefined;
		};
		await press(recorded.u, 'beginExecute', { pwuId: recorded.spec });
		seam.listThrows = undefined;
		seam.refuseBatch = undefined;
		expect(latestStepOf(recorded.spec), 'package N’s failure was not recorded once').toEqual({
			stepState: 'FAILED',
			failed: ["the host could not read the unit's workspace after try 1: a file was removed between the walk and its stat"]
		});
		expect(requested, 'the step’s failure was asked for more than once').toBe(1);

		// ⭑ Package N's failure recorded, and an exception after it: the batch committed, then throwing, as a store that wrote and then failed would.
		const committed = await aSpecification();
		seam.onTurn = async () => {
			seam.listThrows = 'a file was removed between the walk and its stat';
		};
		let asked2 = 0;
		const afterTheCommit = new Error('the store wrote the failure, then could not be read back');
		seam.throwAfterCommit = {
			when: (commands) => {
				if (!failing(commands)) return false;
				asked2 += 1;
				return true;
			},
			error: afterTheCommit
		};
		const caught2 = await press(committed.u, 'beginExecute', { pwuId: committed.spec }).then(
			() => 'returned',
			(e: unknown) => e
		);
		seam.onTurn = undefined;
		seam.listThrows = undefined;
		seam.throwAfterCommit = undefined;
		expect(
			[caught2 === afterTheCommit, asked2, latestStepOf(committed.spec).failed.length],
			'a step whose failure was on the record was failed again, or the exception after it did not go on'
		).toEqual([true, 1, 1]);

		const threw = await aSpecification();
		// ⭑ Package N's failure again, its own recording throwing as a store that cannot be written does: the exception the catch sees.
		seam.onTurn = async () => {
			seam.listThrows = 'a file was removed between the walk and its stat';
		};
		let asked = 0;
		const afterItsEnd = new Error('the store could not be written');
		seam.throwBatch = {
			when: (commands) => {
				if (!failing(commands)) return false;
				asked += 1;
				return true;
			},
			error: afterItsEnd
		};
		const caught = await press(threw.u, 'beginExecute', { pwuId: threw.spec }).then(
			() => 'returned',
			(e: unknown) => e
		);
		seam.onTurn = undefined;
		seam.listThrows = undefined;
		seam.throwBatch = undefined;
		expect([caught === afterItsEnd, asked], 'the step’s failure was asked for again, or the exception did not go on').toEqual([true, 1]);
	});

	// ⭐⭐ The independent review's L17-14 — THE ORDER D90 STATES, and only it: each way's failure asked for after the step's end (the producer's close,
	// and its last take where it takes one) and before the page is answered, or the exception goes on.
	it('⛔ RED FIRST — each way out asks for the step’s failure after the step’s end and before its answer: a work product refused, a command’s evidence refused, an exception (D90; the review’s L17-14)', async () => {
		const orders: unknown[] = [];
		for (const way of ['work-product', 'evidence', 'exception'] as const) {
			const { u, spec } = await aSpecification();
			if (way === 'work-product') seam.refuseBatch = (commands) => (recordingTheWorkProduct(commands) ? 'the store refused the work product' : undefined);
			if (way === 'evidence') seam.refuseJoin = 'the evidence batch was refused';
			if (way === 'exception') seam.processRunsThrows = { value: new Error('the process runs could not be read') };
			seam.trace.length = 0;

			await press(u, 'beginExecute', { pwuId: spec }).then(
				() => undefined,
				() => undefined
			);
			seam.trace.push('answered');

			seam.refuseBatch = undefined;
			seam.refuseJoin = undefined;
			seam.processRunsThrows = undefined;
			const at = (what: string) => seam.trace.indexOf(what);
			const lastEnd = Math.max(seam.trace.lastIndexOf('close'), seam.trace.lastIndexOf('take-at-end'));
			orders.push([way, at('fail-request') > lastEnd && lastEnd >= 0, at('fail-request') >= 0 && at('fail-request') < at('answered')]);
		}
		expect(orders, 'a way out did not ask for the failure after the step’s end, or not before it answered').toEqual([
			['work-product', true, true],
			['evidence', true, true],
			['exception', true, true]
		]);
	});

	it('⭑ CONTROL — a try that reaches its review records what it records today: its step SUCCEEDED, no failure recorded', async () => {
		const { u, spec } = await aSpecification();
		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();
		expect(latestStepOf(spec), 'a try that reached its review recorded a failure').toEqual({ stepState: 'SUCCEEDED', failed: [] });
	});
});

describe('⭐⭐ L17b3 (D91; REG-F-649) — through the page: a repair after an answer its session does not hold sends the reviewed work again', () => {
	const INTRO = 'The work product the review judged is below. This conversation does not hold it, so it is given again here:';
	const RATIONALE_LINE = 'Its rationale, as you gave it with that work product:';
	const REPAIR_OPENING = 'An independent assurance review of the work product you just produced found the following:';
	/**
	 * The floor refuses each try's work product with as many open findings as `perTry` says — none, a clean review — in order (package N's arrangement);
	 * `afterReview` runs after the try it names is reviewed.
	 */
	const floorRefusing = (perTry: readonly number[], afterReview?: (reviewed: number) => void) => {
		let reviewed = 0;
		seam.review = (prompt) => {
			if (!prompt.includes('The WORK PRODUCT to review')) return undefined;
			const open = perTry[reviewed] ?? 0;
			reviewed += 1;
			afterReview?.(reviewed);
			if (open === 0) return undefined;
			const ids = [...prompt.matchAll(/^- ([A-Za-z0-9_-]+): .* \[if unmet: [A-Z]+\]$/gm)].map((m) => m[1]!);
			return JSON.stringify({
				findings: ids.map((id, i) =>
					i < open ? { criterionId: id, failed: true, statement: `The work misses point ${i + 1}.`, severity: 'BLOCKING' } : { criterionId: id, failed: false, statement: 'met' }
				),
				recommendation: 'REJECTED',
				residualUncertainty: []
			});
		};
	};
	/** The stops a try's answer was gathered from, by the try: each one message, ended as `stops` says (`stop` past its end). */
	const gatheredFromEach = (stops: readonly (readonly string[])[]) => {
		seam.gatheredFrom = (n) => (stops[n - 1] ?? ['stop']).map((stopReason) => ({ stopReason }));
	};
	/** The resend the page handed a try, as the step's input carries it. */
	const resendOf = (input: unknown) =>
		(input as { readonly resend?: { readonly workProduct: string; readonly rationale?: string; readonly sessionHoldsAnEarlierAnswer: boolean } }).resend;
	/** The storage key a reference the latest EXECUTION exchange of `pwuId` holds names (`answerSpanRef`), or its last work product's. */
	const spanKeyOfTheLatestTry = (pwuId: string): string | undefined => {
		const x = listByType(getEngine(), 'MODEL_EXCHANGE')
			.filter((e) => e.state.plane === 'EXECUTION' && e.state.subjectObjectId === pwuId)
			.at(-1);
		return (x?.state.answerSpanRef as { readonly storageKey?: string } | undefined)?.storageKey;
	};
	const workProductKeyOf = (pwuId: string): string | undefined =>
		listByType(getEngine(), 'ARTIFACT')
			.filter((a) => a.state.artifactType === 'work-product' && a.state.producingPwuId === pwuId)
			.map((a) => String(a.state.storageKey))
			.at(-1);

	it('⛔ RED FIRST — a repair after an answer that ended in an error sends the reviewed work before its findings, its rationale beside it (D91)', async () => {
		const { u, spec } = await aSpecification();
		// ⭐ L17-10 — the reviewed try's work product's bytes, read from the store as the review left them, independently of the page.
		let reviewedKey: string | undefined;
		floorRefusing([1], (reviewed) => {
			if (reviewed === 1) reviewedKey = workProductKeyOf(spec);
		});
		gatheredFromEach([['error']]);
		const turns = seam.turns.length;
		const inputs = seam.stepInputs.length;

		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

		const repair = seam.turns[turns + 1] ?? '';
		expect(repair, 'the repair did not send the reviewed work first').toContain(`${INTRO}\n\n`);
		expect(
			[repair.startsWith(INTRO), repair.includes('ATTEMPT 1: Write the Specification.'), repair.includes(RATIONALE_LINE), repair.includes('An account.'), repair.indexOf(REPAIR_OPENING) > repair.indexOf('ATTEMPT 1')],
			'the repair does not open with the work the review judged, its rationale beside it, the findings after'
		).toEqual([true, true, true, true, true]);
		expect(resendOf(seam.stepInputs[inputs + 1])?.sessionHoldsAnEarlierAnswer, 'the session was said to hold an earlier answer').toBe(false);
		// ⭐ STRENGTHENED 2026-11-18 (the independent review's L17-10): ~~a substring of the work~~ — the reviewed bytes whole, as the store holds them: the
		// step's input carries them, and the turn sends them, between the introduction and the rationale's line.
		const reviewed = (await getArtifactStore().get(reviewedKey ?? '')) ?? '(the reviewed work product is not in the store)';
		expect(
			[resendOf(seam.stepInputs[inputs + 1])?.workProduct, repair.startsWith(`${INTRO}\n\n${reviewed}\n\n${RATIONALE_LINE}\n\n`)],
			'the work sent again is not the reviewed work product’s bytes, whole'
		).toEqual([reviewed, true]);
	});

	it('⛔ RED FIRST — a repair after an aborted answer sends it too', async () => {
		const { u, spec } = await aSpecification();
		floorRefusing([1]);
		gatheredFromEach([['aborted']]);
		const turns = seam.turns.length;

		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

		expect((seam.turns[turns + 1] ?? '').startsWith(`${INTRO}\n\n`), 'the repair did not send the reviewed work first').toBe(true);
	});

	it('⛔ RED FIRST — a try whose answer was gathered from a reply Pi does not replay and the one after it sends the work too: every message the answer was gathered from is asked', async () => {
		const { u, spec } = await aSpecification();
		floorRefusing([1]);
		gatheredFromEach([['error', 'stop']]);
		const turns = seam.turns.length;

		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

		expect((seam.turns[turns + 1] ?? '').startsWith(`${INTRO}\n\n`), 'the repair did not send the reviewed work first').toBe(true);
	});

	it('⛔ RED FIRST — a session that holds an earlier answer but not the reviewed one sends the reviewed one, saying the session holds an earlier answer', async () => {
		const { u, spec } = await aSpecification();
		// ⭑ Two findings, then one: the trend converges, so a third try is allowed (`mayRetry`).
		floorRefusing([2, 1]);
		gatheredFromEach([['stop'], ['error']]);
		const turns = seam.turns.length;
		const inputs = seam.stepInputs.length;

		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

		expect(seam.stepInputs.length - inputs, 'arrangement: three tries').toBe(3);
		expect(
			[resendOf(seam.stepInputs[inputs + 1]), resendOf(seam.stepInputs[inputs + 2])?.sessionHoldsAnEarlierAnswer],
			'the repair after a replayed answer sent it again, or the one after an errored answer did not say the session holds an earlier one'
		).toEqual([undefined, true]);
		const third = seam.turns[turns + 2] ?? '';
		expect([third.startsWith(`${INTRO}\n\n`), third.includes(`ATTEMPT 1: ${REPAIR_OPENING}`)], 'the third try was not sent the second’s work, the work the review judged').toEqual([
			true,
			true
		]);
	});

	it('⛔ RED FIRST — a retained answer span that cannot be read back to give the reviewed work product sends the work product alone, no rationale declared', async () => {
		const { u, spec } = await aSpecification();
		floorRefusing([1], (reviewed) => {
			if (reviewed !== 1) return;
			const span = spanKeyOfTheLatestTry(spec);
			seam.unreadable = (key) => key === span;
		});
		gatheredFromEach([['error']]);
		const turns = seam.turns.length;
		const inputs = seam.stepInputs.length;

		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

		const repair = seam.turns[turns + 1] ?? '';
		expect([repair.startsWith(`${INTRO}\n\n`), repair.includes(RATIONALE_LINE), resendOf(seam.stepInputs[inputs + 1])?.rationale], 'the work product did not go alone').toEqual([
			true,
			false,
			undefined
		]);
	});

	it('⛔ RED FIRST — a work product that cannot be read back whole fails the step with its reason (D90), never a turn without it', async () => {
		const { u, spec } = await aSpecification();
		floorRefusing([1], (reviewed) => {
			if (reviewed !== 1) return;
			const key = workProductKeyOf(spec);
			seam.unreadable = (k) => k === key;
		});
		gatheredFromEach([['error']]);
		const turns = seam.turns.length;

		const begun = await press(u, 'beginExecute', { pwuId: spec });

		expect([seam.turns.length - turns, (begun.error ?? '').includes('could not be read back')], 'a repair was sent without the work, or the step’s failure does not say why').toEqual([1, true]);
		expect(latestStepOf(spec), 'the step was not failed with its reason').toEqual({ stepState: 'FAILED', failed: [expect.stringContaining('could not be read back')] });
	});

	// ⭐ The independent review's L17-10 — bytes PRESENT that do not match their hash, never sent as the reviewed work: the work product's, failing the
	// step (D90); the retained span's, the work product going alone (D91).
	it('⛔ RED FIRST — a work product whose bytes are present but do not match their hash fails the step with its reason (D90), never a turn with them (the review’s L17-10)', async () => {
		const { u, spec } = await aSpecification();
		floorRefusing([1], (reviewed) => {
			if (reviewed !== 1) return;
			const key = workProductKeyOf(spec);
			seam.tampered = (k) => (k === key ? 'bytes the model never wrote' : undefined);
		});
		gatheredFromEach([['error']]);
		const turns = seam.turns.length;

		const begun = await press(u, 'beginExecute', { pwuId: spec });

		expect(
			[seam.turns.length - turns, seam.turns.some((t) => t.includes('bytes the model never wrote')), (begun.error ?? '').includes('could not be read back')],
			'a repair was sent, or sent the bytes that do not verify, or the step’s failure does not say why'
		).toEqual([1, false, true]);
		expect(latestStepOf(spec), 'the step was not failed with its reason').toEqual({ stepState: 'FAILED', failed: [expect.stringContaining('could not be read back')] });
	});

	it('⛔ RED FIRST — a retained answer span whose bytes are present but do not match their hash sends the work product alone, no rationale declared (the review’s L17-10)', async () => {
		const { u, spec } = await aSpecification();
		floorRefusing([1], (reviewed) => {
			if (reviewed !== 1) return;
			const span = spanKeyOfTheLatestTry(spec);
			seam.tampered = (k) => (k === span ? JSON.stringify({ workProduct: 'other work', rationale: { rationale: 'TAMPERED account.' } }) : undefined);
		});
		gatheredFromEach([['error']]);
		const turns = seam.turns.length;
		const inputs = seam.stepInputs.length;

		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

		const repair = seam.turns[turns + 1] ?? '';
		expect(
			[repair.startsWith(`${INTRO}\n\n`), repair.includes(RATIONALE_LINE), repair.includes('TAMPERED'), resendOf(seam.stepInputs[inputs + 1])?.rationale],
			'the work product did not go alone, or the span’s bytes that do not verify were sent'
		).toEqual([true, false, false, undefined]);
	});

	// ⭐ The independent review's L17-08 — a span READABLE and verified, whose split does not give back the reviewed bytes: an answer of prose and an
	// envelope, whose work product is the whole answer (`splitExecutionEnvelope` reads no JSON object in it) while the span retained is the envelope
	// alone (`exchange-capture.ts`, `splitAnswerSpan`), so the span's work product is not the reviewed one (D91, "since a retained span can hold an
	// envelope apart from prose the work product kept").
	it('⛔ RED FIRST — a retained span that reads and verifies but whose split does not give back the reviewed work product sends the work product alone, no rationale declared (D91; the review’s L17-08)', async () => {
		const { u, spec } = await aSpecification();
		seam.answerShape = (envelope) => `Here is the specification, as the envelope below gives it.\n${envelope}`;
		let reviewedKey: string | undefined;
		floorRefusing([1], (reviewed) => {
			if (reviewed === 1) reviewedKey = workProductKeyOf(spec);
		});
		gatheredFromEach([['error']]);
		const turns = seam.turns.length;
		const inputs = seam.stepInputs.length;

		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

		const reviewed = (await getArtifactStore().get(reviewedKey ?? '')) ?? '(the reviewed work product is not in the store)';
		expect(reviewed.startsWith('Here is the specification'), 'arrangement: the reviewed work product is the whole answer, its prose kept').toBe(true);
		const repair = seam.turns[turns + 1] ?? '';
		expect(
			[repair.startsWith(`${INTRO}\n\n${reviewed}`), repair.includes(RATIONALE_LINE), resendOf(seam.stepInputs[inputs + 1])?.rationale],
			'the work product did not go alone, its bytes whole'
		).toEqual([true, false, undefined]);
	});

	// ⭐⭐ The lead's ruling 2 on Stage 1's writing (`l17b3-facts.md` §5.2) — THE FAIL-SAFE, ITS OWN TEST: where which messages an answer was gathered
	// from cannot be shown, the work is sent again (D91), so a producer that keeps its history and gives no stops is never read as holding the reviewed
	// answer. Both shapes of "none": an adapter's result without the field, and a bare string. ⭑ Its mutant (Stage 3): the absent field read as held.
	it('⛔ RED FIRST — the fail-safe: a repair after an answer whose session keeps its history but gives no stops of the messages it was gathered from sends the work again — a result without the field, or a bare string (D91)', async () => {
		const opened: boolean[] = [];
		for (const answering of [() => undefined, undefined] as const) {
			const { u, spec } = await aSpecification();
			floorRefusing([1]);
			seam.gatheredFrom = answering;
			const turns = seam.turns.length;

			expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

			opened.push((seam.turns[turns + 1] ?? '').startsWith(`${INTRO}\n\n`));
		}
		expect(opened, 'the repair did not send the reviewed work first').toEqual([true, true]);
	});

	it('⭑ CONTROL — a repair after an answer its session holds — every message it was gathered from one Pi replays — is today’s: no work sent again', async () => {
		const { u, spec } = await aSpecification();
		floorRefusing([1]);
		gatheredFromEach([['stop']]);
		const turns = seam.turns.length;
		const inputs = seam.stepInputs.length;

		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

		expect([resendOf(seam.stepInputs[inputs + 1]), (seam.turns[turns + 1] ?? '').startsWith(REPAIR_OPENING)], 'a repair after a replayed answer moved').toEqual([undefined, true]);
	});

	// ⭐⭐ The independent review's L17-09 — ON D85'S REOPENED FILE, THROUGH THE PAGE: the reviewed try found in the file by its turn's text (the one user
	// entry equal to it), its messages those after it up to the next user entry (§2.11 (10), ruled), and the work sent again after the instruction and
	// before the findings where one of them Pi does not replay — at D71's re-run and at RD8's. The file is written by hand, as Pi writes one (the scripted
	// producer writes none), its user entries the record's turns.
	const HELD_SENTENCE = 'the work product the review judged is the one given above, which the conversation does not hold.';
	/** Verification rejected on a durable store, its reviewed turn's text, and its reviewed work product's bytes as the store holds them. */
	async function verificationRejectedDurably() {
		const root = durableHere();
		const r = await verificationRejected();
		const reviewedTurn = seam.turns.filter((t) => t.startsWith('Write the Verification.')).at(-1) ?? '(no turn of Verification was sent)';
		const work = (await getArtifactStore().get(workProductKeyOf(r.ids.verification) ?? '')) ?? '(the reviewed work product is not in the store)';
		return { root, r, reviewedTurn, work, folder: sessionFolderOf(root, 'executor', r.ids.verification) };
	}
	/** D71's re-run of Verification: its first turn, and the input the page handed its step. */
	async function rerunInPlace(r: Awaited<ReturnType<typeof verificationRejected>>) {
		const [turns, inputs] = [seam.turns.length, seam.stepInputs.length];
		expect((await press(r.u, 'rerunRejectedWork', { pwuId: r.ids.verification, rationale: 'Re-run it with the findings.' })).error, 'arrangement: the re-run').toBeUndefined();
		return { turn: seam.turns[turns] ?? '', input: seam.stepInputs[inputs] };
	}

	it('⛔ RED FIRST — D71’s re-run on a reopened file whose reviewed answer Pi does not replay sends the reviewed work, whole, after the instruction and before the findings, and says the reviewed work is the one given above (D91; the review’s L17-09)', async () => {
		const d = await verificationRejectedDurably();
		sessionFileWith(d.folder, [{ user: d.reviewedTurn, assistant: 'The work.', stopReason: 'error' }]);

		const { turn, input } = await rerunInPlace(d.r);

		expect(
			[turn.startsWith(`${d.reviewedTurn}\n\n${INTRO}\n\n${d.work}\n\n`), turn.indexOf(INTRO) < turn.indexOf(CARRIED_FINDINGS_LINE), turn.includes(HELD_SENTENCE), resendOf(input)?.workProduct],
			'the reopened first turn did not send the reviewed work, whole, after the instruction and before the findings, saying so'
		).toEqual([true, true, true, d.work]);
	});

	it('⛔ RED FIRST — RD8’s re-run on a reopened file, after the step stopped, whose reviewed answer Pi does not replay sends the reviewed work after the instruction and before the findings (D91; the review’s L17-09)', async () => {
		const root = durableHere();
		const { u, spec } = await aSpecification();
		// ⭑ Two tries, each refused with one finding: no convergence, so the loop ends and the unit waits with the findings (`mayRetry`).
		floorRefusing([1, 1]);
		gatheredFromEach([['stop'], ['stop']]);
		const turns = seam.turns.length;
		const stopped = await press(u, 'beginExecute', { pwuId: spec });
		expect([seam.turns.length - turns, (getObject(getEngine(), spec) ?? {}).executionState], `arrangement: two tries, then the unit waits — ${stopped.error ?? ''}`).toEqual([2, 'WAITING']);
		const [first, second] = [seam.turns[turns] ?? '', seam.turns[turns + 1] ?? ''];
		const work = (await getArtifactStore().get(workProductKeyOf(spec) ?? '')) ?? '(the reviewed work product is not in the store)';
		sessionFileWith(sessionFolderOf(root, 'executor', spec), [
			{ user: first, assistant: 'The first work.', stopReason: 'stop' },
			{ user: second, assistant: 'The second work.', stopReason: 'error' }
		]);
		seam.review = undefined;
		seam.gatheredFrom = undefined;
		const [before, inputs] = [seam.turns.length, seam.stepInputs.length];

		expect((await press(u, 'rerunWork', { pwuId: spec, rationale: 'Run the work again with the findings.' })).advanced, 'arrangement: the work re-run').toBe('work-rerun');

		const turn = seam.turns[before] ?? '';
		expect(
			[turn.startsWith(`${first}\n\n${INTRO}\n\n${work}\n\n`), turn.indexOf(INTRO) < turn.indexOf(CARRIED_FINDINGS_LINE), turn.includes(HELD_SENTENCE), resendOf(seam.stepInputs[inputs])?.workProduct],
			'RD8’s reopened first turn did not send the reviewed work after the instruction and before the findings, saying so'
		).toEqual([true, true, true, work]);
	});

	it('⛔ RED FIRST — the reviewed try found only by ONE user entry equal to its turn: no such entry, or two, and the work is sent again; its messages end at the next user entry, so a later try’s error does not send it (D91, §2.11 (10); the review’s L17-09)', async () => {
		const sent: boolean[] = [];
		for (const arrangement of ['no-match', 'two-matches', 'later-error'] as const) {
			const d = await verificationRejectedDurably();
			const answered = (user: string, stopReason: string) => ({ user, assistant: 'The work.', stopReason });
			sessionFileWith(
				d.folder,
				arrangement === 'no-match'
					? [answered('A turn the record does not hold.', 'stop')]
					: arrangement === 'two-matches'
						? [answered(d.reviewedTurn, 'stop'), answered(d.reviewedTurn, 'stop')]
						: [answered(d.reviewedTurn, 'stop'), answered('A later turn on the file.', 'error')]
			);
			const { input } = await rerunInPlace(d.r);
			sent.push(resendOf(input) !== undefined);
		}
		expect(sent, 'the work was not sent again where no single user entry is the reviewed turn, or was sent for a later try’s error').toEqual([true, true, false]);
	});

	it('⭑ CONTROL — D71’s re-run on a reopened file whose reviewed answer Pi replays sends nothing again: its first turn as today (D91; the review’s L17-09)', async () => {
		const d = await verificationRejectedDurably();
		sessionFileWith(d.folder, [{ user: d.reviewedTurn, assistant: 'The work.', stopReason: 'stop' }]);

		const { turn, input } = await rerunInPlace(d.r);

		expect(
			[resendOf(input), turn.includes(INTRO), turn.includes('This session holds that attempt: the turns above are your earlier work on this unit, with the work product you returned and your rationale.')],
			'a re-run on a file whose reviewed answer Pi replays moved'
		).toEqual([undefined, false, true]);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 2 (§16; the independent review's L17C-02) — A FILE OR A STEP THAT SHOWS NO REVIEWED ANSWER.
	// On a reopened file, the reviewed turn's user entry followed by no message that carried text is NOT_SHOWN, so the work is sent again; within a
	// step, an empty `gatheredFrom` cannot show which messages the answer was gathered from, so the work is sent again.
	it('⛔ RED FIRST — D71’s re-run on a reopened file whose reviewed turn is followed by no answer sends the reviewed work again: the file shows no reviewed answer (the lead’s ruling 2)', async () => {
		const d = await verificationRejectedDurably();
		// ⭑ The reviewed turn's user entry alone, as Pi's file holds one whose answer never landed.
		sessionFileWith(d.folder, [{ user: d.reviewedTurn }]);

		const { turn, input } = await rerunInPlace(d.r);

		expect(
			[resendOf(input)?.workProduct, turn.startsWith(`${d.reviewedTurn}\n\n${INTRO}\n\n${d.work}\n\n`)],
			'a reopened file that shows no reviewed answer was read to hold it, and the work not sent again'
		).toEqual([d.work, true]);
	});

	it('⛔ RED FIRST — within a step, a try whose answer was gathered from no message it can show (`gatheredFrom: []`) has the reviewed work sent again with its repair (the lead’s ruling 2)', async () => {
		const { u, spec } = await aSpecification();
		floorRefusing([1]);
		gatheredFromEach([[]]);
		const turns = seam.turns.length;

		expect((await press(u, 'beginExecute', { pwuId: spec })).error, 'the step did not run').toBeUndefined();

		expect((seam.turns[turns + 1] ?? '').startsWith(`${INTRO}\n\n`), 'the repair did not send the reviewed work first').toBe(true);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 5 and §18.2 (§16, §18; the independent review's L17C-05; D90, as the lead amends it) — EVERY
// WAY OUT OF A STARTED MODEL STEP, THE READS BEFORE ITS TRY LOOP AMONG THEM. A read after the start that throws — the record of the units a replacement
// replaces, the step's attempt — fails the step once with its described reason, said beside where its recording is refused or throws, no producer
// end where none opened, the page answered with the reason; a read the start does not depend on — the criteria the unit's declared reviews judge it
// by — is made before the start, so a throw starts nothing; and the two refusals before the loop (the policy unresolved, the producer not opened) say
// a failure the store refused or threw on recording beside the refusal, in D90's form, never in its place.
describe('⭐⭐ L17b3 (D90; the lead’s ruling 5 and §18.2) — the reads before a started step’s try loop: none escapes, none leaves the step RUNNING', () => {
	/** What a press answered: its error, or what escaped it. */
	const answered = (pressed: Promise<{ readonly error?: string }>) =>
		pressed.then(
			(p) => ({ error: p.error ?? '', thrown: '' }),
			(e: unknown) => ({ error: '', thrown: saidOf(e) })
		);

	it('⛔ RED FIRST — a replacement’s record that cannot be read after its step started fails the step once with the reason, and the page answers with it; no producer opened (the lead’s ruling 5)', async () => {
		const r = await verificationRejected();
		expect((await sendBackToSource(r)).error, 'arrangement: the act').toBeUndefined();
		const source2 = currentOf(r.u, 'Source').id;
		const [opens, trace] = [seam.opens, seam.trace.length];
		seam.conversationThrows = { value: new Error('the record’s store could not be read') };

		const said = await answered(press(r.u, 'beginExecute', { pwuId: source2 }));

		seam.conversationThrows = undefined;
		expect(
			[said.thrown, said.error.includes('the record of the units this one replaces could not be read: the record’s store could not be read'), latestStepOf(source2)],
			'the record’s failure escaped, or the step was left RUNNING, or failed with no reason'
		).toEqual(['', true, { stepState: 'FAILED', failed: [expect.stringContaining('the record’s store could not be read')] }]);
		expect([seam.trace.slice(trace), seam.opens - opens], 'the step’s failure was not asked for once, or a producer opened').toEqual([['fail-request'], 0]);
	});

	// ⭐⭐ RESTATED 2026-11-18 (`JAN-EXEC` Phase 7, package L17b3 — the lead's ruling 4 of §23; the re-check's L17R-05 and the lead's O-3): ~~'… no step
	// RUNNING, and the page answers with the reason — at Begin & Execute and at RD8’s re-run (the lead’s §18.2 (1))'~~ — "not RUNNING" alone is met
	// by a step that started and then failed: Begin & Execute's limb now holds too that no plan was made and no step exists for the unit, and D71's
	// re-run is added, its criteria's read failing as the person re-runs it, no plan made and no Decision recorded. Every expectation of the old
	// limbs kept, byte for byte.
	it('⛔ RED FIRST — the criteria a unit’s declared reviews judge it by, if they cannot be read, refuse its start: no step RUNNING, no plan made, and the page answers with the reason — at Begin & Execute, where no step exists, at RD8’s re-run, and at D71’s re-run, where no Decision is recorded (the lead’s §18.2 (1); ruling 4 of §23)', async () => {
		const begin = await aSpecification();
		// ⭐ The lead's ruling 4 of §23 — the unit's plans before it, so a plan made is seen.
		const beginPlansBefore = listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === begin.spec).length;
		seam.criteriaThrows = { value: new Error('the governing policies could not be read') };
		const begun = await answered(press(begin.u, 'beginExecute', { pwuId: begin.spec }));
		seam.criteriaThrows = undefined;

		// ⭑ RD8's re-run of a stopped unit: its first step stopped at its review's transport, then the criteria's read failing as the person re-runs it.
		const rd8 = await aSpecification();
		let down = true;
		seam.review = (prompt) => {
			if (down && prompt.includes('The WORK PRODUCT to review')) throw new Error('devin exited with code 1: connection reset by peer');
			return chapterAnswering(prompt);
		};
		expect((await press(rd8.u, 'beginExecute', { pwuId: rd8.spec })).error ?? '', 'arrangement: the step stopped at its review’s transport').toMatch(/VALIDATOR_EXECUTION_FAILED/);
		down = false;
		const plansBefore = listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === rd8.spec).length;
		seam.criteriaThrows = { value: new Error('the governing policies could not be read') };
		const rerun = await answered(press(rd8.u, 'rerunWork', { pwuId: rd8.spec, rationale: 'The reviewer failed at the transport; run the work again.' }));
		seam.criteriaThrows = undefined;

		expect(
			[begun.thrown, begun.error.includes('the governing policies could not be read'), latestStepOf(begin.spec).stepState !== 'RUNNING'],
			'Begin & Execute escaped, or left its step RUNNING, or did not answer with the reason'
		).toEqual(['', true, true]);
		expect(
			[
				rerun.thrown,
				rerun.error.includes('the governing policies could not be read'),
				latestStepOf(rd8.spec).stepState !== 'RUNNING',
				listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === rd8.spec).length
			],
			'RD8’s re-run escaped, left a step RUNNING, did not answer with the reason, or started a plan'
		).toEqual(['', true, true, plansBefore]);
		// ⭐ The lead's ruling 4 of §23 — Begin & Execute made no plan, and no step exists for the unit: "not RUNNING" alone is met by a step that
		// started and then failed.
		expect(
			[listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === begin.spec).length, latestStepOf(begin.spec).stepState],
			'Begin & Execute made a plan, or a step exists for the unit'
		).toEqual([beginPlansBefore, undefined]);

		// ⭐ The lead's ruling 4 of §23 — D71's re-run: a unit its declared reviews rejected, the criteria's read failing as the person re-runs it — that
		// read alone (`onlyWithin`), so the offer, which reads the same policies first, reads them whole.
		const d71 = await verificationRejected();
		const [d71PlansBefore, decisionsBefore] = [
			listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === d71.ids.verification).length,
			listByType(getEngine(), 'DECISION').length
		];
		seam.criteriaThrows = { value: new Error('the governing policies could not be read'), onlyWithin: 'reviewCriteriaOf' };
		const rejectedRerun = await answered(press(d71.u, 'rerunRejectedWork', { pwuId: d71.ids.verification, rationale: 'Re-run it with the findings.' }));
		seam.criteriaThrows = undefined;
		expect(
			[
				rejectedRerun.thrown,
				rejectedRerun.error.includes('the criteria its declared reviews will judge it by could not be read: the governing policies could not be read'),
				latestStepOf(d71.ids.verification).stepState !== 'RUNNING',
				listByType(getEngine(), 'EXECUTION_PLAN').filter((p) => p.state.workUnitId === d71.ids.verification).length,
				listByType(getEngine(), 'DECISION').length
			],
			'D71’s re-run escaped, left a step RUNNING, did not answer with the reason, made a plan, or recorded a Decision'
		).toEqual(['', true, true, d71PlansBefore, decisionsBefore]);
	});

	it('⛔ RED FIRST — the step’s attempt that cannot be read after its start fails the step once with the reason, and the page answers with it; no producer opened (the lead’s §18.2 (2))', async () => {
		const { u, spec } = await aSpecification();
		const [opens, trace] = [seam.opens, seam.trace.length];
		seam.attemptKeyThrows = { value: new Error('the events could not be read') };

		const said = await answered(press(u, 'beginExecute', { pwuId: spec }));

		seam.attemptKeyThrows = undefined;
		expect(
			[said.thrown, said.error.includes('the events could not be read'), latestStepOf(spec)],
			'the attempt’s failure escaped, or the step was left RUNNING, or failed with no reason'
		).toEqual(['', true, { stepState: 'FAILED', failed: [expect.stringContaining('the events could not be read')] }]);
		expect([seam.trace.slice(trace), seam.opens - opens], 'the step’s failure was not asked for once, or a producer opened').toEqual([['fail-request'], 0]);
	});

	// ⭐ L17b3 — the lead's ruling 1 of §23 (the re-check's L17R-01; the lead's O-1) — THE TWO CATCHES BEFORE THE TRY LOOP DESCRIBE WHAT THEY CAUGHT BY
	// THE ONE DESCRIBER (`describedThrow`): a value that cannot be described — `Object.create(null)`, a revoked `Proxy`, an `Error` whose `message`
	// getter throws — thrown by the policy's resolution or by the producer's opening is said to be one; nothing escapes, the step is FAILED once.
	it('⛔ RED FIRST — a value that cannot be described, thrown by the policy’s resolution or the producer’s opening before the try loop: nothing escapes, the step is FAILED once with the describer’s words, and the page answers with them (the lead’s ruling 1 of §23)', async () => {
		/** The three values, made fresh for each case. */
		const indescribable = (): readonly (readonly [string, unknown])[] => {
			const revocable = Proxy.revocable({}, {});
			revocable.revoke();
			const unreadable = new Error('arrangement: its message cannot be read');
			Object.defineProperty(unreadable, 'message', {
				get() {
					throw new Error('the message cannot be read');
				}
			});
			return [
				['Object.create(null)', Object.create(null) as unknown],
				['a revoked Proxy', revocable.proxy],
				['an Error whose message getter throws', unreadable]
			];
		};
		const seen: unknown[] = [];
		for (const where of ['policy', 'opening'] as const)
			for (const [label, value] of indescribable()) {
				const { u, spec } = await aSpecification();
				const [opens, trace] = [seam.opens, seam.trace.length];
				if (where === 'policy') seam.policyThrows = { value };
				else seam.openThrows = { value };
				const said = await answered(press(u, 'beginExecute', { pwuId: spec }));
				seam.policyThrows = undefined;
				seam.openThrows = undefined;
				const step = latestStepOf(spec);
				seen.push([where, label, said.thrown, said.error, step.stepState, step.failed, seam.trace.slice(trace), seam.opens - opens]);
			}

		const WORDS = 'a thrown value that cannot be described';
		expect(
			seen,
			'a value that cannot be described escaped a catch before the try loop, left the step RUNNING, or was not said by the one describer'
		).toEqual(
			(['policy', 'opening'] as const).flatMap((where) =>
				['Object.create(null)', 'a revoked Proxy', 'an Error whose message getter throws'].map((label) => [
					where,
					label,
					'',
					`The model invocation did not run: ${WORDS}`,
					'FAILED',
					[WORDS],
					['fail-request'],
					0
				])
			)
		);
	});

	it('⛔ RED FIRST — a step refused before its try loop — its policy unresolved, or its producer not opened — says a failure the store refused or threw on recording beside the refusal, in D90’s form, and nothing escapes (the lead’s §18.2 (3))', async () => {
		const seen: { readonly error: string; readonly thrown: string }[] = [];
		for (const [where, recording] of [
			['policy', 'refused'],
			['policy', 'throws'],
			['opening', 'refused'],
			['opening', 'throws']
		] as const) {
			const { u, spec } = await aSpecification();
			if (where === 'policy') seam.policyThrows = { value: new Error('the context policy could not be resolved') };
			else seam.listThrows = 'the workspace could not be listed';
			if (recording === 'refused') seam.refuseBatch = (commands) => (failing(commands) ? 'the store refused the failure' : undefined);
			else seam.throwBatch = { when: failing, error: new Error('the store could not be written') };

			seen.push(await answered(press(u, 'beginExecute', { pwuId: spec })));

			seam.policyThrows = undefined;
			seam.listThrows = undefined;
			seam.refuseBatch = undefined;
			seam.throwBatch = undefined;
			expect(latestStepOf(spec).stepState, `arrangement: nothing could record the ${where} refusal’s failure`).toBe('RUNNING');
		}

		expect(seen.map((s) => s.thrown), 'a failure the store threw on escaped in the refusal’s place').toEqual(['', '', '', '']);
		// ⭑ Each answer: the refusal with its own reason first, then the recording's failure beside it — the page's `batchError` form (`<command>:
		// <message>`) for one the store refused, the one describer's for one it threw.
		const [refusal, recordingFailure] = [(s: { readonly error: string }) => s.error.split(' — and the failure could not be recorded: ')[0] ?? '', (s: { readonly error: string }) => s.error.split(' — and the failure could not be recorded: ')[1]];
		expect(
			seen.map((s) => [refusal(s).startsWith('The model invocation did not run: '), refusal(s).includes(s === seen[0] || s === seen[1] ? 'the context policy could not be resolved' : 'the workspace could not be listed')]),
			'the refusal with its own reason is not the answer'
		).toEqual([
			[true, true],
			[true, true],
			[true, true],
			[true, true]
		]);
		expect(seen.map(recordingFailure), 'the failure’s recording is not said beside the refusal, in D90’s form').toEqual([
			'FailExecutionStep: the store refused the failure',
			'the store could not be written',
			'FailExecutionStep: the store refused the failure',
			'the store could not be written'
		]);
	});
});

beforeEach(() => {
	resetEngine('reference');
	seam.prompts.length = 0;
	seam.review = undefined;
	seam.turns.length = 0;
	seam.workspaces.clear();
	seam.opens = 0;
	seam.declared.length = 0;
	seam.refuseWrite = undefined;
	seam.onTurn = undefined;
	seam.sessionsRoot = undefined;
	seam.sessionsRootThrows = undefined;
	seam.places.length = 0;
	seam.stepInputs.length = 0;
	seam.takes.length = 0;
	seam.takeAnswer = undefined;
	seam.refuseBatch = undefined;
	seam.refuseJoin = undefined;
	seam.listThrows = undefined;
	seam.viewThrows = undefined;
	seam.processRunsThrows = undefined;
	seam.disposes = 0;
	seam.disposeThrows = undefined;
	seam.throwBatch = undefined;
	// ⭐ L17b3 — the three seams this package adds, reset. ⭐ And the six the review's findings add (L17-05, L17-08, L17-10, L17-14).
	seam.contexts.length = 0;
	seam.gatheredFrom = undefined;
	seam.unreadable = undefined;
	seam.tampered = undefined;
	seam.answerShape = undefined;
	seam.runs = undefined;
	seam.documentOf = undefined;
	seam.throwAfterCommit = undefined;
	seam.trace.length = 0;
	seam.refuseStepOf = undefined;
	// ⭐ L17b3 — the lead's ruling 5 and §18.2: the four reads' seams, reset.
	seam.conversationThrows = undefined;
	seam.criteriaThrows = undefined;
	seam.attemptKeyThrows = undefined;
	seam.policyThrows = undefined;
	// ⭐ L17b3 — the lead's ruling 1 of §23: the opening's seam, reset.
	seam.openThrows = undefined;
	seam.answer = (policyId) => answerOf(policyId);
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});
