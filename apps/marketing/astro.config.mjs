// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare(),

  vite: {
    plugins: [/** @type {any} */ (tailwindcss())],
    resolve: {
      alias: {
        '@/components/ui': fileURLToPath(new URL('../../packages/design-system/src/ui', import.meta.url)),
        '@/components/theme-provider': fileURLToPath(new URL('../../packages/design-system/src/theme-provider.tsx', import.meta.url)),
        '@/lib/utils': fileURLToPath(new URL('../../packages/design-system/src/lib/utils.ts', import.meta.url)),
      },
    },
  },

  integrations: [react()]
});
