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
          DEFAULT: '#FAF9F6',       // page bg — soft cream/beige
          surface: '#FFFFFF',       // cards
          elevated: '#F5F4F0',      // inputs / subtle panels
        },
        accent: {
          gold: '#1D4D3F',          // semantic alias kept
          'gold-hover': '#153A2F',
          purple: '#1D4D3F',
          // explicit names for the new organic green palette
          primary: '#1D4D3F',
          'primary-hover': '#153A2F',
          'primary-dark': '#0C1F19',
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
        heading: '0',
      },
      transitionDuration: {
        '150': '150ms',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
