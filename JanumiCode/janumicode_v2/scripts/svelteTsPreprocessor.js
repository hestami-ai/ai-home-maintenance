// Shared Svelte <script lang="ts"> preprocessor used by BOTH the esbuild
// production build (esbuild.js) and the vitest test runner (vitest.config.ts).
//
// Background: vitePreprocess({ script: true }) from @sveltejs/vite-plugin-svelte
// strips component imports because its underlying Oxc TS transform is not
// configured with importsNotUsedAsValues: 'preserve'. The author commented
// that out with a TODO. The result is that `import Card from './Card.svelte'`
// gets dropped from the script body when nothing in the body references the
// binding (Svelte template references are invisible to a TS-only transform).
//
// Our workaround: hand the script content to esbuild's own TS transform with
// `verbatimModuleSyntax: true`, which forces every import to survive verbatim.
// Same shape as the vitePreprocess script preprocessor, so it plugs into both
// esbuild-svelte (production) and @sveltejs/vite-plugin-svelte (tests).

const esbuild = require('esbuild');

function tsScriptPreprocessor() {
  return {
    name: 'janumicode-ts-script',
    async script({ attributes, content }) {
      if (attributes.lang !== 'ts' && attributes.lang !== 'typescript') return;
      const result = await esbuild.transform(content, {
        loader: 'ts',
        target: 'es2022',
        tsconfigRaw: {
          compilerOptions: {
            verbatimModuleSyntax: true,
          },
        },
      });
      return { code: result.code, map: result.map };
    },
  };
}

module.exports = { tsScriptPreprocessor };
