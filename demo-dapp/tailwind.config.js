/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          200: '#c2d4ff',
          300: '#94b1ff',
          400: '#5f84ff',
          500: '#3a5fff',
          600: '#1e3ffc',
          700: '#1630e8',
          800: '#1729bb',
          900: '#1a2993',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
        ethereum: '#627eea',
        bsc: '#f0b90b',
        base: '#0052ff',
        solana: '#00d4aa',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          'from': {
            'box-shadow': '0 0 10px -10px #667eea',
          },
          'to': {
            'box-shadow': '0 0 20px 10px #667eea',
          },
        },
      },
      fontFamily: {
        'mono': ['Monaco', 'Courier New', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}