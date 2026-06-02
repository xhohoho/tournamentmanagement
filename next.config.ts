import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Type-safe Link href and router.push — catches broken routes at build time.
  experimental: {
    typedRoutes: true,
  },
  // Produce a self-contained output directory for Docker / custom server deploys.
  output: 'standalone',
};

export default nextConfig;
