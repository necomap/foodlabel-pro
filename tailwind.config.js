/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ブランドカラー: 温かみのある焼き菓子系
        brand: {
          50:  '#fdf8f0',
          100: '#faefd8',
          200: '#f4daa8',
          300: '#ecc470',
          400: '#e3a840',
          500: '#d4891f',  // メインブランドカラー（焼き色）
          600: '#b56d15',
          700: '#8f5311',
          800: '#6e4013',
          900: '#5a3412',
          950: '#321a07',
        },
        cream: {
          50:  '#fefefe',
          100: '#fdfaf5',
          200: '#faf3e8',
          300: '#f5e8d0',
          400: '#edd9b0',
        },
        sage: {
          100: '#f0f4f0',
          500: '#6b8c6b',
          700: '#4a6b4a',
        },
      },
      fontFamily: {
        // 日本語フォント
        sans: [
          '"Noto Sans JP"',
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          'Meiryo',
          'sans-serif',
        ],
        display: [
          '"Shippori Mincho"',
          '"Hiragino Mincho ProN"',
          'serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      boxShadow: {
        'warm': '0 1px 3px rgba(180, 100, 30, 0.1), 0 4px 12px rgba(180, 100, 30, 0.06)',
        'warm-lg': '0 4px 16px rgba(180, 100, 30, 0.12), 0 12px 40px rgba(180, 100, 30, 0.08)',
        'card': '0 1px 2px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      // 印刷用（シール）
      screens: {
        'print': { 'raw': 'print' },
      },
    },
  },
  plugins: [],
};
