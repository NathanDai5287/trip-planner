import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["bcrypt"],
  allowedDevOrigins: ["3000.cal.taxi"],
};

export default nextConfig;
