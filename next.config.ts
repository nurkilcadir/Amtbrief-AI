import type { NextConfig } from "next";

const BUILD_TS = Date.now().toString();

const nextConfig: NextConfig = {
  generateBuildId: () => `build-${BUILD_TS}`,
  env: {
    NEXT_PUBLIC_BUILD_TS: BUILD_TS,
  },
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
