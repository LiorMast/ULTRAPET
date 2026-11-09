/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#BE1E24',
          'red-dark': '#96181D',
          'red-light': '#D42830',
          'red-muted': '#F5E8E8',
          charcoal: '#1A1A1A',
          'charcoal-2': '#2A2A2A',
          'charcoal-3': '#3A3A3A',
          'charcoal-muted': '#6B6B6B',
        },
        neutral: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          150: '#EFEFEF',
          200: '#E8E8E8',
          300: '#D0D0D0',
          400: '#A8A8A8',
          500: '#787878',
          600: '#555555',
          700: '#3A3A3A',
          800: '#282828',
          900: '#181818',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        widest: '0.25em',
        'ultra-wide': '0.35em',
      },
      boxShadow: {
        'premium': '0 20px 60px -10px rgba(0,0,0,0.15)',
        'premium-sm': '0 8px 30px -5px rgba(0,0,0,0.12)',
        'red': '0 8px 30px -5px rgba(190,30,36,0.35)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
        '1200': '1200ms',
      },
    },
  },
  plugins: [],
};
