module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    'react/no-unescaped-entities': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': 'warn', // Warn on console usage in production
    'no-debugger': 'error', // Disallow debugger statements
    eqeqeq: ['warn', 'always'], // Require strict equality
    curly: 'warn', // Require curly braces for all control statements
    semi: ['warn', 'always'], // Enforce semicolons
    quotes: ['warn', 'single'], // Enforce single quotes
    indent: ['off', 2], // Enforce 2-space indentation
    '@typescript-eslint/explicit-function-return-type': 'warn',
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'public/',
    '*.config.js',
    '*.config.ts',
  ],
};
