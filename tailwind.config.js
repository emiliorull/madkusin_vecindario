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
          50: '#F8F4EC',   // Pergamino suave / Lino crudo claro
          100: '#EFE8D8',  // Lino crudo natural
          200: '#DFD3BC',  // Piedra de amolar clara / Papel artesano
          300: '#C8B89A',  // Cuero claro / Piedra media
          700: '#443E38',  // Carbón templado
          800: '#2A2522',  // Acero al carbono oscuro
          900: '#1B1816',  // Carbón piedra suave
          950: '#110F0D'   // Fragua profunda
        },
        kusin: {
          terra: '#991B1B',      // Rojo lacre artesanal (tono MAD del logo)
          terraDark: '#7F1D1D',  // Rojo óxido templado
          amber: '#B45309',      // Cuero tostado / Ámbar de taller
          leather: '#78350F',    // Cuero de asentador (strop)
          steel: '#3A3532',      // Acero al carbono
          whetstone: '#575049',  // Piedra de amolar
          sage: '#166534'        // Verde taller clásico
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', 'sans-serif'],
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
