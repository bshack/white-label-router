import babelParser from '@babel/eslint-parser';
import js from '@eslint/js';

const strictRules = {curly: ['error', 'all'], eqeqeq: ['error', 'always'], 'no-eval': 'error', 'no-implied-eval': 'error', 'no-new-wrappers': 'error', 'no-var': 'error', 'prefer-const': 'error'};
// Node.js globals the CommonJS tests and scripts use (the `globals` package is not a dependency).
const nodeGlobals = Object.fromEntries([
    'require', 'module', 'exports', '__dirname', '__filename', 'process', 'console', 'global', 'globalThis', 'Buffer',
    'setTimeout', 'clearTimeout', 'setImmediate', 'URL', 'URLSearchParams', 'Event', 'EventTarget', 'CustomEvent'
].map(name => [name, 'readonly']));
// Tests and the benchmark install stubbed `window`/`document` on `global` (and browser tests pass functions to the page),
// so they read those names as globals; `no-undef` still catches every other undeclared name.
const stubbedBrowserGlobals = {window: 'readonly', document: 'readonly'};

export default [
  {ignores: ['dist/**', 'coverage/**', 'node_modules/**']},
  {files: ['src/**/*.ts'], languageOptions: {parser: babelParser, parserOptions: {requireConfigFile: false, sourceType: 'unambiguous', babelOptions: {presets: ['@babel/preset-typescript']}}}, rules: {...js.configs.recommended.rules, 'no-undef': 'off', 'no-unused-vars': 'off', ...strictRules}},
  {files: ['test/**/*.js', 'benchmark/**/*.js'], languageOptions: {ecmaVersion: 'latest', sourceType: 'commonjs', globals: {...nodeGlobals, ...stubbedBrowserGlobals}}, rules: {...js.configs.recommended.rules, ...strictRules}},
];
