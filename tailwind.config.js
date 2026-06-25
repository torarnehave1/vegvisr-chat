/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/vegvisr-ui-kit/src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        // Inter for crisp rendering across platforms; falls back to system stack
        // if Google Fonts is blocked. Loaded in index.html via preconnect + link.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    }
  },
  plugins: []
};
