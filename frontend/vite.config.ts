import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
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

// Base path for deployment (e.g., '/ballroomcomp/' for zachsexton.com/ballroomcomp)
// Set via VITE_BASE_PATH env var at build time, defaults to '/'
const basePath = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: basePath,
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
