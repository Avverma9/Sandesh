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
        primary: {
          light: '#f3f4f6',
          dark: '#1f2937',
        },
        secondary: {
          light: '#ffffff',
          dark: '#111827',
        },
        text: {
          light: '#111827',
          dark: '#f9fafb',
        }
      },
    },
  },
  plugins: [],
}