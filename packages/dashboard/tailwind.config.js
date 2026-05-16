/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        discord: {
          DEFAULT: "#5865F2",
          hover:   "#4752d6",
          subtle:  "var(--accent-subtle)",
        },
        /* ── semantic theme tokens (CSS-var backed) ── */
        theme: {
          primary:   "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary:  "var(--bg-tertiary)",
          hover:     "var(--bg-hover)",
          border:    "var(--border-color)",
          subtle:    "var(--border-subtle)",
        },
        /* keep the old dark-* aliases so existing guild page classes still work */
        dark: {
          600: "var(--bg-hover)",
          700: "var(--bg-tertiary)",
          800: "var(--bg-secondary)",
          900: "var(--bg-primary)",
        },
      },
      textColor: {
        "theme-primary":   "var(--text-primary)",
        "theme-secondary": "var(--text-secondary)",
        "theme-muted":     "var(--text-muted)",
        "theme-inverse":   "#ffffff",
      },
      borderColor: {
        "theme-border": "var(--border-color)",
        "theme-subtle": "var(--border-subtle)",
      },
      backgroundColor: {
        "theme-primary":     "var(--bg-primary)",
        "theme-secondary":   "var(--bg-secondary)",
        "theme-tertiary":    "var(--bg-tertiary)",
        "theme-hover":       "var(--bg-hover)",
        "accent-subtle":     "var(--accent-subtle)",
        "success-subtle":    "var(--success-subtle)",
        "warning-subtle":    "var(--warning-subtle)",
        "danger-subtle":     "var(--danger-subtle)",
      },
      boxShadow: {
        sm:  "var(--shadow-sm)",
        md:  "var(--shadow-md)",
        lg:  "var(--shadow-lg)",
        discord: "0 4px 20px rgba(88,101,242,0.25)",
      },
      borderRadius: {
        xl:  "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      animation: {
        "fade-in":  "fade-in 0.2s ease both",
        "slide-in": "slide-in 0.2s ease both",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
