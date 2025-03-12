"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"

// 클라이언트 사이드에서만 렌더링되도록 동적 임포트
const DynamicDashboard = dynamic(
  () => import("@/components/dashboard"),
  { 
    ssr: false, // 서버 사이드 렌더링 비활성화
    loading: () => <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">로딩 중...</h3>
        <p className="text-muted-foreground">탱크 시스템 대시보드를 준비하고 있습니다</p>
      </div>
    </div>
  }
)

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col p-4">
      <div className="w-full max-w-7xl mx-auto mb-6">
        <h1 className="text-4xl font-bold">D-Nature 프로젝트</h1>
        <p className="text-xl mt-2 mb-2">추출 설비 모니터링 및 제어 시스템</p>
      </div>
      
      <div className="w-full max-w-7xl mx-auto">
        <Suspense fallback={<div>로딩 중...</div>}>
          <DynamicDashboard />
        </Suspense>
      </div>
      
      <div className="w-full max-w-7xl mx-auto mt-8 pt-4 border-t text-sm text-gray-500">
        <p>버전: 0.2.0 | 개발: D-Nature | © 2023</p>
      </div>
    </main>
  );
}

