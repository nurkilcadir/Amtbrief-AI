import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        civic: {
          50: "#F9F9FF",
          100: "#F1F3FF",
          200: "#DCE2F7",
          500: "#3755C3",
          600: "#1E40AF",
          700: "#00288E",
        },
        mint: "#DFF8EF",
        amberSoft: "#FFF3D8",
        roseSoft: "#FFE8E8",
      },
      boxShadow: {
        card: "0 4px 14px rgba(15, 23, 42, 0.06)",
        soft: "0 4px 12px rgba(15, 23, 42, 0.045)",
        action: "0 8px 18px rgba(30, 64, 175, 0.22)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
