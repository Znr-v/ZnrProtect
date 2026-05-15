/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        discord: "#5865F2",
        dark: {
          600: "#313338",
          700: "#2b2d31",
          800: "#1e1f22",
          900: "#111214",
        },
      },
    },
  },
  plugins: [],
};
