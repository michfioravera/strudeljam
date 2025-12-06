import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy'


export default defineConfig({
  publicDir: "docs", // ← usa la tua cartella /docs come public!
  
  plugins: [react(),
  viteStaticCopy({
    targets: [
        {
          src: 'docs',   // cartella generata da Typedoc
          dest: '.'      // copia tutto nella root della build
        }
      ]
    })
  ],

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

