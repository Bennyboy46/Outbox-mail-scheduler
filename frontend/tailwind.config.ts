import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e6f7ef',
          100: '#ccefdc',
          200: '#99dfb9',
          300: '#66cf96',
          400: '#33bf73',
          500: '#00a854', // Figma primary green
          600: '#00974b',
          700: '#007f3f',
          800: '#006733',
          900: '#004f27',
        },
      },
    },
  },
  plugins: [],
};

export default config;
