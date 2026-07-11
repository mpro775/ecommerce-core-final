import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const tablerIconsReactCjs = new URL(
  './node_modules/@tabler/icons-react/dist/cjs/tabler-icons-react.cjs',
  import.meta.url,
).pathname;
const tablerIconsReactAlias = decodeURIComponent(tablerIconsReactCjs).replace(/^\/([A-Za-z]:)/, '$1');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tabler/icons-react': tablerIconsReactAlias,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://api-temp.your-domain.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
