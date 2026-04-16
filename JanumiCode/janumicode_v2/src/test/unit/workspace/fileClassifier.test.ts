import { describe, it, expect } from 'vitest';
import { classifyFile, shouldSkipDir } from '../../../lib/workspace/fileClassifier';

describe('classifyFile', () => {
  describe('source files', () => {
    it('classifies TypeScript as source with language', () => {
      const c = classifyFile('src/index.ts');
      expect(c.type).toBe('source');
      expect(c.language).toBe('typescript');
      expect(c.isText).toBe(true);
    });

    it('classifies Python as source', () => {
      const c = classifyFile('scripts/build.py');
      expect(c.type).toBe('source');
      expect(c.language).toBe('python');
    });

    it('classifies Rust as source', () => {
      const c = classifyFile('src/main.rs');
      expect(c.type).toBe('source');
      expect(c.language).toBe('rust');
    });

    it('classifies shell scripts as source', () => {
      expect(classifyFile('deploy.sh').language).toBe('bash');
      expect(classifyFile('install.bash').language).toBe('bash');
    });

    it('classifies Svelte files as source', () => {
      expect(classifyFile('App.svelte').language).toBe('svelte');
    });
  });

  describe('config files', () => {
    it('classifies package.json as config', () => {
      const c = classifyFile('package.json');
      expect(c.type).toBe('config');
    });

    it('classifies yaml as config', () => {
      const c = classifyFile('docker-compose.yaml');
      expect(c.type).toBe('config');
    });

    it('classifies .gitignore as config', () => {
      const c = classifyFile('.gitignore');
      expect(c.type).toBe('config');
    });

    it('classifies Dockerfile as config', () => {
      const c = classifyFile('Dockerfile');
      expect(c.type).toBe('config');
    });

    it('classifies Cargo.toml as config', () => {
      expect(classifyFile('Cargo.toml').type).toBe('config');
    });

    it('classifies unknown .json as config', () => {
      expect(classifyFile('random.json').type).toBe('config');
    });
  });

  describe('spec files', () => {
    it('classifies markdown in /specs/ as spec', () => {
      const c = classifyFile('specs/product.md');
      expect(c.type).toBe('spec');
      expect(c.language).toBe('markdown');
    });

    it('classifies markdown in /design/ as spec', () => {
      expect(classifyFile('design/architecture.md').type).toBe('spec');
    });

    it('classifies markdown in /adr/ as spec', () => {
      expect(classifyFile('docs/adr/0001-decision.md').type).toBe('spec');
    });

    it('classifies ADR files by name as spec', () => {
      expect(classifyFile('docs/adr-001-auth.md').type).toBe('spec');
    });

    it('handles Windows-style paths', () => {
      expect(classifyFile('specs\\product.md').type).toBe('spec');
    });
  });

  describe('doc files', () => {
    it('classifies README as doc', () => {
      expect(classifyFile('README.md').type).toBe('doc');
    });

    it('classifies CHANGELOG as doc', () => {
      expect(classifyFile('CHANGELOG.md').type).toBe('doc');
    });

    it('classifies LICENSE as doc', () => {
      expect(classifyFile('LICENSE').type).toBe('doc');
    });

    it('classifies generic markdown as doc (not spec)', () => {
      expect(classifyFile('docs/how-to.md').type).toBe('doc');
    });

    it('classifies .txt as doc', () => {
      expect(classifyFile('notes.txt').type).toBe('doc');
    });
  });

  describe('data files', () => {
    it('classifies CSV as data (not text)', () => {
      const c = classifyFile('data/users.csv');
      expect(c.type).toBe('data');
      expect(c.isText).toBe(false);
    });

    it('classifies SQLite DB as data', () => {
      expect(classifyFile('data.sqlite').type).toBe('data');
    });
  });

  describe('binary files', () => {
    it('images are marked non-text', () => {
      expect(classifyFile('logo.png').isText).toBe(false);
      expect(classifyFile('photo.jpg').isText).toBe(false);
    });

    it('archives are marked non-text', () => {
      expect(classifyFile('bundle.zip').isText).toBe(false);
      expect(classifyFile('archive.tar.gz').isText).toBe(false);
    });

    it('fonts are marked non-text', () => {
      expect(classifyFile('Roboto.woff2').isText).toBe(false);
    });
  });
});

describe('shouldSkipDir', () => {
  it('skips common build dirs', () => {
    expect(shouldSkipDir('node_modules')).toBe(true);
    expect(shouldSkipDir('dist')).toBe(true);
    expect(shouldSkipDir('build')).toBe(true);
    expect(shouldSkipDir('target')).toBe(true);
  });

  it('skips hidden dirs', () => {
    expect(shouldSkipDir('.git')).toBe(true);
    expect(shouldSkipDir('.svelte-kit')).toBe(true);
    expect(shouldSkipDir('.janumicode')).toBe(true);
  });

  it('does not skip .github', () => {
    expect(shouldSkipDir('.github')).toBe(false);
  });

  it('does not skip regular directories', () => {
    expect(shouldSkipDir('src')).toBe(false);
    expect(shouldSkipDir('docs')).toBe(false);
    expect(shouldSkipDir('specs')).toBe(false);
  });

  it('skips language virtualenv dirs', () => {
    expect(shouldSkipDir('venv')).toBe(true);
    expect(shouldSkipDir('.venv')).toBe(true);
    expect(shouldSkipDir('__pycache__')).toBe(true);
  });
});
