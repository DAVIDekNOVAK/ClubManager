import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// V razvojnem načinu Vite zahteve na /api posreduje backendu, zato brskalnik
// frontend in API vidi kot isti izvor (piškotek seje deluje brez dodatnih nastavitev).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
});
