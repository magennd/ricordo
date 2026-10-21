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
        forest: {
          DEFAULT: '#012615',
          deep: '#012615',
          panel: '#06351F',
          muted: '#0B472A',
        },
        leaf: {
          DEFAULT: '#65A603',
          hover: '#548B02',
          light: '#EBF5D9',
        },
        alabaster: {
          DEFAULT: '#F6EFEB',
          light: '#FAF7F5',
          dark: '#EBE0D8',
        },
        coral: {
          DEFAULT: '#E4774F',
          hover: '#D4633B',
          light: '#FCECE6',
        },
        sand: {
          DEFAULT: '#D9C5B8',
          hover: '#CBB4A5',
        },
      },
      fontFamily: {
        display: ['Excon', 'sans-serif'],
        sans: ['Ranade', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
