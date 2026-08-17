/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        polaris: {
          surface: '#ffffff',
          'surface-secondary': '#f7f7f8',
          'surface-hover': '#f1f1f2',
          border: '#e1e3e5',
          'border-subdued': '#ebebeb',
          text: '#202223',
          'text-subdued': '#6d7175',
          primary: '#008060',
          'primary-hover': '#006e52',
          success: '#108043',
          warning: '#b95000',
          critical: '#d72c0d',
          info: '#2c6ecb',
        },
        geo: {
          emerald: '#10b981',
          teal: '#0d9488',
        },
        aeo: {
          blue: '#2563eb',
          indigo: '#4f46e5',
        },
        aio: {
          purple: '#7c3aed',
          violet: '#8b5cf6',
        }
      },
      boxShadow: {
        'polaris-card': '0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        'polaris-popover': '0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
