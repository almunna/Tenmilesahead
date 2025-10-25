/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563eb", // used by bg-brand, text-brand, ring-brand, etc.
          dark: "#1e40af", // used by hover:bg-brand-dark
        },
      },
    },
  },
  plugins: [],
};
