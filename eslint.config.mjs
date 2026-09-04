import eslint from '@eslint/js';
import next from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      'apps/web/public/maplibre-gl-*.mjs',
      'NILAM app full prototype review/**',
      'packages/db/drizzle/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      '@next/next': next,
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    files: ['apps/web/components/ui/map.tsx'],
    rules: {
      // This component is vendored from mapcn. Its imperative MapLibre
      // instances intentionally live in refs and synchronize inside effects.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['apps/web/scripts/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  prettier,
);
