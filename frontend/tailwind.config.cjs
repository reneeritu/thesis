/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        skyblue: '#67defa',
        orangered: '#ffcc00',
        black: '#0a0a0a',
        grey: '#f4f4f4',
        pink: '#ff2a7a',
        ultramarine: '#1d3bff',
      },
      fontFamily: {
        body: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: [
          'Space Grotesk',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      spacing: {
        1: '8px',
        1.5: '12px',
        2: '16px',
        2.5: '20px',
        3: '24px',
        4: '32px',
        5: '40px',
      },
      maxWidth: {
        shell: '1280px',
      },
    },
  },
  plugins: [],
};

