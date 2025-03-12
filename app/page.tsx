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

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <h1 className="text-4xl font-bold">D-Nature 프로젝트</h1>
        <p className="text-xl mt-2 mb-10">MQTT 제어 시스템</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">진단 페이지</h2>
            <p className="mb-4">MQTT 연결 상태를 확인하고 테스트할 수 있는 페이지입니다.</p>
            <a href="/debug" className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              디버그 페이지 열기
            </a>
          </div>
          
          <div className="p-6 border rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">밸브 제어</h2>
            <p className="mb-4">추출 설비 밸브를 원격으로 제어할 수 있는 인터페이스입니다.</p>
            <a href="/control" className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              제어 인터페이스 열기
            </a>
          </div>
        </div>
        
        <div className="mt-12">
          <h3 className="text-xl font-semibold mb-2">사용 방법</h3>
          <ol className="list-decimal list-inside space-y-2 pl-4">
            <li>디버그 페이지에서 MQTT 연결 상태를 확인합니다.</li>
            <li>연결이 정상인 경우 제어 인터페이스를 열어 밸브를 조작합니다.</li>
            <li>밸브 상태 변경 후 피드백을 확인하세요.</li>
          </ol>
        </div>
        
        <div className="mt-6 text-sm text-gray-500">
          <p>버전: 0.1.1 | 개발: D-Nature | © 2023</p>
        </div>
      </div>
    </main>
  );
}

