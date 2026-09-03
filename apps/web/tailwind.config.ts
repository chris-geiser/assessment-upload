import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

// Design tokens extracted from the School Portal's compiled CSS (the IRDL system),
// so the prototype is visually aligned with the real product. NOTE: the constitution
// lists brand purple as #632E93, but the actual portal primary is purple-500 #573988;
// we follow the real design system here and flag the constitution hex as inaccurate.
const purple = {
  50: "#f7f4fa",
  100: "#f7f4fa",
  200: "#c9cff1",
  300: "#9a98cb",
  400: "#7961a0",
  500: "#573988",
  600: "#462e6d",
  700: "#331f53",
  800: "#27004b",
  900: "#110b1b",
  DEFAULT: "#573988",
};

const pink = {
  50: "#fce5f0",
  200: "#f18dc1",
  400: "#ed017f",
  500: "#e6006d",
  DEFAULT: "#e6006d",
};

const neutral = {
  50: "#fafafa",
  100: "#ebebeb",
  200: "#d6d6d6",
  300: "#c2c2c2",
  400: "#adadad",
  500: "#999999",
  600: "#737373",
  700: "#5e5e5e",
  800: "#3d3c3c",
  900: "#111827",
};

// IRDL semantic hues layered over Tailwind defaults so unused shades still resolve.
const green = { ...colors.emerald, 100: "#e7fbf5", 200: "#c8fbeb", 500: "#28d7a3", 600: "#20ac82", 700: "#188161" };
const red = { ...colors.rose, 100: "#ffecf0", 200: "#fdced9", 400: "#ff6a8c", 500: "#ff3f6d", 600: "#f1255a", 700: "#cc3357" };
const yellow = { ...colors.amber, 100: "#fef8ee", 200: "#fdecc8", 400: "#ffd680", 500: "#ffc854", 700: "#a16207" };

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: purple, // components use `brand`; remapping fixes every purple at once
        purple,
        pink,
        neutral,
        // Any stray `gray-*` resolves to the neutral scale (no off-palette gray).
        gray: { ...colors.gray, ...neutral },
        green,
        red,
        yellow,
        surface: "#f5f5f5",
      },
    },
  },
  plugins: [],
};

export default config;
