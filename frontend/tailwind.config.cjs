/** @type {import('tailwindcss').Config} */

const monoStack = [
  'JetBrains Mono',
  'ui-monospace',
  'SFMono-Regular',
  'Menlo',
  'monospace',
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
        /** All UI uses one monospace stack (see :root --text-* in index.css). */
        sans: monoStack,
        heading: monoStack,
        mono: monoStack,
      },
      fontSize: {
        /** Fixed scale from CSS variables — do not use arbitrary text-[Npx] for rhythm. */
        xs: ['var(--text-xs)', { lineHeight: '1.45' }],
        sm: ['var(--text-sm)', { lineHeight: '1.45' }],
        base: ['var(--text-base)', { lineHeight: '1.5' }],
        md: ['var(--text-md)', { lineHeight: '1.45' }],
        lg: ['var(--text-lg)', { lineHeight: '1.4' }],
        xl: ['var(--text-xl)', { lineHeight: '1.35' }],
        '2xl': ['var(--text-2xl)', { lineHeight: '1.3' }],
        body: ['var(--text-base)', { lineHeight: '1.5' }],
        small: ['var(--text-sm)', { lineHeight: '1.45' }],
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
