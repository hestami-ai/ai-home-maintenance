/** @type {import('next').NextConfig} */

const nextConfig = {
  output: 'standalone',

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Configure domains for optimized images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'static.hestami-ai.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8090',
        pathname: '/**',
      },
    ],
  },

  // API routes proxy configuration
  async rewrites() {
    return [
      // Handle Next Auth's internal routes locally
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*',
      },
      // Proxy Django auth endpoints
      {
        source: '/api/users/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/users/:path*`,
      },
    ];
  },

  // Security headers configuration
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.cloudflare.com;
              frame-src 'self' https://*.cloudflare.com;
              style-src 'self' 'unsafe-inline';
              connect-src 'self' https://*.cloudflare.com;
              img-src 'self' data: blob: https://*.cloudflare.com http://localhost:8090 https://*.thumbtack.com https://*.googleapis.com https://*.ggpht.com https://* ;
              media-src 'self' http://localhost:8090;
              worker-src 'self' blob:;
              font-src 'self' data:;
            `.replace(/\s+/g, ' ').trim()
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Host',
            value: process.env.NODE_ENV === 'development' ? 'localhost' : process.env.NEXT_PUBLIC_HOST || '',
          }
        ],
      },
      {
        // Allow static files to be loaded
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Environment configuration
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // Webpack configuration for module resolution
  webpack(config) {
    return config;
  },
};

module.exports = nextConfig;
