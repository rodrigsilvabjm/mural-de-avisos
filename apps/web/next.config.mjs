/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/player/:path*',
        headers: noCacheHeaders(),
      },
      {
        source: '/player-lite/:path*',
        headers: noCacheHeaders(),
      },
      {
        source: '/_next/static/:path*',
        headers: noCacheHeaders(),
      },
    ];
  },
};

function noCacheHeaders() {
  return [
    { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
    { key: 'Pragma', value: 'no-cache' },
    { key: 'Expires', value: '0' },
  ];
}

export default nextConfig;
