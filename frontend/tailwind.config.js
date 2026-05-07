/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6958C2',
        'primary-light': '#8878D8',
        'primary-bg': '#f0eefb',
        'sidebar-bg': '#0d0c18',
        'content-bg': '#f5f4fb',
        't1': '#1a1830',
        't2': '#6b6890',
        't3': '#a8a6c0',
        'bdr': '#e8e6f0',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
