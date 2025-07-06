import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // React Strict Mode を無効化してちらつきを防ぐ
  reactStrictMode: false,

  // 差分ビルド用の outputFileTracingRoot
  outputFileTracingRoot: __dirname,

  // サーバーサイド専用モジュールをクライアントサイドで読み込まないように設定
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // クライアントサイドでNode.jsのnetモジュールを無効化
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
      };
    }
    return config;
  },
};

export default nextConfig;
