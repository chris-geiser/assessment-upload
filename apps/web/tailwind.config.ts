import type { Config } from "tailwindcss";

// Brand system per constitution P5. Primary is purple #632E93. Status colors map
// to semantic names used across the kit (green success, yellow warning, red error,
// blue processing, gray superseded).
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#632E93",
          50: "#F4EEFA",
          100: "#E7DAF3",
          600: "#632E93",
          700: "#512578",
          800: "#3F1C5E",
        },
        status: {
          success: "#15803D",
          warning: "#B45309",
          error: "#B91C1C",
          processing: "#1D4ED8",
          superseded: "#6B7280",
        },
      },
    },
  },
  plugins: [],
};

export default config;
