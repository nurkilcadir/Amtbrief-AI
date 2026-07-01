import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["pdfjs-dist"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
