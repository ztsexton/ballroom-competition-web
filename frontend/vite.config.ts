import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Only load HTTPS certs if they exist (dev environment)
const certPath = path.resolve(__dirname, '../.cert/localhost+2.pem');
const keyPath = path.resolve(__dirname, '../.cert/localhost+2-key.pem');
const httpsConfig = fs.existsSync(certPath) && fs.existsSync(keyPath)
  ? {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    }
  : undefined;

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts'
  },
  server: {
    port: 3000,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: httpsConfig ? 'https://localhost:3001' : 'http://localhost:3001',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates in development
      },
    },
  }
});
