import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './', // rutas relativas: funciona en GitHub Pages bajo cualquier subruta
  plugins: [tailwindcss()],
  test: {
    include: ['tests/**/*.test.js'],
  },
});
