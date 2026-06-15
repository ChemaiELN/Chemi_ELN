import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
      colors: {
        teal: {
          50:  '#f4faf9',
          100: '#e8f4f4',
          200: '#cee6e5',
          300: '#add5d4',
          400: '#8cc4c2',
          500: '#6bb3b1',
          600: '#4a9290',
          700: '#5aa3a1',
          800: '#458988',
          900: '#3a7574',
        },
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
}

export default config
