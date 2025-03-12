"use client"

import { Suspense, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import Link from 'next/link'

// 클라이언트 사이드에서만 렌더링되도록 동적 임포트
const DynamicDashboard = dynamic(
  () => import("@/app/components/dashboard"),
  { 
    ssr: false, // 서버 사이드 렌더링 비활성화
    loading: () => <div>로딩 중...</div>
  }
)

export default function MQTTDashboard() {
  // 서버 사이드 렌더링인지 확인하는 상태
  const [isClient, setIsClient] = useState(false)

  // 마운트 시점에 클라이언트 사이드임을 확인
  useEffect(() => {
    setIsClient(true)
  }, [])

  // 클라이언트 사이드에서만 대시보드 렌더링
  return (
    <>
      {isClient ? (
        <Suspense fallback={<div>대시보드 로딩 중...</div>}>
          <DynamicDashboard />
        </Suspense>
      ) : (
        <div>서버에서 렌더링 중... 로딩 중입니다.</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/debug" className="px-4 py-3 border rounded-md bg-blue-50 hover:bg-blue-100 transition">
          디버그 페이지
        </Link>
        <Link href="/control" className="px-4 py-3 border rounded-md bg-purple-50 hover:bg-purple-100 transition">
          MQTT 제어 페이지
        </Link>
      </div>
    </>
  )
}

