/**
 * Media Workflow (v1)
 *
 * DBOS durable workflow for managing field tech media operations.
 * Handles: register, markUploaded, addVoiceNote, updateTranscription, delete.
 */

import { DBOS } from '@dbos-inc/dbos-sdk';
import { prisma } from '../db.js';
import type { MediaType } from '../../../../generated/prisma/client.js';
import { type EntityWorkflowResult } from './schemas.js';
import { createWorkflowLogger, logWorkflowStart, logWorkflowEnd } from './workflowLogger.js';
import { recordWorkflowEvent } from '../api/middleware/activityEvent.js';
import { recordSpanError } from '../api/middleware/tracing.js';

// Action types for the unified workflow
export const MediaAction = {
	REGISTER_MEDIA: 'REGISTER_MEDIA',
	MARK_UPLOADED: 'MARK_UPLOADED',
	ADD_VOICE_NOTE: 'ADD_VOICE_NOTE',
	UPDATE_TRANSCRIPTION: 'UPDATE_TRANSCRIPTION',
	DELETE_MEDIA: 'DELETE_MEDIA'
} as const;

export type MediaAction = (typeof MediaAction)[keyof typeof MediaAction];

const WORKFLOW_STATUS_EVENT = 'media_status';
const WORKFLOW_ERROR_EVENT = 'media_error';

export interface MediaWorkflowInput {
	action: MediaAction;
	organizationId: string;
	userId: string;
	mediaId?: string;
	data: Record<string, unknown>;
}

export interface MediaWorkflowResult extends EntityWorkflowResult {
	// Inherits success, error, entityId from EntityWorkflowResult
}

// Step functions for each operation
async function registerMedia(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const media = await prisma.jobMedia.create({
		data: {
			organizationId,
			jobId: data.jobId as string,
			jobVisitId: data.jobVisitId as string | undefined,
			mediaType: data.mediaType as MediaType,
			fileName: data.fileName as string,
			fileSize: data.fileSize as number,
			mimeType: data.mimeType as string,
			storageKey: data.storageKey as string,
			caption: data.caption as string | undefined,
			latitude: data.latitude as number | undefined,
			longitude: data.longitude as number | undefined,
			capturedAt: data.capturedAt ? new Date(data.capturedAt as string) : null,
			uploadedBy: userId,
			isUploaded: false
		}
	});

	return media.id;
}

async function markUploaded(
	organizationId: string,
	userId: string,
	mediaId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.jobMedia.update({
		where: { id: mediaId },
		data: {
			isUploaded: true,
			uploadedAt: new Date(),
			storageUrl: data.storageUrl as string | undefined
		}
	});

	return mediaId;
}

async function addVoiceNote(
	organizationId: string,
	userId: string,
	data: Record<string, unknown>
): Promise<string> {
	const media = await prisma.jobMedia.create({
		data: {
			organizationId,
			jobId: data.jobId as string,
			jobVisitId: data.jobVisitId as string | undefined,
			mediaType: 'AUDIO',
			fileName: data.fileName as string,
			fileSize: data.fileSize as number,
			mimeType: data.mimeType as string,
			storageKey: data.storageKey as string,
			caption: data.caption as string | undefined,
			latitude: data.latitude as number | undefined,
			longitude: data.longitude as number | undefined,
			capturedAt: data.capturedAt ? new Date(data.capturedAt as string) : new Date(),
			uploadedBy: userId,
			isUploaded: false,
			isTranscribed: false
		}
	});

	return media.id;
}

async function updateTranscription(
	organizationId: string,
	userId: string,
	mediaId: string,
	data: Record<string, unknown>
): Promise<string> {
	await prisma.jobMedia.update({
		where: { id: mediaId },
		data: {
			transcription: data.transcription as string,
			isTranscribed: true
		}
	});

	return mediaId;
}

async function deleteMedia(
	organizationId: string,
	userId: string,
	mediaId: string
): Promise<string> {
	await prisma.jobMedia.delete({ where: { id: mediaId } });
	return mediaId;
}

// Main workflow function
async function mediaWorkflow(input: MediaWorkflowInput): Promise<MediaWorkflowResult> {
	const log = createWorkflowLogger('mediaWorkflow', DBOS.workflowID, input.action);
	const startTime = logWorkflowStart(log, input.action, input as any);

	try {
		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'started', action: input.action });

		let entityId: string | undefined;

		switch (input.action) {
			case 'REGISTER_MEDIA':
				entityId = await DBOS.runStep(
					() => registerMedia(input.organizationId, input.userId, input.data),
					{ name: 'registerMedia' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'JOB', // Media is attached to jobs
					entityId: entityId,
					action: 'CREATE',
					eventCategory: 'EXECUTION',
					summary: `Registered media: ${input.data.fileName}`,
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'mediaWorkflow_v1',
					workflowStep: 'REGISTER_MEDIA',
					workflowVersion: 'v1'
				});
				break;

			case 'MARK_UPLOADED':
				entityId = await DBOS.runStep(
					() => markUploaded(input.organizationId, input.userId, input.mediaId!, input.data),
					{ name: 'markUploaded' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'JOB',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'SYSTEM',
					summary: 'Media upload confirmed',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'mediaWorkflow_v1',
					workflowStep: 'MARK_UPLOADED',
					workflowVersion: 'v1'
				});
				break;

			case 'ADD_VOICE_NOTE':
				entityId = await DBOS.runStep(
					() => addVoiceNote(input.organizationId, input.userId, input.data),
					{ name: 'addVoiceNote' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'JOB',
					entityId: entityId,
					action: 'CREATE',
					eventCategory: 'EXECUTION',
					summary: 'Voice note added',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'mediaWorkflow_v1',
					workflowStep: 'ADD_VOICE_NOTE',
					workflowVersion: 'v1'
				});
				break;

			case 'UPDATE_TRANSCRIPTION':
				entityId = await DBOS.runStep(
					() => updateTranscription(input.organizationId, input.userId, input.mediaId!, input.data),
					{ name: 'updateTranscription' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'JOB',
					entityId: entityId,
					action: 'UPDATE',
					eventCategory: 'SYSTEM', // Usually done by AI/System
					summary: 'Voice note transcription updated',
					performedById: input.userId,
					performedByType: 'SYSTEM',
					workflowId: 'mediaWorkflow_v1',
					workflowStep: 'UPDATE_TRANSCRIPTION',
					workflowVersion: 'v1'
				});
				break;

			case 'DELETE_MEDIA':
				entityId = await DBOS.runStep(
					() => deleteMedia(input.organizationId, input.userId, input.mediaId!),
					{ name: 'deleteMedia' }
				);
				await recordWorkflowEvent({
					organizationId: input.organizationId,
					entityType: 'JOB',
					entityId: input.mediaId!,
					action: 'DELETE',
					eventCategory: 'EXECUTION',
					summary: 'Media deleted',
					performedById: input.userId,
					performedByType: 'HUMAN',
					workflowId: 'mediaWorkflow_v1',
					workflowStep: 'DELETE_MEDIA',
					workflowVersion: 'v1'
				});
				break;

			default:
				const errorResult = { success: false, error: `Unknown action: ${input.action}` };
				logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
				return errorResult;
		}

		await DBOS.setEvent(WORKFLOW_STATUS_EVENT, { step: 'completed', entityId });

		const successResult = { success: true, entityId };
		logWorkflowEnd(log, input.action, true, startTime, successResult as any);
		return successResult;

	} catch (error) {
		const errorObj = error instanceof Error ? error : new Error(String(error));
		const errorMessage = errorObj.message;
		log.error('Workflow failed', { action: input.action, error: errorMessage });
		await DBOS.setEvent(WORKFLOW_ERROR_EVENT, { error: errorMessage });

		// Record error on span for trace visibility
		await recordSpanError(errorObj, {
			errorCode: 'WORKFLOW_FAILED',
			errorType: 'MEDIA_WORKFLOW_ERROR'
		});

		const errorResult = { success: false, error: errorMessage };
		logWorkflowEnd(log, input.action, false, startTime, errorResult as any);
		return errorResult;
	}
}

export const mediaWorkflow_v1 = DBOS.registerWorkflow(mediaWorkflow);

export async function startMediaWorkflow(
	input: MediaWorkflowInput,
	idempotencyKey: string
): Promise<MediaWorkflowResult> {
	const workflowId = idempotencyKey || `media-${input.action}-${input.mediaId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(mediaWorkflow_v1, { workflowID: idempotencyKey})(input);
	return handle.getResult();
}
