/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        black: '#0a0a0a',
        white: '#ffffff',
        grey: {
          50: '#fafafa',
          100: '#f4f4f4',
          200: '#e0e0e0',
          400: '#9e9e9e',
        },
        yellow: {
          400: '#ffd94a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
        /** Headings / display (loaded in `index.html`) */
        bricolage: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
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

