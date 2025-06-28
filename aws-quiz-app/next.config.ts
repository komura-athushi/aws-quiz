/** @type {import("next").NextConfig} */
const nextConfig = {
  // React 19 に合わせて strict mode／concurrent を有効化
  reactStrictMode: true,

  // 差分ビルド用の outputFileTracingRoot
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
