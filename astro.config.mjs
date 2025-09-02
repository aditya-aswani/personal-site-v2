import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

// For GitHub Pages deployment
// If using custom domain (adityaaswani.com), use that as site
// If using github.io, use: https://[username].github.io/[repo-name]

export default defineConfig({
  site: 'https://adityaaswani.com', // Update with your domain or GitHub Pages URL
  // base: '/repo-name', // Only needed if not using custom domain
  integrations: [
    mdx(),
    sitemap(),
    tailwind()
  ],
  vite: {
    ssr: {
      external: ["svgo"]
    }
  }
});