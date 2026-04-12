/**
 * Webview bundle import-integrity regression tests.
 *
 * Background: on 2026-04-11 we discovered that vitePreprocess({ script: true })
 * from @sveltejs/vite-plugin-svelte 7 silently strips component imports like
 * `import IntentComposer from './IntentComposer.svelte'` whenever the script
 * body never references the binding at the value level (typical: the
 * template references it but the TS transform can't see templates). The
 * Svelte compiler then emits `IntentComposer(node_3, …)` against a binding
 * that no longer exists in the bundle, producing a runtime
 * `ReferenceError: IntentComposer is not defined` that only surfaces when
 * the component actually renders.
 *
 * Root cause: vitePreprocess calls Vite's Oxc transformer without
 * `importsNotUsedAsValues: 'preserve'` (literally commented out with a TODO
 * in preprocess.js lines 46-57). Our fix: an inline TS preprocessor that
 * passes `tsconfigRaw.compilerOptions.verbatimModuleSyntax = true` to
 * esbuild's own TS transform.
 *
 * These tests exercise both states programmatically by running esbuild in
 * memory with each preprocessor variant, then asserting on the bundle
 * contents. No disk build required.
 */

import { describe, it, expect } from 'vitest';
import * as esbuild from 'esbuild';
import * as path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sveltePlugin = require('esbuild-svelte');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const ENTRY = path.join(REPO_ROOT, 'src', 'webview', 'main.ts');

/** Expected Svelte components that should end up defined in the bundle. */
const EXPECTED_COMPONENTS = [
  'App',
  'Card',
  'MirrorCard',
  'MenuCard',
  'PhaseGateCard',
  'IntentComposer',
  'ContextBar',
  'AttachmentBar',
  'MentionAutocomplete',
];

/**
 * Inline Svelte <script lang="ts"> preprocessor. The `fixed` variant passes
 * verbatimModuleSyntax: true to esbuild's TS transform so every import is
 * preserved. The `broken` variant runs the TS transform with its default
 * import-elision, which is what stripped our component imports.
 */
function tsScriptPreprocessor(variant: 'fixed' | 'broken') {
  return {
    name: `ts-script-${variant}`,
    async script({ attributes, content }: {
      attributes: Record<string, string | boolean>;
      content: string;
    }): Promise<{ code: string; map?: string } | undefined> {
      if (attributes.lang !== 'ts' && attributes.lang !== 'typescript') return undefined;
      const tsconfigRaw =
        variant === 'fixed'
          ? { compilerOptions: { verbatimModuleSyntax: true } }
          : undefined;
      const result = await esbuild.transform(content, {
        loader: 'ts',
        target: 'es2022',
        tsconfigRaw: tsconfigRaw as never,
      });
      return { code: result.code, map: result.map };
    },
  };
}

async function bundleWebview(variant: 'fixed' | 'broken'): Promise<string> {
  const result = await esbuild.build({
    entryPoints: [ENTRY],
    absWorkingDir: REPO_ROOT,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
    mainFields: ['svelte', 'browser', 'module', 'main'],
    conditions: ['svelte', 'browser'],
    logLevel: 'silent',
    plugins: [
      sveltePlugin({
        preprocess: tsScriptPreprocessor(variant),
        compilerOptions: { css: 'injected' },
        cache: false, // don't share cache between variants
      }),
    ],
  });
  return new TextDecoder().decode(result.outputFiles[0].contents);
}

describe('Webview bundle — component import integrity', () => {
  it(
    'pass-to-pass: fixed preprocessor preserves every .svelte component import',
    async () => {
      const bundle = await bundleWebview('fixed');

      for (const name of EXPECTED_COMPONENTS) {
        expect(
          bundle,
          `expected bundle to contain a definition for \`function ${name}(\``,
        ).toMatch(new RegExp(`function ${name}\\(`));
      }
    },
    30_000,
  );

  it(
    'fail-to-pass: broken preprocessor strips component imports so App references undefined bindings',
    async () => {
      const bundle = await bundleWebview('broken');

      // App itself is the entry component; it will always be defined.
      expect(bundle).toMatch(/function App\(/);

      // Svelte's compile output references IntentComposer (and Card) at the
      // call site regardless of whether the import survived. With the broken
      // preprocessor, the REFERENCE is present but the DEFINITION is not —
      // this is exactly the bug we're guarding against.
      expect(bundle).toContain('IntentComposer(');
      expect(
        bundle,
        'broken preprocessor should NOT produce an IntentComposer function definition — ' +
          'this assertion proves the fix in the pass-to-pass test is load-bearing',
      ).not.toMatch(/function IntentComposer\(/);

      // Same story for Card and at least one of the specialized cards.
      expect(bundle).toContain('Card(');
      expect(bundle).not.toMatch(/function Card\(/);
    },
    30_000,
  );

  it(
    'every .svelte import in a .svelte file resolves to a definition in the bundle (static check against the fixed bundle)',
    async () => {
      const bundle = await bundleWebview('fixed');

      // Walk src/webview recursively for .svelte files and collect imports.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs');
      const webviewDir = path.join(REPO_ROOT, 'src', 'webview');
      const svelteFiles: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (entry.name.endsWith('.svelte')) svelteFiles.push(p);
        }
      };
      walk(webviewDir);

      const importRegex = /import\s+(\w+)\s+from\s+['"][^'"]+\.svelte['"]/g;
      const missing: string[] = [];

      for (const file of svelteFiles) {
        const source = fs.readFileSync(file, 'utf-8');
        // Only look inside <script> blocks.
        const scriptMatch = /<script[^>]*>([\s\S]*?)<\/script>/.exec(source);
        if (!scriptMatch) continue;
        const script = scriptMatch[1];

        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(script)) !== null) {
          const componentName = match[1];
          if (!new RegExp(`function ${componentName}\\(`).test(bundle)) {
            missing.push(`${componentName} (imported from ${path.relative(REPO_ROOT, file)})`);
          }
        }
      }

      expect(
        missing,
        'Every .svelte import should produce a function definition in the bundle',
      ).toEqual([]);
    },
    30_000,
  );
});
