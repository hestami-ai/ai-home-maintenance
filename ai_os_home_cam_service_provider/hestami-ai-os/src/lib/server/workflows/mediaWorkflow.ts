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

// Action types for the unified workflow
export const MediaAction = {
	REGISTER_MEDIA: 'REGISTER_MEDIA',
	MARK_UPLOADED: 'MARK_UPLOADED',
	ADD_VOICE_NOTE: 'ADD_VOICE_NOTE',
	UPDATE_TRANSCRIPTION: 'UPDATE_TRANSCRIPTION',
	DELETE_MEDIA: 'DELETE_MEDIA'
} as const;

export type MediaAction = (typeof MediaAction)[keyof typeof MediaAction];

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

	console.log(`[MediaWorkflow] REGISTER_MEDIA media:${media.id} by user ${userId}`);
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

	console.log(`[MediaWorkflow] MARK_UPLOADED media:${mediaId} by user ${userId}`);
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

	console.log(`[MediaWorkflow] ADD_VOICE_NOTE media:${media.id} by user ${userId}`);
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

	console.log(`[MediaWorkflow] UPDATE_TRANSCRIPTION media:${mediaId} by user ${userId}`);
	return mediaId;
}

async function deleteMedia(
	organizationId: string,
	userId: string,
	mediaId: string
): Promise<string> {
	await prisma.jobMedia.delete({ where: { id: mediaId } });

	console.log(`[MediaWorkflow] DELETE_MEDIA media:${mediaId} by user ${userId}`);
	return mediaId;
}

// Main workflow function
async function mediaWorkflow(input: MediaWorkflowInput): Promise<MediaWorkflowResult> {
	try {
		let entityId: string | undefined;

		switch (input.action) {
			case 'REGISTER_MEDIA':
				entityId = await DBOS.runStep(
					() => registerMedia(input.organizationId, input.userId, input.data),
					{ name: 'registerMedia' }
				);
				break;

			case 'MARK_UPLOADED':
				entityId = await DBOS.runStep(
					() => markUploaded(input.organizationId, input.userId, input.mediaId!, input.data),
					{ name: 'markUploaded' }
				);
				break;

			case 'ADD_VOICE_NOTE':
				entityId = await DBOS.runStep(
					() => addVoiceNote(input.organizationId, input.userId, input.data),
					{ name: 'addVoiceNote' }
				);
				break;

			case 'UPDATE_TRANSCRIPTION':
				entityId = await DBOS.runStep(
					() => updateTranscription(input.organizationId, input.userId, input.mediaId!, input.data),
					{ name: 'updateTranscription' }
				);
				break;

			case 'DELETE_MEDIA':
				entityId = await DBOS.runStep(
					() => deleteMedia(input.organizationId, input.userId, input.mediaId!),
					{ name: 'deleteMedia' }
				);
				break;

			default:
				return { success: false, error: `Unknown action: ${input.action}` };
		}

		return { success: true, entityId };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[MediaWorkflow] Error in ${input.action}:`, errorMessage);
		return { success: false, error: errorMessage };
	}
}

export const mediaWorkflow_v1 = DBOS.registerWorkflow(mediaWorkflow);

export async function startMediaWorkflow(
	input: MediaWorkflowInput,
	idempotencyKey?: string
): Promise<MediaWorkflowResult> {
	const workflowId = idempotencyKey || `media-${input.action}-${input.mediaId || 'new'}-${Date.now()}`;
	const handle = await DBOS.startWorkflow(mediaWorkflow_v1, { workflowID: workflowId })(input);
	return handle.getResult();
}
