import type { NextConfig } from 'next';

// Static export: the site is plain HTML, CSS and JS served by Cloudflare
// Workers static assets. Nothing needs a server; the only live data is read
// in the browser from Google Sheets and Discord.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: false,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
