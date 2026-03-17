import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@blip/shared", "@blip/db", "@blip/e2b"],
};

export default nextConfig;
