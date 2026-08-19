import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/Nota", destination: "/", permanent: false },
      { source: "/nota", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
