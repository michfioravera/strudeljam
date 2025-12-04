import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  optimizeDeps: {
    include: ['@strudel/core', '@strudel/webaudio'],
    exclude: ['lucide-react'],
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
    // Rimuovi l'alias se vuoi usare i pacchetti npm
    alias: {
      // '@strudel': path.resolve(__dirname, 'src/external/strudel/dist'),
    },
  },
});

