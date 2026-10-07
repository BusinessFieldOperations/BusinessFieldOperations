import js from '@eslint/js';
import globals from 'globals';
import css from '@eslint/css';
import {defineConfig} from 'eslint/config';
import {FlatCompat} from '@eslint/eslintrc';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const gtsIgnores = [{ignores: require('./eslint.ignores.cjs')}];
const gts = require('gts');
const {default: preact} = require('eslint-config-preact');

export default defineConfig([
  ...gtsIgnores,
  ...gts,
  ...compat.config(preact.__esModule),
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: {
      js,
      '@typescript-eslint': tsPlugin,
    },
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {args: 'after-used', argsIgnorePattern: '^_'},
      ],
    },
  },
  {
    files: ['**/*.css'],
    plugins: {css},
    language: 'css/css',
    extends: ['css/recommended'],
  },
]);