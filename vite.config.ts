import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/life-dashboard-vite-test/',
  plugins: [react()],
});
