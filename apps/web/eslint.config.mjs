import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import i18next from 'eslint-plugin-i18next';

const config = [
  ...nextVitals,
  ...nextTs,
  {
    // UI text must come from i18n dictionaries (I18N.md §2).
    files: ['src/**/*.tsx'],
    ignores: ['src/app/not-found.tsx'], // locale-less fallback, intentionally bilingual
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        { mode: 'jsx-text-only', 'jsx-components': { exclude: ['Trans'] } },
      ],
    },
  },
  { ignores: ['.next/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
];

export default config;
