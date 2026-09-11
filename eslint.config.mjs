import babelParser from '@babel/eslint-parser';
import js from '@eslint/js';
export default [
  {ignores: ['dist/**', 'coverage/**', 'node_modules/**']},
  {files: ['src/**/*.ts'], languageOptions: {parser: babelParser, parserOptions: {requireConfigFile: false, sourceType: 'unambiguous', babelOptions: {presets: ['@babel/preset-typescript']}}}, rules: {...js.configs.recommended.rules, 'no-undef': 'off', 'no-unused-vars': 'off', curly: ['error', 'all'], eqeqeq: ['error', 'always'], 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-wrappers': 'error', 'no-var': 'error', 'prefer-const': 'error'}},
];
