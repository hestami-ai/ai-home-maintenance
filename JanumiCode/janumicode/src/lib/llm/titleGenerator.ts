/**
 * LLM-based Dialogue Title Generator
 * Generates concise, human-readable titles for dialogues using the LLM.
 * Best-effort: failures fall back to a truncated goal string.
 */

import { invokeRole } from './roleManager';
import { MessageRole } from './provider';
import { updateDialogueTitle } from '../dialogue/lifecycle';
import { emitDialogueTitleUpdated } from '../integration/eventBus';
import { getLogger } from '../logging/logger';

const MAX_TITLE_LENGTH = 60;

/**
 * Generate and persist a dialogue title using the LLM.
 *
 * This is fire-and-forget — callers should use `.catch(() => {})`.
 * On success the title is saved to the DB and a bus event is emitted.
 * On failure a truncated goal is saved instead.
 */
export async function generateDialogueTitle(
	dialogueId: string,
	goal: string,
	conversationContext?: string
): Promise<string> {
	const logger = getLogger();

	try {
		const userContent = conversationContext
			? `Goal: ${goal}\n\nConversation context:\n${conversationContext}`
			: `Goal: ${goal}`;

		const result = await invokeRole('executor', {
			systemPrompt:
				'Generate a concise title (max 60 characters) for the following dialogue goal. ' +
				'The title should be descriptive and human-readable, like a chat thread subject line. ' +
				'Return ONLY the title text, nothing else — no quotes, no prefix.',
			messages: [
				{
					role: MessageRole.USER,
					content: userContent,
				},
			],
			model: 'default',
			maxTokens: 80,
			temperature: 0.3,
		});

		let title: string;

		if (result.success && result.value.content.trim()) {
			title = result.value.content.trim();
			// Strip wrapping quotes if the model added them
			if (
				(title.startsWith('"') && title.endsWith('"')) ||
				(title.startsWith("'") && title.endsWith("'"))
			) {
				title = title.slice(1, -1);
			}
			// Enforce length limit
			if (title.length > MAX_TITLE_LENGTH) {
				title = title.substring(0, MAX_TITLE_LENGTH - 3) + '...';
			}
		} else {
			logger.warn('Title generation LLM call failed, using fallback', {
				dialogueId,
				error: result.success ? 'empty response' : result.error.message,
			});
			title = truncateGoal(goal);
		}

		// Persist and emit
		const updateResult = updateDialogueTitle(dialogueId, title);
		if (!updateResult.success) {
			logger.warn('Failed to persist dialogue title', {
				dialogueId,
				error: updateResult.error.message,
			});
		}

		emitDialogueTitleUpdated(dialogueId, title);
		return title;
	} catch (error) {
		logger.warn('Title generation threw unexpectedly, using fallback', {
			dialogueId,
			error: error instanceof Error ? error.message : String(error),
		});

		const fallback = truncateGoal(goal);
		updateDialogueTitle(dialogueId, fallback);
		emitDialogueTitleUpdated(dialogueId, fallback);
		return fallback;
	}
}

function truncateGoal(goal: string): string {
	if (goal.length <= MAX_TITLE_LENGTH) {
		return goal;
	}
	return goal.substring(0, MAX_TITLE_LENGTH - 3) + '...';
}
