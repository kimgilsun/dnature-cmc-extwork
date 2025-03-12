/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // 정적 내보내기를 위한 설정
  output: 'export',
  // 외부 URL로의 이미지 요청 허용
  images: {
    domains: ['api.codingpen.com'],
    unoptimized: true, // 정적 내보내기에 필요
  },
  // webpack 설정 추가 (필요한 경우)
  webpack: (config, { isServer }) => {
    // 클라이언트 측에서만 필요한 설정
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig 