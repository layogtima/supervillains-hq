// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://supervillains.wtf',
  integrations: [vue()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // playbook-engine Worker runs locally via `npm run engine:dev`
      proxy: {
        '/api/playbook': 'http://localhost:8799',
      },
    },
  },
});
