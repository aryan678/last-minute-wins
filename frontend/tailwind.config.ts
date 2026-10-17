import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 900: "#0f1729", 800: "#18223a", 700: "#243150" },
        brand: { 500: "#4f46e5", 600: "#4338ca", 50: "#eef2ff" },
      },
    },
  },
  plugins: [],
};

export default config;
