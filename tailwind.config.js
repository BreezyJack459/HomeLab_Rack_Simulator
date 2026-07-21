/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic theme tokens — values come from CSS variables in
        // src/styles/theme.css and switch automatically per theme.
        // Prefer these over raw palette colors (slate/cyan/white/black).
        content: {
          DEFAULT: 'rgb(var(--c-content) / <alpha-value>)',
          secondary: 'rgb(var(--c-content-secondary) / <alpha-value>)',
          muted: 'rgb(var(--c-content-muted) / <alpha-value>)',
          faint: 'rgb(var(--c-content-faint) / <alpha-value>)'
        },
        surface: {
          DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)',
          raised: 'rgb(var(--c-surface-raised) / <alpha-value>)'
        },
        fill: {
          DEFAULT: 'rgb(var(--c-fill) / <alpha-value>)',
          strong: 'rgb(var(--c-fill-strong) / <alpha-value>)',
          subtle: 'rgb(var(--c-fill-subtle) / <alpha-value>)'
        },
        edge: {
          DEFAULT: 'rgb(var(--c-edge) / <alpha-value>)',
          strong: 'rgb(var(--c-edge-strong) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          fg: 'rgb(var(--c-accent-fg) / <alpha-value>)',
          'fg-strong': 'rgb(var(--c-accent-fg-strong) / <alpha-value>)',
          on: 'rgb(var(--c-accent-on) / <alpha-value>)',
          subtle: 'rgb(var(--c-accent-subtle) / <alpha-value>)',
          solid: 'rgb(var(--c-accent-solid) / <alpha-value>)',
          'solid-hover': 'rgb(var(--c-accent-solid-hover) / <alpha-value>)'
        },
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
