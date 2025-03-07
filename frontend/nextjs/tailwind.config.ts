import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          dark: '#1F2937',  // Dark navy from logo
          main: '#374151',  // Slightly lighter navy
          light: '#4B5563', // Light navy
        },
        secondary: {
          main: '#10B981',  // Green checkmark color from logo
          light: '#34D399',
          dark: '#059669',
        },
        accent: {
          main: '#D1D5DB',  // Light gray from logo
          light: '#F3F4F6',
          dark: '#9CA3AF',
        }
      },
    },
  },
  plugins: [],
} satisfies Config;
