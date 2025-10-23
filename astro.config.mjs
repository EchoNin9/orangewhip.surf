import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import image from '@astrojs/image';

// https://astro.build/config
export default defineConfig({
  site: 'https://orangewhip.surf',
  integrations: [tailwind(), image()],
  output: 'static',
  build: {
    assets: '_assets'
  }
});
