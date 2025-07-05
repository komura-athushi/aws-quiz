/** @type {import("next").NextConfig} */
const nextConfig = {
  // React Strict Mode を無効化してちらつきを防ぐ
  reactStrictMode: false,

  // 差分ビルド用の outputFileTracingRoot
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
