/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Warm, handmade palette — clay and cream rather than the usual SaaS blue.
        clay: {
          50: '#FDF5F1',
          100: '#F9E6DC',
          200: '#F0C8B4',
          300: '#E3A183',
          400: '#D47B55',
          500: '#C2603A',
          600: '#A54B2B',
          700: '#833A22',
          800: '#5F2A19',
          900: '#3D1B11',
        },
        cream: {
          50: '#FEFCFA',
          100: '#FBF7F2',
          200: '#F4ECE1',
          300: '#E8DCCB',
        },
        ink: {
          400: '#8A7A70',
          500: '#6B5A50',
          600: '#4A382E',
          700: '#33241C',
          800: '#241812',
          900: '#180F0A',
        },
        sage: {
          100: '#E4EDE7',
          400: '#7C9A88',
          500: '#5E7A6B',
          600: '#47604F',
        },
        saffron: {
          100: '#FCEFD2',
          400: '#E8B44A',
          500: '#D99A22',
          600: '#B37B14',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(36, 24, 18, 0.04), 0 8px 24px -12px rgba(36, 24, 18, 0.18)',
        lift: '0 2px 4px rgba(36, 24, 18, 0.06), 0 18px 40px -16px rgba(36, 24, 18, 0.28)',
        phone: '0 40px 90px -30px rgba(36, 24, 18, 0.45)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};
