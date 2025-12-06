import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Connect } from 'vite';

export default defineConfig({
  publicDir: "public",
  
  plugins: [
    react(),
    // Plugin personalizzato per redirect delle directory
    {
      name: 'directory-index',
      configureServer(server) {
        server.middlewares.use((req: Connect.IncomingMessage, res: any, next: Connect.NextFunction) => {
          // Se la richiesta finisce con / e non è la root
          if (req.url && req.url.endsWith('/') && req.url !== '/') {
            req.url = req.url + 'index.html';
          }
          next();
        });
      }
    }
  ],

  optimizeDeps: {
    include: ['@strudel/core', '@strudel/webaudio'],
    exclude: ['lucide-react'],
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
  },
});