/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar) / <alpha-value>)',
          accent: 'hsl(var(--sidebar-accent) / <alpha-value>)',
        },
        surface: 'hsl(var(--surface) / <alpha-value>)',
        elevated: 'hsl(var(--elevated) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        text: {
          primary: 'hsl(var(--text-primary) / <alpha-value>)',
          secondary: 'hsl(var(--text-secondary) / <alpha-value>)',
          tertiary: 'hsl(var(--text-tertiary) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          hover: 'hsl(var(--accent-hover) / <alpha-value>)',
          soft: 'hsl(var(--accent-soft) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        status: {
          success: 'hsl(var(--status-success) / <alpha-value>)',
          warning: 'hsl(var(--status-warning) / <alpha-value>)',
          error: 'hsl(var(--status-error) / <alpha-value>)',
          info: 'hsl(var(--status-info) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        card: 'var(--radius-card)',
        composer: 'var(--radius-composer)',
        pill: 'var(--radius-pill)',
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
      },
      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
