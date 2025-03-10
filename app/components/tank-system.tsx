"use client"
import { motion } from "framer-motion"

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
  }
  onValveChange: (newState: string) => void
}

export default function TankSystem({ tankData, onValveChange }: TankSystemProps) {
  // 상태에 따른 탱크 색상 가져오기 함수를 수정하여 탱크를 적절한 색으로 변경
  const getTankColor = (status: string) => {
    switch (status) {
      case "empty":
        return "fill-gray-100"
      case "filling":
        return "fill-gray-200"
      case "full":
        return "fill-gray-300"
      default:
        return "fill-gray-100"
    }
  }

  // 밸브 상태 파싱 (4자리 문자열에서 첫 두 자리만 사용)
  const parseValveState = () => {
    // 밸브 상태가 4자리가 아니면 기본값 사용
    if (tankData.valveState.length !== 4) {
      return { valve1: 0, valve2: 0 }
    }

    return {
      valve1: Number.parseInt(tankData.valveState[0]),
      valve2: Number.parseInt(tankData.valveState[1]),
    }
  }

  const { valve1, valve2 } = parseValveState()

  // 경로 활성화 여부 확인
  const isPathActive = (path: "tank6ToMain" | "tank6ToTank1" | "mainToTank1") => {
    if (path === "tank6ToMain") return valve1 === 0
    if (path === "tank6ToTank1") return valve1 === 1
    if (path === "mainToTank1") return valve2 === 1
    return false
  }

  // 밸브 상태에 따른 파이프 색상 가져오기
  const getValvePipeColor = (path: "tank6ToMain" | "tank6ToTank1" | "mainToTank1") => {
    return isPathActive(path) ? "stroke-blue-500" : "stroke-gray-300"
  }

  // 펌프 상태에 따른 파이프 색상 가져오기
  const getPipeColor = (fromTank: number, toTank: number) => {
    // 순환 방향: 1->2->3->4->5->6->1
    // 특별한 경우: 6->본탱크->1 (밸브 상태에 따라)

    // 밸브 상태에 따른 특별 경로 처리
    if (fromTank === 6) {
      if (valve1 === 0) {
        // 6->본탱크 경로
        return tankData.tanks[5].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"
      } else {
        // 6->1 직접 경로
        return tankData.tanks[5].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"
      }
    }

    // 본탱크->1 경로
    if (fromTank === 0 && toTank === 1) {
      return valve2 === 1 ? "stroke-blue-500" : "stroke-gray-300"
    }

    // 일반 순환 경로 (n->n+1)
    if (toTank === fromTank + 1 || (fromTank === 6 && toTank === 1)) {
      const tankIndex = fromTank - 1
      return tankIndex >= 0 && tankIndex < tankData.tanks.length && tankData.tanks[tankIndex].pumpStatus === "ON"
        ? "stroke-blue-500"
        : "stroke-gray-300"
    }

    return "stroke-gray-300" // 기본값
  }

  // 밸브 상태 텍스트 가져오기
  const getValveStateText = () => {
    if (valve1 === 1 && valve2 === 0) return "추출 순환 (1000)"
    if (valve1 === 0 && valve2 === 1) return "전체 순환 (0100)"
    if (valve1 === 0 && valve2 === 0) return "본탱크 수집 (0000)"
    return `밸브 상태: ${tankData.valveState}`
  }

  // 다음 밸브 상태 가져오기 (순환)
  const getNextValveState = () => {
    if (tankData.valveState === "1000") return "0100"
    if (tankData.valveState === "0100") return "0000"
    if (tankData.valveState === "0000") return "1000"
    return "1000" // 기본값
  }

  // 원형 레이아웃을 위한 계산
  const centerX = 500
  const centerY = 400
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

  // 본탱크 위치
  const mainTankPosition = { x: centerX, y: centerY, label: "본탱크" }

  // 밸브 위치 계산
  const valve1Position = calculatePosition(5.5, 6) // 6번과 1번 탱크 사이
  // 2way 밸브 위치 계산 수정 - 본탱크에 더 가깝게
  const valve2Position = {
    x: centerX + (circleRadius - 180) * Math.cos(-Math.PI / 2),
    y: centerY + (circleRadius - 180) * Math.sin(-Math.PI / 2),
  }

  // 펌프 위치 계산 (탱크에서 중심 방향으로)
  const calculatePumpPosition = (tankPos: { x: number; y: number; angle: number }, nextTankIndex: number) => {
    // 다음 탱크 위치 (원형 배치에서 다음 탱크)
    const nextTank = tankPositions[nextTankIndex]

    // 현재 탱크에서 다음 탱크 방향으로 약간 이동한 위치에 펌프 배치
    const directionX = nextTank.x - tankPos.x
    const directionY = nextTank.y - tankPos.y
    const length = Math.sqrt(directionX * directionX + directionY * directionY)
    const normalizedX = directionX / length
    const normalizedY = directionY / length

    // 탱크에서 약 40% 정도 다음 탱크 방향으로 이동한 위치
    return {
      x: tankPos.x + normalizedX * (pumpDistance * 0.8),
      y: tankPos.y + normalizedY * (pumpDistance * 0.8),
      angle: tankPos.angle,
    }
  }

  // 탱크 간 파이프 경로 계산
  const calculatePipePath = (fromIndex: number, toIndex: number) => {
    const from = tankPositions[fromIndex]
    const to = tankPositions[toIndex]

    // 직선 경로
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }

  // 탱크에서 펌프로의 경로 계산
  const calculateTankToPumpPath = (tankIndex: number) => {
    const tank = tankPositions[tankIndex]
    const pump = calculatePumpPosition(tank, tankIndex)

    return `M ${tank.x} ${tank.y} L ${pump.x} ${pump.y}`
  }

  // 펌프에서 다음 탱크로의 경로 계산
  const calculatePumpToNextTankPath = (tankIndex: number) => {
    const pump = calculatePumpPosition(tankPositions[tankIndex], tankIndex)
    const nextTankIndex = (tankIndex + 1) % 6
    const nextTank = tankPositions[nextTankIndex]

    return `M ${pump.x} ${pump.y} L ${nextTank.x} ${nextTank.y}`
  }

  // 탱크6에서 본탱크로의 경로 계산
  const calculateTank6ToMainPath = () => {
    const tank6 = tankPositions[5]
    const pump6 = calculatePumpPosition(tank6, 5)

    return `M ${pump6.x} ${pump6.y} L ${mainTankPosition.x} ${mainTankPosition.y}`
  }

  // 본탱크에서 탱크1로의 경로 계산 수정
  const calculateMainToTank1Path = () => {
    const tank1 = tankPositions[0]
    
    // 본탱크 경계 위치 계산
    const mainTankEdgeX = mainTankPosition.x + mainTankRadius * ((tank1.x - mainTankPosition.x) / 
                          Math.sqrt(Math.pow(tank1.x - mainTankPosition.x, 2) + Math.pow(tank1.y - mainTankPosition.y, 2)))
    const mainTankEdgeY = mainTankPosition.y + mainTankRadius * ((tank1.y - mainTankPosition.y) / 
                          Math.sqrt(Math.pow(tank1.x - mainTankPosition.x, 2) + Math.pow(tank1.y - mainTankPosition.y, 2)))
    
    // 1번 탱크 경계 위치 계산
    const tank1EdgeX = tank1.x - (tankWidth/2) * ((tank1.x - mainTankPosition.x) / 
                      Math.sqrt(Math.pow(tank1.x - mainTankPosition.x, 2) + Math.pow(tank1.y - mainTankPosition.y, 2)))
    const tank1EdgeY = tank1.y - (tankHeight/2) * ((tank1.y - mainTankPosition.y) / 
                      Math.sqrt(Math.pow(tank1.x - mainTankPosition.x, 2) + Math.pow(tank1.y - mainTankPosition.y, 2)))

    return `M ${mainTankEdgeX} ${mainTankEdgeY} L ${tank1EdgeX} ${tank1EdgeY}`
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

  // 3way 밸브 경로 계산 함수 수정
  const calculate3WayPaths = () => {
    const tank6 = tankPositions[5]
    const pump6 = calculatePumpPosition(tank6, 5)
    const tank1 = tankPositions[0]
    
    // 6번 펌프 위치
    const pumpX = pump6.x
    const pumpY = pump6.y
    
    // 3way 밸브 위치 (T자 분기점)
    const valveX = valve1Position.x
    const valveY = valve1Position.y
    
    // 6번 탱크에서 3way 밸브로 직접 연결하는 경로 (수직선)
    const fromTank6ToValve = `M ${tank6.x} ${tank6.y} L ${valveX} ${valveY}`
    
    // 6번 펌프에서 3way 밸브로 가는 경로
    const fromPump6ToValve = `M ${pumpX} ${pumpY} L ${valveX} ${valveY}`
    
    // 3way 밸브에서 본탱크로 가는 경로 (직각으로 꺾어서)
    const fromValveToMain = `M ${valveX} ${valveY} L ${valveX} ${mainTankPosition.y} L ${mainTankPosition.x - mainTankRadius} ${mainTankPosition.y}`
    
    // 3way 밸브에서 1번 탱크로 가는 경로 (직각으로 꺾어서)
    const fromValveToTank1 = `M ${valveX} ${valveY} L ${tank1.x} ${valveY} L ${tank1.x} ${tank1.y + tankHeight/2}`
    
    return { fromTank6ToValve, fromPump6ToValve, fromValveToMain, fromValveToTank1 }
  }

  const { fromTank6ToValve, fromPump6ToValve, fromValveToMain, fromValveToTank1 } = calculate3WayPaths()

  // 화살표 위치 계산
  const calculateArrowPosition = (path: string, progress = 0.5) => {
    // SVG 경로에서 특정 지점의 좌표를 계산
    // 간단한 구현을 위해 시작점과 끝점 사이의 중간 지점을 사용
    const matches = path.match(/M\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+L\s+(\d+\.?\d*)\s+(\d+\.?\d*)/)
    if (!matches) return { x: 0, y: 0, angle: 0 }

    const x1 = Number.parseFloat(matches[1])
    const y1 = Number.parseFloat(matches[2])
    const x2 = Number.parseFloat(matches[3])
    const y2 = Number.parseFloat(matches[4])

    const x = x1 + (x2 - x1) * progress
    const y = y1 + (y2 - y1) * progress
    const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI

    return { x, y, angle }
  }

  return (
    <div className="relative w-full h-[800px] border rounded-lg p-4 bg-[#f8f4ff]">
      {/* 밸브 상태 텍스트 박스 추가 */}
      {tankData.valveStatusMessage && (
        <div className="absolute top-2 left-2 bg-white/90 p-1.5 rounded-md text-[9px] font-mono shadow-sm border border-gray-200">
          <span className="font-semibold">현재 밸브 상태:</span> {extractValveStatus(tankData.valveStatusMessage)}
        </div>
      )}

      <svg width="100%" height="100%" viewBox="0 0 1000 800" className="overflow-visible">
        {/* 배경 원 (가이드) */}
        <circle
          cx={centerX}
          cy={centerY}
          r={circleRadius}
          className="fill-none stroke-gray-100 stroke-2 stroke-dashed"
        />

        {/* 메인 탱크 (본탱크) */}
        <g>
          <rect
            x={mainTankPosition.x - mainTankRadius}
            y={mainTankPosition.y - mainTankRadius}
            width={mainTankRadius * 2}
            height={mainTankRadius * 2}
            rx="5"
            className={`stroke-gray-400 stroke-2 ${getTankColor(tankData.mainTank.status)}`}
          />
          <text x={mainTankPosition.x} y={mainTankPosition.y} textAnchor="middle" className="text-sm font-bold">
            {mainTankPosition.label}
          </text>
        </g>

        {/* 순환 파이프 (1->2->3->4->5) */}
        {[0, 1, 2, 3, 4].map((i) => {
          const fromTank = i + 1
          const toTank = i + 2
          return (
            <path
              key={`pipe-${fromTank}-${toTank}`}
              d={calculatePipePath(i, i + 1)}
              fill="none"
              className={getPipeColor(fromTank, toTank)}
              strokeWidth="12"
              strokeLinecap="round"
            />
          )
        })}

        {/* 3way 밸브 경로 수정 - 이미지와 정확히 같게 */}
        {/* 6번 탱크에서 3way 밸브로 직접 연결하는 경로 (수직선) */}
        <path
          d={fromTank6ToValve}
          fill="none"
          className={tankData.tanks[5].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* 6번 펌프에서 3way 밸브로 가는 경로 */}
        <path
          d={fromPump6ToValve}
          fill="none"
          className={tankData.tanks[5].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* 3way 밸브에서 본탱크로 가는 경로 */}
        <path
          d={fromValveToMain}
          fill="none"
          className={valve1 === 0 && tankData.tanks[5].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* 3way 밸브에서 1번 탱크로 가는 경로 */}
        <path
          d={fromValveToTank1}
          fill="none"
          className={valve1 === 1 && tankData.tanks[5].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-300"}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* 본탱크->1 파이프 (밸브2 제어) */}
        <path
          d={calculateMainToTank1Path()}
          fill="none"
          className={valve2 === 1 ? "stroke-blue-500" : "stroke-gray-300"}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* 탱크 1-6 및 펌프 */}
        {tankPositions.map((pos, index) => {
          const tankNum = index + 1
          const tank = tankData.tanks[index]
          const nextTankIndex = (index + 1) % 6
          const pumpPos = calculatePumpPosition(pos, nextTankIndex)

          return (
            <g key={tankNum}>
              {/* 탱크 */}
              <rect
                x={pos.x - tankWidth / 2}
                y={pos.y - tankHeight / 2}
                width={tankWidth}
                height={tankHeight}
                rx="5"
                className={`stroke-gray-400 stroke-2 ${getTankColor(tank.status)}`}
                fill="gray"
              />
              <text x={pos.x} y={pos.y} textAnchor="middle" className="text-sm font-bold text-white">
                {pos.label}
              </text>

              {/* 인버터 펌프 */}
              <circle
                cx={pumpPos.x}
                cy={pumpPos.y}
                r={pumpRadius}
                className={`stroke-gray-400 stroke-2`}
                fill={tank.pumpStatus === "ON" ? "#93c5fd" : "#e5e7eb"}
              />
              <text x={pumpPos.x} y={pumpPos.y - 5} textAnchor="middle" className="text-xs font-bold">
                IP_{tankNum}
              </text>
              <text x={pumpPos.x} y={pumpPos.y + 10} textAnchor="middle" className="text-xs font-bold">
                {tank.pumpStatus}
              </text>
            </g>
          )
        })}

        {/* 밸브 1 (3way 밸브) 수정 */}
        <g
          onClick={() => onValveChange(getNextValveState())}
          className="cursor-pointer"
          transform={`translate(${valve1Position.x}, ${valve1Position.y})`}
        >
          <polygon points="-30,-20 30,-20 0,20" className={`fill-yellow-50 stroke-yellow-400 stroke-2`} />
          <text x="0" y="-5" textAnchor="middle" className="text-xs font-bold">
            3way 밸브
          </text>
          <text x="0" y="10" textAnchor="middle" className="text-xs font-bold">
            {valve1 === 1 ? "추출순환(ON)" : "전체순환(OFF)"}
          </text>
        </g>

        {/* 밸브 2 - 본탱크에서 1번 탱크로 가는 경로 제어 */}
        <g
          onClick={() => onValveChange(getNextValveState())}
          className="cursor-pointer"
          transform={`translate(${valve2Position.x}, ${valve2Position.y})`}
        >
          <rect x="-20" y="-20" width="40" height="40" className={`fill-yellow-50 stroke-yellow-400 stroke-2`} />
          <text x="0" y="-5" textAnchor="middle" className="text-xs font-bold">
            2way 밸브
          </text>
          <text x="0" y="10" textAnchor="middle" className="text-xs font-bold">
            {valve2 === 1 ? "ON" : "OFF"}
          </text>
        </g>
      </svg>

      {/* 범례 */}
      <div className="absolute bottom-4 right-4 bg-white p-2 border rounded-md text-xs">
        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-gray-100 border border-gray-400 mr-2"></div>
          <span>비어있음 (5% 이하)</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-gray-200 border border-gray-400 mr-2"></div>
          <span>채워지는 중</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-gray-300 border border-gray-400 mr-2"></div>
          <span>가득 채워짐</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-blue-300 mr-2"></div>
          <span>펌프 ON</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-gray-200 mr-2"></div>
          <span>펌프 OFF</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-blue-500 mr-2"></div>
          <span>활성화된 경로</span>
        </div>
      </div>
    </div>
  )
} 