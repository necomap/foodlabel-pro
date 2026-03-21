/** @type {import('next').NextConfig} */
const nextConfig = {
  // 日本語フォントのサポート
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  images: {
    remotePatterns: [],
  },
  // 印刷用ページはキャッシュしない
  async headers() {
    return [
      {
        source: '/api/labels/generate',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ];
  },
};

module.exports = nextConfig;
