"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"

// 클라이언트 사이드에서만 렌더링되도록 동적 임포트
const DynamicDashboard = dynamic(
  () => import("@/app/components/dashboard"),
  { 
    ssr: false,
    loading: () => <div>로딩 중...</div>
  }
)

export default function MQTTDashboard() {
  return (
    <Suspense fallback={<div>대시보드 로딩 중...</div>}>
      <DynamicDashboard />
    </Suspense>
  )
}

