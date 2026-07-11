import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this repo from /stw-pension-calc/, not the domain
  // root. Only the Pages deploy workflow sets DEPLOY_TARGET=gh-pages; a
  // plain `npm run build` (Vercel/Netlify/local) stays rooted at '/'.
  base: process.env.DEPLOY_TARGET === 'gh-pages' ? '/stw-pension-calc/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        indrop: fileURLToPath(new URL('./in-drop.html', import.meta.url)),
      },
    },
  },
})
