/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  serverExternalPackages: ["@aws-sdk/client-s3", "stripe", "sharp"],
  // Photos uploaded after the build are not in public/ as far as the production
  // server is concerned: serve them from UPLOADS_DIR through an API route.
  async rewrites() {
    return [{ source: "/uploads/:key", destination: "/api/uploads/:key" }];
  },
};

export default nextConfig;
