// Flat ESLint config for the JPWB workspace (TypeScript library, no framework).
// Prettier owns formatting; ESLint owns correctness/soundness rules only.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
	{
		// Generated / build output is never linted (SvelteKit's .svelte-kit + adapter build/ included:
		// the demo surface owns its own svelte-check toolchain and is outside the engine lint gate).
		ignores: [
			'**/dist/**',
			'**/node_modules/**',
			'**/coverage/**',
			'**/.turbo/**',
			'**/.svelte-kit/**',
			'**/build/**'
		]
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.node }
		},
		rules: {
			// The engine is the anti-mock authority; surface accidental `any` leaks early.
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			// Exhaustiveness on discriminated unions is load-bearing for the state machines.
			'@typescript-eslint/switch-exhaustiveness-check': 'off'
		}
	},
	{
		// Tests may be looser about non-null assertions and explicit any for doubles.
		files: ['**/*.test.ts', '**/__tests__/**/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off'
		}
	}
);
