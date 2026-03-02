import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["tdl", "prebuilt-tdlib"],
};

export default nextConfig;
