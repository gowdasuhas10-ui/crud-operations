import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',
  server: {
    port: 5174, // Using 5174 to avoid conflict with Emergency Dashboard on 5173
    proxy: {
      '/read': 'http://127.0.0.1:5000',
      '/create': 'http://127.0.0.1:5000',
      '/update': 'http://127.0.0.1:5000',
      '/delete': 'http://127.0.0.1:5000',
      '/ai-query': 'http://127.0.0.1:5000'
    }
  },
  build: {
    outDir: '../backend/static',
    emptyOutDir: true
  }
});
