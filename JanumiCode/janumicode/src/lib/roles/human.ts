/**
 * Human Authority Integration
 * Implements Phase 6.6: Human decision capture, override tracking, full audit trail
 * This is NOT an LLM-backed agent - it's a system for recording human authority decisions
 */

import type { Result, HumanDecision, Claim, Verdict } from '../types';
import { HumanAction } from '../types';
import { getDatabase } from '../database';
import { randomUUID } from 'node:crypto';
import { getLogger, isLoggerInitialized } from '../logging';

/**
 * Override types for tracking what is being overridden
 */
export enum OverrideType {
	VERIFIER_VERDICT = 'VERIFIER_VERDICT',
	EXECUTOR_PROPOSAL = 'EXECUTOR_PROPOSAL',
	CONSTRAINT = 'CONSTRAINT',
	HISTORICAL_PRECEDENT = 'HISTORICAL_PRECEDENT',
}

/**
 * Waiver for tracking constraint overrides
 */
export interface ConstraintWaiver {
	waiver_id: string;
	constraint_ref: string;
	justification: string;
	granted_by: string;
	timestamp: string;
	expiration?: string;
}

/**
 * Human decision input
 */
export interface HumanDecisionInput {
	gateId: string;
	action: HumanAction;
	rationale: string;
	attachmentsRef?: string[];
	overrideType?: OverrideType;
	overrideTargetId?: string;
	waiver?: Omit<ConstraintWaiver, 'waiver_id' | 'timestamp'>;
	decisionMaker: string;
}

/**
 * Human decision validation result
 */
export interface HumanDecisionValidation {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

/**
 * Capture a human decision
 * Records decision with full audit trail and optional override tracking
 *
 * @param input Human decision input
 * @returns Result containing captured decision
 */
export function captureHumanDecision(
	input: HumanDecisionInput
): Result<HumanDecision> {
	try {
		// Validate input
		const validation = validateHumanDecisionInput(input);
		if (!validation.isValid) {
			return {
				success: false,
				error: new Error(
					`Human decision validation failed:\n${validation.errors.join('\n')}`
				),
			};
		}

		// Log warnings if any
		if (validation.warnings.length > 0 && isLoggerInitialized()) {
			getLogger().child({ component: 'role:human' }).warn('Human decision warnings', { warnings: validation.warnings });
		}

		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const decisionId = randomUUID();
		const timestamp = new Date().toISOString();

		// Store decision
		const decision: HumanDecision = {
			decision_id: decisionId,
			gate_id: input.gateId,
			action: input.action,
			rationale: input.rationale,
			attachments_ref: input.attachmentsRef?.join(',') ?? null,
			timestamp,
		};

		db.prepare(
			`
			INSERT INTO human_decisions (
				decision_id, gate_id, action, rationale,
				attachments_ref, timestamp
			) VALUES (?, ?, ?, ?, ?, ?)
		`
		).run(
			decision.decision_id,
			decision.gate_id,
			decision.action,
			decision.rationale,
			decision.attachments_ref,
			decision.timestamp
		);

		// Track override if applicable
		if (input.overrideType && input.overrideTargetId) {
			const overrideResult = trackOverride(
				decisionId,
				input.overrideType,
				input.overrideTargetId,
				input.rationale,
				input.decisionMaker
			);

			if (!overrideResult.success) {
				return overrideResult;
			}
		}

		// Store waiver if applicable
		if (input.waiver) {
			const waiverResult = storeConstraintWaiver(
				decisionId,
				input.waiver,
				input.decisionMaker
			);

			if (!waiverResult.success) {
				return waiverResult;
			}
		}

		return { success: true, value: decision };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to capture human decision'),
		};
	}
}

/**
 * Validate human decision input
 * Ensures all required fields are present and valid
 */
function validateHumanDecisionInput(
	input: HumanDecisionInput
): HumanDecisionValidation {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Check required fields
	if (!input.gateId) {
		errors.push('Gate ID is required');
	}

	if (!input.action) {
		errors.push('Action is required');
	}

	if (!input.rationale || input.rationale.trim().length === 0) {
		errors.push('Rationale is required and cannot be empty');
	}

	if (!input.decisionMaker || input.decisionMaker.trim().length === 0) {
		errors.push('Decision maker is required');
	}

	// Check action validity
	const validActions = Object.values(HumanAction);
	if (!validActions.includes(input.action)) {
		errors.push(`Invalid action: ${input.action}`);
	}

	// Check rationale quality
	if (input.rationale && input.rationale.trim().length < 10) {
		warnings.push(
			'Rationale is very short - consider providing more detailed justification'
		);
	}

	// Check override consistency
	if (input.overrideType && !input.overrideTargetId) {
		errors.push('Override type specified but no override target ID provided');
	}

	if (!input.overrideType && input.overrideTargetId) {
		errors.push('Override target ID specified but no override type provided');
	}

	// Check override type validity
	if (input.overrideType) {
		const validOverrideTypes = Object.values(OverrideType);
		if (!validOverrideTypes.includes(input.overrideType)) {
			errors.push(`Invalid override type: ${input.overrideType}`);
		}
	}

	// Warn for overrides without attachments
	if (input.overrideType && (!input.attachmentsRef || input.attachmentsRef.length === 0)) {
		warnings.push(
			'Override decision has no supporting attachments - consider attaching evidence'
		);
	}

	// Check waiver validity
	if (input.waiver) {
		if (!input.waiver.constraint_ref) {
			errors.push('Waiver specified but no constraint reference provided');
		}

		if (!input.waiver.justification || input.waiver.justification.trim().length === 0) {
			errors.push('Waiver specified but no justification provided');
		}

		if (input.waiver.justification && input.waiver.justification.trim().length < 20) {
			warnings.push(
				'Waiver justification is very short - consider providing detailed justification'
			);
		}

		// Check expiration validity
		if (input.waiver.expiration) {
			const expirationDate = new Date(input.waiver.expiration);
			const now = new Date();

			if (expirationDate <= now) {
				errors.push('Waiver expiration date must be in the future');
			}
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Track an override
 * Records what is being overridden and by whom
 */
function trackOverride(
	decisionId: string,
	overrideType: OverrideType,
	targetId: string,
	rationale: string,
	decisionMaker: string
): Result<void> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Create overrides table if it doesn't exist
		db.exec(`
			CREATE TABLE IF NOT EXISTS overrides (
				override_id TEXT PRIMARY KEY,
				decision_id TEXT NOT NULL,
				override_type TEXT NOT NULL,
				target_id TEXT NOT NULL,
				rationale TEXT NOT NULL,
				decision_maker TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				FOREIGN KEY (decision_id) REFERENCES human_decisions(decision_id)
			)
		`);

		const overrideId = randomUUID();
		const timestamp = new Date().toISOString();

		db.prepare(
			`
			INSERT INTO overrides (
				override_id, decision_id, override_type, target_id,
				rationale, decision_maker, timestamp
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			overrideId,
			decisionId,
			overrideType,
			targetId,
			rationale,
			decisionMaker,
			timestamp
		);

		return { success: true, value: undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error : new Error('Failed to track override'),
		};
	}
}

/**
 * Store a constraint waiver
 * Records constraints that have been waived with justification
 */
function storeConstraintWaiver(
	decisionId: string,
	waiver: Omit<ConstraintWaiver, 'waiver_id' | 'timestamp'>,
	grantedBy: string
): Result<ConstraintWaiver> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		// Create waivers table if it doesn't exist
		db.exec(`
			CREATE TABLE IF NOT EXISTS constraint_waivers (
				waiver_id TEXT PRIMARY KEY,
				decision_id TEXT NOT NULL,
				constraint_ref TEXT NOT NULL,
				justification TEXT NOT NULL,
				granted_by TEXT NOT NULL,
				timestamp TEXT NOT NULL,
				expiration TEXT,
				FOREIGN KEY (decision_id) REFERENCES human_decisions(decision_id)
			)
		`);

		const waiverRecord: ConstraintWaiver = {
			waiver_id: randomUUID(),
			constraint_ref: waiver.constraint_ref,
			justification: waiver.justification,
			granted_by: grantedBy,
			timestamp: new Date().toISOString(),
			expiration: waiver.expiration,
		};

		db.prepare(
			`
			INSERT INTO constraint_waivers (
				waiver_id, decision_id, constraint_ref, justification,
				granted_by, timestamp, expiration
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`
		).run(
			waiverRecord.waiver_id,
			decisionId,
			waiverRecord.constraint_ref,
			waiverRecord.justification,
			waiverRecord.granted_by,
			waiverRecord.timestamp,
			waiverRecord.expiration
		);

		return { success: true, value: waiverRecord };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to store constraint waiver'),
		};
	}
}

/**
 * Retrieve decision history for a gate
 * Gets all decisions related to a specific gate
 *
 * @param gateId Gate ID
 * @returns Result containing decision history
 */
export function getDecisionHistory(
	gateId: string
): Result<HumanDecision[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const decisions = db
			.prepare(
				`
			SELECT decision_id, gate_id, action, rationale,
			       attachments_ref, timestamp
			FROM human_decisions
			WHERE gate_id = ?
			ORDER BY timestamp DESC
		`
			)
			.all(gateId) as HumanDecision[];

		return { success: true, value: decisions };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve decision history'),
		};
	}
}

/**
 * Retrieve override history
 * Gets all overrides of a specific type and target
 *
 * @param overrideType Override type
 * @param targetId Target ID (optional)
 * @returns Result containing override records
 */
export function getOverrideHistory(
	overrideType: OverrideType,
	targetId?: string
): Result<
	Array<{
		override_id: string;
		decision_id: string;
		override_type: OverrideType;
		target_id: string;
		rationale: string;
		decision_maker: string;
		timestamp: string;
	}>
> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		let query = `
			SELECT override_id, decision_id, override_type, target_id,
			       rationale, decision_maker, timestamp
			FROM overrides
			WHERE override_type = ?
		`;

		const params: string[] = [overrideType];

		if (targetId) {
			query += ' AND target_id = ?';
			params.push(targetId);
		}

		query += ' ORDER BY timestamp DESC';

		const overrides = db.prepare(query).all(...params) as Array<{
			override_id: string;
			decision_id: string;
			override_type: OverrideType;
			target_id: string;
			rationale: string;
			decision_maker: string;
			timestamp: string;
		}>;

		return { success: true, value: overrides };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve override history'),
		};
	}
}

/**
 * Check if a constraint has an active waiver
 * Verifies if a constraint waiver is still valid
 *
 * @param constraintRef Constraint reference
 * @returns Result containing whether waiver is active
 */
export function hasActiveWaiver(constraintRef: string): Result<boolean> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const now = new Date().toISOString();

		const waiver = db
			.prepare(
				`
			SELECT waiver_id, expiration
			FROM constraint_waivers
			WHERE constraint_ref = ?
			  AND (expiration IS NULL OR datetime(expiration) > datetime(?))
			ORDER BY timestamp DESC
			LIMIT 1
		`
			)
			.get(constraintRef, now) as ConstraintWaiver | undefined;

		return { success: true, value: waiver !== undefined };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to check waiver status'),
		};
	}
}

/**
 * Get all active waivers
 * Returns all currently valid constraint waivers
 *
 * @returns Result containing active waivers
 */
export function getActiveWaivers(): Result<ConstraintWaiver[]> {
	try {
		const db = getDatabase();
		if (!db) {
			return {
				success: false,
				error: new Error('Database not initialized'),
			};
		}

		const now = new Date().toISOString();

		const waivers = db
			.prepare(
				`
			SELECT waiver_id, constraint_ref, justification,
			       granted_by, timestamp, expiration
			FROM constraint_waivers
			WHERE expiration IS NULL OR datetime(expiration) > datetime(?)
			ORDER BY timestamp DESC
		`
			)
			.all(now) as ConstraintWaiver[];

		return { success: true, value: waivers };
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error
					? error
					: new Error('Failed to retrieve active waivers'),
		};
	}
}
