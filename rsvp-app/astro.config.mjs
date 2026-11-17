// @ts-check
import { defineConfig } from 'astro/config';
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  adapter: netlify(),
  output: 'server',
  integrations: [react(), tailwind()],
  vite: {
    optimizeDeps: {
      // Prebundle the auth client before React islands request it.
      include: ['@supabase/ssr'],
    },
    server: {
      allowedHosts: ['peroratorical-twiggier-marc.ngrok-free.dev'],
    },
  },

});
