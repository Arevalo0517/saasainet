/** @type {import('next').NextConfig} */
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
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_URL ?? 'http://localhost:3001',
    NEXT_PUBLIC_APP_URL: process.env.APP_URL ?? 'http://localhost:3000',
  },
};

export default nextConfig;
