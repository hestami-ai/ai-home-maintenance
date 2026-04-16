import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  scanWorkspace,
  readFileContent,
  hasExistingArtifacts,
} from '../../../lib/workspace/workspaceScanner';

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-scanner-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function write(rel: string, content = ''): string {
  const abs = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

describe('scanWorkspace', () => {
  it('finds files in a flat workspace', () => {
    write('a.md', '# A');
    write('b.ts', 'export {};');
    write('README.md', '# README');

    const result = scanWorkspace(tmpRoot);

    expect(result.totalFiles).toBe(3);
    expect(result.files.map(f => f.name).sort()).toEqual(['README.md', 'a.md', 'b.ts']);
  });

  it('recurses into subdirectories', () => {
    write('specs/product.md', '# Product');
    write('src/index.ts', 'export {};');
    write('src/lib/util.ts', 'export {};');

    const result = scanWorkspace(tmpRoot);

    expect(result.totalFiles).toBe(3);
    expect(result.filesByType.spec).toBe(1);
    expect(result.filesByType.source).toBe(2);
  });

  it('skips node_modules and .git', () => {
    write('node_modules/react/index.js', 'module.exports = {};');
    write('node_modules/lodash/index.js', 'module.exports = {};');
    write('.git/HEAD', 'ref: refs/heads/main');
    write('src/index.ts', 'export {};');

    const result = scanWorkspace(tmpRoot);

    expect(result.totalFiles).toBe(1);
    expect(result.files[0].relativePath).toBe('src/index.ts');
  });

  it('skips .janumicode directory', () => {
    write('.janumicode/governed_stream.db', 'binary-ish');
    write('.janumicode/context/1.2_abc.md', '# detail');
    write('src/a.ts', '');

    const result = scanWorkspace(tmpRoot);

    expect(result.totalFiles).toBe(1);
    expect(result.files[0].relativePath).toBe('src/a.ts');
  });

  it('respects maxFiles cap', () => {
    for (let i = 0; i < 10; i++) {
      write(`file${i}.ts`, '');
    }
    const result = scanWorkspace(tmpRoot, { maxFiles: 5 });
    expect(result.totalFiles).toBe(5);
  });

  it('skips files exceeding maxFileSizeBytes', () => {
    const big = 'x'.repeat(2048);
    write('big.txt', big);
    write('small.txt', 'hi');

    const result = scanWorkspace(tmpRoot, { maxFileSizeBytes: 1024 });

    expect(result.totalFiles).toBe(1);
    expect(result.files[0].name).toBe('small.txt');
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].reason).toMatch(/exceeds max file size/);
  });

  it('respects includeTypes filter', () => {
    write('specs/product.md', '');
    write('README.md', '');
    write('src/index.ts', '');
    write('config.json', '');

    const result = scanWorkspace(tmpRoot, { includeTypes: ['spec', 'source'] });

    expect(result.totalFiles).toBe(2);
    expect(result.files.map(f => f.type).sort()).toEqual(['source', 'spec']);
  });

  it('honors .gitignore patterns', () => {
    write('.gitignore', 'secret.env\n*.log\nbuild/\n');
    write('secret.env', 'TOKEN=abc');
    write('debug.log', 'trace');
    write('build/output.js', 'compiled');
    write('src/app.ts', 'ok');

    const result = scanWorkspace(tmpRoot);

    const names = result.files.map(f => f.relativePath);
    expect(names).toContain('.gitignore');
    expect(names).toContain('src/app.ts');
    expect(names).not.toContain('secret.env');
    expect(names).not.toContain('debug.log');
    expect(names).not.toContain('build/output.js');
  });

  it('normalizes Windows-style separators in relative paths', () => {
    write('specs/nested/deep/product.md', '');
    const result = scanWorkspace(tmpRoot);
    expect(result.files[0].relativePath).toBe('specs/nested/deep/product.md');
    expect(result.files[0].relativePath.includes('\\')).toBe(false);
  });

  it('supports extraSkipDirs', () => {
    write('experimental/a.ts', '');
    write('src/b.ts', '');

    const result = scanWorkspace(tmpRoot, { extraSkipDirs: ['experimental'] });

    expect(result.totalFiles).toBe(1);
    expect(result.files[0].relativePath).toBe('src/b.ts');
  });
});

describe('readFileContent', () => {
  it('reads text file content', () => {
    write('a.md', '# Hello\n\nWorld');
    const result = scanWorkspace(tmpRoot);
    const file = result.files[0];

    const read = readFileContent(file);

    expect(read).not.toBeNull();
    expect(read!.content).toBe('# Hello\n\nWorld');
    expect(read!.truncated).toBe(false);
  });

  it('truncates content exceeding maxBytes', () => {
    const big = 'abcdef'.repeat(1000);
    write('big.md', big);
    const result = scanWorkspace(tmpRoot);
    const file = result.files[0];

    const read = readFileContent(file, 100);

    expect(read!.truncated).toBe(true);
    expect(read!.content.length).toBe(100);
  });

  it('returns null for binary files', () => {
    write('img.png', 'fake-png-bytes');
    const result = scanWorkspace(tmpRoot);
    const file = result.files[0];

    const read = readFileContent(file);

    expect(read).toBeNull();
  });
});

describe('hasExistingArtifacts', () => {
  it('returns false for empty workspace', () => {
    expect(hasExistingArtifacts(tmpRoot)).toBe(false);
  });

  it('returns true when workspace has any non-hidden file', () => {
    write('readme.md', '# hi');
    expect(hasExistingArtifacts(tmpRoot)).toBe(true);
  });

  it('returns true when workspace has non-hidden directories', () => {
    fs.mkdirSync(path.join(tmpRoot, 'src'));
    expect(hasExistingArtifacts(tmpRoot)).toBe(true);
  });

  it('returns false when workspace only has .janumicode/', () => {
    fs.mkdirSync(path.join(tmpRoot, '.janumicode'));
    fs.writeFileSync(path.join(tmpRoot, '.janumicode', 'config.json'), '{}');
    expect(hasExistingArtifacts(tmpRoot)).toBe(false);
  });

  it('returns false for nonexistent workspace', () => {
    expect(hasExistingArtifacts(path.join(tmpRoot, 'does-not-exist'))).toBe(false);
  });
});
