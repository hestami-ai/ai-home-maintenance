import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { createModuleLogger } from '$lib/server/logger';

const log = createModuleLogger('UploadsRoute');

// Get upload directory from environment
const getUploadDir = () => {
	return process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
};

// MIME type mapping
const mimeTypes: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
	'.doc': 'application/msword',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.xls': 'application/vnd.ms-excel',
	'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'.txt': 'text/plain',
	'.json': 'application/json',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav'
};

const getMimeType = (filePath: string): string => {
	const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
	return mimeTypes[ext] || 'application/octet-stream';
};

export const GET: RequestHandler = async ({ params }) => {
	const requestedPath = params.path;
	
	if (!requestedPath) {
		log.warn('No path provided for file download');
		throw error(400, 'No file path provided');
	}

	// Security: Prevent directory traversal
	if (requestedPath.includes('..') || requestedPath.includes('//')) {
		log.warn('Directory traversal attempt blocked', { path: requestedPath });
		throw error(403, 'Invalid path');
	}

	const uploadDir = getUploadDir();
	const filePath = join(uploadDir, requestedPath);

	// Ensure the resolved path is within the upload directory
	if (!filePath.startsWith(uploadDir)) {
		log.warn('Path escape attempt blocked', { path: requestedPath, resolved: filePath });
		throw error(403, 'Invalid path');
	}

	try {
		// Check if file exists
		const fileStat = await stat(filePath);
		
		if (!fileStat.isFile()) {
			log.warn('Requested path is not a file', { path: requestedPath });
			throw error(404, 'Not found');
		}

		// Read file
		const fileBuffer = await readFile(filePath);
		const mimeType = getMimeType(filePath);

		log.debug('Serving file', { 
			path: requestedPath, 
			size: fileStat.size, 
			mimeType 
		});

		return new Response(fileBuffer, {
			status: 200,
			headers: {
				'Content-Type': mimeType,
				'Content-Length': fileStat.size.toString(),
				'Cache-Control': 'private, max-age=3600'
			}
		});
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			log.warn('File not found', { path: requestedPath });
			throw error(404, 'File not found');
		}
		
		log.error('Error serving file', { path: requestedPath, error: err });
		throw error(500, 'Internal server error');
	}
};
