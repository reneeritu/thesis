/** @type {import('tailwindcss').Config} */

const helveticaStack = [
  'Helvetica Neue',
  'Helvetica',
  'Arial',
  'system-ui',
  '-apple-system',
  'sans-serif',
];

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        black: '#0a0a0a',
        white: '#ffffff',
        cyan: '#4AEAFF',
        red: '#FF5F4A',
        green: '#91FF62',
        purple: '#D062FF',
        grey: {
          50: '#fafafa',
          100: '#f4f4f4',
          200: '#e0e0e0',
          400: '#9e9e9e',
        },
        yellow: {
          400: '#fff34a',
        },
      },
      fontFamily: {
        /** Headings — same stack as sans (system Helvetica, no webfont). */
        heading: helveticaStack,
        /** Primary UI + body (pair with `font-mono` for technical chrome). */
        sans: helveticaStack,
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        /* Caps match the fixed scale; fluid down to readable mobile minimums */
        h1: [
          'clamp(2rem, 9vw, 4rem)',
          { lineHeight: '1.05', letterSpacing: '-0.04em' },
        ],
        h2: [
          'clamp(1.75rem, 5.5vw, 2.5rem)',
          { lineHeight: '1.1', letterSpacing: '-0.03em' },
        ],
        h3: [
          'clamp(1.125rem, 3vw, 1.5rem)',
          { lineHeight: '1.2', letterSpacing: '-0.02em' },
        ],
        body: ['16px', { lineHeight: '1.5' }],
        small: ['14px', { lineHeight: '1.4' }],
      },
      spacing: {
        1: '8px',
        2: '16px',
        3: '24px',
        4: '32px',
        5: '40px',
        6: '48px',
        7: '56px',
      },
      maxWidth: {
        shell: '1200px',
      },
    },
  },
  plugins: [],
};

