// eslint.config.js
import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  // JavaScript recommended rules
  js.configs.recommended,

  // TypeScript-specific rules
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json', // Specify it only if you want to use rules which require type information
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      // Add TypeScript-specific rules here
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      // You can add more rules as needed
    },
  },

  // Custom project-specific rules
  {
    rules: {
      'no-console': 'warn', // Warn on console usage in production
      'no-debugger': 'error', // Disallow debugger statements
      eqeqeq: ['error', 'always'], // Require strict equality
      curly: 'error', // Require curly braces for all control statements
      semi: ['error', 'always'], // Enforce semicolons
      quotes: ['error', 'single'], // Enforce single quotes
      indent: ['error', 2], // Enforce 2-space indentation
    },
  },
];
