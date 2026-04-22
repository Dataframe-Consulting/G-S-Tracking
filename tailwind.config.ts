import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1D3D29",
          50:  "#F5F2EB",  // Cream — light text on dark / page bg
          100: "#e0ebe3",
          200: "#b8d0bc",
          300: "#8fb594",
          400: "#659a6b",
          500: "#3E8051",  // Leaf — secondary / focus rings
          600: "#316644",
          700: "#264f35",  // Active nav
          800: "#1e3e2a",  // Hover states
          900: "#1D3D29",  // Forest — primary / sidebar bg
          950: "#0f2117"
        },
        accent: "#C47D28"  // Amber — GPS / accent
      },
      fontFamily: {
        sans:    ["var(--font-sans)",    "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
