// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Illak Zapata
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './', // rutas relativas: funciona en GitHub Pages bajo cualquier subruta
  plugins: [tailwindcss()],
  test: {
    include: ['tests/**/*.test.js'],
  },
});
