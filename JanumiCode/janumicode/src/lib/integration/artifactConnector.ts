/**
 * Artifact Connector Integration
 * Implements Phase 9.1.4: Connect artifact manager to executor output
 * Bridges executor output with artifact storage and management
 */

import { nanoid } from 'nanoid';
import type { Result, ExecutorResponse, Artifact } from '../types';
import { CodedError } from '../types';
import { storeArtifact, getArtifact, getAllArtifacts } from '../artifacts';
import { getDatabase } from '../database';

/**
 * Process executor output options
 */
export interface ProcessExecutorOutputOptions {
	/** Dialogue ID */
	dialogueId: string;
	/** Executor response */
	executorResponse: ExecutorResponse;
	/** Turn ID */
	turnId?: number;
}

/**
 * Process executor output result
 */
export interface ProcessExecutorOutputResult {
	/** Created artifacts */
	artifacts: Artifact[];
	/** Number of files created */
	fileCount: number;
	/** Total lines of code */
	totalLines: number;
}

/**
 * Process executor output and create artifacts
 * Extracts code artifacts from executor response and stores them
 *
 * @param options Processing options
 * @returns Result with created artifacts
 */
export async function processExecutorOutput(
	options: ProcessExecutorOutputOptions
): Promise<Result<ProcessExecutorOutputResult>> {
	try {
		const { dialogueId, executorResponse, turnId } = options;
		const artifacts: Artifact[] = [];
		let totalLines = 0;

		// Extract code blocks from proposal
		const codeBlocks = extractCodeBlocks(executorResponse.proposal);

		// Create artifact for each code block
		for (const block of codeBlocks) {
			const artifactResult = await storeArtifact({
				type: 'blob',
				content: block.code,
				mimeType: 'text/plain',
				metadata: {
					dialogueId,
					language: block.language,
					filePath: block.filePath,
					description: block.description,
					turnId,
					executorProposal: executorResponse.proposal,
				},
			});

			if (artifactResult.success) {
				artifacts.push(artifactResult.value.artifact!);
				totalLines += block.code.split('\n').length;
			}
		}

		// Create artifact for full proposal (if not empty)
		if (executorResponse.proposal.trim().length > 0) {
			const proposalResult = await storeArtifact({
				type: 'blob',
				content: executorResponse.proposal,
				mimeType: 'text/markdown',
				metadata: {
					dialogueId,
					turnId,
					codeBlockCount: codeBlocks.length,
				},
			});

			if (proposalResult.success) {
				artifacts.push(proposalResult.value.artifact!);
			}
		}

		return {
			success: true,
			value: {
				artifacts,
				fileCount: codeBlocks.length,
				totalLines,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'EXECUTOR_OUTPUT_PROCESSING_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Code block structure
 */
interface CodeBlock {
	/** Programming language */
	language: string;
	/** Code content */
	code: string;
	/** File path (if specified) */
	filePath?: string;
	/** Description (if specified) */
	description?: string;
}

/**
 * Extract code blocks from markdown text
 * Parses markdown code fences and extracts code
 *
 * @param text Markdown text
 * @returns Array of code blocks
 */
function extractCodeBlocks(text: string): CodeBlock[] {
	const blocks: CodeBlock[] = [];
	const codeBlockRegex = /```(\w+)?\s*(?:\[([^\]]+)\])?\s*\n([\s\S]*?)```/g;

	let match;
	while ((match = codeBlockRegex.exec(text)) !== null) {
		const language = match[1] || 'plaintext';
		const metadata = match[2]; // Optional metadata like file path
		const code = match[3].trim();

		const block: CodeBlock = {
			language,
			code,
		};

		// Parse metadata if present (format: "filepath.ts - Description")
		if (metadata) {
			const parts = metadata.split(' - ');
			block.filePath = parts[0].trim();
			if (parts.length > 1) {
				block.description = parts.slice(1).join(' - ').trim();
			}
		}

		blocks.push(block);
	}

	return blocks;
}

/**
 * Get artifacts for dialogue
 * Retrieves all artifacts associated with a dialogue
 *
 * @param dialogueId Dialogue ID
 * @param artifactType Optional filter by artifact type
 * @returns Result with artifacts
 */
export function getDialogueArtifacts(
	dialogueId: string,
	artifactType?: 'code' | 'proposal' | 'test' | 'documentation'
): Result<Artifact[]> {
	try {
		const allArtifacts = getAllArtifacts(dialogueId);

		if (!allArtifacts.success) {
			return allArtifacts;
		}

		// Note: artifactType filtering not supported in current implementation
		// as Artifact type doesn't include artifact_type field
		const artifacts = allArtifacts.value;

		return {
			success: true,
			value: artifacts,
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'GET_DIALOGUE_ARTIFACTS_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Get artifact statistics
 * Computes statistics for dialogue artifacts
 *
 * @param dialogueId Dialogue ID
 * @returns Result with statistics
 */
export function getArtifactStatistics(dialogueId: string): Result<{
	totalArtifacts: number;
	codeArtifacts: number;
	proposalArtifacts: number;
	testArtifacts: number;
	documentationArtifacts: number;
	totalLines: number;
	languages: Record<string, number>;
}> {
	try {
		const allArtifacts = getAllArtifacts(dialogueId);

		if (!allArtifacts.success) {
			return {
				success: false,
				error: allArtifacts.error,
			};
		}

		const artifacts = allArtifacts.value;
		const stats = {
			totalArtifacts: artifacts.length,
			codeArtifacts: 0,
			proposalArtifacts: 0,
			testArtifacts: 0,
			documentationArtifacts: 0,
			totalLines: 0,
			languages: {} as Record<string, number>,
		};

		for (const artifact of artifacts) {
			// Convert Buffer to string for line counting
			const contentStr = artifact.content.toString('utf-8');
			stats.totalLines += contentStr.split('\n').length;

			// Classify by MIME type
			if (artifact.mime_type.includes('javascript') || artifact.mime_type.includes('typescript')) {
				stats.codeArtifacts++;
				const lang = artifact.mime_type.includes('typescript') ? 'typescript' : 'javascript';
				stats.languages[lang] = (stats.languages[lang] || 0) + 1;
			} else if (artifact.mime_type.includes('markdown')) {
				stats.proposalArtifacts++;
			}
		}

		return {
			success: true,
			value: stats,
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'GET_ARTIFACT_STATISTICS_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Export artifacts to files
 * Writes artifacts to the file system
 *
 * @param dialogueId Dialogue ID
 * @param outputDir Output directory
 * @returns Result with exported files
 */
export function exportArtifactsToFiles(
	dialogueId: string,
	outputDir: string
): Result<{ exportedFiles: string[] }> {
	// This function would be implemented in a real system
	// For now, return a placeholder result
	return {
		success: false,
		error: new CodedError(
			'NOT_IMPLEMENTED',
			'Artifact export not implemented in Phase 9'
		),
	};
}

/**
 * Validate artifact content
 * Checks if artifact content is valid
 *
 * @param artifact Artifact to validate
 * @returns Validation result
 */
export function validateArtifactContent(artifact: Artifact): Result<{
	valid: boolean;
	issues: string[];
}> {
	try {
		const issues: string[] = [];

		// Check content is not empty
		if (!artifact.content || artifact.content.length === 0) {
			issues.push('Artifact content is empty');
		}

		// Check content length
		if (artifact.content.length > 1000000) {
			// 1MB limit
			issues.push('Artifact content exceeds 1MB limit');
		}

		// Validate content can be decoded as UTF-8
		try {
			const contentStr = artifact.content.toString('utf-8');
			if (contentStr.trim().length === 0) {
				issues.push('Artifact content is empty after trimming');
			}
		} catch {
			issues.push('Artifact content is not valid UTF-8');
		}

		return {
			success: true,
			value: {
				valid: issues.length === 0,
				issues,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'ARTIFACT_VALIDATION_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}

/**
 * Get artifact diff
 * Compares two artifacts and returns diff information
 *
 * @param artifactId1 First artifact ID
 * @param artifactId2 Second artifact ID
 * @returns Result with diff information
 */
export function getArtifactDiff(
	artifactId1: string,
	artifactId2: string
): Result<{
	linesAdded: number;
	linesRemoved: number;
	linesChanged: number;
}> {
	try {
		const artifact1Result = getArtifact(artifactId1);
		const artifact2Result = getArtifact(artifactId2);

		if (!artifact1Result.success || !artifact2Result.success) {
			return {
				success: false,
				error: new CodedError(
					'ARTIFACT_NOT_FOUND',
					'One or both artifacts not found'
				),
			};
		}

		// Convert Buffer to string
		const content1 = artifact1Result.value.content.toString('utf-8');
		const content2 = artifact2Result.value.content.toString('utf-8');

		const lines1 = content1.split('\n');
		const lines2 = content2.split('\n');

		// Simple line-based diff (not a true diff algorithm)
		const linesAdded = Math.max(0, lines2.length - lines1.length);
		const linesRemoved = Math.max(0, lines1.length - lines2.length);
		const linesChanged = Math.min(lines1.length, lines2.length);

		return {
			success: true,
			value: {
				linesAdded,
				linesRemoved,
				linesChanged,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: new CodedError(
				'ARTIFACT_DIFF_FAILED',
				error instanceof Error ? error.message : 'Unknown error'
			),
		};
	}
}
