/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL ?? "http://localhost:8080";

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // The browser only ever talks to this origin; API and uploaded files are proxied to the backend.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/files/:path*", destination: `${backend}/files/:path*` },
    ];
  },
};

export default nextConfig;
