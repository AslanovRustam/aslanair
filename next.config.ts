import type { NextConfig } from "next";

/** The models, the sky images and the sounds change only with a new build: a day fresh, a week stale-while-revalidate. */
const CACHED = "public, max-age=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return ["/models/:path*", "/images/:path*", "/sounds/:path*"].map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: CACHED }],
    }));
  },
};

export default nextConfig;
