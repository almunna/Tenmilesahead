/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // base palette (unchanged)
        black: "#000000",
        haiti: { 900: "#272b3c", 800: "#282c3c" },
        hydro: "#457680",
        outer: "#334d66",
        cedar: "#599ba6",
        sky: "#66bfcc",
        midnight: "#242437",

        // ✅ LIGHT THEME TOKENS
        background: "#f4f8fb", // light page background (soft blue-50 vibe)
        surface: "#ffffff", // cards/panels
        foreground: "#0f172a", // dark text (slate-900)
        muted: "#64748b", // slate-500/600 for body copy
        "muted-foreground": "#64748b", // enables placeholder:text-muted-foreground
        border: "#cbd5e1", // darker border for better contrast (slate-300)
        ring: "#66bfcc", // focus ring stays in palette

        primary: {
          DEFAULT: "#66bfcc", // Sky Dive
          600: "#599ba6", // Cedar
          700: "#457680", // Hydro
          800: "#334d66", // Outer Space
        },
        accent: {
          DEFAULT: "#599ba6",
          700: "#457680",
        },

        // back-compat
        brand: {
          DEFAULT: "#66bfcc",
          dark: "#599ba6",
        },
      },
    },
  },
  plugins: [],
};
