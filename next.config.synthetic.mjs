/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: "/tmp/next-synthetic-dist",
  serverExternalPackages: ["@aws-sdk/client-s3", "stripe", "sharp"],
};
export default nextConfig;
