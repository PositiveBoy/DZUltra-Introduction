import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./stores/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        dz: {
          yellow: "#ffd84d",
          orange: "#ff8a00",
          primary: "#FF662B",
          ink: "#171717",
          soft: "#fff7df",
          line: "#ece7dc"
        }
      },
      boxShadow: {
        phone: "0 28px 80px rgba(24, 24, 24, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
