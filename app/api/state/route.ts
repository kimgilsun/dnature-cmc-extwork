import { NextResponse } from 'next/server';

// 서버 메모리에 상태 저장 (실제 프로덕션에서는 데이터베이스를 사용해야 함)
let STATE_DB: any = {
  tankSystem: null,
  lastUpdated: null
};

// 상태 저장 API
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 수신된 상태 저장
    STATE_DB.tankSystem = body;
    STATE_DB.lastUpdated = new Date().toISOString();
    
    console.log(`[API] 탱크 시스템 상태 업데이트: ${STATE_DB.lastUpdated}`);
    
    return NextResponse.json({
      success: true,
      message: '상태가 저장되었습니다.',
      timestamp: STATE_DB.lastUpdated
    });
  } catch (error) {
    console.error('[API] 상태 저장 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: '상태 저장 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

// 상태 조회 API
export async function GET() {
  // 저장된 상태 반환
  return NextResponse.json({
    data: STATE_DB.tankSystem || null,
    lastUpdated: STATE_DB.lastUpdated,
    timestamp: new Date().toISOString()
  });
} 