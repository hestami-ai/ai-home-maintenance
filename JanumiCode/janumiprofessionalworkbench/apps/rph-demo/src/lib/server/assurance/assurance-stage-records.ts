// ⭐⭐ `JAN-EXEC` Phase 7, package L17b1 — design D74, D75, D76, D77 (`REG-D-166` (3), (4); `REG-D-167` (2)) — THE ASSURANCE STAGE'S RECORDS: their form,
// and how they are read back.
//
// ⭑ THE FORM (the lead's ruling on reading 7). Each part a model wrote for the stage — a narrative chapter, a diagnosis, a step-back — and a unit's
// tactic record is an `ARTIFACT` holding its bytes on the content plane (`application/json`), beside a `SOURCE` `EVIDENCE` whose content reference
// names the artifact, the part and its round (the round's opening verdict, the first rejecting one) and the Undertaking. The host's findings on a
// part — a check limb a chapter fails, a shared workspace that changed, a claimed check absent from the captured runs — are that evidence's
// `limitations`. ⛔ No new object type and no vocabulary: `RecordArtifact` and `ProposeEvidence` as they stand. ⛔ NO STAGE RECORD CARRIES
// `producingPwuId` OR `producingExecutionAttemptId` — a tactic record neither, though its unit's own model wrote it: readers count an attempt's
// artifacts as its tries' work products, one per try in record order (`stopped-unit-recovery.ts`, `tryOfWorkProduct`, `stoppedUnitOf`;
// `run-report-core.ts`), and list a unit's artifacts by its producing unit. So the unit and the attempt are named in the evidence's `stage` alone.
// ⭑ READ BY THE ROUND, NEVER BY MEMORY: the evidence is walked in the event log's order, and each part's bytes are re-hashed against the record.
import { createHash } from 'node:crypto';
import type { ActorReference } from '@janumipwb/rph-contracts';
import { listByType, type EngineHandle } from '@janumipwb/rph-engine';
import type { ArtifactStore } from '@janumipwb/rph-ports';

/** The parts of the stage, as their artifacts' `artifactType` names them, and a unit's tactic record (D77). */
export const STAGE_PART = {
	CHAPTER: 'narrative-chapter',
	DIAGNOSIS: 'fault-diagnosis',
	STEP_BACK: 'step-back',
	TACTIC: 'tactic-record',
	TACTIC_FINDING: 'tactic-record-finding'
} as const;
export type StagePart = (typeof STAGE_PART)[keyof typeof STAGE_PART];

/** A part's outcome, as its artifact's `status` says it (a free string, `REG-Q-056`). */
export type StagePartStatus = 'recorded' | 'failing' | 'refused' | 'not-run';

/** One batch step, as the page's `runSteps` takes it: command, aggregate type, aggregate id, payload. */
export type StageStep = readonly [string, string, string, Record<string, unknown>];

/** What recording a part needs from its caller. */
export interface StageRecordDeps {
	readonly store: ArtifactStore;
	readonly tenantPrefix: string;
	readonly newId: (prefix: string) => string;
	readonly now: () => string;
	/** The caller's atomic batch: an error string, or null. */
	readonly runSteps: (steps: readonly StageStep[]) => string | null;
}

/** A part to record. */
export interface StagePartToRecord {
	readonly part: StagePart;
	readonly roundId: string;
	readonly undertakingId: string;
	/** The round's unit — the rejected one — or, for a tactic record, the unit whose model wrote it. */
	readonly unitId: string;
	readonly bytes: string;
	readonly status: StagePartStatus;
	readonly producedBy: ActorReference;
	readonly limitations: readonly string[];
	/** A tactic record's attempt (`<stepId>#<n>`), named in the evidence's `stage` alone (see the header). */
	readonly attemptKey?: string;
}

/** ⭐ RECORD ONE PART: its bytes on the content plane, then its artifact and its SOURCE evidence in one batch. */
export async function recordStagePart(
	deps: StageRecordDeps,
	p: StagePartToRecord
): Promise<{ readonly artifactId: string; readonly evidenceId: string } | { readonly refusedBecause: string }> {
	const ref = await deps.store.put({
		tenantPrefix: deps.tenantPrefix,
		bytes: p.bytes,
		mediaType: 'application/json',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});
	const artifactId = deps.newId('art');
	const evidenceId = deps.newId('evd');
	const refused = deps.runSteps([
		[
			'RecordArtifact',
			'ARTIFACT',
			artifactId,
			{
				artifactId,
				artifactType: p.part,
				mediaType: 'application/json',
				storageProvider: ref.storageProvider,
				storageKey: ref.storageKey,
				contentHash: ref.contentHash,
				byteSize: ref.byteSize,
				securityClassification: 'unclassified',
				retentionClass: 'retained-by-participation',
				status: p.status
			}
		],
		[
			'ProposeEvidence',
			'EVIDENCE',
			evidenceId,
			{
				evidenceId,
				evidenceType: 'SOURCE',
				contentReference: {
					stage: {
						part: p.part,
						round: p.roundId,
						undertakingId: p.undertakingId,
						unitId: p.unitId,
						status: p.status,
						...(p.attemptKey === undefined ? {} : { attempt: p.attemptKey })
					},
					artifactId,
					storageKey: ref.storageKey,
					contentHash: ref.contentHash,
					byteSize: ref.byteSize
				},
				producedBy: p.producedBy,
				supportsClaimIds: [],
				contradictsClaimIds: [],
				scope: `the assurance stage of work unit ${p.unitId}, round ${p.roundId}: ${p.part}`,
				limitations: [...p.limitations],
				capturedAt: deps.now()
			}
		]
	]);
	return refused === null ? { artifactId, evidenceId } : { refusedBecause: refused };
}

/** One stage record, as its SOURCE evidence names it, in the event log's order. */
export interface StageRecord {
	readonly evidenceId: string;
	readonly artifactId: string;
	readonly part: StagePart;
	readonly roundId: string;
	readonly undertakingId: string;
	readonly unitId: string;
	readonly status: StagePartStatus;
	readonly storageKey: string;
	readonly contentHash: string;
	readonly limitations: readonly string[];
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** ⭐ EVERY STAGE RECORD THE STORE HOLDS, in the order the event log recorded them (evidence ids first seen). */
export function stageRecordsIn(engine: EngineHandle): StageRecord[] {
	const order = new Map<string, number>();
	engine.readAllEvents().forEach((e, i) => {
		if (e.aggregateType === 'EVIDENCE' && !order.has(e.aggregateId)) order.set(e.aggregateId, i);
	});
	return listByType(engine, 'EVIDENCE')
		.flatMap((row): StageRecord[] => {
			const ref = (row.state.contentReference ?? {}) as Record<string, unknown>;
			const stage = (ref.stage ?? undefined) as Record<string, unknown> | undefined;
			if (row.state.evidenceType !== 'SOURCE' || stage === undefined) return [];
			const limitations = Array.isArray(row.state.limitations) ? row.state.limitations.filter((l): l is string => typeof l === 'string') : [];
			return [
				{
					evidenceId: row.id,
					artifactId: str(ref.artifactId),
					part: str(stage.part) as StagePart,
					roundId: str(stage.round),
					undertakingId: str(stage.undertakingId),
					unitId: str(stage.unitId),
					status: str(stage.status) as StagePartStatus,
					storageKey: str(ref.storageKey),
					contentHash: str(ref.contentHash),
					limitations
				}
			];
		})
		.sort((a, b) => (order.get(a.evidenceId) ?? 0) - (order.get(b.evidenceId) ?? 0));
}

/** ⭐ A RECORD'S BYTES, re-hashed against the record: `undefined` when gone or when they do not hash to what it names. */
export async function stageBytesOf(store: ArtifactStore, rec: Pick<StageRecord, 'storageKey' | 'contentHash'>): Promise<string | undefined> {
	const bytes = await store.get(rec.storageKey);
	if (bytes === undefined) return undefined;
	const hash = createHash('sha256').update(bytes, 'utf8').digest('hex');
	return rec.contentHash.replace(/^sha256:/, '') === hash ? bytes : undefined;
}

/**
 * ⭐ A record's bytes read as one JSON object, or `undefined`. ⭐ The review's re-check (B) — READ WITH THE PARSE THAT ACCEPTED THEM (`oneJsonObject`): a
 * diagnosis, a step-back or a tactic record a model wrote inside a Markdown fence was accepted so, and its recorded bytes keep the fence, which a bare
 * `JSON.parse` called unreadable.
 */
export async function stageJsonOf(store: ArtifactStore, rec: Pick<StageRecord, 'storageKey' | 'contentHash'>): Promise<Record<string, unknown> | undefined> {
	const bytes = await stageBytesOf(store, rec);
	if (bytes === undefined) return undefined;
	const read = oneJsonObject(bytes);
	return read.ok ? read.value : undefined;
}

/** ⭐ A model's answer read as ONE JSON object: the whole answer, a code fence around it allowed; else why not. */
export function oneJsonObject(answer: string): { readonly ok: true; readonly value: Record<string, unknown> } | { readonly ok: false; readonly why: string } {
	const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/.exec(answer.trim());
	const text = (fenced?.[1] ?? answer).trim();
	try {
		const v = JSON.parse(text) as unknown;
		if (typeof v === 'object' && v !== null && !Array.isArray(v)) return { ok: true, value: v as Record<string, unknown> };
		return { ok: false, why: 'the answer is JSON, but not one JSON object' };
	} catch {
		return { ok: false, why: 'the answer does not parse as one JSON object' };
	}
}
