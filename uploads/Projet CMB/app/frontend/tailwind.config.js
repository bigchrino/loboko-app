/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        loboko: {
          bg: '#0a0a0a',
          surface: '#1a1a1a',
          'surface-hover': '#252525',
          elevated: '#111111',
          border: '#2a2a2a',
          accent: '#8b5cf6',
          'accent-hover': '#7c3aed',
          'accent-light': 'rgba(139, 92, 246, 0.15)',
        }
      },
      fontFamily: {
        inter: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}