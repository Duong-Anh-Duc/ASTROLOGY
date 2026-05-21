import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#FFFFFF',       // page bg — pure white
          surface: '#FFFFFF',       // cards
          elevated: '#F7F8FC',      // inputs
        },
        accent: {
          gold: '#5B6CFF',          // semantic alias kept — now primary blue
          'gold-hover': '#4A5AE8',
          purple: '#7C3AED',
          // explicit names for the new palette
          primary: '#5B6CFF',
          'primary-hover': '#4A5AE8',
          'primary-dark': '#4338CA',
          gradient: '#7C66FF',
        },
        border: {
          DEFAULT: '#E5E7EB',
          subtle: '#EEF0F4',
        },
        text: {
          primary: '#1A1F36',
          secondary: '#525866',
          tertiary: '#8A93A6',
          accent: '#5B6CFF',
        },
        semantic: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
        // Service brand colours for badges
        svc: {
          bat: '#F59E0B',        // Bát Tự — amber
          'bat-bg': '#FEF3C7',
          kinh: '#7C3AED',       // Kinh Dịch — violet
          'kinh-bg': '#EDE9FE',
          sim: '#3B82F6',        // Sim — blue
          'sim-bg': '#DBEAFE',
        },
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        soft: '0 1px 3px rgba(20, 30, 60, 0.04), 0 4px 12px rgba(20, 30, 60, 0.06)',
        elevated: '0 8px 24px rgba(20, 30, 60, 0.10)',
      },
      letterSpacing: {
        heading: '-0.01em',
      },
      transitionDuration: {
        '150': '150ms',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'svc-card':
          'linear-gradient(135deg, #4F46E5 0%, #6366F1 55%, #7C66FF 100%)',
        'btn-primary':
          'linear-gradient(95deg, #5B6CFF 0%, #7C66FF 60%, #A855F7 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
