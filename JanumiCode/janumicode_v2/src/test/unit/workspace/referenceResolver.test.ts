import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  detectReferences,
  resolveReference,
  resolveAllReferences,
} from '../../../lib/workspace/referenceResolver';

describe('detectReferences', () => {
  it('finds quoted markdown paths', () => {
    const refs = detectReferences(
      'Review "specs/hestami/Product Description.md" and prepare for implementation.',
    );
    expect(refs).toHaveLength(1);
    expect(refs[0].form).toBe('quoted_path');
    expect(refs[0].referenceText).toBe('specs/hestami/Product Description.md');
  });

  it('finds multiple mentions', () => {
    const refs = detectReferences(
      'Compare @src/auth/handler.ts with @src/auth/legacy.ts please.',
    );
    expect(refs).toHaveLength(2);
    expect(refs.map(r => r.referenceText)).toContain('src/auth/handler.ts');
    expect(refs.map(r => r.referenceText)).toContain('src/auth/legacy.ts');
  });

  it('ignores quoted text that does not look like a path', () => {
    const refs = detectReferences('He said "hello world" to me.');
    expect(refs).toHaveLength(0);
  });

  it('ignores urls', () => {
    const refs = detectReferences('See https://example.com for more info.');
    expect(refs).toHaveLength(0);
  });

  it('finds file:// URIs', () => {
    const refs = detectReferences('Use file:///tmp/foo.md for now.');
    expect(refs).toHaveLength(1);
    expect(refs[0].form).toBe('file_uri');
  });
});

describe('resolveReference', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ref-resolver-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('resolves a file that exists', () => {
    fs.mkdirSync(path.join(tmpRoot, 'specs'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'specs', 'Product.md'),
      '# Product\n\nContent here.',
    );

    const result = resolveReference(
      { referenceText: 'specs/Product.md', form: 'quoted_path' },
      tmpRoot,
    );

    expect(result.status).toBe('resolved');
    expect(result.content).toContain('# Product');
    expect(result.type).toBe('spec');
    expect(result.relativePath).toBe('specs/Product.md');
  });

  it('reports not_found for missing file', () => {
    const result = resolveReference(
      { referenceText: 'nonexistent/file.md', form: 'quoted_path' },
      tmpRoot,
    );
    expect(result.status).toBe('not_found');
    expect(result.content).toBeNull();
  });

  it('rejects paths outside the workspace', () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'secret.md'), 'secret');
      const result = resolveReference(
        { referenceText: path.join(outside, 'secret.md'), form: 'quoted_path' },
        tmpRoot,
      );
      expect(result.status).toBe('outside_workspace');
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('handles Windows-style separators', () => {
    fs.mkdirSync(path.join(tmpRoot, 'specs'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'specs', 'Product.md'), 'content');

    const result = resolveReference(
      { referenceText: 'specs\\Product.md', form: 'quoted_path' },
      tmpRoot,
    );

    expect(result.status).toBe('resolved');
  });

  it('classifies source code with language', () => {
    fs.mkdirSync(path.join(tmpRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'src', 'index.ts'), 'export {};');

    const result = resolveReference(
      { referenceText: 'src/index.ts', form: 'quoted_path' },
      tmpRoot,
    );

    expect(result.status).toBe('resolved');
    expect(result.type).toBe('source');
    expect(result.language).toBe('typescript');
  });
});

describe('resolveAllReferences', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ref-resolver-all-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('resolves multiple references and dedupes by path', () => {
    fs.mkdirSync(path.join(tmpRoot, 'specs'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'specs', 'a.md'), 'a');
    fs.writeFileSync(path.join(tmpRoot, 'specs', 'b.md'), 'b');

    const resolved = resolveAllReferences(
      'Review "specs/a.md" and "specs/b.md" — note: "specs/a.md" again.',
      tmpRoot,
    );

    expect(resolved).toHaveLength(2);
    expect(resolved.map(r => r.relativePath).sort()).toEqual(['specs/a.md', 'specs/b.md']);
  });

  it('surfaces missing references with not_found', () => {
    const resolved = resolveAllReferences(
      'Review "specs/missing.md" please.',
      tmpRoot,
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0].status).toBe('not_found');
  });
});
