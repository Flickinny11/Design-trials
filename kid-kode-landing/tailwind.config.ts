import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        // --ds-font-* (design-system/tokens.css) wrap the next/font/local
        // variables with clean system fallback stacks: Sora / Sora / JetBrains Mono.
        display: ['var(--ds-font-display)', 'ui-sans-serif', 'system-ui'],
        sans: ['var(--ds-font-ui)', 'ui-sans-serif', 'system-ui'],
        ui: ['var(--ds-font-ui)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--ds-font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        void: '#04050a',
        abyss: '#08091a',
        obsidian: '#0e1025',
        steel: '#14162c',
        graphite: '#1b1d36',
        platinum: '#e8eaf5',
        electric: '#4da6ff',
        prism: {
          red: '#ff5577',
          orange: '#ff9a44',
          yellow: '#ffd966',
          green: '#55e6a5',
          cyan: '#5ee0ff',
          blue: '#5d8bff',
          violet: '#a978ff',
          pink: '#ff6ec7',
        },
        verified: '#22c55e',
        warn: '#f5a524',
        failed: '#ef4466',
        pending: '#6b7694',
        frozen: '#8bb4ff',
        // ── Design-system namespace (Wave 0 contract; mirrors tokens.css) ──
        ds: {
          void: 'var(--ds-void)',
          ink: 'var(--ds-ink)',
          charcoal: 'var(--ds-charcoal)',
          graphite: 'var(--ds-graphite)',
          slate: 'var(--ds-slate)',
          steel: 'var(--ds-steel)',
          'text-hi': 'var(--ds-text-hi)',
          text: 'var(--ds-text)',
          'text-mid': 'var(--ds-text-mid)',
          'text-low': 'var(--ds-text-low)',
          metal: {
            100: 'var(--ds-metal-100)',
            200: 'var(--ds-metal-200)',
            300: 'var(--ds-metal-300)',
            400: 'var(--ds-metal-400)',
            500: 'var(--ds-metal-500)',
            600: 'var(--ds-metal-600)',
            700: 'var(--ds-metal-700)',
          },
          // Arc-cyan — the single emissive / active accent (+ anodized tint).
          arc: 'var(--ds-arc)',
          'arc-hot': 'var(--ds-arc-hot)',
          anodized: 'var(--ds-anodized)',
          ice: {
            200: 'var(--ds-ice-200)',
            300: 'var(--ds-ice-300)',
            400: 'var(--ds-ice-400)',
            500: 'var(--ds-ice-500)',
          },
          ok: 'var(--ds-ok)',
          warn: 'var(--ds-warn)',
          danger: 'var(--ds-danger)',
          neutral: 'var(--ds-neutral)',
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(93, 139, 255, 0.25)',
        rim: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        'ds-0': 'var(--ds-elev-0)',
        'ds-1': 'var(--ds-elev-1)',
        'ds-2': 'var(--ds-elev-2)',
        'ds-3': 'var(--ds-elev-3)',
        'ds-4': 'var(--ds-elev-4)',
      },
      borderRadius: {
        'ds-xs': 'var(--ds-r-xs)',
        'ds-sm': 'var(--ds-r-sm)',
        'ds-md': 'var(--ds-r-md)',
        'ds-lg': 'var(--ds-r-lg)',
        'ds-xl': 'var(--ds-r-xl)',
      },
      animation: {
        'float-slow': 'float 18s ease-in-out infinite',
        'slide-in-r': 'slide-in-r 340ms cubic-bezier(0.22, 1, 0.36, 1)',
        'shimmer': 'shimmer 4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(-1%,-2%,0)' },
        },
        'slide-in-r': {
          '0%': { transform: 'translateX(30px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        shimmer: {
          '0%, 100%': { boxShadow: '0 0 36px rgba(85,230,165,0.45)' },
          '50%': { boxShadow: '0 0 52px rgba(85,230,165,0.75)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
