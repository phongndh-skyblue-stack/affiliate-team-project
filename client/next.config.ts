import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ['super-affiliate.micace.org'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:4050/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://127.0.0.1:4050/uploads/:path*',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://127.0.0.1:4050/socket.io/:path*',
      },
    ];
  },
};

export default nextConfig;
