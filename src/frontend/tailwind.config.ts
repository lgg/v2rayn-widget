import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "hsl(var(--canvas) / <alpha-value>)",
        panel: "hsl(var(--panel) / <alpha-value>)",
        text: "hsl(var(--text) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        danger: "hsl(var(--danger) / <alpha-value>)"
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem"
      },
      boxShadow: {
        float: "0 16px 48px rgba(8, 22, 48, 0.20)",
        glow: "0 0 0 8px rgba(33, 111, 255, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
