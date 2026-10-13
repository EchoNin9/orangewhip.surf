/** Accent step: --ow-accent mixed with white/black, opacity-aware. */
const tint = (toward, pct) => {
  const base = toward ? `color-mix(in oklch, var(--ow-accent) ${pct}%, ${toward})` : 'var(--ow-accent)';
  return `color-mix(in oklch, ${base} calc(<alpha-value> * 100%), transparent)`;
};

/** A CSS-var colour that still supports opacity modifiers (text-ow-danger/70). */
const alpha = (v) => `color-mix(in oklch, var(${v}) calc(<alpha-value> * 100%), transparent)`;

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
          'accent-2': alpha('--ow-accent-2'),
          'accent-3': alpha('--ow-accent-3'),
          'on-accent': 'var(--ow-on-accent)',
          hairline: 'var(--ow-hairline)',
          'hairline-strong': 'var(--ow-hairline-strong)',
          surface: 'var(--ow-surface)',
          'surface-hover': 'var(--ow-surface-hover)',
          danger: alpha('--ow-danger'),
          success: alpha('--ow-success'),
          glass: 'var(--ow-glass)',
          'glass-strong': 'var(--ow-glass-strong)',
          'ghost-border': 'var(--ow-ghost-border)',
        },
        // Legacy scales, re-pointed at the OW system (route migration, step C).
        // primary-* follows the live palette: --ow-accent mixed toward white/black,
        // with <alpha-value> so opacity modifiers (bg-primary-500/25) keep working.
        primary: {
          50: tint('white', 12),
          100: tint('white', 22),
          200: tint('white', 40),
          300: tint('white', 62),
          400: tint('white', 82),
          500: tint(null, 100),
          600: tint('black', 85),
          700: tint('black', 70),
          800: tint('black', 55),
          900: tint('black', 42),
        },
        // secondary-* = warm neutrals at slate's lightness steps (contrast preserved; 900 = --ow-bg)
        secondary: {
          50: '#fcf9f5',
          100: '#f4eee4',
          200: '#e4ddd2',
          300: '#d1c9be',
          400: '#a9a094',
          500: '#8e8479', // 5.3:1 on bg, 4.95:1 on cards (AA)
          600: '#5e534a',
          700: '#483d36',
          800: '#2a1f19',
          900: '#140b07',
        },
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        display: ['Anton', 'system-ui', 'sans-serif'],
        // OW redesign faces (OW-2)
        cooper: ['"Cooper Hewitt"', 'system-ui', 'sans-serif'],
        anton: ['Anton', 'system-ui', 'sans-serif'],
        grotesk: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
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
