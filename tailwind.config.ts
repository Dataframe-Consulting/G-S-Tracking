import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#085041",
          50: "#e8f3f0",
          100: "#c5e0d9",
          200: "#9ecbbf",
          300: "#75b5a4",
          400: "#52a28e",
          500: "#2f8f78",
          600: "#1f7362",
          700: "#14604f",
          800: "#0a553f",
          900: "#085041",
          950: "#043327"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
