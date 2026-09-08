import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

import { defaultLocale, locales } from './src/i18n/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321',
  output: 'static',
  integrations: [react()],
  i18n: {
    defaultLocale,
    locales: [...locales],
    routing: {
      prefixDefaultLocale: true,
    },
  },
  redirects: {
    '/': `/${defaultLocale}/`,
  },
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
    // Three.js addons sit outside the main entry, so Vite keeps rediscovering
    // them and 504s the late rocket import as "Outdated Optimize Dep".
    assetsInclude: ['**/*.glb'],
    optimizeDeps: {
      include: [
        'three',
        '@react-three/fiber',
        '@react-three/rapier',
        'three/examples/jsm/loaders/GLTFLoader.js',
        'three/examples/jsm/libs/meshopt_decoder.module.js',
      ],
    },
    server: {
      warmup: {
        clientFiles: ['./src/components/ui/RocketScene.tsx'],
      },
    },
  },
});
