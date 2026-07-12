/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Redesign nav breakpoint: ≤760 mobile, ≥761 desktop (OW-4)
        ow: '761px',
      },
      colors: {
        // OW redesign tokens — resolved from CSS vars in index.css (OW-2)
        ow: {
          bg: 'var(--ow-bg)',
          'bg-top': 'var(--ow-bg-top)',
          text: 'var(--ow-text)',
          dim: 'var(--ow-text-dim)',
          dimmer: 'var(--ow-text-dimmer)',
          accent: 'var(--ow-accent)',
          'accent-2': 'var(--ow-accent-2)',
          'accent-3': 'var(--ow-accent-3)',
          'on-accent': 'var(--ow-on-accent)',
          hairline: 'var(--ow-hairline)',
          'hairline-strong': 'var(--ow-hairline-strong)',
          surface: 'var(--ow-surface)',
          'surface-hover': 'var(--ow-surface-hover)',
        },
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Oswald', 'system-ui', 'sans-serif'],
        // OW redesign faces (OW-2)
        cooper: ['"Cooper Hewitt"', 'system-ui', 'sans-serif'],
        anton: ['Anton', 'Oswald', 'system-ui', 'sans-serif'],
        grotesk: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
