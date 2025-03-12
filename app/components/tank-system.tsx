"use client"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { MqttClient } from "mqtt"
import { cn } from '@/lib/utils';
import "./tank-system.css"; // 새로 생성한 CSS 파일 import

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
}

// 추출 진행 메시지를 위한 인터페이스
interface ExtractionProgress {
  timestamp: number
  message: string
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

export default function TankSystem({ tankData, onValveChange, progressMessages = [], onPumpToggle, onPumpReset }: TankSystemProps) {
  // 애니메이션을 위한 상태 추가
  const [fillPercentage, setFillPercentage] = useState<number>(0);
  
  // 길게 누르기 감지를 위한 타이머 상태 추가
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentPressedPump, setCurrentPressedPump] = useState<number | null>(null);
  
  // 펌프 버튼 마우스 다운 핸들러
  const handlePumpMouseDown = (pumpId: number) => {
    setCurrentPressedPump(pumpId);
    
    // 길게 누르기 감지 타이머 설정 (1초 후 리셋 명령 발생)
    const timer = setTimeout(() => {
      console.log(`펌프 ${pumpId} 길게 누름 감지 - 리셋 명령 실행`);
      if (onPumpReset) {
        onPumpReset(pumpId);
      }
      setCurrentPressedPump(null);
    }, 1000);
    
    setLongPressTimer(timer);
  };
  
  // 펌프 버튼 마우스 업 핸들러
  const handlePumpMouseUp = (pumpId: number) => {
    // 타이머가 있으면 취소 (길게 누르기 취소)
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    // 현재 누른 펌프가 있고, 마우스 업 이벤트가 발생한 펌프와 같으면 클릭으로 간주
    if (currentPressedPump === pumpId) {
      console.log(`펌프 ${pumpId} 클릭 - 토글 명령 실행`);
      if (onPumpToggle) {
        onPumpToggle(pumpId);
      }
    }
    
    setCurrentPressedPump(null);
  };
  
  // 마우스가 펌프 밖으로 나갔을 때 핸들러
  const handlePumpMouseLeave = () => {
    // 타이머가 있으면 취소
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setCurrentPressedPump(null);
  };
  
  // 터치 이벤트 핸들러 (모바일)
  const handlePumpTouchStart = (pumpId: number) => {
    handlePumpMouseDown(pumpId);
  };
  
  const handlePumpTouchEnd = (pumpId: number) => {
    handlePumpMouseUp(pumpId);
  };
  
  const handlePumpTouchCancel = () => {
    handlePumpMouseLeave();
  };

  // 추출 진행 상황에서 탱크 채움 비율 계산
  useEffect(() => {
    if (progressMessages.length > 0) {
      const latestProgress = progressMessages[progressMessages.length - 1];
      const latestMessage = latestProgress.message;
      
      // 시간 정보 추출 (84s | 140s 또는 427/215s 형식)
      const timeMatch = latestMessage.match(/(\d+)s?\s*[\|\/]\s*(\d+)s?/);
      
      if (timeMatch && timeMatch.length >= 3) {
        const current = parseInt(timeMatch[1], 10);
        const total = parseInt(timeMatch[2], 10);
        
        if (!isNaN(current) && !isNaN(total) && total > 0) {
          // 현재 값과 총 값의 비율 계산 (최대 100%)
          const percentage = Math.min((current / total) * 100, 100);
          setFillPercentage(percentage);
        }
      }
    }
  }, [progressMessages]);

  // 상태에 따른 탱크 색상 가져오기 함수를 수정하여 탱크를 적절한 색으로 변경
  const getTankColor = (status: string) => {
    switch (status) {
      case "full":
        return "fill-white stroke-red-500 stroke-[4]";
      case "empty":
        return "fill-white stroke-gray-500 stroke-[4]";
      case "filling":
        return "fill-amber-50 stroke-amber-400 stroke-[3]";
      default:
        return "fill-white stroke-gray-400 stroke-2";
    }
  };

  // 탱크 상태에 따른 상세 메시지 반환
  const getStatusMessage = (status: string, level: number) => {
    switch (status) {
      case "full":
        return "가득 차있음";
      case "empty":
        return level <= 5 ? "비었음" : `${level}% 잔여`;
      case "filling":
        return `채워지는 중 (${Math.round(fillPercentage)}%)`;
      default:
        return `${level}% 잔여`;
    }
  };

  // 채워지는 애니메이션을 위한 스타일 계산
  const getFillingStyle = (status: string) => {
    if (status === "filling") {
      return {
        clipPath: `inset(${100 - fillPercentage}% 0 0 0)`,
        transition: 'clip-path 1.5s ease-in-out',
        animation: 'pulse 2s infinite'
      };
    }
    return {};
  }

  // 밸브 상태 파싱 (4자리 문자열에서 첫 두 자리만 사용)
  const parseValveState = () => {
    // 디버깅용 로그
    console.log('밸브 상태 파싱 시작 - 밸브 상태 메시지:', tankData.valveStatusMessage);
    console.log('현재 밸브 상태 문자열:', tankData.valveState);
    console.log('밸브 설명:', tankData.valveADesc, tankData.valveBDesc);
    
    // 특수 케이스: 0100 (3웨이 밸브 OFF, 2웨이 밸브 ON)
    if (tankData.valveState === '0100') {
      console.log('특수 케이스 감지: 0100 - 3웨이 밸브 OFF, 2웨이 밸브 ON');
      return {
        valve1: 0, // 3웨이 밸브 OFF
        valve2: 1, // 2웨이 밸브 ON
        valve1Desc: tankData.valveADesc || '전체순환_교환',
        valve2Desc: tankData.valveBDesc || '열림'
      };
    }
    
    // valveStatusMessage를 우선적으로 확인하여 상태 파싱
    if (tankData.valveStatusMessage) {
      // 'valveA=ON' 또는 'valveA=OFF' 포함 여부 정확히 체크
      const valveAState = tankData.valveStatusMessage.includes('valveA=ON') ? 1 : 0;
      const valveBState = tankData.valveStatusMessage.includes('valveB=ON') ? 1 : 0;
      
      // 밸브 설명 텍스트 - dashboard.tsx에서 파싱된 값 사용
      let valveADesc = tankData.valveADesc || '';
      let valveBDesc = tankData.valveBDesc || '';
      
      // 디버깅을 위한 로그
      console.log(`밸브 상태 파싱 결과: valveA=${valveAState} (${valveADesc}), valveB=${valveBState} (${valveBDesc})`);
      
      return {
        valve1: valveAState,
        valve2: valveBState,
        valve1Desc: valveADesc,
        valve2Desc: valveBDesc
      };
    }
    
    // 기존 로직 유지 (fallback)
    if (tankData.valveState.length !== 4) {
      return { valve1: 0, valve2: 0, valve1Desc: '', valve2Desc: '' };
    }

    const v1 = parseInt(tankData.valveState[0]);
    const v2 = parseInt(tankData.valveState[1]);

    return {
      valve1: v1,
      valve2: v2,
      valve1Desc: v1 === 1 ? '추출순환' : '전체순환',
      valve2Desc: v2 === 1 ? '열림' : '닫힘'
    };
  };

  const { valve1, valve2, valve1Desc, valve2Desc } = parseValveState();

  // 경로 활성화 여부 확인
  const isPathActive = (path: "tank6ToMain" | "tank6ToTank1" | "mainToTank1") => {
    if (path === "tank6ToMain") return valve1 === 0
    if (path === "tank6ToTank1") return valve1 === 1
    if (path === "mainToTank1") return valve2 === 1
    return false
  }

  // 밸브 상태에 따라 라인 표시 여부 결정하는 함수 추가
  const shouldShowLine = (path: "tank6ToMain" | "tank6ToTank1" | "mainToTank1") => {
    if (path === "tank6ToMain") return valve1 === 0; // 전체순환_교환 모드일 때 본탱크로의 라인 표시
    if (path === "tank6ToTank1") return valve1 === 1; // 추출 순환일 때 1번 펌프로의 라인 표시
    if (path === "mainToTank1") return valve2 === 1; // 2way 밸브가 열려있을 때 표시
    return false;
  }

  // 밸브 상태에 따른 파이프 색상 가져오기
  const getValvePipeColor = (path: "tank6ToMain" | "tank6ToTank1" | "mainToTank1") => {
    return isPathActive(path) ? "stroke-blue-500" : "stroke-gray-300"
  }

  // 펌프 상태에 따른 파이프 색상 가져오기
  const getPipeColor = (fromTank: number, toTank: number) => {
    // 1-based 인덱스를 0-based로 변환
    const fromIndex = fromTank - 1
    const toIndex = toTank - 1

    // 해당 구간에 연결된 펌프의 상태 확인
    // 예: 2-3 구간은 3번 펌프에 연결 (인덱스 2)
    const pumpIndex = toIndex >= 0 && toIndex < tankData.tanks.length ? toIndex : fromIndex
    const pumpStatus = tankData.tanks[pumpIndex]?.pumpStatus || "OFF"

    return pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"
  }

  // 밸브 상태에 따른 텍스트 반환
  const getValveStateText = () => {
    const { valve1, valve2 } = parseValveState()
    
    if (valve1 === 1) {
      return "추출 순환"
    } else if (valve2 === 1) {
      return "전체 순환 (열림)"
    } else {
      return "밸브 닫힘"
    }
  }

  // 다음 밸브 상태 가져오기 (순환)
  const getNextValveState = () => {
    console.log('현재 밸브 상태:', tankData.valveState);
    // 0100 상태에서 클릭하면 1000 상태로 변경
    if (tankData.valveState === "0100") return "1000"
    // 1000 상태에서 클릭하면 0000 상태로 변경
    if (tankData.valveState === "1000") return "0000"
    // 0000 상태에서 클릭하면 0100 상태로 변경
    if (tankData.valveState === "0000") return "0100"
    return "0100" // 기본값
  }

  // 원형 레이아웃을 위한 계산
  const centerX = 500
  const centerY = 350 // 본탱크 위치를 위로 조정
  const mainTankRadius = 70
  const circleRadius = 250
  const tankWidth = 100
  const tankHeight = 100
  const pumpRadius = 30
  const pumpDistance = 60

  // 원형으로 배치된 탱크 위치 계산
  const calculatePosition = (index: number, total: number) => {
    // 시작 각도를 조정하여 1번 탱크가 상단에 오도록 함
    const startAngle = -Math.PI / 2
    const angle = startAngle + (index * 2 * Math.PI) / total
    return {
      x: centerX + circleRadius * Math.cos(angle),
      y: centerY + circleRadius * Math.sin(angle),
      angle: angle,
    }
  }

  // 탱크 위치 계산
  const tankPositions = Array(6)
    .fill(0)
    .map((_, i) => {
      const pos = calculatePosition(i, 6)
      return {
        ...pos,
        label: `${i + 1}번 탱크`,
      }
    })

  // 본탱크 위치 - 사각형으로 변경하고 크기 확대
  const mainTankPosition = { x: centerX, y: centerY, label: "본탱크", width: 180, height: 180 }

  // 밸브 위치 계산
  const valve1Position = calculatePosition(5.5, 6) // 6번과 1번 탱크 사이
  // 2way 밸브 위치 계산 수정 - 본탱크에 더 가깝게
  const valve2Position = {
    x: centerX,
    y: centerY - 150, // 본탱크 위쪽에 직각 배치
  }

  // 3way 밸브 위치 계산 - 6번 탱크와 본탱크 사이에 배치하되 펌프1과 교차하지 않도록
  const valve3wayPosition = {
    x: (tankPositions[5].x + centerX) / 2 - 50, // 본탱크와 6번 탱크 사이에 배치, 약간 왼쪽으로 조정
    y: tankPositions[5].y + 50, // 6번 탱크보다 조금 아래에 위치
  }

  // 펌프 위치 계산 함수 수정 - 현재 탱크와 다음 탱크 사이에 위치하도록
  const calculatePumpPosition = (currentTankIndex: number, nextTankIndex: number) => {
    const currentTank = tankPositions[currentTankIndex]
    const nextTank = tankPositions[nextTankIndex]

    // 두 탱크 간의 중간 지점에 펌프 배치
    return {
      x: (currentTank.x + nextTank.x) / 2,
      y: (currentTank.y + nextTank.y) / 2,
      angle: currentTank.angle
    }
  }

  // 탱크 간 파이프 경로 계산
  const calculatePipePath = (fromIndex: number, toIndex: number) => {
    const from = tankPositions[fromIndex]
    const to = tankPositions[toIndex]

    // 직선 경로
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }

  // 6번 탱크에서 3way 밸브로의 경로 (직선 연결)
  const calculate6ToValvePath = () => {
    // 6번 탱크에서 3way 밸브로 직선 연결
    return `M ${tankPositions[5].x} ${tankPositions[5].y} L ${valve3wayPosition.x} ${valve3wayPosition.y}`
  }

  // 3way 밸브에서 본탱크로의 경로 (직선 연결)
  const calculate3wayToMainPath = () => {
    // 3way 밸브에서 본탱크 왼쪽 가장자리까지 직선 연결
    const tankLeft = mainTankPosition.x - mainTankPosition.width / 2
    const tankMid = mainTankPosition.y
    return `M ${valve3wayPosition.x} ${valve3wayPosition.y} L ${tankLeft} ${tankMid}`
  }

  // 본탱크에서 2way 밸브로의 경로 (직각으로 조정)
  const calculateMainToTank1Path = () => {
    // 본탱크 위쪽 가장자리에서 시작하여 2way 밸브까지 수직 연결
    const tankEdgeY = mainTankPosition.y - mainTankPosition.height / 2
    return `M ${mainTankPosition.x} ${tankEdgeY} V ${valve2Position.y}`
  }

  // 2way 밸브에서 펌프1 입구 쪽으로의 경로
  const calculate2wayToPump1Path = () => {
    const pump1Pos = calculatePumpPosition(5, 0)
    
    // 2way 밸브에서 펌프1 입구 근처까지 갈라지는 위치로 가는 경로
    // 3way 밸브에서 오는 경로와 만나는 중간 지점 계산
    const midX = (valve3wayPosition.x + 50 + pump1Pos.x) / 2
    const midY = (valve3wayPosition.y + pump1Pos.y) / 2 - 20 // 조금 위쪽에 위치
    
    return `M ${valve2Position.x} ${valve2Position.y} 
            V ${midY} 
            L ${midX} ${midY}`
  }

  // 3way 밸브에서 펌프 1로의 경로 (T자 갈라짐)
  const calculate3wayToPump1Path = () => {
    const pump1Pos = calculatePumpPosition(5, 0)
    
    // T자로 갈라지는 경로 - 3way 밸브에서 중간 합류 지점까지
    // 중간 합류 지점 계산 (2way 밸브에서 오는 경로와 합류)
    const midX = (valve3wayPosition.x + 50 + pump1Pos.x) / 2
    const midY = (valve3wayPosition.y + pump1Pos.y) / 2 - 20 // 조금 위쪽에 위치
    
    return `M ${valve3wayPosition.x} ${valve3wayPosition.y} 
            L ${valve3wayPosition.x + 50} ${valve3wayPosition.y} 
            L ${midX} ${midY}`
  }

  // 합류 지점에서 펌프1로의 경로
  const calculateMergeToPump1Path = () => {
    const pump1Pos = calculatePumpPosition(5, 0)
    
    // 중간 합류 지점 계산
    const midX = (valve3wayPosition.x + 50 + pump1Pos.x) / 2
    const midY = (valve3wayPosition.y + pump1Pos.y) / 2 - 20
    
    return `M ${midX} ${midY} L ${pump1Pos.x} ${pump1Pos.y}`
  }

  // 1번 펌프에서 1번 탱크로의 경로 (직선 연결)
  const calculatePump1To1Path = () => {
    const pump1Pos = calculatePumpPosition(5, 0)
    return `M ${pump1Pos.x} ${pump1Pos.y} L ${tankPositions[0].x} ${tankPositions[0].y}`
  }

  // 1번 탱크에서 2번 펌프로의 경로
  const calculate1ToPump2Path = () => {
    const pump2Pos = calculatePumpPosition(0, 1)
    return `M ${tankPositions[0].x} ${tankPositions[0].y} L ${pump2Pos.x} ${pump2Pos.y}`
  }

  // 2번 펌프에서 2번 탱크로의 경로
  const calculatePump2To2Path = () => {
    const pump2Pos = calculatePumpPosition(0, 1)
    return `M ${pump2Pos.x} ${pump2Pos.y} L ${tankPositions[1].x} ${tankPositions[1].y}`
  }

  // 밸브 상태 메시지에서 필요한 부분만 추출
  const extractValveStatus = (message: string) => {
    if (!message) return "";
    
    // valveA와 valveB 부분만 추출하는 정규식
    const valveAMatch = message.match(/valveA=[^,]+/);
    const valveBMatch = message.match(/valveB=[^,]+/);
    
    const valveA = valveAMatch ? valveAMatch[0] : "";
    const valveB = valveBMatch ? valveBMatch[0] : "";
    
    if (valveA && valveB) {
      return `${valveA}, ${valveB}`;
    } else if (valveA) {
      return valveA;
    } else if (valveB) {
      return valveB;
    }
    
    return "";
  }

  // 화살표 위치 계산
  const calculateArrowPosition = (path: string, progress = 0.5) => {
    // SVG 경로 객체 생성
    const dummySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("d", path);
    dummySvg.appendChild(pathElement);
    
    // 경로의 길이 구하기
    const pathLength = pathElement.getTotalLength();
    
    // 특정 위치의 점 구하기 (기본값: 경로의 중간점)
    const point = pathElement.getPointAtLength(pathLength * progress);
    
    return { x: point.x, y: point.y };
  };

  // 파이프가 활성화 상태인지 확인
  const isPipeActive = (pumpIndex: number, valveCondition: boolean = true) => {
    return tankData.tanks[pumpIndex].pumpStatus === "ON" && valveCondition;
  }

  return (
    <div className="relative w-full h-[850px] bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100">
      {/* 펄스 애니메이션 스타일 추가 */}
      <style>{pulseCss}</style>
      
      <svg viewBox="0 0 1000 800" className="w-full h-full">
        {/* 본탱크 - 원형에서 사각형으로 변경 및 크기 확대 */}
        <rect
          x={mainTankPosition.x - mainTankPosition.width / 2}
          y={mainTankPosition.y - mainTankPosition.height / 2}
          width={mainTankPosition.width}
          height={mainTankPosition.height}
          rx="10"
          className={`${getTankColor(tankData.mainTank.status)}`}
        />
        {tankData.mainTank.status === "filling" && (
          <rect
            x={mainTankPosition.x - mainTankPosition.width / 2}
            y={mainTankPosition.y - mainTankPosition.height / 2}
            width={mainTankPosition.width}
            height={mainTankPosition.height}
            rx="10"
            className="fill-amber-200/30"
            style={getFillingStyle(tankData.mainTank.status)}
          />
        )}
        <text x={mainTankPosition.x} y={mainTankPosition.y} textAnchor="middle" className="text-sm font-bold fill-black">
          {mainTankPosition.label}
        </text>
        
        {/* 본탱크 상태 메시지 텍스트 박스 */}
        <g>
          <rect
            x={mainTankPosition.x - mainTankPosition.width / 2}
            y={mainTankPosition.y + mainTankPosition.height / 2 + 5}
            width={mainTankPosition.width}
            height={20}
            rx="3"
            className="fill-gray-100 stroke-gray-300 stroke-1"
          />
          <text
            x={mainTankPosition.x}
            y={mainTankPosition.y + mainTankPosition.height / 2 + 18}
            textAnchor="middle"
            className="text-[9px] fill-gray-700"
          >
            {getStatusMessage(tankData.mainTank.status, tankData.mainTank.level)}
          </text>
        </g>

        {/* 탱크 연결 파이프 - 직선으로 연결 (2-3, 3-4, 4-5, 5-6번 탱크만) */}
        {Array(4)
          .fill(0)
          .map((_, i) => {
            const currentIndex = i + 1 // 2, 3, 4, 5번 탱크부터 시작
            const nextIndex = (currentIndex + 1) % 6 // 3, 4, 5, 6번 탱크
            const pumpIndex = i + 2 // 펌프 인덱스 (3, 4, 5, 6번 펌프는 각각 2, 3, 4, 5번 인덱스)
            return (
              <path
                key={`pipe-${currentIndex}-${nextIndex}`}
                d={calculatePipePath(currentIndex, nextIndex)}
                className={`${tankData.tanks[pumpIndex].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"} stroke-[12]`}
                fill="none"
                strokeLinecap="round"
              />
            )
          })}

        {/* 1번 탱크에서 2번 펌프로의 경로 */}
        <path
          d={calculate1ToPump2Path()}
          className={`stroke-[12] ${tankData.tanks[1].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"}`}
          fill="none"
          strokeLinecap="round"
        />

        {/* 2번 펌프에서 2번 탱크로의 경로 */}
        <path
          d={calculatePump2To2Path()}
          className={`stroke-[12] ${tankData.tanks[1].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"}`}
          fill="none"
          strokeLinecap="round"
        />

        {/* 6번 탱크에서 3way 밸브로의 경로 */}
        <path
          d={calculate6ToValvePath()}
          className={`stroke-[12] ${tankData.tanks[5].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"}`}
          fill="none"
          strokeLinecap="round"
        />

        {/* 3way 밸브에서 본탱크로의 경로 - 밸브 상태에 따라 표시 여부 결정 */}
        <path
          d={calculate3wayToMainPath()}
          className={`stroke-[12] ${shouldShowLine("tank6ToMain") ? (isPipeActive(5) ? "stroke-blue-500" : "stroke-gray-300") : "stroke-transparent"}`}
          fill="none"
          strokeLinecap="round"
        />

        {/* 본탱크에서 2way 밸브로의 경로 */}
        <path
          d={calculateMainToTank1Path()}
          className={`stroke-[12] ${(valve2 === 1) ? "stroke-blue-500" : "stroke-gray-300"}`}
          fill="none"
          strokeLinecap="round"
        />

        {/* 2way 밸브에서 펌프1 입구 합류 지점으로의 경로 */}
        <path
          d={calculate2wayToPump1Path()}
          className={`stroke-[12] ${(valve2 === 1 && isPipeActive(0)) ? "stroke-blue-500" : "stroke-gray-300"}`}
          fill="none"
          strokeLinecap="round"
        />

        {/* 3way 밸브에서 펌프1 입구 합류 지점까지의 경로 - 밸브 상태에 따라 표시 여부 결정 */}
        <path
          d={calculate3wayToPump1Path()}
          className={`stroke-[12] ${shouldShowLine("tank6ToTank1") ? (isPipeActive(5) ? "stroke-blue-500" : "stroke-gray-300") : "stroke-transparent"}`}
          fill="none"
          strokeLinecap="round"
        />

        {/* 합류 지점에서 펌프1로의 경로 */}
        <path
          d={calculateMergeToPump1Path()}
          className={`stroke-[12] ${((valve1 === 1 && isPipeActive(5)) || (valve2 === 1)) && isPipeActive(0) ? "stroke-blue-500" : "stroke-gray-300"}`}
          fill="none"
          strokeLinecap="round"
        />

        {/* 1번 펌프에서 1번 탱크로의 경로 */}
        <path
          d={calculatePump1To1Path()}
          className={`stroke-[12] ${isPipeActive(0) && ((valve1 === 1 && isPipeActive(5)) || (valve2 === 1)) ? "stroke-blue-500" : "stroke-gray-300"}`}
          fill="none"
          strokeLinecap="round"
        />

        {/* 탱크 1-6 */}
        {tankPositions.map((pos, index) => {
          const tankNum = index + 1
          const tank = tankData.tanks[index]
          
          // 1번 탱크인 경우 텍스트 박스의 위치를 조정
          const textBoxY = tankNum === 1 
            ? pos.y + tankHeight / 2 + 5
            : pos.y + tankHeight / 2 + 5;
          
          // 1번 탱크 텍스트 박스 너비 조정
          const textBoxWidth = tankNum === 1 ? 120 : tankWidth;
          
          return (
            <g key={`tank-${tankNum}`}>
              {/* 탱크 */}
              <rect
                x={pos.x - tankWidth / 2}
                y={pos.y - tankHeight / 2}
                width={tankWidth}
                height={tankHeight}
                rx="5"
                className={`${getTankColor(tank.status)}`}
              />
              {/* 채워지는 애니메이션을 위한 오버레이 */}
              {tank.status === "filling" && (
                <rect
                  x={pos.x - tankWidth / 2}
                  y={pos.y - tankHeight / 2}
                  width={tankWidth}
                  height={tankHeight}
                  rx="5"
                  className="fill-amber-200/30"
                  style={getFillingStyle(tank.status)}
                />
              )}
              <text x={pos.x} y={pos.y} textAnchor="middle" className="text-sm font-bold fill-black font-semibold z-10">
                {pos.label}
              </text>
              
              {/* 탱크 상태 메시지 텍스트 박스 - 1번 탱크는 위치와 크기 조정 */}
              <g>
                <rect
                  x={tankNum === 1 ? pos.x - textBoxWidth / 2 : pos.x - tankWidth / 2}
                  y={textBoxY}
                  width={textBoxWidth}
                  height={20}
                  rx="3"
                  className="fill-gray-100 stroke-gray-300 stroke-1"
                />
                <text
                  x={pos.x}
                  y={textBoxY + 13}
                  textAnchor="middle"
                  className="text-[9px] fill-gray-700"
                >
                  {getStatusMessage(tank.status, tank.level)}
                </text>
              </g>
            </g>
          )
        })}

        {/* 3way 밸브 - ON/OFF 스위치 형태로 개선 */}
        <g
          onClick={() => onValveChange(getNextValveState())}
          className="cursor-pointer"
          transform={`translate(${valve3wayPosition.x}, ${valve3wayPosition.y})`}
        >
          {/* 밸브 배경 */}
          <rect 
            x="-30" 
            y="-40" 
            width="60" 
            height="80" 
            rx="10" 
            className={`fill-yellow-50 stroke-yellow-400 stroke-2`} 
          />
          
          {/* 밸브 내부 T자 표시 */}
          <line x1="-20" y1="0" x2="20" y2="0" className="stroke-yellow-500 stroke-2" />
          <line x1="0" y1="0" x2="0" y2="20" className="stroke-yellow-500 stroke-2" />
          
          {/* ON/OFF 스위치 - 위치에 따라 위아래로 이동 */}
          <rect 
            x="-20" 
            y={valve1 === 1 ? "-25" : "5"} 
            width="40" 
            height="20" 
            rx="10" 
            className={`${valve1 === 1 ? "fill-green-500" : "fill-red-500"} stroke-gray-400 stroke-1 transition-all duration-300`} 
          />
          
          {/* 밸브 텍스트 */}
          <text x="0" y="-30" textAnchor="middle" className="text-xs font-bold">
            3way 밸브
          </text>
          <text x="0" y={valve1 === 1 ? "-15" : "15"} textAnchor="middle" className="text-[10px] font-bold text-white">
            {valve1 === 1 ? "ON" : "OFF"}
          </text>
          <text x="0" y="50" textAnchor="middle" className="text-[10px] text-gray-700">
            {valve1 === 1 ? "추출순환" : valve1Desc || "전체순환"}
          </text>
        </g>

        {/* 2way 밸브 - ON/OFF 스위치 형태로 개선 */}
        <g
          onClick={() => onValveChange(getNextValveState())}
          className="cursor-pointer"
          transform={`translate(${valve2Position.x}, ${valve2Position.y})`}
        >
          {/* 밸브 배경 */}
          <rect 
            x="-30" 
            y="-40" 
            width="60" 
            height="80" 
            rx="10" 
            className={`fill-yellow-50 stroke-yellow-400 stroke-2`} 
          />
          
          {/* 밸브 내부 표시 */}
          <line x1="-20" y1="0" x2="20" y2="0" className="stroke-yellow-500 stroke-2" />
          {valve2 === 1 && <line x1="0" y1="-20" x2="0" y2="20" className="stroke-yellow-500 stroke-2" />}
          
          {/* ON/OFF 스위치 */}
          <rect 
            x="-20" 
            y={valve2 === 1 ? "-25" : "5"} 
            width="40" 
            height="20" 
            rx="10" 
            className={`${valve2 === 1 ? "fill-green-500" : "fill-red-500"} stroke-gray-400 stroke-1 transition-all duration-300`} 
          />
          
          {/* 밸브 텍스트 */}
          <text x="0" y="-30" textAnchor="middle" className="text-xs font-bold">
            2way 밸브
          </text>
          <text x="0" y={valve2 === 1 ? "-15" : "15"} textAnchor="middle" className="text-[10px] font-bold text-white">
            {valve2 === 1 ? "ON" : "OFF"}
          </text>
          <text x="0" y="50" textAnchor="middle" className="text-[10px] text-gray-700">
            {valve2 === 1 ? valve2Desc || "본탱크개방" : "닫힘"}
          </text>
        </g>

        {/* 범례 */}
        <g className="text-xs">
          <rect x="720" y="700" width="250" height="150" className="fill-white stroke-gray-300 stroke-1 rounded" />
          <text x="730" y="720" className="font-bold">범례:</text>
          
          <rect x="730" y="730" width="15" height="15" className="fill-white stroke-gray-500 stroke-[4]" />
          <text x="755" y="743">비어있음</text>
          
          <rect x="730" y="755" width="15" height="15" className="fill-amber-50 stroke-amber-400 stroke-[3]" />
          <rect x="730" y="755" width="15" height="7" className="fill-amber-200/30" />
          <text x="755" y="768">채워지는 중</text>
          
          <rect x="730" y="780" width="15" height="15" className="fill-white stroke-red-500 stroke-[4]" />
          <text x="755" y="793">가득 채워짐</text>
          
          <circle cx="737" cy="813" r="7.5" className="fill-blue-300 stroke-gray-400 stroke-1" />
          <text x="755" y="818">펌프 ON</text>
          
          <circle cx="737" cy="838" r="7.5" className="fill-gray-200 stroke-gray-400 stroke-1" />
          <text x="755" y="843">펌프 OFF</text>
        </g>

        {/* 펌프 (3~6번) - 탱크 사이에 배치 */}
        {Array(4)
          .fill(0)
          .map((_, index) => {
            const currentTankIndex = index + 1 // 2, 3, 4, 5번 탱크부터 시작
            const nextTankIndex = (currentTankIndex + 1) % 6 // 3, 4, 5, 6번 탱크
            const pumpPos = calculatePumpPosition(currentTankIndex, nextTankIndex)
            const pumpNum = index + 3 // 3, 4, 5, 6번 펌프
            const tank = tankData.tanks[pumpNum - 1] // 인덱스는 0부터 시작하므로 -1
            
            return (
              <g key={`pump-${pumpNum}`}>
                {/* 인버터 펌프 */}
                <circle
                  cx={pumpPos.x}
                  cy={pumpPos.y}
                  r={pumpRadius}
                  className={`stroke-gray-400 stroke-2 ${onPumpToggle ? 'cursor-pointer' : ''}`}
                  fill={tank.pumpStatus === "ON" ? "#93c5fd" : "#e5e7eb"}
                  onMouseDown={() => onPumpToggle && handlePumpMouseDown(pumpNum)}
                  onMouseUp={() => onPumpToggle && handlePumpMouseUp(pumpNum)}
                  onMouseLeave={() => onPumpToggle && handlePumpMouseLeave()}
                  onTouchStart={() => onPumpToggle && handlePumpTouchStart(pumpNum)}
                  onTouchEnd={() => onPumpToggle && handlePumpTouchEnd(pumpNum)}
                  onTouchCancel={() => onPumpToggle && handlePumpTouchCancel()}
                />
                <text x={pumpPos.x} y={pumpPos.y - 5} textAnchor="middle" className="text-xs font-bold">
                  IP_{pumpNum}
                </text>
                <text x={pumpPos.x} y={pumpPos.y + 10} textAnchor="middle" className="text-xs font-bold">
                  {tank.pumpStatus}
                </text>
                {currentPressedPump === pumpNum && (
                  <circle
                    cx={pumpPos.x}
                    cy={pumpPos.y}
                    r={pumpRadius + 5}
                    className="fill-transparent stroke-yellow-400 stroke-2 animate-pulse"
                  />
                )}
              </g>
            )
          })}

        {/* 1번 펌프 (6번과 1번 탱크 사이) */}
        {(() => {
          const pumpPos = calculatePumpPosition(5, 0)
          const tank = tankData.tanks[0] // 1번 펌프 = 0번 인덱스
          
          return (
            <g key="pump-1">
              <circle
                cx={pumpPos.x}
                cy={pumpPos.y}
                r={pumpRadius}
                className={`stroke-gray-400 stroke-2 ${onPumpToggle ? 'cursor-pointer' : ''}`}
                fill={tank.pumpStatus === "ON" ? "#93c5fd" : "#e5e7eb"}
                onMouseDown={() => onPumpToggle && handlePumpMouseDown(1)}
                onMouseUp={() => onPumpToggle && handlePumpMouseUp(1)}
                onMouseLeave={() => onPumpToggle && handlePumpMouseLeave()}
                onTouchStart={() => onPumpToggle && handlePumpTouchStart(1)}
                onTouchEnd={() => onPumpToggle && handlePumpTouchEnd(1)}
                onTouchCancel={() => onPumpToggle && handlePumpTouchCancel()}
              />
              <text x={pumpPos.x} y={pumpPos.y - 5} textAnchor="middle" className="text-xs font-bold">
                IP_1
              </text>
              <text x={pumpPos.x} y={pumpPos.y + 10} textAnchor="middle" className="text-xs font-bold">
                {tank.pumpStatus}
              </text>
              {currentPressedPump === 1 && (
                <circle
                  cx={pumpPos.x}
                  cy={pumpPos.y}
                  r={pumpRadius + 5}
                  className="fill-transparent stroke-yellow-400 stroke-2 animate-pulse"
                />
              )}
            </g>
          )
        })()}

        {/* 2번 펌프 (1번과 2번 탱크 사이) - 추가 */}
        {(() => {
          const pumpPos = calculatePumpPosition(0, 1)
          const tank = tankData.tanks[1] // 2번 펌프 = 1번 인덱스
          
          return (
            <g key="pump-2">
              <circle
                cx={pumpPos.x}
                cy={pumpPos.y}
                r={pumpRadius}
                className={`stroke-gray-400 stroke-2 ${onPumpToggle ? 'cursor-pointer' : ''}`}
                fill={tank.pumpStatus === "ON" ? "#93c5fd" : "#e5e7eb"}
                onMouseDown={() => onPumpToggle && handlePumpMouseDown(2)}
                onMouseUp={() => onPumpToggle && handlePumpMouseUp(2)}
                onMouseLeave={() => onPumpToggle && handlePumpMouseLeave()}
                onTouchStart={() => onPumpToggle && handlePumpTouchStart(2)}
                onTouchEnd={() => onPumpToggle && handlePumpTouchEnd(2)}
                onTouchCancel={() => onPumpToggle && handlePumpTouchCancel()}
              />
              <text x={pumpPos.x} y={pumpPos.y - 5} textAnchor="middle" className="text-xs font-bold">
                IP_2
              </text>
              <text x={pumpPos.x} y={pumpPos.y + 10} textAnchor="middle" className="text-xs font-bold">
                {tank.pumpStatus}
              </text>
              {currentPressedPump === 2 && (
                <circle
                  cx={pumpPos.x}
                  cy={pumpPos.y}
                  r={pumpRadius + 5}
                  className="fill-transparent stroke-yellow-400 stroke-2 animate-pulse"
                />
              )}
            </g>
          )
        })()}
      </svg>

      {/* 추출 진행 상황 표시 하단 박스로 이동 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 p-4 text-xs">
        <div className="flex justify-between">
          <div className="w-1/2">
            <div className="font-bold mb-2">추출 진행 상황:</div>
            {progressMessages.length === 0 ? (
              <div className="text-gray-500">메시지 대기 중...</div>
            ) : (
              <div className="max-h-[100px] overflow-y-auto space-y-2">
                {progressMessages.map((msg, idx) => {
                  const timeStr = new Date(msg.timestamp).toLocaleTimeString();
                  
                  // 메시지 표시 방식 개선
                  return (
                    <div key={msg.timestamp} className="p-2 rounded bg-white border border-gray-100 text-[10px] leading-tight">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{timeStr}</span>
                        <span className="text-blue-500 font-semibold text-[8px]">#{idx+1}</span>
                      </div>
                      <div className="mt-1 text-[9px] font-mono bg-gray-50 p-1 rounded break-all leading-tight">
                        {msg.message}
                      </div>
                      
                      {/* JSON 데이터 표시 부분 개선 */}
                      {msg.rawJson && (
                        <div className="mt-2 bg-green-50 border border-green-100 rounded p-2 overflow-x-auto">
                          <div className="font-medium text-green-800 mb-1 text-[9px]">JSON 데이터:</div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8px]">
                            {msg.rawJson.includes('process_info') && (
                              <div>
                                <span className="font-semibold text-green-700">진행:</span>{" "}
                                {JSON.parse(msg.rawJson).process_info}
                              </div>
                            )}
                            {msg.rawJson.includes('elapsed_time') && (
                              <div>
                                <span className="font-semibold text-green-700">경과시간:</span>{" "}
                                {JSON.parse(msg.rawJson).elapsed_time}
                              </div>
                            )}
                            {msg.rawJson.includes('remaining_time') && (
                              <div>
                                <span className="font-semibold text-green-700">남은시간:</span>{" "}
                                {JSON.parse(msg.rawJson).remaining_time}
                              </div>
                            )}
                            {msg.rawJson.includes('total_remaining') && (
                              <div>
                                <span className="font-semibold text-green-700">총 남은시간:</span>{" "}
                                {JSON.parse(msg.rawJson).total_remaining}
                              </div>
                            )}
                            {msg.rawJson.includes('process_time') && (
                              <div>
                                <span className="font-semibold text-green-700">총 시간:</span>{" "}
                                {JSON.parse(msg.rawJson).process_time}
                              </div>
                            )}
                            {msg.rawJson.includes('status') && (
                              <div className="col-span-2 mt-1 bg-blue-50 p-1 rounded text-blue-700">
                                <span className="font-semibold">상태:</span>{" "}
                                {JSON.parse(msg.rawJson).status}
                              </div>
                            )}
                          </div>
                          <details className="mt-1">
                            <summary className="text-[8px] text-green-700 cursor-pointer">원본 JSON 보기</summary>
                            <pre className="text-[7px] font-mono text-green-800 whitespace-pre-wrap overflow-x-auto mt-1">
                              {msg.rawJson}
                            </pre>
                          </details>
                        </div>
                      )}
                      
                      {/* 일반 텍스트 메시지 파싱 부분 (JSON이 아닌 경우) */}
                      {!msg.rawJson && msg.message && (
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[8px]">
                          {msg.message.includes('(') && msg.message.includes(')') && (
                            <div>
                              <span className="font-semibold">진행:</span>{" "}
                              {msg.message.match(/\(([^)]+)\)/)?.[1] || ""}
                            </div>
                          )}
                          
                          {msg.message.includes('|') && (
                            <div>
                              <span className="font-semibold">시간:</span>{" "}
                              {msg.message.match(/(\d+)s\s*\|\s*(\d+)s/)?.[0] || ""}
                            </div>
                          )}
                          
                          {msg.message.includes('/') && msg.message.includes('s') && (
                            <div>
                              <span className="font-semibold">총진행:</span>{" "}
                              {msg.message.match(/(\d+)s\s*\/\s*(\d+)s/)?.[0] || ""}
                            </div>
                          )}
                          
                          {msg.message.split(',').length > 3 && (
                            <div className="col-span-2 bg-blue-50 p-1 rounded text-blue-800">
                              <span className="font-semibold">상태:</span>{" "}
                              {msg.message.split(',').slice(3).join(',').trim()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="w-1/2 pl-4 border-l border-gray-200">
            <details className="text-[9px]" open>
              <summary className="font-bold cursor-pointer mb-2">시스템 상태 정보</summary>
              <div className="bg-white p-2 rounded border border-gray-100 space-y-1 max-h-[100px] overflow-y-auto">
                <div>
                  <span className="font-semibold">밸브 상태:</span> 
                  3방향 밸브: {valve1 === 1 ? `ON (${valve1Desc || "추출순환"})` : `OFF (${valve1Desc || "전체순환"})`}, 
                  2방향 밸브: {valve2 === 1 ? `ON (${valve2Desc || "본탱크개방"})` : "OFF (닫힘)"}
                </div>
                
                {tankData.valveStatusMessage && (
                  <div className="bg-yellow-50 p-1 rounded text-[8px] border border-yellow-100 mt-1 overflow-x-auto whitespace-nowrap">
                    <span className="font-semibold">밸브 상세:</span> {tankData.valveStatusMessage}
                  </div>
                )}
                
                <div>
                  <span className="font-semibold">탱크 상태:</span>
                </div>
                <div className="pl-2 space-y-0.5">
                  <div>본탱크: {getStatusMessage(tankData.mainTank.status, tankData.mainTank.level)}</div>
                  {tankData.tanks.map((tank, idx) => (
                    <div key={idx}>
                      {`탱크 ${tank.id}: ${getStatusMessage(tank.status, tank.level)}, 펌프: ${tank.pumpStatus}`}
                    </div>
                  ))}
                </div>
                <div>
                  <span className="font-semibold">채움 비율:</span> {fillPercentage}%
                </div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  )
}
