/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#131316',
        card: '#1F2025',
        border: '#383941',
        brand: {
          50: '#eef4ff',
          100: '#d9e8ff',
          400: '#7fcfff',
          500: '#A8C7FA',
          600: '#8ab4f8',
        },
        m3: {
          bg: '#131316',
          surface: '#1B1C20',
          container: '#1F2025',
          'container-high': '#26272D',
          'container-highest': '#2F3037',
          outline: '#44474F',
          'outline-variant': '#383941',
          primary: '#A8C7FA',
          'primary-container': '#004A77',
          'on-primary-container': '#D3E3FD',
          secondary: '#C2E7FF',
          mint: '#6DD58C',
          coral: '#F28B82',
          amber: '#FDD663',
          purple: '#D0BCFF',
          text: '#E3E2E6',
          'text-muted': '#9496A1',
        }
      }
    },
  },
  plugins: [],
}
