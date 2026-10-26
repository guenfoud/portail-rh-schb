import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8082,
    host: true,
    // Autorise tous les sous-domaines ngrok et hôtes distants
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        ws: true
      }
    }
  }
});
