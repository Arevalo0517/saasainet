/** @type {import('next').NextConfig} */
const apiUpstream = process.env.API_UPSTREAM_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://35.92.220.88:3001';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@platform/auth',
    '@platform/contracts',
    '@platform/observability',
    '@platform/ui',
  ],
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUpstream.replace(/\/$/, '')}/api/v1/:path*`,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000',
  },
};

export default nextConfig;
