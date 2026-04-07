import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTempDatabase, type TempDbContext } from '../../helpers/tempDatabase';
import { initTestLogger, teardownTestLogger } from '../../helpers/fakeLogger';
import {
	storeArtifact,
	retrieveArtifact,
	findArtifactsByClaim,
	findArtifactsByVerdict,
	linkArtifactToClaim,
} from '../../../lib/artifacts/manager';
import { getDatabase } from '../../../lib/database/init';
import * as fs from 'node:fs/promises';

vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
}));

vi.mock('../../../lib/artifacts/gitIntegration', () => ({
	isGitRepository: vi.fn().mockResolvedValue({ success: true, value: false }),
	getGitFileInfo: vi.fn().mockResolvedValue({ success: false }),
	getGitRepoInfo: vi.fn().mockResolvedValue({ success: false }),
	getCurrentCommitHash: vi.fn().mockResolvedValue({ success: false }),
}));

describe('artifacts/manager', () => {
	let tempDb: TempDbContext;

	beforeEach(() => {
		initTestLogger();
		tempDb = createTempDatabase();
	});

	afterEach(() => {
		tempDb.cleanup();
		teardownTestLogger();
		vi.clearAllMocks();
	});

	describe('storeArtifact - blob type', () => {
		it('stores blob artifact successfully', async () => {
			const result = await storeArtifact({
				type: 'blob',
				content: 'Test content',
				mimeType: 'text/plain',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.artifact).toBeDefined();
				expect(result.value.reference).toBeDefined();
				expect(result.value.contentRef).toMatch(/^blob:\/\//);
			}
		});

		it('includes metadata correctly', async () => {
			const result = await storeArtifact({
				type: 'blob',
				content: 'Test',
				mimeType: 'text/plain',
				metadata: { key: 'value' },
				relatedClaims: ['claim1'],
				relatedVerdict: 'verdict1',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				const metadata = JSON.parse(result.value.reference.metadata);
				expect(metadata.key).toBe('value');
				expect(metadata.relatedClaims).toContain('claim1');
				expect(metadata.relatedVerdict).toBe('verdict1');
			}
		});

		it('fails when content is missing', async () => {
			const result = await storeArtifact({
				type: 'blob',
				mimeType: 'text/plain',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Content required');
			}
		});
	});

	describe('storeArtifact - file type', () => {
		it('stores file artifact successfully', async () => {
			vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('file content'));

			const result = await storeArtifact({
				type: 'file',
				filePath: 'src/test.ts',
				workspaceRoot: '/workspace',
				mimeType: 'text/typescript',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.reference).toBeDefined();
				expect(result.value.contentRef).toMatch(/^file:\/\//);
			}
		});

		it('fails when filePath is missing', async () => {
			const result = await storeArtifact({
				type: 'file',
				workspaceRoot: '/workspace',
				mimeType: 'text/plain',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('filePath and workspaceRoot required');
			}
		});
	});

	describe('storeArtifact - evidence type', () => {
		it('stores evidence artifact successfully', async () => {
			const result = await storeArtifact({
				type: 'evidence',
				content: 'Evidence content',
				sourceUrl: 'https://example.com/evidence',
				mimeType: 'text/html',
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value.reference).toBeDefined();
				expect(result.value.contentRef).toMatch(/^evidence:\/\//);
				const metadata = JSON.parse(result.value.reference.metadata);
				expect(metadata.sourceUrl).toBe('https://example.com/evidence');
			}
		});

		it('fails when content is missing', async () => {
			const result = await storeArtifact({
				type: 'evidence',
				sourceUrl: 'https://example.com',
				mimeType: 'text/html',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('content and sourceUrl required');
			}
		});
	});

	describe('retrieveArtifact', () => {
		it('retrieves blob artifact', async () => {
			const storeResult = await storeArtifact({
				type: 'blob',
				content: 'Test content',
				mimeType: 'text/plain',
			});

			if (!storeResult.success) {
				throw new Error('Store failed');
			}

			const retrieveResult = await retrieveArtifact(storeResult.value.contentRef);
			expect(retrieveResult.success).toBe(true);
			if (retrieveResult.success) {
				expect(retrieveResult.value.content.toString()).toBe('Test content');
				expect(retrieveResult.value.mimeType).toBe('text/plain');
			}
		});

		it('retrieves file artifact', async () => {
			vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('file content'));

			const storeResult = await storeArtifact({
				type: 'file',
				filePath: 'src/test.ts',
				workspaceRoot: '/workspace',
				mimeType: 'text/typescript',
			});

			if (!storeResult.success) {
				throw new Error('Store failed');
			}

			vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('file content from disk'));

			const retrieveResult = await retrieveArtifact(
				storeResult.value.contentRef,
				'/workspace'
			);
			expect(retrieveResult.success).toBe(true);
			if (retrieveResult.success) {
				expect(retrieveResult.value.content.toString()).toBe('file content from disk');
			}
		});

		it('fails with unknown reference format', async () => {
			const result = await retrieveArtifact('unknown://reference');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Unknown content reference format');
			}
		});
	});

	describe('findArtifactsByClaim', () => {
		it('finds artifacts linked to claim', async () => {
			await storeArtifact({
				type: 'blob',
				content: 'Evidence 1',
				mimeType: 'text/plain',
				relatedClaims: ['claim123'],
			});

			await storeArtifact({
				type: 'blob',
				content: 'Evidence 2',
				mimeType: 'text/plain',
				relatedClaims: ['claim123', 'claim456'],
			});

			await storeArtifact({
				type: 'blob',
				content: 'Unrelated',
				mimeType: 'text/plain',
				relatedClaims: ['claim999'],
			});

			const result = findArtifactsByClaim('claim123');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
			}
		});

		it('returns empty array when no artifacts found', async () => {
			const result = findArtifactsByClaim('nonexistent');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toEqual([]);
			}
		});
	});

	describe('findArtifactsByVerdict', () => {
		it('finds artifacts linked to verdict', async () => {
			await storeArtifact({
				type: 'blob',
				content: 'Evidence 1',
				mimeType: 'text/plain',
				relatedVerdict: 'verdict123',
			});

			await storeArtifact({
				type: 'blob',
				content: 'Evidence 2',
				mimeType: 'text/plain',
				relatedVerdict: 'verdict123',
			});

			const result = findArtifactsByVerdict('verdict123');
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.value).toHaveLength(2);
			}
		});
	});

	describe('linkArtifactToClaim', () => {
		it('links artifact to claim', async () => {
			const storeResult = await storeArtifact({
				type: 'blob',
				content: 'Test',
				mimeType: 'text/plain',
			});

			if (!storeResult.success) {
				throw new Error('Store failed');
			}

			const linkResult = linkArtifactToClaim(
				storeResult.value.reference.reference_id,
				'claim123'
			);

			expect(linkResult.success).toBe(true);

			const findResult = findArtifactsByClaim('claim123');
			expect(findResult.success).toBe(true);
			if (findResult.success) {
				expect(findResult.value).toHaveLength(1);
			}
		});

		it('does not duplicate claim if already linked', async () => {
			const storeResult = await storeArtifact({
				type: 'blob',
				content: 'Test',
				mimeType: 'text/plain',
				relatedClaims: ['claim123'],
			});

			if (!storeResult.success) {
				throw new Error('Store failed');
			}

			linkArtifactToClaim(storeResult.value.reference.reference_id, 'claim123');

			const db = getDatabase()!;
			const ref = db
				.prepare('SELECT metadata FROM artifact_references WHERE reference_id = ?')
				.get(storeResult.value.reference.reference_id) as { metadata: string };

			const metadata = JSON.parse(ref.metadata);
			expect(metadata.relatedClaims.filter((c: string) => c === 'claim123')).toHaveLength(1);
		});

		it('fails when artifact not found', async () => {
			const result = linkArtifactToClaim('nonexistent', 'claim123');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Artifact reference not found');
			}
		});
	});

	describe('error handling', () => {
		it('handles database errors', async () => {
			tempDb.cleanup();

			const result = await storeArtifact({
				type: 'blob',
				content: 'Test',
				mimeType: 'text/plain',
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.message).toContain('Database not initialized');
			}
		});
	});
});
