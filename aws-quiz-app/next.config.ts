/** @type {import("next").NextConfig} */
const nextConfig = {
  // React 19 に合わせて strict mode／concurrent を有効化
  reactStrictMode: true,

  // App Router 専用: 動的ルートのビルド最適化
  experimental: {
    serverActions: true,      
    turbopack:  true,        
  },

  // 差分ビルド用の outputFileTracingRoot
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
