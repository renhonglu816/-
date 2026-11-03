/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'xxl': '1.75rem',
        'xxxl': '2rem',
        'xxxxl': '2.5rem',
      },
      colors: {
        'primary': '#F97316',
        'primary-light': '#FFEDD5',
        'primary-dark': '#C2410C',
        'secondary': '#EA580C',
        'danger': '#EF4444',
        'warning': '#F97316',
        'info': '#F97316',
        'light': '#FFF7ED',
        'dark': '#1F2937',
      },
    },
  },
  plugins: [],
}