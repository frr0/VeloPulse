/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#080A0F',
        card: '#121722',
        border: '#1f293d',
        brand: {
          50: '#e6fff6',
          100: '#b3ffe2',
          400: '#26ebad',
          500: '#00E5A3',
          600: '#00b882',
        }
      }
    },
  },
  plugins: [],
}
