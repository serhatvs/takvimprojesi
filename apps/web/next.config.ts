import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agu/ui", "@agu/config", "@agu/contracts"]
};

export default nextConfig;
