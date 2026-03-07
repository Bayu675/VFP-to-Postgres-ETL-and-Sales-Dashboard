/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Trik biar Tailwind ga ngerusak base styling MUI
  important: '#root',
  theme: {
    extend: {},
  },
  plugins: [],
}