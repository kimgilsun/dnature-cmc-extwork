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

interface Tank {
  id: number
  level: number
  status: "empty" | "filling" | "full"
  pumpStatus: "ON" | "OFF"
  inverter: number
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

// 실제 컴포넌트 렌더링을 담당하는 하위 컴포넌트
function SimpleTankSystem({ 
  tankData, 
  onValveChange, 
  progressMessages = [], 
  onPumpToggle, 
  pumpStateMessages = {},
  onExtractionCommand 
}: TankSystemProps) {
  // 밸브 상태 파싱
  const valveState = tankData.valveState || '0000';
  const valve1 = parseInt(valveState[0] || '0');
  const valve2 = parseInt(valveState[1] || '0');
  
  // 밸브 설명
  const valve1Desc = tankData.valveADesc || (valve1 === 1 ? "추출순환" : "전체순환");
  const valve2Desc = tankData.valveBDesc || (valve2 === 1 ? "열림" : "닫힘");
  
  // 간단한 상태 배경색 선택 함수
  const getTankColor = (status: string) => {
    switch (status) {
      case "empty": return "bg-gray-100";
      case "filling": return "bg-blue-200";
      case "full": return "bg-blue-400";
      default: return "bg-gray-100";
    }
  };
  
  // 탱크 위치 계산 (간단 버전)
  const calculateTankPosition = (index: number, total: number) => {
    const spacing = 120; // 탱크 간 간격
    const startX = 150; // 시작 X 좌표
    const startY = 200; // 시작 Y 좌표
    
    return {
      x: startX + (index * spacing),
      y: startY + (index % 2 === 0 ? 0 : 50) // 짝수 번째 탱크는 약간 아래로
    };
  };
  
  // 안전한 밸브 상태 변경 핸들러
  const handleValveChange = () => {
    if (onValveChange) {
      // 밸브 A 토글 (0->1 또는 1->0)
      const newState = valve1 === 1 ? "0000" : "1000";
      onValveChange(newState);
    }
  };
  
  // 안전한 추출 명령 핸들러
  const handleExtraction = (command: string) => {
    if (onExtractionCommand) {
      onExtractionCommand(command);
    }
  };
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">탱크 시스템 (간단 버전)</h2>
      
      {/* 메인 탱크 */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-40 h-32 border-2 border-gray-400 rounded-lg relative overflow-hidden">
          <div 
            className={`absolute bottom-0 left-0 right-0 ${getTankColor(tankData.mainTank.status)}`}
            style={{
              height: `${tankData.mainTank.level}%`,
              transition: 'height 0.5s ease-in-out'
            }}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-bold">본탱크</span>
          </div>
          <div className="absolute bottom-1 right-1 text-xs font-bold">
            {tankData.mainTank.level}%
          </div>
        </div>
        <div className="mt-2 text-sm">
          <span className="font-semibold">상태:</span> {tankData.mainTank.status}
        </div>
      </div>
      
      {/* 하위 탱크 그리드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {tankData.tanks.map((tank) => (
          <div key={tank.id} className="flex flex-col items-center">
            <div className="w-24 h-20 border-2 border-gray-400 rounded-lg relative overflow-hidden">
              <div 
                className={`absolute bottom-0 left-0 right-0 ${getTankColor(tank.status)}`}
                style={{
                  height: `${tank.level}%`,
                  transition: 'height 0.5s ease-in-out'
                }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold text-sm">탱크 {tank.id}</span>
              </div>
              <div className="absolute bottom-1 right-1 text-xs font-bold">
                {tank.level}%
              </div>
            </div>
            <button 
              className={`mt-2 px-2 py-1 text-xs rounded-full ${tank.pumpStatus === "ON" ? "bg-green-500 text-white" : "bg-gray-200"}`}
              onClick={() => onPumpToggle && onPumpToggle(tank.id)}
            >
              펌프 {tank.id}: {tank.pumpStatus}
            </button>
            {pumpStateMessages[tank.id] && (
              <div className="mt-1 text-xs text-gray-500 max-w-[120px] truncate">
                {pumpStateMessages[tank.id]}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* 밸브 상태 및 제어 */}
      <div className="flex flex-col items-center mb-6">
        <div className="text-sm mb-2">
          <span className="font-semibold">밸브 상태:</span> {tankData.valveState || 'N/A'}
        </div>
        <div className="flex gap-4">
          <button 
            className={`px-4 py-2 rounded-lg ${valve1 === 1 ? "bg-green-500 text-white" : "bg-gray-200"}`}
            onClick={handleValveChange}
          >
            밸브 A: {valve1 === 1 ? `ON (${valve1Desc})` : `OFF (${valve1Desc})`}
          </button>
          <button 
            className={`px-4 py-2 rounded-lg ${valve2 === 1 ? "bg-green-500 text-white" : "bg-gray-200"}`}
            onClick={() => onValveChange && onValveChange(valve1 === 1 ? "1100" : "0100")}
          >
            밸브 B: {valve2 === 1 ? `ON (${valve2Desc})` : `OFF (${valve2Desc})`}
          </button>
        </div>
      </div>
      
      {/* 제어 버튼 */}
      <div className="flex justify-center gap-4 mb-6">
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          onClick={() => handleExtraction("start")}
        >
          추출 시작
        </button>
        <button 
          className="px-4 py-2 bg-red-500 text-white rounded-lg"
          onClick={() => handleExtraction("stop")}
        >
          추출 중지
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
