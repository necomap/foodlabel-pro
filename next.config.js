/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Robots-Tag', value: 'index, follow' },
          // 2026-09追加（セキュリティ強化）: 以前はセキュリティ関連のHTTPレスポンスヘッダーが
          // 一切設定されていなかった。クリックジャッキング・MIMEスニッフィング等の基本的な
          // 対策として、影響範囲が小さく既存機能を壊さないヘッダーのみをまず追加する。
          // Content-Security-Policyは、印刷用HTML生成箇所などインラインstyle/scriptを多用して
          // いる箇所が多く、十分な動作確認なしに導入すると印刷・ラベル生成機能を壊すリスクが
          // 高いため、今回はあえて追加しない（導入する場合は別途動作確認しながら段階的に）。
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
