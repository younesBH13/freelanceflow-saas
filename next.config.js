/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable body parsing for webhook routes
  async rewrites() {
    return []
  },
}

module.exports = nextConfig
