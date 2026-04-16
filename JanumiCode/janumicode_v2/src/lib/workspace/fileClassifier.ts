/**
 * File type classifier — maps filesystem paths to semantic categories
 * used by the Deep Memory Research Agent and Phase 0.2 artifact ingestion.
 *
 * Categories:
 *   - source : code the project builds/tests/runs
 *   - config : build/tooling config (package.json, tsconfig, etc.)
 *   - spec   : product specs, design docs, ADRs — high-value for DMR
 *   - doc    : general documentation
 *   - data   : datasets, fixtures, generated content
 *   - other  : unclassified
 */

import * as path from 'node:path';

export type FileType = 'source' | 'config' | 'spec' | 'doc' | 'data' | 'other';

export interface FileClassification {
  type: FileType;
  language?: string;
  isText: boolean;
}

const SOURCE_EXTS: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
  '.swift': 'swift',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
  '.ps1': 'powershell',
  '.sql': 'sql',
  '.svelte': 'svelte',
  '.vue': 'vue',
};

const CONFIG_FILES = new Set([
  'package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock',
  'tsconfig.json', 'tsconfig.e2e.json', 'jsconfig.json',
  'vite.config.js', 'vite.config.ts', 'vitest.config.js', 'vitest.config.ts',
  'esbuild.js', 'rollup.config.js', 'webpack.config.js',
  '.eslintrc', '.eslintrc.json', '.eslintrc.js', 'eslint.config.js',
  '.prettierrc', '.prettierrc.json', '.prettierrc.js',
  '.gitignore', '.gitattributes',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  'Cargo.toml', 'Cargo.lock',
  'go.mod', 'go.sum',
  'requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'Pipfile.lock',
  'Gemfile', 'Gemfile.lock',
  'pom.xml', 'build.gradle', 'build.gradle.kts',
  '.env', '.env.local', '.env.example',
  'Makefile', 'makefile',
]);

const CONFIG_EXTS = new Set(['.yaml', '.yml', '.toml', '.ini', '.conf']);

const DATA_EXTS = new Set([
  '.csv', '.tsv', '.parquet', '.feather', '.arrow',
  '.xlsx', '.xls',
  '.db', '.sqlite', '.sqlite3',
]);

const DOC_EXTS = new Set(['.md', '.markdown', '.rst', '.txt', '.adoc', '.org']);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'target',
  '.next', '.nuxt', '.svelte-kit', '.cache', 'coverage',
  '__pycache__', '.pytest_cache', '.mypy_cache',
  'venv', '.venv', 'env', '.env.d',
  '.janumicode', // Skip our own internal state
]);

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
  '.mp3', '.mp4', '.wav', '.flac', '.avi', '.mov', '.webm',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.pdf', '.docx', '.xlsx', '.pptx',
  '.exe', '.dll', '.so', '.dylib',
  '.wasm', '.class', '.jar',
  '.pyc', '.pyo',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
]);

/**
 * Classify a file by its path. Does not read the file.
 */
export function classifyFile(filePath: string): FileClassification {
  const base = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  const isText = !BINARY_EXTS.has(ext);

  // Doc-like names first (README, CHANGELOG, LICENSE, etc.)
  if (/^readme(\.|$)/i.test(base) || /^changelog/i.test(base) || /^license/i.test(base)
      || /^contributing/i.test(base) || /^authors/i.test(base)) {
    return { type: 'doc', isText };
  }

  // Config by exact filename
  if (CONFIG_FILES.has(path.basename(filePath))) {
    return { type: 'config', isText: true };
  }

  // Source extensions
  if (ext in SOURCE_EXTS) {
    return { type: 'source', language: SOURCE_EXTS[ext], isText };
  }

  // Config extensions
  if (CONFIG_EXTS.has(ext)) {
    return { type: 'config', isText };
  }

  // Data extensions
  if (DATA_EXTS.has(ext)) {
    return { type: 'data', isText: false };
  }

  // Spec heuristics — paths containing /specs/, /docs/specs/, /design/, etc.
  const lowerPath = filePath.replaceAll('\\', '/').toLowerCase();
  if (DOC_EXTS.has(ext)) {
    if (/(?:^|\/)specs?\//.test(lowerPath) || /(?:^|\/)design\//.test(lowerPath) ||
        /(?:^|\/)adr\//.test(lowerPath) || /(?:^|\/)architecture\//.test(lowerPath) ||
        /\bspec\b/.test(base) || /\badr\b/.test(base)) {
      return { type: 'spec', language: 'markdown', isText: true };
    }
    return { type: 'doc', language: 'markdown', isText: true };
  }

  // JSON fallback — could be data, config, or generated content
  if (ext === '.json') {
    return { type: 'config', isText: true };
  }

  return { type: 'other', isText };
}

/**
 * Should we skip this directory during a workspace scan?
 */
export function shouldSkipDir(dirName: string): boolean {
  if (SKIP_DIRS.has(dirName)) return true;
  // Skip hidden directories except a few we care about
  if (dirName.startsWith('.') && dirName !== '.github') return true;
  return false;
}
