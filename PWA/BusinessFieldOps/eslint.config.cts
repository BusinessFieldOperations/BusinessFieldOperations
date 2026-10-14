import globals from 'globals';
import css from '@eslint/css';
import {defineConfig} from 'eslint/config';
import {FlatCompat} from '@eslint/eslintrc';
import type {Linter} from 'eslint';

const compat = new FlatCompat({baseDirectory: __dirname});

const gts = require('gts');
const {default: preact} = require('eslint-config-preact');
const gtsIgnores = [{ignores: require('./eslint.ignores.cjs')}];

// Reuse gts's own plugin instance when it has one; otherwise fall back to
// the installed package. Using the same instance avoids "Cannot redefine plugin".
const tsPlugin =
  gts.find((c: Linter.Config) => c.plugins?.['@typescript-eslint'])?.plugins[
    '@typescript-eslint'
  ] ?? require('@typescript-eslint/eslint-plugin');

// Keep gts/preact configs away from CSS files.
const jsTsFiles = ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'];
const isGlobalIgnore = (c: Linter.Config) =>
  Object.keys(c)
    .filter(k => k !== 'name')
    .join() === 'ignores';
const scoped = [...gts, ...compat.config(preact.__esModule)].map(c =>
  isGlobalIgnore(c) ? c : {...c, files: c.files ?? jsTsFiles},
);

const unusedOptions = {
  args: 'after-used',
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
  destructuredArrayIgnorePattern: '^_',
};

const tsParser =
  gts.find((c: Linter.Config) => c.languageOptions?.parser)?.languageOptions
    .parser ?? require('@typescript-eslint/parser');

export default defineConfig([
  ...gtsIgnores,
  ...scoped,
  {
    files: ['vite.config.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json'],
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['**/*.{cts,mts}'],
    languageOptions: {
      parser: tsParser,
      globals: {...globals.browser, ...globals.node},
    },
  },
  {
    files: ['**/*.{ts,mts,cts,tsx}'],
    plugins: {'@typescript-eslint': tsPlugin},
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', unusedOptions],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx}'],
    rules: {'no-unused-vars': ['error', unusedOptions]},
  },
  {
    files: ['**/*.css'],
    plugins: {css},
    language: 'css/css',
    extends: ['css/recommended'],
    rules: {
      // Ignore CSS variables declared in other files
      'css/no-invalid-properties': ['error', {allowUnknownVariables: true}],
    },
  },
]);
