import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: '#07111F',
          50: '#E6EAF0',
          100: '#B3BFCD',
          200: '#8095AB',
          300: '#4D6A89',
          400: '#1F406A',
          500: '#07111F',
          600: '#060E1A',
          700: '#040B14',
          800: '#03080F',
          900: '#02050A',
        },
        electric: {
          DEFAULT: '#2563EB',
          50: '#E8EEFE',
          100: '#C2D2FC',
          200: '#9BB5FA',
          300: '#7598F8',
          400: '#4E7BF6',
          500: '#2563EB',
          600: '#1E51BD',
          700: '#173F8E',
          800: '#0F2D60',
          900: '#081B31',
        },
        cyan: {
          ai: '#22D3EE',
          DEFAULT: '#22D3EE',
          50: '#E5FAFE',
          100: '#B8F1FA',
          200: '#8AE9F7',
          300: '#5DE0F3',
          400: '#3FD9EF',
          500: '#22D3EE',
          600: '#1BA9BF',
          700: '#147E8F',
          800: '#0E5460',
          900: '#072A30',
        },
        warm: {
          DEFAULT: '#FF7A59',
          50: '#FFEDE7',
          100: '#FFCFBE',
          200: '#FFB196',
          300: '#FF936D',
          400: '#FF8463',
          500: '#FF7A59',
          600: '#CC6247',
          700: '#994936',
          800: '#663124',
          900: '#331812',
        },
        cloud: {
          DEFAULT: '#F8FAFC',
          50: '#F8FAFC',
          100: '#E2E8F0',
          200: '#CBD5E1',
          300: '#94A3B8',
          400: '#64748B',
          500: '#475569',
          600: '#334155',
          700: '#1E293B',
          800: '#0F172A',
          900: '#0A0F1C',
        },
        brand: {
          50: '#E8EEFE',
          100: '#C2D2FC',
          500: '#2563EB',
          600: '#1E51BD',
          700: '#173F8E',
          900: '#081B31',
        },
      },
      backgroundImage: {
        'midnight-gradient':
          'linear-gradient(135deg, #07111F 0%, #0F2D60 50%, #2563EB 100%)',
        'aurora-gradient':
          'linear-gradient(120deg, #2563EB 0%, #22D3EE 50%, #FF7A59 100%)',
        'midnight-radial':
          'radial-gradient(circle at 20% 20%, rgba(34, 211, 238, 0.15) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(37, 99, 235, 0.18) 0%, transparent 50%), #07111F',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34, 211, 238, 0.3), 0 8px 24px -8px rgba(34, 211, 238, 0.4)',
        'glow-strong': '0 0 0 1px rgba(34, 211, 238, 0.5), 0 12px 32px -8px rgba(34, 211, 238, 0.6)',
        midnight: '0 12px 32px -16px rgba(7, 17, 31, 0.8)',
      },
    },
  },
  plugins: [],
};

export default config;
