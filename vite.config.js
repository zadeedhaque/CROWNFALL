import { defineConfig } from 'vite';

// Relative base so the build drops straight into GitHub Pages, Netlify or Vercel
// without any path rewriting.
export default defineConfig({
  base: './',
  server: { port: 5173, open: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Phaser never changes between deploys; giving it its own chunk means
        // repeat visitors only re-download the game code.
        manualChunks: { phaser: ['phaser'] }
      }
    }
  }
});
