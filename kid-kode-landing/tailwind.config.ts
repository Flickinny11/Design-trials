import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        void: "#04050a",
        abyss: "#08091a",
        obsidian: "#0e1025",
        steel: "#14162c",
        graphite: "#1b1d36",
        platinum: "#e8eaf5",
        electric: "#4da6ff",
        prism: {
          red: "#ff5577",
          orange: "#ff9a44",
          yellow: "#ffd966",
          green: "#55e6a5",
          cyan: "#5ee0ff",
          blue: "#5d8bff",
          violet: "#a978ff",
          pink: "#ff6ec7",
        },
        verified: "#22c55e",
        warn: "#f5a524",
        failed: "#ef4466",
        pending: "#6b7694",
        frozen: "#8bb4ff",
      },
      boxShadow: {
        glow: "0 0 40px rgba(93, 139, 255, 0.25)",
        rim: "inset 0 0 0 1px rgba(255,255,255,0.06)",
      },
      animation: {
        "float-slow": "float 18s ease-in-out infinite",
        "slide-in-r": "slide-in-r 340ms cubic-bezier(0.22, 1, 0.36, 1)",
        shimmer: "shimmer 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translate3d(0,0,0)" },
          "50%": { transform: "translate3d(-1%,-2%,0)" },
        },
        "slide-in-r": {
          "0%": { transform: "translateX(30px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        shimmer: {
          "0%, 100%": { boxShadow: "0 0 36px rgba(85,230,165,0.45)" },
          "50%": { boxShadow: "0 0 52px rgba(85,230,165,0.75)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
