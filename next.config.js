/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // 서버 렌더링 비활성화 설정 추가
  experimental: {
    // 페이지마다 라우팅 핸들링을 클라이언트 측으로 이동
    appDir: true,
  },
  // 출력 옵션 추가
  output: 'export', // SSG(정적 생성) 사용
  // WebSocket 연결을 위한 CORS 설정 추가
  async headers() {
    return [
      {
        // 모든 경로에 적용
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' }, // 보안을 위해 실제 도메인으로 제한 가능
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
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