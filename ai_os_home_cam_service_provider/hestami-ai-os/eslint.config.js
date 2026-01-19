import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	// Explicitly ignore large generated files that cause memory issues
	{
		ignores: [
			'src/lib/api/types.generated.ts',
			'generated/**',
			'.svelte-kit/**'
		]
	},
	js.configs.recommended,
	// Use type-checked preset for better type safety (catches unsafe any, promise issues, etc.)
	...ts.configs.recommendedTypeChecked,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node },
			parserOptions: {
				// Enable type-aware linting for all TS files
				projectService: true
			}
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',

			// Require exhaustive switch statements when switching on union types/enums
			// This pushes toward discriminated unions/enums instead of ad-hoc strings
			'@typescript-eslint/switch-exhaustiveness-check': 'error'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			// Prevent importing heavy/problematic modules in Svelte files (complements R5 governance rule)
			// These imports cause memory crashes during builds
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '@prisma/client',
							message:
								'Do not import @prisma/client in .svelte files. Use types from $lib/api/cam or $lib/api/types instead.'
						}
					],
					patterns: [
						{
							group: ['**/types.generated*'],
							message:
								'Do not import types.generated.ts in .svelte files - it causes memory crashes. Use extracted types from $lib/api/cam or similar barrel files.'
						}
					]
				}
			]
		}
	}
);
