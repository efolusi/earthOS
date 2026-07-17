import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Flat ESLint config shared by every EarthOS package, plugin, and app.
 * Consume with:
 *   import earthos from '@earthos/config/eslint';
 *   export default earthos;
 */
export default tseslint.config(
  { ignores: ['dist/**', '.next/**', 'coverage/**', 'node_modules/**', '*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-this-alias': ['error', { allowedNames: ['engine', 'parent', 'self'] }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'three/examples/jsm',
              message: 'Import from three/addons instead.',
            },
          ],
        },
      ],
    },
  },
);
