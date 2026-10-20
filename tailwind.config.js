/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stone: {
          50: '#FAF7F2',
          100: '#F3EDE2',
          200: '#E6DCCB',
          800: '#292524',
          900: '#1C1917',
          950: '#0F0D0C'
        },
        kusin: {
          terra: '#C2410C',
          terraDark: '#9A3412',
          amber: '#D97706',
          water: '#0284C7',
          waterLight: '#E0F2FE',
          leather: '#78350F',
          sage: '#15803D'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
      },
      keyframes: {
        pulseWave: {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        }
      },
      animation: {
        'pulse-wave-1': 'pulseWave 1s ease-in-out infinite',
        'pulse-wave-2': 'pulseWave 1s ease-in-out 0.2s infinite',
        'pulse-wave-3': 'pulseWave 1s ease-in-out 0.4s infinite',
        'pulse-wave-4': 'pulseWave 1s ease-in-out 0.15s infinite',
      }
    },
  },
  plugins: [],
};
