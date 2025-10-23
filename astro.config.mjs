import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://orangewhip.surf',
  integrations: [tailwind()],
  output: 'static',
  build: {
    assets: '_assets'
  }
});
