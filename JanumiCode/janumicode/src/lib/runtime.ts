/**
 * Runtime path resolution for sidecar processes.
 *
 * In production (marketplace), the extension bundles a Node.js LTS binary
 * at runtime/node(.exe). In development, falls back to system `node`.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Resolve the Node.js binary path to use for sidecar / MCP child processes.
 * Prefers bundled runtime/node(.exe) if present; falls back to 'node' on PATH.
 *
 * @param extensionRoot — root of the extension (where runtime/ lives).
 *   Defaults to `__dirname/..` (works when called from dist/).
 */
export function resolveNodeBinary(extensionRoot?: string): string {
	const root = extensionRoot ?? path.resolve(__dirname, '..');
	const name = process.platform === 'win32' ? 'node.exe' : 'node';
	const bundled = path.join(root, 'runtime', name);
	if (fs.existsSync(bundled)) {
		return bundled;
	}
	// Development: use system node
	return name;
}
