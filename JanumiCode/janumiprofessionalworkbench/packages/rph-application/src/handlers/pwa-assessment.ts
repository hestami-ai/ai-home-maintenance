// Authoring-plane faithfulness-assessment handlers. A judge DISTINCT from the authoring executor (exec != assurance)
// scores whether a DRAFT PWA graph faithfully interprets its prompt; the verdict is recorded as durable, event-sourced
// domain state (a governed-stream precursor, sibling to AUTHORING_CONVERSATION). The bounded assess/refine loop runs
// iteration 1 automatically and, if still unfaithful, ESCALATES to a human who RESOLVES it. Lifecycle: RECORDED (create)
// -> ESCALATED -> RESOLVED. The auto-refinement between iterations is captured implicitly by the next assessment's
// priorAssessmentId link, so no separate revision command is needed.
import type {
	EscalateAuthoringAssessmentPayload,
	RecordAuthoringAssessmentPayload,
	ResolveAuthoringAssessmentPayload
} from '@janumipwb/rph-contracts';
import {
	commitState,
	createObject,
	loadOrReject,
	makeEvent,
	newEnvelope,
	nextEnvelope,
	reject,
	type CommandHandler
} from './kit.js';

const ASSESSMENT = 'AUTHORING_ASSESSMENT';

/** RecordAuthoringAssessment — persist a judge's faithfulness verdict for a PWA authoring turn (status RECORDED).
 *  The assessor reference carries the vendor/model that judged (the separation-of-duties record). */
export const recordAuthoringAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as RecordAuthoringAssessmentPayload;
	const id = command.targetAggregateId;
	if (!ctx.store.loadObject(p.pwaId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`Assessment references unknown PWA ${p.pwaId}`,
			[p.pwaId]
		);
	}
	if (p.priorAssessmentId && !ctx.store.loadObject(p.priorAssessmentId)) {
		return reject(
			command,
			'RPH_VALIDATION_SEMANTIC_FAILED',
			`priorAssessmentId ${p.priorAssessmentId} does not exist`,
			[p.priorAssessmentId]
		);
	}
	const state: Record<string, unknown> = {
		...newEnvelope(command, ASSESSMENT, id, {
			lifecycleStatus: 'ACTIVE',
			originType: 'MODEL_GENERATION',
			sourceObjectIds: [p.pwaId, ...(p.priorAssessmentId ? [p.priorAssessmentId] : [])]
		}),
		pwaId: p.pwaId,
		promptText: p.promptText,
		iteration: p.iteration,
		...(p.priorAssessmentId !== undefined ? { priorAssessmentId: p.priorAssessmentId } : {}),
		assessor: p.assessor,
		verdict: p.verdict,
		overallScore: p.overallScore,
		criteria: p.criteria,
		gaps: p.gaps,
		recommendation: p.recommendation,
		...(p.scoreDelta !== undefined ? { scoreDelta: p.scoreDelta } : {}),
		...(p.converging !== undefined ? { converging: p.converging } : {}),
		status: 'RECORDED'
	};
	return createObject(ctx, command, {
		objectType: ASSESSMENT,
		aggregateId: id,
		state,
		eventType: 'AuthoringAssessmentRecorded'
	});
};

/** EscalateAuthoringAssessment — a still-unfaithful assessment after the auto-refine becomes a human-in-the-loop
 *  decision (RECORDED -> ESCALATED), carrying the reason + human-readable context to help the human decide. */
export const escalateAuthoringAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as EscalateAuthoringAssessmentPayload;
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	if (loaded.state.status !== 'RECORDED') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`Only a RECORDED assessment can be escalated (${id} is ${String(loaded.state.status)})`
		);
	}
	const newRevision = loaded.revision + 1;
	const next: Record<string, unknown> = {
		...nextEnvelope(loaded.state, command, newRevision),
		status: 'ESCALATED',
		reason: p.reason,
		context: p.context
	};
	const event = makeEvent(ctx, command, {
		eventType: 'AuthoringAssessmentEscalated',
		aggregateType: ASSESSMENT,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload
	});
	return commitState(ctx, command, {
		objectType: ASSESSMENT,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};

/** ResolveAuthoringAssessment — the human's decision on an escalated assessment (ESCALATED -> RESOLVED). */
export const resolveAuthoringAssessment: CommandHandler = (ctx, command, payload) => {
	const p = payload as ResolveAuthoringAssessmentPayload;
	const id = command.targetAggregateId;
	const loaded = loadOrReject(ctx, command, id);
	if (!loaded.ok) return loaded.result;
	if (loaded.state.status !== 'ESCALATED') {
		return reject(
			command,
			'RPH_INVARIANT_VIOLATION',
			`Only an ESCALATED assessment can be resolved (${id} is ${String(loaded.state.status)})`
		);
	}
	const newRevision = loaded.revision + 1;
	const next: Record<string, unknown> = {
		...nextEnvelope(loaded.state, command, newRevision),
		status: 'RESOLVED',
		resolution: p.resolution,
		...(p.resolutionNote !== undefined ? { resolutionNote: p.resolutionNote } : {}),
		resolvedBy: p.resolvedBy
	};
	const event = makeEvent(ctx, command, {
		eventType: 'AuthoringAssessmentResolved',
		aggregateType: ASSESSMENT,
		aggregateId: id,
		aggregateRevision: newRevision,
		payload
	});
	return commitState(ctx, command, {
		objectType: ASSESSMENT,
		aggregateId: id,
		expectedRevision: loaded.revision,
		newRevision,
		newSemanticVersion: loaded.semanticVersion,
		nextState: next,
		event
	});
};
