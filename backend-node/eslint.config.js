// ESLint 9 flat config. Previously missing entirely — `npm run lint` used
// the legacy `--ext .ts` CLI flag, which ESLint 9 no longer supports without
// a config file, so the script had never actually run successfully. Mirrors
// the @typescript-eslint packages already in devDependencies.
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Matches the existing codebase convention (App tool wraps req/res
      // handlers loosely typed as `any` in several places) — not worth
      // rewriting wholesale as part of just turning lint on for the first time.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // This is a CommonJS project (no "type": "module"); app.ts's optional
      // route loader and the test suite's mocking both use require()
      // deliberately, not as a stray habit — flagging every require() as an
      // error would fight the project's own module system.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]
