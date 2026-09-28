import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

const sourceFiles = ['**/*.js', '**/*.mjs'];

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    'dist/**',
    'content-candidates/**',
    // Generated bundles are verified from their authored sources by npm run check.
    'src/**',
    // These fragments share one scope only after compile-logic concatenates them.
    'logic-src/**',
    // Frozen compatibility code is intentionally outside the supported source gate.
    'server/legacy/**',
    // Tests have their own Node test gate; this baseline targets shipped source.
    'tests/**',
    // Historical Bun/Workers build entry point retained for archive compatibility.
    'scripts/build.mjs',
  ]),
  {
    ...js.configs.recommended,
    files: sourceFiles,
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
  },
  {
    files: sourceFiles,
    ignores: ['public/**'],
    languageOptions: { globals: { ...globals.node, ...globals.nodeBuiltin } },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: sourceFiles,
    rules: {
      'no-constant-binary-expression': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Control characters are deliberately stripped at trust boundaries.
      'no-control-regex': 'off',
      // Serialized command queues intentionally mutate captured room state.
      'require-atomic-updates': 'off',
      'no-unused-vars': ['error', {
        // Public hook signatures are stable contracts even when one layer does not
        // consume every argument yet; locals and imports remain strict.
        args: 'none',
        caughtErrors: 'none',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^_',
      }],
    },
  },
  {
    files: ['local-server.mjs', 'server/**/*.mjs'],
    ignores: ['server/legacy/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.async.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
]);
