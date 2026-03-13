/**
 * Event Writer - Append-Only Event Logging
 * Implements Phase 1.4: Event Logging Infrastructure
 * Based on Technical Specification Section 4 (Historian-Core)
 */

import { randomUUID } from 'node:crypto';
import { getLogger, isLoggerInitialized } from '../logging';
import type {
	Result,
	DialogueTurn,
	Claim,
	ClaimEvent,
	Verdict,
	Gate,
	HumanDecision,
	ConstraintManifest,
	Artifact,
	ArtifactReference,
	IntakeConversationState,
	IntakeConversationTurn,
	IntakePlanDocument,
	IntakeAccumulation,
	IntakeTurnResponse,
	IntakeGatheringTurnResponse,
	DomainCoverageMap,
	IntakeModeRecommendation,
	IntakeCheckpoint,
} from '../types';
import { createEmptyPlanDocument } from '../types/intake';
import {
	Role,
	ClaimEventType,
	VerdictType,
	IntakeSubState,
	IntakeMode,
	EngineeringDomain,
} from '../types';
import { getDatabase } from '../database';

/**
 * Write a dialogue turn to the database
 * @param turn Partial turn data (turn_id will be auto-generated)
 * @returns Result containing the created turn or error
 */
export function writeDialogueTurn(
	turn: Omit<DialogueTurn, 'turn_id' | 'timestamp'>
): Result<DialogueTurn> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const stmt = db.prepare(`
            INSERT INTO dialogue_turns (dialogue_id, role, phase, speech_act, content_ref, timestamp)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `);

		const info = stmt.run(
			turn.dialogue_id,
			turn.role,
			turn.phase,
			turn.speech_act,
			turn.content_ref
		);

		// Retrieve the created turn
		const createdTurn = db
			.prepare('SELECT * FROM dialogue_turns WHERE turn_id = ?')
			.get(info.lastInsertRowid) as DialogueTurn;

		return { success: true, value: createdTurn };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write dialogue turn'),
		};
	}
}

/**
 * Write a claim to the database
 * @param claim Partial claim data (claim_id will be auto-generated if not provided)
 * @returns Result containing the created claim or error
 */
export function writeClaim(
	claim: Omit<Claim, 'claim_id' | 'created_at'> & { claim_id?: string }
): Result<Claim> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const claimId = claim.claim_id || randomUUID();

		const stmt = db.prepare(`
            INSERT INTO claims (claim_id, statement, introduced_by, criticality, status, dialogue_id, turn_id, created_at, assumption_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `);

		stmt.run(
			claimId,
			claim.statement,
			claim.introduced_by,
			claim.criticality,
			claim.status,
			claim.dialogue_id,
			claim.turn_id,
			(claim as Claim).assumption_type ?? null
		);

		// Create corresponding claim event
		const eventResult = writeClaimEvent({
			claim_id: claimId,
			event_type: ClaimEventType.CREATED,
			source: claim.introduced_by,
			evidence_ref: null,
		});

		if (!eventResult.success) {
			return {
				success: false,
				error: new Error(
					`Claim created but event logging failed: ${eventResult.error.message}`
				),
			};
		}

		// Retrieve the created claim
		const createdClaim = db
			.prepare('SELECT * FROM claims WHERE claim_id = ?')
			.get(claimId) as Claim;

		// Incremental FTS indexing (best-effort)
		if (claim.statement?.trim()) {
			try {
				const { indexContent } = require('../database/ftsSync') as typeof import('../database/ftsSync');
				indexContent('claims', claimId, claim.dialogue_id, claim.statement);
			} catch { /* FTS indexing is best-effort */ }
		}

		return { success: true, value: createdClaim };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write claim'),
		};
	}
}

/**
 * Write a claim event to the database
 * @param event Partial event data (event_id will be auto-generated)
 * @returns Result containing the created event or error
 */
export function writeClaimEvent(
	event: Omit<ClaimEvent, 'event_id' | 'timestamp'>
): Result<ClaimEvent> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const eventId = randomUUID();

		const stmt = db.prepare(`
            INSERT INTO claim_events (event_id, claim_id, event_type, source, evidence_ref, timestamp)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `);

		stmt.run(
			eventId,
			event.claim_id,
			event.event_type,
			event.source,
			event.evidence_ref
		);

		// Retrieve the created event
		const createdEvent = db
			.prepare('SELECT * FROM claim_events WHERE event_id = ?')
			.get(eventId) as ClaimEvent;

		return { success: true, value: createdEvent };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write claim event'),
		};
	}
}

/**
 * Write a verdict to the database
 * @param verdict Partial verdict data (verdict_id will be auto-generated)
 * @returns Result containing the created verdict or error
 */
export function writeVerdict(
	verdict: Omit<Verdict, 'verdict_id' | 'timestamp'>
): Result<Verdict> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const verdictId = randomUUID();

		const stmt = db.prepare(`
            INSERT INTO verdicts (verdict_id, claim_id, verdict, constraints_ref, evidence_ref, rationale, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);

		stmt.run(
			verdictId,
			verdict.claim_id,
			verdict.verdict,
			verdict.constraints_ref,
			verdict.evidence_ref,
			verdict.rationale
		);

		// Update claim status based on verdict
		const updateClaimStmt = db.prepare(`
            UPDATE claims SET status = ? WHERE claim_id = ?
        `);

		updateClaimStmt.run(verdict.verdict, verdict.claim_id);

		// Create corresponding claim event
		let eventType: ClaimEventType;
		if (verdict.verdict === VerdictType.VERIFIED) {
			eventType = ClaimEventType.VERIFIED;
		} else if (verdict.verdict === VerdictType.DISPROVED) {
			eventType = ClaimEventType.DISPROVED;
		} else {
			eventType = ClaimEventType.CREATED;
		}

		const eventResult = writeClaimEvent({
			claim_id: verdict.claim_id,
			event_type: eventType,
			source: Role.VERIFIER,
			evidence_ref: verdict.evidence_ref,
		});

		if (!eventResult.success && isLoggerInitialized()) {
			getLogger().child({ component: 'events' }).warn('Verdict created but event logging failed', {
				error: eventResult.error.message,
			});
		}

		// Retrieve the created verdict
		const createdVerdict = db
			.prepare('SELECT * FROM verdicts WHERE verdict_id = ?')
			.get(verdictId) as Verdict;

		// Incremental FTS indexing (best-effort)
		if (verdict.rationale?.trim()) {
			try {
				// Look up dialogue_id from the claim
				const claimRow = db.prepare('SELECT dialogue_id FROM claims WHERE claim_id = ?').get(verdict.claim_id) as { dialogue_id: string } | undefined;
				if (claimRow) {
					const { indexContent } = require('../database/ftsSync') as typeof import('../database/ftsSync');
					indexContent('verdicts', verdictId, claimRow.dialogue_id, verdict.rationale);
				}
			} catch { /* FTS indexing is best-effort */ }
		}

		return { success: true, value: createdVerdict };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write verdict'),
		};
	}
}

/**
 * Write a gate to the database
 * @param gate Partial gate data (gate_id will be auto-generated)
 * @returns Result containing the created gate or error
 */
export function writeGate(
	gate: Omit<Gate, 'gate_id' | 'created_at' | 'resolved_at'>
): Result<Gate> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const gateId = randomUUID();

		const stmt = db.prepare(`
            INSERT INTO gates (gate_id, dialogue_id, reason, status, blocking_claims, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `);

		stmt.run(
			gateId,
			gate.dialogue_id,
			gate.reason,
			gate.status,
			JSON.stringify(gate.blocking_claims)
		);

		// Retrieve the created gate
		const createdGate = db
			.prepare('SELECT * FROM gates WHERE gate_id = ?')
			.get(gateId) as Gate & { blocking_claims: string };

		// Parse blocking_claims JSON
		const result: Gate = {
			...createdGate,
			blocking_claims: JSON.parse(createdGate.blocking_claims),
			resolved_at: null,
		};

		return { success: true, value: result };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write gate'),
		};
	}
}

/**
 * Write a human decision to the database
 * @param decision Partial decision data (decision_id will be auto-generated)
 * @returns Result containing the created decision or error
 */
export function writeHumanDecision(
	decision: Omit<HumanDecision, 'decision_id' | 'timestamp'>
): Result<HumanDecision> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const decisionId = randomUUID();

		const stmt = db.prepare(`
            INSERT INTO human_decisions (decision_id, gate_id, action, rationale, attachments_ref, timestamp)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `);

		stmt.run(
			decisionId,
			decision.gate_id,
			decision.action,
			decision.rationale,
			decision.attachments_ref
		);

		// If decision resolves the gate, update gate status
		if (
			decision.action === 'APPROVE' ||
			decision.action === 'OVERRIDE'
		) {
			const updateGateStmt = db.prepare(`
                UPDATE gates SET status = 'RESOLVED', resolved_at = datetime('now') WHERE gate_id = ?
            `);

			updateGateStmt.run(decision.gate_id);
		}

		// Retrieve the created decision
		const createdDecision = db
			.prepare('SELECT * FROM human_decisions WHERE decision_id = ?')
			.get(decisionId) as HumanDecision;

		return { success: true, value: createdDecision };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write human decision'),
		};
	}
}

/**
 * Write a constraint manifest to the database
 * @param manifest Partial manifest data (manifest_id will be auto-generated)
 * @returns Result containing the created manifest or error
 */
export function writeConstraintManifest(
	manifest: Omit<ConstraintManifest, 'manifest_id' | 'timestamp'>
): Result<ConstraintManifest> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const manifestId = randomUUID();

		const stmt = db.prepare(`
            INSERT INTO constraint_manifests (manifest_id, version, constraints_ref, timestamp)
            VALUES (?, ?, ?, datetime('now'))
        `);

		stmt.run(manifestId, manifest.version, manifest.constraints_ref);

		// Retrieve the created manifest
		const createdManifest = db
			.prepare('SELECT * FROM constraint_manifests WHERE manifest_id = ?')
			.get(manifestId) as ConstraintManifest;

		return { success: true, value: createdManifest };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write constraint manifest'),
		};
	}
}

/**
 * Write an artifact to the database
 * @param artifact Partial artifact data (artifact_id will be auto-generated)
 * @returns Result containing the created artifact or error
 */
export function writeArtifact(
	artifact: Omit<Artifact, 'artifact_id' | 'created_at'>
): Result<Artifact> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const artifactId = randomUUID();

		const stmt = db.prepare(`
            INSERT INTO artifacts (artifact_id, content_hash, content, mime_type, size, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
        `);

		stmt.run(
			artifactId,
			artifact.content_hash,
			artifact.content,
			artifact.mime_type,
			artifact.size
		);

		// Retrieve the created artifact
		const createdArtifact = db
			.prepare('SELECT * FROM artifacts WHERE artifact_id = ?')
			.get(artifactId) as Artifact;

		return { success: true, value: createdArtifact };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write artifact'),
		};
	}
}

/**
 * Write an artifact reference to the database
 * @param reference Partial reference data (reference_id will be auto-generated)
 * @returns Result containing the created reference or error
 */
export function writeArtifactReference(
	reference: Omit<ArtifactReference, 'reference_id' | 'created_at'>
): Result<ArtifactReference> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const referenceId = randomUUID();

		const stmt = db.prepare(`
            INSERT INTO artifact_references (reference_id, artifact_type, file_path, content_hash, git_commit, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);

		stmt.run(
			referenceId,
			reference.artifact_type,
			reference.file_path,
			reference.content_hash,
			reference.git_commit,
			reference.metadata
		);

		// Retrieve the created reference
		const createdReference = db
			.prepare('SELECT * FROM artifact_references WHERE reference_id = ?')
			.get(referenceId) as ArtifactReference;

		return { success: true, value: createdReference };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write artifact reference'),
		};
	}
}

// ==================== INTAKE CONVERSATION WRITERS ====================

/**
 * Write a new INTAKE conversation turn to the database.
 * Stores the paired human message + expert response + plan snapshot.
 * @returns The created turn record
 */
export function writeIntakeTurn(options: {
	dialogueId: string;
	turnNumber: number;
	humanMessage: string;
	expertResponse: IntakeTurnResponse | IntakeGatheringTurnResponse;
	planSnapshot: IntakePlanDocument | null;
	tokenCount: number;
	isGathering?: boolean;
}): Result<IntakeConversationTurn> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const expertResponseJson = JSON.stringify(options.expertResponse);
		// During gathering, planSnapshot is null — store empty plan doc (column is NOT NULL)
		const planSnapshotJson = JSON.stringify(
			options.planSnapshot ?? createEmptyPlanDocument()
		);

		const stmt = db.prepare(
			`INSERT INTO intake_turns (dialogue_id, turn_number, human_message, expert_response, plan_snapshot, token_count, is_gathering, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
		);

		const info = stmt.run(
			options.dialogueId,
			options.turnNumber,
			options.humanMessage,
			expertResponseJson,
			planSnapshotJson,
			options.tokenCount,
			options.isGathering ? 1 : 0,
		);

		const created = db
			.prepare('SELECT * FROM intake_turns WHERE id = ?')
			.get(info.lastInsertRowid) as {
			id: number;
			dialogue_id: string;
			turn_number: number;
			human_message: string;
			expert_response: string;
			plan_snapshot: string;
			token_count: number;
			is_gathering: number;
			created_at: string;
		};

		const parsedPlan = JSON.parse(created.plan_snapshot) as IntakePlanDocument;

		return {
			success: true,
			value: {
				id: created.id,
				dialogueId: created.dialogue_id,
				turnNumber: created.turn_number,
				humanMessage: created.human_message,
				expertResponse: JSON.parse(
					created.expert_response
				) as IntakeTurnResponse | IntakeGatheringTurnResponse,
				planSnapshot: parsedPlan.version === 0 && !parsedPlan.title
					? null
					: parsedPlan,
				tokenCount: created.token_count,
				isGathering: created.is_gathering === 1,
				createdAt: created.created_at,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to write intake turn'),
		};
	}
}

/**
 * Update the INTAKE conversation state.
 * Supports partial updates — only provided fields are changed.
 */
export function updateIntakeConversation(
	dialogueId: string,
	updates: {
		subState?: IntakeSubState;
		turnCount?: number;
		draftPlan?: IntakePlanDocument;
		accumulations?: IntakeAccumulation[];
		finalizedPlan?: IntakePlanDocument | null;
		// V15 Adaptive Deep INTAKE fields
		intakeMode?: IntakeMode;
		domainCoverage?: DomainCoverageMap | null;
		currentDomain?: EngineeringDomain | null;
		checkpoints?: IntakeCheckpoint[];
		classifierResult?: IntakeModeRecommendation | null;
		// V17 Inverted flow
		clarificationRound?: number;
	}
): Result<IntakeConversationState> {
	const db = getDatabase();
	if (!db) {
		return {
			success: false,
			error: new Error('Database not initialized'),
		};
	}

	try {
		const setClauses: string[] = ["updated_at = datetime('now')"];
		const params: unknown[] = [];

		if (updates.subState !== undefined) {
			setClauses.push('sub_state = ?');
			params.push(updates.subState);
		}
		if (updates.turnCount !== undefined) {
			setClauses.push('turn_count = ?');
			params.push(updates.turnCount);
		}
		if (updates.draftPlan !== undefined) {
			setClauses.push('draft_plan = ?');
			params.push(JSON.stringify(updates.draftPlan));
		}
		if (updates.accumulations !== undefined) {
			setClauses.push('accumulations = ?');
			params.push(JSON.stringify(updates.accumulations));
		}
		if (updates.finalizedPlan !== undefined) {
			setClauses.push('finalized_plan = ?');
			params.push(
				updates.finalizedPlan === null
					? null
					: JSON.stringify(updates.finalizedPlan)
			);
		}
		// V15 Adaptive Deep INTAKE fields
		if (updates.intakeMode !== undefined) {
			setClauses.push('intake_mode = ?');
			params.push(updates.intakeMode);
		}
		if (updates.domainCoverage !== undefined) {
			setClauses.push('domain_coverage = ?');
			params.push(
				updates.domainCoverage === null
					? null
					: JSON.stringify(updates.domainCoverage)
			);
		}
		if (updates.currentDomain !== undefined) {
			setClauses.push('current_domain = ?');
			params.push(updates.currentDomain);
		}
		if (updates.checkpoints !== undefined) {
			setClauses.push('checkpoints = ?');
			params.push(JSON.stringify(updates.checkpoints));
		}
		if (updates.classifierResult !== undefined) {
			setClauses.push('classifier_result = ?');
			params.push(
				updates.classifierResult === null
					? null
					: JSON.stringify(updates.classifierResult)
			);
		}
		// V17 Inverted flow
		if (updates.clarificationRound !== undefined) {
			setClauses.push('clarification_round = ?');
			params.push(updates.clarificationRound);
		}

		params.push(dialogueId);

		db.prepare(
			`UPDATE intake_conversations SET ${setClauses.join(', ')} WHERE dialogue_id = ?`
		).run(...params);

		// Retrieve updated record
		const row = db
			.prepare(
				'SELECT * FROM intake_conversations WHERE dialogue_id = ?'
			)
			.get(dialogueId) as {
			id: number;
			dialogue_id: string;
			sub_state: string;
			turn_count: number;
			draft_plan: string;
			accumulations: string;
			finalized_plan: string | null;
			created_at: string;
			updated_at: string;
			intake_mode: string | null;
			domain_coverage: string | null;
			current_domain: string | null;
			checkpoints: string | null;
			classifier_result: string | null;
		};

		if (!row) {
			return {
				success: false,
				error: new Error(
					`Intake conversation not found for dialogue: ${dialogueId}`
				),
			};
		}

		return {
			success: true,
			value: {
				id: row.id,
				dialogueId: row.dialogue_id,
				subState: row.sub_state as IntakeSubState,
				turnCount: row.turn_count,
				draftPlan: JSON.parse(row.draft_plan) as IntakePlanDocument,
				accumulations: JSON.parse(
					row.accumulations
				) as IntakeAccumulation[],
				finalizedPlan: row.finalized_plan
					? (JSON.parse(row.finalized_plan) as IntakePlanDocument)
					: null,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				// V15 Adaptive Deep INTAKE fields
				intakeMode: row.intake_mode as IntakeMode | null,
				domainCoverage: row.domain_coverage
					? (JSON.parse(row.domain_coverage) as DomainCoverageMap)
					: null,
				currentDomain: row.current_domain as EngineeringDomain | null,
				checkpoints: row.checkpoints
					? (JSON.parse(row.checkpoints) as IntakeCheckpoint[])
					: [],
				classifierResult: row.classifier_result
					? (JSON.parse(row.classifier_result) as IntakeModeRecommendation)
					: null,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to update intake conversation'),
		};
	}
}

// ==================== Q&A EXCHANGE WRITER ====================

/**
 * Persist a Q&A exchange to the cli_activity_events table.
 * Uses event_type 'qa_exchange' with summary = question, detail = answer.
 * No schema migration needed — event_type has no CHECK constraint.
 */
export function writeQaExchange(options: {
	dialogueId: string;
	question: string;
	answer: string;
	phase?: string;
}): Result<{ event_id: number }> {
	const db = getDatabase();
	if (!db) {
		return { success: false, error: new Error('Database not initialized') };
	}

	try {
		const timestamp = new Date().toISOString();
		const info = db.prepare(
			`INSERT INTO cli_activity_events
			 (dialogue_id, timestamp, role, phase, event_type, summary, detail)
			 VALUES (?, ?, 'HUMAN', ?, 'qa_exchange', ?, ?)`
		).run(
			options.dialogueId,
			timestamp,
			options.phase ?? null,
			options.question,
			options.answer,
		);

		// Index for FTS search
		try {
			const { indexContent } = require('../database/ftsSync');
			indexContent('cli_activity_events', String(info.lastInsertRowid), options.dialogueId,
				`${options.question} ${options.answer}`);
		} catch { /* FTS is best-effort */ }

		return { success: true, value: { event_id: info.lastInsertRowid as number } };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to write Q&A exchange'),
		};
	}
}
