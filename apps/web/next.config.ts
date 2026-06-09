import type { NextConfig } from "next";

const apiBaseUrl = process.env.DZULTRA_API_BASE_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  typedRoutes: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
