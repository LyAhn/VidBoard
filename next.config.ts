import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ['motion'],
  webpack: (config, { dev }) => {
    if (dev) {
      if (process.env.DISABLE_HMR === 'true') {
        config.watchOptions = { ignored: /.*/ };
      } else {
        // Native fs watchers are unreliable on Windows — use polling instead
        config.watchOptions = {
          poll: 500,
          aggregateTimeout: 200,
        };
      }
    }
    return config;
  },
};

export default nextConfig;
