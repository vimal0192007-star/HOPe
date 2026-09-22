/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        medical: {
          red: {
            50: '#FEF2F2',
            100: '#FEE2E2',
            200: '#FCA5A5',
            300: '#F87171',
            400: '#EF4444',
            500: '#DC2626', // Primary Medical Red
            600: '#C62828',
            700: '#B91C1C',
            800: '#991B1B',
            900: '#7F1D1D',
          },
          white: '#FFFFFF',
          bg: '#FAFAFA',
          card: '#FFFFFF',
          border: '#E5E7EB',
          text: '#111827',
          muted: '#6B7280',
          light: '#F3F4F6'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      },
      boxShadow: {
        'medical': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'medical-lg': '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        'care-orb': '0 0 20px rgba(220, 38, 38, 0.35), 0 0 40px rgba(220, 38, 38, 0.15)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 15px rgba(220, 38, 38, 0.3)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 30px rgba(220, 38, 38, 0.6)' },
        },
        wave: {
          '0%': { height: '8px' },
          '50%': { height: '24px' },
          '100%': { height: '8px' }
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2.5s infinite ease-in-out',
        'wave': 'wave 1s infinite ease-in-out',
      }
    },
  },
  plugins: [],
}
