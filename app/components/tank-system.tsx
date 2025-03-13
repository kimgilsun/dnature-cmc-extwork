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

export default function TankSystem({ 
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
  // 렌더링 안전성을 위한 상태 변수
  const [renderKey, setRenderKey] = useState<number>(0);
  const hasInitialized = useRef<boolean>(false);
  const isMounted = useRef<boolean>(true);
  
  // 오류 처리를 위한 상태
  const [renderError, setRenderError] = useState<{hasError: boolean, message: string | null}>({
    hasError: false,
    message: null
  });
  
  // 기본 렌더링 초기화 - 첫 렌더링 이후에만 실행
  useEffect(() => {
    // 컴포넌트 마운트 표시
    isMounted.current = true;
    
    // 첫 렌더링 이후 초기화 상태 설정
    if (!hasInitialized.current) {
      try {
        console.log('탱크 시스템 컴포넌트 초기화');
        hasInitialized.current = true;
        
        // 렌더링 트리거 (이 컴포넌트를 다시 렌더링하되 이미 초기화된 상태로)
        setTimeout(() => {
          if (isMounted.current) {
            setRenderKey(prev => prev + 1);
          }
        }, 0);
      } catch (error) {
        console.error('컴포넌트 초기화 오류:', error);
        if (isMounted.current) {
          setRenderError({
            hasError: true, 
            message: error instanceof Error ? error.message : '알 수 없는 오류'
          });
        }
      }
    }
    
    // 클린업 함수
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // 에러 UI
  if (renderError.hasError) {
    return (
      <div className="border border-red-300 rounded-md p-6 text-center">
        <div className="text-xl font-semibold text-red-500 mb-2">컴포넌트 오류 발생</div>
        <p className="text-gray-600">탱크 시스템 컴포넌트에서 오류가 발생했습니다.</p>
        <p className="text-sm text-gray-500 mt-2">
          {renderError.message || '알 수 없는 오류'}
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
  
  // 초기화 전에는 간단한 로딩 화면 표시
  if (!hasInitialized.current) {
    return (
      <div className="border border-gray-200 rounded-md p-6 bg-gray-50 flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-pulse mb-4 h-8 w-8 rounded-full bg-gray-300"></div>
        <div className="text-gray-500 font-medium">탱크 시스템 초기화 중...</div>
      </div>
    );
  }
  
  // 안전하게 초기화된 후 실제 컴포넌트 렌더링
  try {
    // 애니메이션을 위한 상태 추가
    const [fillPercentage, setFillPercentage] = useState<number>(0);
    
    // 클라이언트 ID 상태 추가
    const clientId = useRef(generateClientId());
    
    // 마지막 상태 업데이트 시간
    const [lastStateUpdate, setLastStateUpdate] = useState<Date | null>(null);
    
    // 상태 변경 알림을 위한 상태
    const [notifications, setNotifications] = useState<Array<{
      message: string,
      timestamp: number,
      source?: string
    }>>([]);
    
    // 밸브 상태 파싱 - 렌더링 중에 오류가 발생하지 않도록 미리 계산
    const valveInfo = useMemo(() => {
      try {
        if (!tankData || !tankData.valveState) {
          return { valve1: 0, valve2: 0, valve3: 0, valve4: 0 };
        }
        
        const valveArray = tankData.valveState.split('').map(v => parseInt(v) || 0);
        return {
          valve1: valveArray[0] || 0,
          valve2: valveArray[1] || 0,
          valve3: valveArray[2] || 0,
          valve4: valveArray[3] || 0
        };
      } catch (e) {
        console.error('밸브 상태 파싱 오류:', e);
        return { valve1: 0, valve2: 0, valve3: 0, valve4: 0 };
      }
    }, [tankData?.valveState]);
    
    const { valve1, valve2, valve3, valve4 } = valveInfo;
    
    // 밸브 설명 파싱
    const valveDescriptions = useMemo(() => {
      const valve1Desc = tankData?.valveADesc || (valve1 === 1 ? "추출순환" : "전체순환");
      const valve2Desc = tankData?.valveBDesc || (valve2 === 1 ? "열림" : "닫힘");
      return { valve1Desc, valve2Desc };
    }, [tankData?.valveADesc, tankData?.valveBDesc, valve1, valve2]);
    
    const { valve1Desc, valve2Desc } = valveDescriptions;
    
    // 여기에서 실제 렌더링 코드 시작
    return (
      <div className="relative">
        {/* 오리지널 컴포넌트 내용 */}
        {/* ... */}
      </div>
    );
  } catch (error) {
    // 렌더링 중 발생한 오류 처리
    console.error('탱크 시스템 렌더링 오류:', error);
    
    return (
      <div className="border border-red-300 rounded-md p-6 text-center">
        <div className="text-xl font-semibold text-red-500 mb-2">렌더링 오류 발생</div>
        <p className="text-gray-600">탱크 시스템 컴포넌트를 렌더링하는 중 오류가 발생했습니다.</p>
        <p className="text-sm text-gray-500 mt-2">
          {error instanceof Error ? error.message : '알 수 없는 오류'}
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
}
