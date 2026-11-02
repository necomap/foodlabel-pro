// Next.js 16 で `next lint` が廃止されたため、ESLint CLI 用のフラット設定を追加（2026-11）
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...nextVitals,
  {
    // eslint-plugin-react-hooks v7 で追加された React Compiler 系の新ルールは、既存コードの
    // 書き方（useEffect内のsetState等）を大量に指摘する。動作上の不具合ではないため当面は警告に留める。
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
    },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'scripts/**', 'public/**'],
  },
];

export default eslintConfig;
