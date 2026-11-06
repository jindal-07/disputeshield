import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Pin the project root so a stray lockfile in a parent folder isn't picked up.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
