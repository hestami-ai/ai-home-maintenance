/**
 * Gate Management
 * Implements Phase 7.3 & 7.4: Gate creation, tracking, resolution, and human handling
 * Gates represent blocking points requiring human decision
 */

import type { Result, Gate, HumanDecision, Claim } from '../types';
import { GateStatus, ClaimStatus } from '../types';
import { getDatabase } from '../database';
import { randomUUID } from 'node:crypto';

/**
 * Gate creation options
 */
export interface CreateGateOptions {
	dialogueId: string;
	reason: string;
	blockingClaims: string[]; // Claim IDs that triggered this gate
	metadata?: Record<string, unknown>;
}

/**
 * Gate resolution options
 */
export interface ResolveGateOptions {
	gateId: string;
	decisionId: string; // Human decision ID
	resolution: string; // Resolution description
	metadata?: Record<string, unknown>;
}

/**
 * Gate trigger conditions
 */
export enum GateTriggerCondition {
	CRITICAL_CLAIM_DISPROVED = 'CRITICAL_CLAIM_DISPROVED',
	CRITICAL_CLAIM_UNKNOWN = 'CRITICAL_CLAIM_UNKNOWN',
	CONFLICTING_PRECEDENTS = 'CONFLICTING_PRECEDENTS',
	RISK_ACCEPTANCE_REQUIRED = 'RISK_ACCEPTANCE_REQUIRED',
	CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
	MANUAL_GATE = 'MANUAL_GATE',
	// MAKER gate triggers
	REPAIR_ESCALATION = 'REPAIR_ESCALATION',
	SCOPE_VIOLATION = 'SCOPE_VIOLATION',
	ACCEPTANCE_CONTRACT_FAILURE = 'ACCEPTANCE_CONTRACT_FAILURE',
	DECOMPOSITION_REJECTED = 'DECOMPOSITION_REJECTED',
	VERIFICATION_FAILURE = 'VERIFICATION_FAILURE',
	// Architecture phase gate triggers
	ARCHITECTURE_REVIEW = 'ARCHITECTURE_REVIEW',
}

/**
 * Create a gate
 * Opens a gate to block workflow until human decision
 *
 * @param options Gate creation options
 * @returns Result containing created gate
 */
export function createGate(options: CreateGateOptions): Result<Gate> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const gateId = randomUUID();
		const now = new Date().toISOString();

		const gate: Gate = {
			gate_id: gateId,
			dialogue_id: options.dialogueId,
			reason: options.reason,
			status: GateStatus.OPEN,
			blocking_claims: options.blockingClaims,
			created_at: now,
			resolved_at: null,
		};

		db.prepare(
			`
			INSERT INTO gates (
				gate_id, dialogue_id, reason, status,
				blocking_claims, created_at, resolved_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			gate.gate_id,
			gate.dialogue_id,
			gate.reason,
			gate.status,
			JSON.stringify(gate.blocking_claims),
			gate.created_at,
			gate.resolved_at
		);

		// Create gate metadata table if needed
		if (options.metadata) {
			db.exec(`
				CREATE TABLE IF NOT EXISTS gate_metadata (
					gate_id TEXT PRIMARY KEY,
					metadata TEXT NOT NULL,
					FOREIGN KEY (gate_id) REFERENCES gates(gate_id)
				)
			`);

			db.prepare(
				`
				INSERT INTO gate_metadata (gate_id, metadata)
				VALUES (?, ?)
			`
			).run(gateId, JSON.stringify(options.metadata));
		}

		return { success: true, value: gate };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to create gate'),
		};
	}
}

/**
 * Create a review gate
 * Convenience wrapper for creating gates during REVIEW or VALIDATE phases
 * where there are no specific blocking claims — the gate simply pauses
 * the workflow for human review.
 *
 * @param dialogueId Dialogue ID
 * @param reason Human-readable reason for the gate
 * @returns Result containing created gate
 */
export function createReviewGate(
	dialogueId: string,
	reason: string
): Result<Gate> {
	return createGate({
		dialogueId,
		reason,
		blockingClaims: [],
		metadata: {
			condition: GateTriggerCondition.MANUAL_GATE,
		},
	});
}

/**
 * Get gate by ID
 * Retrieves a gate record
 *
 * @param gateId Gate ID
 * @returns Result containing gate
 */
export function getGate(gateId: string): Result<Gate> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const gate = db
			.prepare(
				`
			SELECT gate_id, dialogue_id, reason, status,
			       blocking_claims, created_at, resolved_at
			FROM gates
			WHERE gate_id = ?
		`
			)
			.get(gateId) as
			| (Omit<Gate, 'blocking_claims'> & { blocking_claims: string })
			| undefined;

		if (!gate) {
			return {
				success: false,
				error: new Error(`Gate not found: ${gateId}`),
			};
		}

		// Parse blocking_claims JSON
		return {
			success: true,
			value: {
				...gate,
				blocking_claims: JSON.parse(gate.blocking_claims) as string[],
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error : new Error('Failed to get gate'),
		};
	}
}

/**
 * Get all gates for a dialogue
 * Retrieves all gates (both open and resolved)
 *
 * @param dialogueId Dialogue ID
 * @param statusFilter Optional status filter (OPEN/RESOLVED)
 * @returns Result containing gates
 */
export function getGatesForDialogue(
	dialogueId: string,
	statusFilter?: GateStatus
): Result<Gate[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		let query = `
			SELECT gate_id, dialogue_id, reason, status,
			       blocking_claims, created_at, resolved_at
			FROM gates
			WHERE dialogue_id = ?
		`;

		const params: unknown[] = [dialogueId];

		if (statusFilter) {
			query += ' AND status = ?';
			params.push(statusFilter);
		}

		query += ' ORDER BY created_at DESC';

		const gates = db.prepare(query).all(...params) as Array<
			Omit<Gate, 'blocking_claims'> & { blocking_claims: string }
		>;

		return {
			success: true,
			value: gates.map((gate) => ({
				...gate,
				blocking_claims: JSON.parse(gate.blocking_claims) as string[],
			})),
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get gates for dialogue'),
		};
	}
}

/**
 * Resolve a gate
 * Marks a gate as resolved after human decision
 *
 * @param options Gate resolution options
 * @returns Result containing resolved gate
 */
export function resolveGate(options: ResolveGateOptions): Result<Gate> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Verify gate exists and is open
		const gateResult = getGate(options.gateId);
		if (!gateResult.success) {
			return gateResult;
		}

		if (gateResult.value.status !== GateStatus.OPEN) {
			return {
				success: false,
				error: new Error(`Gate ${options.gateId} is not open`),
			};
		}

		const now = new Date().toISOString();

		// Update gate status
		db.prepare(
			`
			UPDATE gates
			SET status = ?,
			    resolved_at = ?
			WHERE gate_id = ?
		`
		).run(GateStatus.RESOLVED, now, options.gateId);

		// Store resolution metadata if provided
		if (options.metadata) {
			db.exec(`
				CREATE TABLE IF NOT EXISTS gate_resolutions (
					gate_id TEXT PRIMARY KEY,
					decision_id TEXT NOT NULL,
					resolution TEXT NOT NULL,
					metadata TEXT NOT NULL,
					timestamp TEXT NOT NULL,
					FOREIGN KEY (gate_id) REFERENCES gates(gate_id),
					FOREIGN KEY (decision_id) REFERENCES human_decisions(decision_id)
				)
			`);

			db.prepare(
				`
				INSERT INTO gate_resolutions (
					gate_id, decision_id, resolution, metadata, timestamp
				) VALUES (?, ?, ?, ?, ?)
			`
			).run(
				options.gateId,
				options.decisionId,
				options.resolution,
				JSON.stringify(options.metadata),
				now
			);
		}

		return getGate(options.gateId);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to resolve gate'),
		};
	}
}

/**
 * Check for gate trigger conditions
 * Examines dialogue state to determine if a gate should be opened
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing trigger condition and blocking claims
 */
export function checkGateTriggers(
	dialogueId: string
): Result<{
	shouldTrigger: boolean;
	condition?: GateTriggerCondition;
	blockingClaims?: string[];
	reason?: string;
}> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Check for critical claims that are DISPROVED
		const disprovedCritical = db
			.prepare(
				`
			SELECT claim_id, statement
			FROM claims
			WHERE dialogue_id = ?
			  AND criticality = 'CRITICAL'
			  AND status = 'DISPROVED'
		`
			)
			.all(dialogueId) as Array<{ claim_id: string; statement: string }>;

		if (disprovedCritical.length > 0) {
			return {
				success: true,
				value: {
					shouldTrigger: true,
					condition: GateTriggerCondition.CRITICAL_CLAIM_DISPROVED,
					blockingClaims: disprovedCritical.map((c) => c.claim_id),
					reason: `Critical claim(s) disproved: ${disprovedCritical.map((c) => c.statement).join(', ')}`,
				},
			};
		}

		// Check for critical claims that are UNKNOWN
		const unknownCritical = db
			.prepare(
				`
			SELECT claim_id, statement
			FROM claims
			WHERE dialogue_id = ?
			  AND criticality = 'CRITICAL'
			  AND status = 'UNKNOWN'
		`
			)
			.all(dialogueId) as Array<{ claim_id: string; statement: string }>;

		if (unknownCritical.length > 0) {
			return {
				success: true,
				value: {
					shouldTrigger: true,
					condition: GateTriggerCondition.CRITICAL_CLAIM_UNKNOWN,
					blockingClaims: unknownCritical.map((c) => c.claim_id),
					reason: `Critical claim(s) unknown: ${unknownCritical.map((c) => c.statement).join(', ')}`,
				},
			};
		}

		// No gate triggers detected
		return {
			success: true,
			value: {
				shouldTrigger: false,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to check gate triggers'),
		};
	}
}

/**
 * Trigger gate if conditions are met
 * Checks for trigger conditions and creates gate if necessary
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing created gate (if triggered)
 */
export function triggerGateIfNeeded(
	dialogueId: string
): Result<Gate | null> {
	try {
		const triggerResult = checkGateTriggers(dialogueId);
		if (!triggerResult.success) {
			return triggerResult as Result<Gate | null>;
		}

		const trigger = triggerResult.value;

		if (!trigger.shouldTrigger) {
			return { success: true, value: null };
		}

		// Create gate
		return createGate({
			dialogueId,
			reason: trigger.reason ?? 'Unknown reason',
			blockingClaims: trigger.blockingClaims ?? [],
			metadata: {
				condition: trigger.condition,
			},
		});
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to trigger gate'),
		};
	}
}

/**
 * Get blocking claims for a gate
 * Retrieves the claims that triggered this gate
 *
 * @param gateId Gate ID
 * @returns Result containing blocking claims
 */
export function getBlockingClaims(gateId: string): Result<Claim[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const gateResult = getGate(gateId);
		if (!gateResult.success) {
			return gateResult as Result<Claim[]>;
		}

		const gate = gateResult.value;

		if (gate.blocking_claims.length === 0) {
			return { success: true, value: [] };
		}

		const placeholders = gate.blocking_claims.map(() => '?').join(',');
		const query = `
			SELECT claim_id, statement, introduced_by, criticality,
			       status, dialogue_id, turn_id, created_at
			FROM claims
			WHERE claim_id IN (${placeholders})
		`;

		const claims = db.prepare(query).all(...gate.blocking_claims) as Claim[];

		return { success: true, value: claims };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get blocking claims'),
		};
	}
}

/**
 * Check if dialogue has open gates
 * Quick check for blocking gates
 *
 * @param dialogueId Dialogue ID
 * @returns Result containing whether there are open gates
 */
export function hasOpenGates(dialogueId: string): Result<boolean> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const result = db
			.prepare(
				`
			SELECT COUNT(*) as count
			FROM gates
			WHERE dialogue_id = ? AND status = 'OPEN'
		`
			)
			.get(dialogueId) as { count: number };

		return { success: true, value: result.count > 0 };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to check for open gates'),
		};
	}
}

/**
 * Get gate resolution details
 * Retrieves the resolution information for a resolved gate
 *
 * @param gateId Gate ID
 * @returns Result containing resolution details
 */
export function getGateResolution(
	gateId: string
): Result<{
	decision_id: string;
	resolution: string;
	metadata: Record<string, unknown>;
	timestamp: string;
} | null> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const resolution = db
			.prepare(
				`
			SELECT decision_id, resolution, metadata, timestamp
			FROM gate_resolutions
			WHERE gate_id = ?
		`
			)
			.get(gateId) as
			| {
					decision_id: string;
					resolution: string;
					metadata: string;
					timestamp: string;
			  }
			| undefined;

		if (!resolution) {
			return { success: true, value: null };
		}

		return {
			success: true,
			value: {
				...resolution,
				metadata: JSON.parse(resolution.metadata) as Record<
					string,
					unknown
				>,
			},
		};
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to get gate resolution'),
		};
	}
}

/**
 * Create a repair escalation gate.
 * Convenience wrapper for when the bounded repair engine needs human intervention.
 *
 * @param dialogueId Dialogue ID
 * @param unitId Task unit that failed repair
 * @param failureType Classified failure type
 * @param reason Human-readable reason for escalation
 * @returns Result containing created gate
 */
export function createRepairEscalationGate(
	dialogueId: string,
	unitId: string,
	failureType: string,
	reason: string,
	unitLabel?: string
): Result<Gate> {
	return createGate({
		dialogueId,
		reason,
		blockingClaims: [],
		metadata: {
			condition: GateTriggerCondition.REPAIR_ESCALATION,
			unit_id: unitId,
			failure_type: failureType,
			unit_label: unitLabel,
		},
	});
}

/**
 * Create an evaluator-enriched repair escalation gate.
 * Calls the failure evaluator LLM to analyze executor output, then stores
 * the structured evaluation in gate metadata for rich UI rendering.
 *
 * Falls back to the basic gate if the evaluation call fails.
 */
export async function createEnrichedRepairEscalationGate(
	dialogueId: string,
	unitId: string,
	failureType: string,
	reason: string,
	unitLabel: string,
	executorOutput: string,
	unitGoal: string,
): Promise<Result<Gate>> {
	// Attempt LLM evaluation of the failure
	let evaluation: import('./failureEvaluator').FailureEvaluation | undefined;
	try {
		const { evaluateUnitFailure } = await import('./failureEvaluator.js');
		const evalResult = await evaluateUnitFailure(
			unitLabel, unitGoal, executorOutput, reason, failureType
		);
		if (evalResult.success) {
			evaluation = evalResult.value;
		}
	} catch {
		// Evaluation failed — proceed with basic gate
	}

	const enrichedReason = evaluation?.summary
		? `${reason} — ${evaluation.summary}`
		: reason;

	return createGate({
		dialogueId,
		reason: enrichedReason,
		blockingClaims: [],
		metadata: {
			condition: GateTriggerCondition.REPAIR_ESCALATION,
			unit_id: unitId,
			failure_type: failureType,
			unit_label: unitLabel,
			executor_output: executorOutput,
			...(evaluation ? { evaluation } : {}),
		},
	});
}
