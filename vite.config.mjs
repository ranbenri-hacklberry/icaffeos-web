import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom build-end plugin to generate _redirects file for Cloudflare Pages SPA routing
function cfRedirectsPlugin() {
  return {
    name: 'cloudflare-redirects',
    closeBundle() {
      const distPath = path.resolve(__dirname, 'dist');
      if (fs.existsSync(distPath)) {
        fs.writeFileSync(
          path.join(distPath, '_redirects'),
          '/* /index.html 200\n'
        );
        console.log('✅ Generated _redirects in dist for Cloudflare SPA routing.');
      }
    }
  };
}

export default defineConfig({
  plugins: [
    react(), 
    cfRedirectsPlugin()
  ],
  base: '/',
  build: {
    outDir: 'dist',
    minify: 'terser'
  }
});
