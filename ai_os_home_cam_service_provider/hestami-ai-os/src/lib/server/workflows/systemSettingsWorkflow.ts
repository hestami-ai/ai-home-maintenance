/**
 * System Settings Workflow (v1)
 *
 * DBOS durable workflow for system settings operations.
 * Handles: UPSERT_SETTING.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import { type EntityWorkflowResult } from './schemas.js';
import { recordSpanError } from '../api/middleware/tracing.js';
import { createWorkflowLogger } from './workflowLogger.js';

const log = createWorkflowLogger('SystemSettingsWorkflow');

// Action types for the unified workflow
export const SystemSettingsAction = {
	UPSERT_SETTING: 'UPSERT_SETTING'
} as const;

export type SystemSettingsAction = (typeof SystemSettingsAction)[keyof typeof SystemSettingsAction];

export interface SystemSettingsWorkflowInput {
	action: SystemSettingsAction;
	userId: string;
	data: {
		key?: string;
		value?: Record<string, unknown>;
	};
}

export interface SystemSettingsWorkflowResult extends EntityWorkflowResult {
	settingId?: string;
}

// Step functions
async function upsertSetting(
	userId: string,
	key: string,
	value: Record<string, unknown>
): Promise<{ settingId: string }> {
	const setting = await prisma.systemSetting.upsert({
		where: { key },
		create: {
			key,
			value: value as any,
			updatedBy: userId
		},
		update: {
			value: value as any,
			updatedBy: userId
		}
	});

	log.info('UPSERT_SETTING completed', { settingId: setting.id, key });
	return { settingId: setting.id };
}

// Main workflow function
async function systemSettingsWorkflow(input: SystemSettingsWorkflowInput): Promise<SystemSettingsWorkflowResult> {
	try {
		switch (input.action) {
			case 'UPSERT_SETTING': {
				if (!input.data.key || !input.data.value) {
					throw new Error('key and value are required for UPSERT_SETTING');
				}
				const result = await DBOS.runStep(
					() => upsertSetting(input.userId, input.data.key!, input.data.value!),
					{ name: 'upsertSetting' }
				);
				return {
					success: true,
					entityId: result.settingId,
					settingId: result.settingId
				};
			}

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}
	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		console.error(`[SystemSettingsWorkflow] Error in ${input.action}:`, errorMessage);

		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'SYSTEM_SETTINGS_WORKFLOW_ERROR'
		});

		return { success: false, error: errorMessage };
	}
}

export const systemSettingsWorkflow_v1 = DBOS.registerWorkflow(systemSettingsWorkflow);

export async function startSystemSettingsWorkflow(
	input: SystemSettingsWorkflowInput,
	idempotencyKey: string
): Promise<SystemSettingsWorkflowResult> {
	const handle = await DBOS.startWorkflow(systemSettingsWorkflow_v1, { workflowID: idempotencyKey })(input);
	return handle.getResult();
}
