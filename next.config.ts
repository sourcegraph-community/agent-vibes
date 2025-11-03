import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  outputFileTracingIncludes: {
    '/api/rss/sync': ['src/RssPipeline/Data/**/*'],
    '/api/rss/summarize': ['src/RssPipeline/Data/**/*'],
    '/api/rss/entries': ['src/RssPipeline/Data/**/*'],
  },
};

export default nextConfig;
