"use client"
import { motion } from "framer-motion"
import { useEffect, useState, useRef, useCallback, useMemo } from "react"
// import { MqttClient } from "mqtt" - 클라이언트 측에서 사용할 수 없음
import { cn } from '@/lib/utils';
import "./tank-system.css"; // 새로 생성한 CSS 파일 import

// 고유 클라이언트 ID 생성 함수
const generateClientId = () => {
  if (typeof window === 'undefined') return 'server';
  return `client_${Math.random().toString(36).substring(2, 15)}`;
};

// 시스템 상태 저장 및 불러오기 함수 개선
const saveSystemState = async (state: any) => {
  if (typeof window !== 'undefined') {
    // 로컬 스토리지에 저장
    try {
      const stateToSave = {
        ...state,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      localStorage.setItem('tankSystemState', JSON.stringify(stateToSave));
      
      // 서버 API를 통해 상태 저장
      if (window.navigator.onLine) {
        try {
          const response = await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stateToSave)
          });
          
          const result = await response.json();
          console.log('서버 상태 저장 결과:', result);
        } catch (serverError) {
          console.error('서버 상태 저장 실패:', serverError);
        }
        
        // 상태가 변경될 때마다 세션 스토리지에도 백업 저장
        sessionStorage.setItem('tankSystemState', JSON.stringify(stateToSave));
        
        // IndexedDB에도 저장 (오프라인 지원)
        saveToIndexedDB(stateToSave);
        
        // 다른 탭/창에 상태 변경 알림
        localStorage.setItem('tankSystemStateUpdate', Date.now().toString());
      }
    } catch (error) {
      console.error('상태 저장 실패:', error);
    }
  }
};

// IndexedDB에 상태 저장
const saveToIndexedDB = (state: any) => {
  return new Promise<void>((resolve, reject) => {
    // IndexedDB 지원 여부 확인
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.log('이 브라우저는 IndexedDB를 지원하지 않습니다.');
      return resolve(); // 오류로 처리하지 않고 조용히 종료
    }
    
    try {
      const request = window.indexedDB.open('TankSystemDB', 1);
      
      request.onupgradeneeded = function(event) {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains('systemState')) {
            db.createObjectStore('systemState', { keyPath: 'id' });
          }
        } catch (error) {
          console.error('IndexedDB 스키마 업그레이드 중 오류:', error);
        }
      };
      
      request.onsuccess = function(event) {
        try {
          const db = request.result;
          const transaction = db.transaction(['systemState'], 'readwrite');
          const store = transaction.objectStore('systemState');
          
          // 항상 동일한 키를 사용하여 항상 최신 상태만 유지
          const stateToSave = {
            id: 'currentState',
            data: state,
            timestamp: Date.now()
          };
          
          const putRequest = store.put(stateToSave);
          
          putRequest.onsuccess = function() {
            resolve();
          };
          
          putRequest.onerror = function(event) {
            console.warn('IndexedDB 저장 오류 (무시됨):', event);
            resolve(); // 오류를 무시하고 계속 진행
          };
          
          transaction.oncomplete = function() {
            db.close();
          };
        } catch (error) {
          console.warn('IndexedDB 트랜잭션 오류 (무시됨):', error);
          resolve(); // 오류를 무시하고 계속 진행
        }
      };
      
      request.onerror = function(event) {
        console.warn('IndexedDB 접근 오류 (무시됨):', event);
        resolve(); // 오류를 무시하고 계속 진행
      };
    } catch (error) {
      console.warn('IndexedDB 처리 중 예외 (무시됨):', error);
      resolve(); // 오류를 무시하고 계속 진행
    }
  });
};

// 상태 불러오기 함수 개선
const loadSystemState = () => {
  if (typeof window !== 'undefined') {
    try {
      const storedState = localStorage.getItem('tankSystemState');
      
      if (storedState) {
        return JSON.parse(storedState);
      }
      
      return null;
    } catch (error) {
      console.error('상태 불러오기 실패:', error);
      return null;
    }
  }
  
  return null;
};

// 서버에서 초기 상태 불러오기
const loadInitialState = async (): Promise<any> => {
  if (typeof window !== 'undefined') {
    try {
      // 서버 API에서 상태 가져오기
      if (window.navigator.onLine) {
        try {
          console.log('서버에서 최신 상태 불러오기 시도...');
          const response = await fetch('/api/state');
          
          if (response.ok) {
            const serverData = await response.json();
            
            if (serverData.data) {
              console.log('서버에서 상태를 성공적으로 불러왔습니다:', serverData.lastUpdated);
              return serverData.data;
            } else {
              console.log('서버에 저장된 상태가 없습니다. 로컬 스토리지 사용.');
            }
          } else {
            console.error('서버 응답 오류:', response.status);
          }
        } catch (serverError) {
          console.error('서버에서 상태 불러오기 실패:', serverError);
        }
      }
      
      // 서버에서 불러오기 실패 시 로컬 스토리지에서 불러오기
      const localState = loadSystemState();
      if (localState) {
        console.log('로컬 스토리지에서 상태를 불러왔습니다.');
        return localState;
      }
      
      // IndexedDB에서 불러오기 시도
      try {
        const idbState = await loadFromIndexedDB();
        if (idbState) {
          console.log('IndexedDB에서 상태를 불러왔습니다.');
          return idbState;
        }
      } catch (idbError) {
        console.error('IndexedDB에서 상태 불러오기 실패:', idbError);
      }
      
    } catch (error) {
      console.error('초기 상태 불러오기 실패:', error);
    }
  }
  
  console.log('사용 가능한 저장된 상태가 없습니다. 기본값 사용.');
  return null;
};

// IndexedDB에서 상태 불러오기 (Promise 반환)
const loadFromIndexedDB = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    // IndexedDB 지원 여부 확인
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.log('이 브라우저는 IndexedDB를 지원하지 않습니다.');
      return resolve(null); // 오류로 처리하지 않고 null 반환
    }
    
    try {
      const request = window.indexedDB.open('TankSystemDB', 1);
      
      request.onupgradeneeded = function(event) {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains('systemState')) {
            db.createObjectStore('systemState', { keyPath: 'id' });
          }
        } catch (error) {
          console.error('IndexedDB 스키마 업그레이드 중 오류:', error);
          // 오류를 reject하지 않고 계속 진행
        }
      };
      
      request.onsuccess = function(event) {
        try {
          const db = request.result;
          
          // 객체 저장소가 존재하는지 확인
          if (!db.objectStoreNames.contains('systemState')) {
            console.log('systemState 객체 저장소가 없습니다');
            db.close();
            return resolve(null);
          }
          
          const transaction = db.transaction(['systemState'], 'readonly');
          const store = transaction.objectStore('systemState');
          const getRequest = store.get('currentState');
          
          getRequest.onsuccess = function() {
            if (getRequest.result) {
              resolve(getRequest.result.data);
            } else {
              resolve(null);
            }
            
            // 트랜잭션이 완료되면 DB 연결 닫기
            transaction.oncomplete = function() {
              db.close();
            };
          };
          
          getRequest.onerror = function(event) {
            console.warn('IndexedDB 읽기 오류 (무시됨):', event);
            db.close();
            resolve(null); // 오류를 무시하고 null 반환
          };
        } catch (error) {
          console.warn('IndexedDB 트랜잭션 오류 (무시됨):', error);
          resolve(null); // 오류를 무시하고 null 반환
        }
      };
      
      request.onerror = function(event) {
        console.warn('IndexedDB 접근 오류 (무시됨):', event);
        resolve(null); // 오류를 무시하고 null 반환
      };
    } catch (error) {
      console.warn('IndexedDB 처리 중 예외 (무시됨):', error);
      resolve(null); // 오류를 무시하고 null 반환
    }
  });
};

// Tank 인터페이스 업데이트
interface Tank {
  id: number
  level: number
  status: string
  pumpStatus: string
  problem?: boolean // problem 필드 추가
}

interface TankSystemProps {
  tankData: {
    mainTank: {
      level: number
      status: string
    }
    tanks: Tank[]
    valveState: string
    valveStatusMessage?: string
    valveADesc?: string  // 밸브 A 설명 추가
    valveBDesc?: string  // 밸브 B 설명 추가
  }
  onValveChange: (newState: string) => void
  progressMessages?: Array<{timestamp: number, message: string, rawJson?: string | null}>
  onPumpToggle?: (pumpId: number) => void  // 펌프 ON/OFF 토글 함수 추가
  onPumpReset?: (pumpId: number) => void   // 펌프 리셋 함수 추가
  onPumpKCommand?: (pumpId: number) => void // K 명령 발행 함수 추가
  pumpStateMessages?: Record<number, string> // 펌프 상태 메시지
  mqttClient?: any // MQTT 클라이언트 타입을 any로 변경
  onExtractionCommand?: (command: string) => void // 추출 명령 함수 추가
}

// 추출 진행 메시지를 위한 인터페이스
interface ExtractionProgress {
  timestamp: number
  message: string
}

// 연결 상태를 위한 인터페이스
interface ConnectionStatus {
  connected: boolean
  lastConnected: Date | null
  reconnecting: boolean
}

// 펄스 애니메이션을 위한 스타일 추가
const pulseCss = `
  @keyframes pulse {
    0% {
      opacity: 0.6;
    }
    50% {
      opacity: 0.8;
    }
    100% {
      opacity: 0.6;
    }
  }
`;

// SimpleTankSystem 컴포넌트 수정 - SVG 기반 레이아웃 및 펌프 리셋 기능 복원
function SimpleTankSystem({
  tankData,
  onValveChange,
  progressMessages = [],
  onPumpToggle,
  onPumpReset,
  onPumpKCommand,
  pumpStateMessages = {},
  mqttClient,
  onExtractionCommand
}: TankSystemProps) {
  // 기존의 useState 호출들은 그대로 유지
  const [valveState, setValveState] = useState<string>(tankData.valveState || "0000");
  const valveInitialized = useRef(false);
  const [mainTankFillPercentage, setMainTankFillPercentage] = useState(tankData.mainTank.level);
  
  // 펌프 상태 관련 state들 추가 (이전 코드에서 복원)
  const [pumpSwitchPositions, setPumpSwitchPositions] = useState<Record<number, number>>({});
  const [resetSwitchPosition, setResetSwitchPosition] = useState<Record<number, number>>({});
  const [isDragging, setIsDragging] = useState<Record<number, boolean>>({});
  const [dragTimers, setDragTimers] = useState<Record<number, NodeJS.Timeout | null>>({});
  const [resetTimers, setResetTimers] = useState<Record<number, NodeJS.Timeout | null>>({});
  const [resetDragState, setResetDragState] = useState<Record<number, { 
    dragging: boolean, 
    position: number, 
    timer: NodeJS.Timeout | null 
  }>>({});
  
  // 펄스 효과를 위한 CSS 클래스
  const pulseCss = "animate-pulse opacity-75";

  // 밸브 상태 처리
  const valve1 = parseInt(valveState[0]) || 0;
  const valve2 = parseInt(valveState[1]) || 0;
  const valve1Desc = tankData.valveADesc || "밸브 A";
  const valve2Desc = tankData.valveBDesc || "밸브 B";

  // 밸브 상태 변경 핸들러
  const handleValveChange = useCallback(() => {
    const newState = valve1 === 1 ? "0000" : "1000";
    setValveState(newState);
    onValveChange(newState);
  }, [valve1, onValveChange]);

  // 추출 명령 핸들러
  const handleExtraction = useCallback((command: string) => {
    if (onExtractionCommand) {
      onExtractionCommand(command);
    }
  }, [onExtractionCommand]);

  // 펌프 드래그 시작 처리 함수
  const handleDragStart = useCallback((pumpId: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    // 이미 드래그 중이면 무시
    if (isDragging[pumpId]) return;
    
    // 드래그 상태 업데이트
    setIsDragging(prev => ({...prev, [pumpId]: true}));
    
    // 펌프 ON 명령 발행
    if (onPumpToggle) {
      onPumpToggle(pumpId);
    }
    
    // 타이머 설정: 1초 후에 드래그 상태 해제
    const timer = setTimeout(() => {
      setIsDragging(prev => ({...prev, [pumpId]: false}));
      setDragTimers(prev => ({...prev, [pumpId]: null}));
    }, 1000);
    
    // 타이머 저장
    setDragTimers(prev => ({...prev, [pumpId]: timer}));
  }, [isDragging, onPumpToggle]);
  
  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      // 드래그 타이머 정리
      Object.values(dragTimers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      
      // 리셋 타이머 정리
      Object.values(resetTimers).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      
      // 리셋 드래그 타이머 정리
      Object.values(resetDragState).forEach(state => {
        if (state.timer) clearTimeout(state.timer);
      });
    };
  }, [dragTimers, resetTimers, resetDragState]);
  
  // 리셋 버튼 드래그 시작 처리
  const handleResetDragStart = useCallback((pumpId: number, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    // 현재 이미 드래그 중이면 무시
    if (resetDragState[pumpId]?.dragging) return;
    
    // 초기 상태 설정
    setResetDragState(prev => ({
      ...prev, 
      [pumpId]: {
        dragging: true,
        position: 0,
        timer: null
      }
    }));
    
    // 마우스 이동 이벤트 리스너 추가
    document.addEventListener('mousemove', (e) => handleResetDragMove(pumpId, e));
    document.addEventListener('touchmove', (e) => handleResetDragMove(pumpId, e), { passive: false });
    
    // 마우스 업 이벤트 리스너 추가
    document.addEventListener('mouseup', () => handleResetDragEnd(pumpId));
    document.addEventListener('touchend', () => handleResetDragEnd(pumpId));
  }, [resetDragState]);
  
  // 리셋 버튼 드래그 이동 처리
  const handleResetDragMove = useCallback((pumpId: number, e: MouseEvent | TouchEvent) => {
    // 드래그 중이 아니면 무시
    if (!resetDragState[pumpId]?.dragging) return;
    
    // 이벤트 기본 동작 방지
    e.preventDefault();
    
    // 리셋 버튼 요소 찾기
    const resetButton = document.getElementById(`reset-btn-${pumpId}`);
    if (!resetButton) return;
    
    // 버튼의 위치와 크기 계산
    const rect = resetButton.getBoundingClientRect();
    const buttonWidth = rect.width;
    const maxDrag = 50; // 최대 드래그 거리
    
    // 마우스/터치 위치 계산
    let clientX;
    if (e instanceof MouseEvent) {
      clientX = e.clientX;
    } else {
      clientX = e.touches[0].clientX;
    }
    
    // 드래그 위치 계산
    const dragX = Math.max(0, Math.min(maxDrag, clientX - rect.left));
    const dragPercentage = (dragX / maxDrag) * 100;
    
    // 드래그 상태 업데이트
    setResetDragState(prev => ({
      ...prev,
      [pumpId]: {
        ...prev[pumpId],
        position: dragPercentage
      }
    }));
    
    // 100%에 도달하면 리셋 실행
    if (dragPercentage >= 100 && onPumpReset) {
      onPumpReset(pumpId);
      
      // 리셋 후 드래그 상태 해제
      setResetDragState(prev => ({
        ...prev,
        [pumpId]: {
          ...prev[pumpId],
          dragging: false,
          position: 0
        }
      }));
      
      // 이벤트 리스너 제거
      document.removeEventListener('mousemove', (e) => handleResetDragMove(pumpId, e));
      document.removeEventListener('touchmove', (e) => handleResetDragMove(pumpId, e));
      document.removeEventListener('mouseup', () => handleResetDragEnd(pumpId));
      document.removeEventListener('touchend', () => handleResetDragEnd(pumpId));
    }
  }, [resetDragState, onPumpReset]);
  
  // 리셋 버튼 드래그 종료 처리
  const handleResetDragEnd = useCallback((pumpId: number) => {
    // 현재 상태 가져오기
    const currentState = resetDragState[pumpId];
    if (!currentState) return;
    
    // 이벤트 리스너 제거
    document.removeEventListener('mousemove', (e) => handleResetDragMove(pumpId, e));
    document.removeEventListener('touchmove', (e) => handleResetDragMove(pumpId, e));
    document.removeEventListener('mouseup', () => handleResetDragEnd(pumpId));
    document.removeEventListener('touchend', () => handleResetDragEnd(pumpId));
    
    // 100%에 도달했는지 확인
    if (currentState.position >= 100 && onPumpReset) {
      onPumpReset(pumpId);
    }
    
    // 드래그 상태 해제
    setResetDragState(prev => ({
      ...prev,
      [pumpId]: {
        dragging: false,
        position: 0,
        timer: null
      }
    }));
  }, [resetDragState, onPumpReset, handleResetDragMove]);
  
  // K 명령 처리
  const handleKCommand = useCallback((pumpId: number) => {
    if (onPumpKCommand) {
      onPumpKCommand(pumpId);
    }
  }, [onPumpKCommand]);

  // 탱크 위치 계산 함수
  const calculateTankPosition = useCallback((index: number, total: number) => {
    const spacing = 120; // 탱크 간 간격
    const startX = 150; // 시작 X 좌표
    const startY = 200; // 시작 Y 좌표
    
    return {
      x: startX + (index * spacing),
      y: startY + (index % 2 === 0 ? 0 : 50) // 짝수 번째 탱크는 약간 아래로
    };
  }, []);
  
  // SVG 크기 계산
  const svgWidth = 800;
  const svgHeight = 500;
  
  return (
    <div className="p-4 bg-gray-50 rounded-lg shadow-inner w-full">
      <h2 className="text-2xl font-bold mb-6 text-center">탱크 시스템 제어</h2>
      
      {/* 메인 SVG 컨테이너 */}
      <div className="relative w-full mb-8 overflow-x-auto">
        <svg 
          width={svgWidth} 
          height={svgHeight} 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="mx-auto border border-gray-200 rounded-lg bg-white"
        >
          {/* 메인 탱크 */}
          <g transform="translate(350, 50)">
            <rect
              x={0}
              y={0}
              width={100}
              height={150}
              rx={5}
              className="stroke-gray-400 fill-blue-100 stroke-2"
            />
            
            {/* 물 레벨 */}
            <rect
              x={0}
              y={150 - (mainTankFillPercentage / 100) * 150}
              width={100}
              height={(mainTankFillPercentage / 100) * 150}
              className="fill-blue-500"
            />
            
            <text x={50} y={75} textAnchor="middle" className="font-bold fill-blue-800">
              메인 탱크
            </text>
            
            <text x={50} y={95} textAnchor="middle" className="fill-blue-800">
              {mainTankFillPercentage}%
            </text>
          </g>
          
          {/* 펌프와 탱크 연결 */}
          {tankData.tanks.map((tank, index) => {
            const position = calculateTankPosition(index, tankData.tanks.length);
            
            return (
              <g key={tank.id} transform={`translate(${position.x}, ${position.y})`}>
                {/* 하위 탱크 */}
                <rect
                  x={0}
                  y={0}
                  width={60}
                  height={100}
                  rx={3}
                  className={`stroke-gray-400 fill-blue-100 stroke-2 ${tank.problem ? 'fill-red-200' : ''}`}
                />
                
                {/* 물 레벨 */}
                <rect
                  x={0}
                  y={100 - (tank.level / 100) * 100}
                  width={60}
                  height={(tank.level / 100) * 100}
                  className={`${tank.problem ? 'fill-red-400' : 'fill-blue-400'}`}
                />
                
                <text x={30} y={20} textAnchor="middle" className="font-bold fill-blue-800 text-sm">
                  탱크 {tank.id}
                </text>
                
                <text x={30} y={40} textAnchor="middle" className="fill-blue-800 text-sm">
                  {tank.level}%
                </text>
                
                {/* 펌프 상태 표시 */}
                <g transform="translate(0, 110)">
                  <rect
                    x={5}
                    y={0}
                    width={50}
                    height={30}
                    rx={3}
                    className={`stroke-gray-400 fill-gray-100 stroke-2 ${tank.pumpStatus === "ON" ? 'fill-green-100 stroke-green-400' : ''}`}
                  />
                  
                  <text
                    x={30}
                    y={20}
                    textAnchor="middle"
                    className={`text-xs ${tank.pumpStatus === "ON" ? 'fill-green-700' : 'fill-gray-500'}`}
                  >
                    펌프 {tank.id}
                  </text>
                  
                  {/* 펌프 스위치 (드래그 가능) */}
                  <g 
                    key={`pump-switch-${tank.id}`}
                    transform="translate(5, 40)"
                    className="cursor-pointer"
                    onMouseDown={(e) => handleDragStart(tank.id, e)}
                    onTouchStart={(e) => handleDragStart(tank.id, e)}
                  >
                    {/* 스위치 배경 */}
                    <rect
                      x={0}
                      y={0}
                      width={50}
                      height={20}
                      rx={10}
                      className="fill-gray-200 stroke-gray-300"
                    />
                    
                    {/* 스위치 핸들 */}
                    <circle
                      cx={tank.pumpStatus === "ON" ? 35 : 15}
                      cy={10}
                      r={8}
                      className={`${tank.pumpStatus === "ON" ? 'fill-green-500' : 'fill-gray-400'} ${isDragging[tank.id] ? pulseCss : ''}`}
                    />
                    
                    <text
                      x={tank.pumpStatus === "ON" ? 15 : 35}
                      y={14}
                      textAnchor="middle"
                      className="text-[10px] fill-gray-700"
                    >
                      {tank.pumpStatus === "ON" ? "ON" : "OFF"}
                    </text>
                  </g>
                  
                  {/* 펌프 리셋 버튼 */}
                  <g 
                    key={`pump-reset-btn-${tank.id}`}
                    id={`reset-btn-${tank.id}`}
                    className="cursor-pointer"
                    onMouseDown={(e) => handleResetDragStart(tank.id, e)}
                    onTouchStart={(e) => handleResetDragStart(tank.id, e)}
                    transform="translate(5, 70)"
                  >
                    {/* 리셋 스위치 배경 */}
                    <rect
                      x={0}
                      y={0}
                      width={50}
                      height={20}
                      rx={10}
                      className="fill-red-100 stroke-red-300"
                    />
                    
                    {/* 드래그 진행 상태 */}
                    <rect
                      x={0}
                      y={0}
                      width={resetDragState[tank.id]?.position ? (resetDragState[tank.id].position / 100) * 50 : 0}
                      height={20}
                      rx={10}
                      className="fill-red-300"
                    />
                    
                    <text
                      x={25}
                      y={14}
                      textAnchor="middle"
                      className="text-[10px] fill-red-700 font-semibold"
                    >
                      리셋
                    </text>
                  </g>
                  
                  {/* K 명령 버튼 */}
                  {onPumpKCommand && (
                    <g 
                      className="cursor-pointer"
                      onClick={() => handleKCommand(tank.id)}
                      transform="translate(5, 100)"
                    >
                      <rect
                        x={0}
                        y={0}
                        width={50}
                        height={20}
                        rx={3}
                        className="fill-purple-100 stroke-purple-300 hover:fill-purple-200"
                      />
                      
                      <text
                        x={25}
                        y={14}
                        textAnchor="middle"
                        className="text-[10px] fill-purple-700 font-semibold"
                      >
                        K
                      </text>
                    </g>
                  )}
                </g>
              </g>
            );
          })}
          
          {/* 밸브 컨트롤 */}
          <g transform="translate(600, 50)">
            <rect
              x={0}
              y={0}
              width={120}
              height={80}
              rx={5}
              className="stroke-gray-400 fill-gray-100 stroke-2"
            />
            
            <text x={60} y={20} textAnchor="middle" className="font-bold fill-gray-700">
              밸브 제어
            </text>
            
            {/* 밸브 A */}
            <g transform="translate(10, 30)">
              <circle
                cx={15}
                cy={15}
                r={12}
                className={`stroke-gray-400 stroke-2 ${valve1 === 1 ? 'fill-green-500' : 'fill-gray-200'}`}
                onClick={handleValveChange}
              />
              
              <text x={40} y={20} className="fill-gray-700 text-sm">
                밸브 A: {valve1 === 1 ? "열림" : "닫힘"}
              </text>
            </g>
            
            {/* 밸브 B */}
            <g transform="translate(10, 60)">
              <circle
                cx={15}
                cy={15}
                r={12}
                className={`stroke-gray-400 stroke-2 ${valve2 === 1 ? 'fill-green-500' : 'fill-gray-200'}`}
                onClick={() => onValveChange(valve1 === 1 ? "1100" : "0100")}
              />
              
              <text x={40} y={20} className="fill-gray-700 text-sm">
                밸브 B: {valve2 === 1 ? "열림" : "닫힘"}
              </text>
            </g>
          </g>
        </svg>
      </div>
      
      {/* 제어 버튼 */}
      <div className="flex justify-center gap-4 mb-6">
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          onClick={() => handleExtraction("start")}
        >
          추출 시작
        </button>
        <button 
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          onClick={() => handleExtraction("stop")}
        >
          추출 중지
        </button>
        <button 
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
          onClick={() => handleExtraction("reset")}
        >
          추출 제어 리셋
        </button>
      </div>
      
      {/* 진행 메시지 */}
      {progressMessages.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">진행 메시지</h3>
          <div className="max-h-40 overflow-y-auto">
            {progressMessages.map((msg, idx) => (
              <div key={idx} className="mb-1 text-sm border-b border-gray-100 pb-1">
                <span className="text-gray-500 mr-2">
                  {new Date(msg.timestamp).toLocaleTimeString()}:
                </span>
                {msg.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 메인 컴포넌트
export default function TankSystem(props: TankSystemProps) {
  // 모든 상태는 최상위 레벨에 정의
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // 첫 렌더링 후 로딩 상태 해제
  useEffect(() => {
    let isMounted = true;
    
    // 로딩 애니메이션을 위해 약간의 지연 추가
    const timer = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 500);
    
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);
  
  // 오류 발생 시 대체 UI
  if (hasError) {
    return (
      <div className="border border-red-300 rounded-md p-6 text-center">
        <div className="text-xl font-semibold text-red-500 mb-2">컴포넌트 오류 발생</div>
        <p className="text-gray-600">탱크 시스템 컴포넌트에서 오류가 발생했습니다.</p>
        <p className="text-sm text-gray-500 mt-2">
          {errorMessage || '알 수 없는 오류'}
        </p>
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => window.location.reload()}
        >
          페이지 새로고침
        </button>
      </div>
    );
  }
  
  // 로딩 중 표시
  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-md p-6 bg-gray-50 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-pulse mb-4 h-8 w-8 rounded-full bg-gray-300"></div>
        <div className="text-gray-500 font-medium">탱크 시스템 로딩 중...</div>
        <p className="text-sm text-gray-400 mt-2">잠시만 기다려주세요...</p>
      </div>
    );
  }
  
  // 정상 렌더링 - 간소화된 컴포넌트 사용
  try {
    return <SimpleTankSystem {...props} />;
  } catch (error) {
    // 렌더링 오류 발생 시 에러 로깅만 하고 간단한 대체 UI 표시
    console.error('탱크 시스템 렌더링 오류:', error);
    return (
      <div className="border border-red-300 rounded-md p-6 text-center">
        <div className="text-xl font-semibold text-red-500 mb-2">렌더링 오류 발생</div>
        <p className="text-gray-600">단순화된 버전을 표시합니다.</p>
        <div className="mt-4 p-4 border rounded">
          <div className="font-bold mb-2">탱크 데이터:</div>
          <div>메인 탱크: {props.tankData.mainTank.level}% ({props.tankData.mainTank.status})</div>
          <div>밸브 상태: {props.tankData.valveState || 'N/A'}</div>
          <div>하위 탱크: {props.tankData.tanks.length}개</div>
        </div>
      </div>
    );
  }
}
