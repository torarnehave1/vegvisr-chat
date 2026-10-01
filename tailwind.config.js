/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './packages/chat-workspace/src/**/*.{js,ts,jsx,tsx}',
    './node_modules/vegvisr-ui-kit/src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      // Semantic colours backed by the CSS variables in src/styles/tokens.css.
      // `<alpha-value>` keeps bg-brand/20 and friends working. A component
      // references these and never names a theme; .dark on <html> swaps the set.
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          sunk: 'rgb(var(--surface-sunk) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          faint: 'rgb(var(--ink-faint) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          ink: 'rgb(var(--brand-ink) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
        },
        mine: {
          DEFAULT: 'rgb(var(--mine) / <alpha-value>)',
          ink: 'rgb(var(--mine-ink) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          ink: 'rgb(var(--danger-ink) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
        },
        notice: {
          DEFAULT: 'rgb(var(--notice) / <alpha-value>)',
          ink: 'rgb(var(--notice-ink) / <alpha-value>)',
          soft: 'rgb(var(--notice-soft) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          ink: 'rgb(var(--success-ink) / <alpha-value>)',
          soft: 'rgb(var(--success-soft) / <alpha-value>)',
        },
        agent: {
          DEFAULT: 'rgb(var(--agent) / <alpha-value>)',
          ink: 'rgb(var(--agent-ink) / <alpha-value>)',
          soft: 'rgb(var(--agent-soft) / <alpha-value>)',
        },
      },
      minHeight: { 11: '2.75rem' },
      minWidth: { 11: '2.75rem' },
      fontFamily: {
        // Inter for crisp rendering across platforms; falls back to system stack
        // if Google Fonts is blocked. Loaded in index.html via preconnect + link.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    }
  },
  plugins: []
};
