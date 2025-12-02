const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scansione dei file dove Tailwind deve trovare classi
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  
  // Classi che Tailwind deve sempre generare, anche se dinamiche
  safelist: [
    'bg-trackActive',
    'text-trackActive',
    'border-trackActive',
  ],

  theme: {
    extend: {
      // Colori custom per tracce, background, etc.
      colors: {
        trackActive: '#0f172a', // colore per traccia attiva
        appbg: '#0f172a',       // background generale app
      },

      // Animazioni personalizzate (per flash step, ecc.)
      keyframes: {
        flash: {
          '0%': { opacity: 0.9, transform: 'scale(1)' },
          '100%': { opacity: 0, transform: 'scale(1.2)' },
        },
      },
      animation: {
        flash: 'flash 120ms ease-out forwards',
      },
    },
  },

  plugins: [],
};
