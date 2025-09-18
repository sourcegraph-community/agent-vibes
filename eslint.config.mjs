// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default [
  // Ignore build artifacts and dependencies
  { ignores: ['.next/**', 'node_modules/**'] },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript (non type-aware for speed)
  ...tseslint.configs.recommended,

  // React + Hooks (minimal, React 19-friendly)
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      '@stylistic': stylistic,
    },
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React 17+ (and 19) do not need React in scope
      'react/react-in-jsx-scope': 'off',

      // Hooks recommended baseline
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Minimal formatting via ESLint Stylistic (kept conservative)
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      '@stylistic/object-curly-spacing': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/no-trailing-spaces': 'error',
    },
  },

  // Pragmatic TS overrides: rely on tsc for unused vars
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Allow Next.js generated triple-slash reference in next-env.d.ts
  {
    files: ['next-env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
];
