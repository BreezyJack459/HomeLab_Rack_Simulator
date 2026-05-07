/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rack: {
          bg: '#10131a',
          rail: '#252b38',
          line: '#3a4254',
          glow: '#5ac8fa'
        }
      },
      boxShadow: {
        panel: '0 18px 45px rgba(0, 0, 0, 0.28)'
      }
    }
  },
  plugins: []
};
