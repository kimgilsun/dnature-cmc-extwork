/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // 정적 내보내기를 위한 설정 제거
  // output: 'export', 
  // 외부 URL로의 이미지 요청 허용
  images: {
    domains: ['api.codingpen.com'],
    unoptimized: true, // 정적 내보내기에 필요
  },
  // CORS 헤더 설정 추가
  async headers() {
    return [
      {
        // 모든 경로에 대해 CORS 헤더 설정
        source: '/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // 필요한 도메인으로 변경
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type',
          },
        ],
      },
    ];
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
  eslint: {
    // 빌드 과정에서 ESLint 검사를 건너뜁니다
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 또한 타입 검사도 건너뛰어 빌드 속도를 높입니다
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig;