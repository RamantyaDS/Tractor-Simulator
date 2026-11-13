import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site at /Tractor-Simulator/
export default defineConfig({
  base: '/Tractor-Simulator/',
  plugins: [react()],
});
