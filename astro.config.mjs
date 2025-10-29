import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://orangewhip.surf',
  integrations: [tailwind(), react()],
  output: 'static',
  build: {
    assets: '_assets'
  }
});
