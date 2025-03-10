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
  }
  onValveChange: (newState: string) => void
}

export default function TankSystem({ tankData, onValveChange }: TankSystemProps) {
  // 상태에 따른 탱크 색상 가져오기 함수를 수정하여 모든 탱크를 회색으로 변경
  const getTankColor = (status: string) => {
    switch (status) {
      case "empty":
        return "bg-gray-200"
      case "filling":
        return "bg-gray-300"
      case "full":
        return "bg-gray-400"
      default:
        return "bg-gray-200"
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
    return isPathActive(path) ? "stroke-blue-500" : "stroke-gray-200"
  }

  // 펌프 상태에 따른 파이프 색상 가져오기
  const getPipeColor = (fromTank: number, toTank: number) => {
    // 순환 방향: 1->2->3->4->5->6->1
    // 특별한 경우: 6->본탱크->1 (밸브 상태에 따라)

    // 밸브 상태에 따른 특별 경로 처리
    if (fromTank === 6) {
      if (valve1 === 0) {
        // 6->본탱크 경로
        return tankData.tanks[5].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-200"
      } else {
        // 6->1 직접 경로
        return tankData.tanks[5].pumpStatus === "ON" ? "stroke-blue-500" : "stroke-gray-200"
      }
    }

    // 본탱크->1 경로
    if (fromTank === 0 && toTank === 1) {
      return valve2 === 1 ? "stroke-blue-500" : "stroke-gray-200"
    }

    // 일반 순환 경로 (n->n+1)
    if (toTank === fromTank + 1 || (fromTank === 6 && toTank === 1)) {
      const tankIndex = fromTank - 1
      return tankIndex >= 0 && tankIndex < tankData.tanks.length && tankData.tanks[tankIndex].pumpStatus === "ON"
        ? "stroke-blue-500"
        : "stroke-gray-200"
    }

    return "stroke-gray-200" // 기본값
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

  // 본탱크에서 탱크1로의 경로 계산
  const calculateMainToTank1Path = () => {
    const tank1 = tankPositions[0]

    return `M ${mainTankPosition.x} ${mainTankPosition.y} L ${tank1.x} ${tank1.y}`
  }

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
      {/* SVG 기반 탱크 시스템 */}
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
            className={`stroke-gray-600 stroke-2 ${getTankColor(tankData.mainTank.status)} fill-current`}
          />
          <text x={mainTankPosition.x} y={mainTankPosition.y} textAnchor="middle" className="text-sm font-bold">
            {mainTankPosition.label}
          </text>
        </g>

        {/* 순환 파이프 (1->2->3->4->5->6->1) */}
        {[0, 1, 2, 3, 4].map((i) => {
          const fromTank = i + 1
          const toTank = i + 2
          return (
            <path
              key={`pipe-${fromTank}-${toTank}`}
              d={calculatePipePath(i, i + 1)}
              fill="none"
              className={getPipeColor(fromTank, toTank)}
              strokeWidth="8"
              strokeLinecap="round"
            />
          )
        })}

        {/* 6->1 파이프 (특별 처리) */}
        <path
          d={calculatePipePath(5, 0)}
          fill="none"
          className={valve1 === 1 ? getPipeColor(6, 1) : "stroke-gray-200"}
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* 6->본탱크 파이프 (밸브1 제어, 0일 때 활성화) */}
        <path
          d={calculateTank6ToMainPath()}
          fill="none"
          className={getValvePipeColor("tank6ToMain")}
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* 본탱크->1 파이프 (밸브2 제어, 1일 때 활성화) */}
        <path
          d={calculateMainToTank1Path()}
          fill="none"
          className={getValvePipeColor("mainToTank1")}
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* 화살표 애니메이션 */}
        {/* 1->2->3->4->5->6 화살표 */}
        {[0, 1, 2, 3, 4].map((i) => {
          const fromTank = i + 1
          const toTank = i + 2
          const tankIndex = fromTank - 1

          if (tankData.tanks[tankIndex]?.pumpStatus === "ON") {
            const path = calculatePipePath(i, i + 1)
            const arrowPos = calculateArrowPosition(path)

            return (
              <motion.path
                key={`arrow-${fromTank}-${toTank}`}
                d={`M 0 -10 L 10 0 L 0 10 Z`}
                fill="#2563eb"
                transform={`translate(${arrowPos.x}, ${arrowPos.y}) rotate(${arrowPos.angle})`}
                animate={{
                  x: [0, 10, 0],
                  y: [0, 0, 0],
                }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
              />
            )
          }
          return null
        })}

        {/* 6->1 화살표 (밸브1 = 1일 때) */}
        {valve1 === 1 &&
          tankData.tanks[5]?.pumpStatus === "ON" &&
          (() => {
            const path = calculatePipePath(5, 0)
            const arrowPos = calculateArrowPosition(path)

            return (
              <motion.path
                d={`M 0 -10 L 10 0 L 0 10 Z`}
                fill="#2563eb"
                transform={`translate(${arrowPos.x}, ${arrowPos.y}) rotate(${arrowPos.angle})`}
                animate={{
                  x: [0, 10, 0],
                  y: [0, 0, 0],
                }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
              />
            )
          })()}

        {/* 6->본탱크 화살표 (밸브1 = 0일 때) */}
        {isPathActive("tank6ToMain") &&
          tankData.tanks[5]?.pumpStatus === "ON" &&
          (() => {
            const path = calculateTank6ToMainPath()
            const arrowPos = calculateArrowPosition(path)

            return (
              <motion.path
                d={`M 0 -10 L 10 0 L 0 10 Z`}
                fill="#2563eb"
                transform={`translate(${arrowPos.x}, ${arrowPos.y}) rotate(${arrowPos.angle})`}
                animate={{
                  x: [0, 10, 0],
                  y: [0, 0, 0],
                }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
              />
            )
          })()}

        {/* 본탱크->1 화살표 (밸브2 = 1일 때) */}
        {isPathActive("mainToTank1") &&
          (() => {
            const path = calculateMainToTank1Path()
            const arrowPos = calculateArrowPosition(path)

            return (
              <motion.path
                d={`M 0 -10 L 10 0 L 0 10 Z`}
                fill="#2563eb"
                transform={`translate(${arrowPos.x}, ${arrowPos.y}) rotate(${arrowPos.angle})`}
                animate={{
                  x: [0, 10, 0],
                  y: [0, 0, 0],
                }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5 }}
              />
            )
          })()}

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
                className={`stroke-gray-600 stroke-2 ${getTankColor(tank.status)} fill-current`}
              />
              <text x={pos.x} y={pos.y} textAnchor="middle" className="text-sm font-bold">
                {pos.label}
              </text>

              {/* 인버터 펌프 */}
              <circle
                cx={pumpPos.x}
                cy={pumpPos.y}
                r={pumpRadius}
                className={`stroke-gray-600 stroke-2 ${tank.pumpStatus === "ON" ? "fill-green-200" : "fill-gray-200"}`}
              />
              <text x={pumpPos.x} y={pumpPos.y - 5} textAnchor="middle" className="text-xs font-bold">
                인버터 펌프{tankNum}
              </text>
              <text x={pumpPos.x} y={pumpPos.y + 10} textAnchor="middle" className="text-xs font-bold">
                {tank.pumpStatus}
              </text>
            </g>
          )
        })}

        {/* 밸브 1 (3way 밸브) - 6번 탱크에서 나온 액체가 본탱크로 갈지 1번 탱크로 갈지 결정 */}
        <g
          onClick={() => onValveChange(getNextValveState())}
          className="cursor-pointer"
          transform={`translate(${valve1Position.x}, ${valve1Position.y})`}
        >
          <polygon points="-30,-20 30,-20 0,20" className={`fill-yellow-100 stroke-gray-600 stroke-2`} />
          <text x="0" y="-5" textAnchor="middle" className="text-xs font-bold">
            3way 밸브
          </text>
          <text x="0" y="10" textAnchor="middle" className="text-xs font-bold">
            {valve1 === 1 ? "1번 탱크로" : "본탱크로"}
          </text>
        </g>

        {/* 밸브 2 - 본탱크에서 1번 탱크로 가는 경로 제어 */}
        <g
          onClick={() => onValveChange(getNextValveState())}
          className="cursor-pointer"
          transform={`translate(${valve2Position.x}, ${valve2Position.y})`}
        >
          <rect x="-20" y="-20" width="40" height="40" className={`fill-yellow-100 stroke-gray-600 stroke-2`} />
          <text x="0" y="-5" textAnchor="middle" className="text-xs font-bold">
            2way 밸브
          </text>
          <text x="0" y="10" textAnchor="middle" className="text-xs font-bold">
            {valve2 === 1 ? "ON" : "OFF"}
          </text>
        </g>

        {/* 현재 밸브 상태 표시 */}
        <g>
          <rect x="20" y="20" width="200" height="60" rx="5" className="fill-white stroke-gray-300 stroke-1" />
          <text x="120" y="50" textAnchor="middle" className="text-sm font-bold">
            {getValveStateText()}
          </text>
        </g>

        {/* 순환 경로 표시 */}
        <g>
          {/* 1000 상태 (추출 순환) 경로 표시 */}
          {valve1 === 1 && valve2 === 0 && (
            <path
              d={`M ${tankPositions[0].x} ${tankPositions[0].y} 
                  L ${tankPositions[1].x} ${tankPositions[1].y}
                  L ${tankPositions[2].x} ${tankPositions[2].y}
                  L ${tankPositions[3].x} ${tankPositions[3].y}
                  L ${tankPositions[4].x} ${tankPositions[4].y}
                  L ${tankPositions[5].x} ${tankPositions[5].y}
                  L ${tankPositions[0].x} ${tankPositions[0].y}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeDasharray="10,5"
              strokeOpacity="0.7"
            />
          )}

          {/* 0100 상태 (전체 순환) 경로 표시 */}
          {valve1 === 0 && valve2 === 1 && (
            <path
              d={`M ${tankPositions[0].x} ${tankPositions[0].y} 
                  L ${tankPositions[1].x} ${tankPositions[1].y}
                  L ${tankPositions[2].x} ${tankPositions[2].y}
                  L ${tankPositions[3].x} ${tankPositions[3].y}
                  L ${tankPositions[4].x} ${tankPositions[4].y}
                  L ${tankPositions[5].x} ${tankPositions[5].y}
                  L ${mainTankPosition.x} ${mainTankPosition.y}
                  L ${tankPositions[0].x} ${tankPositions[0].y}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeDasharray="10,5"
              strokeOpacity="0.7"
            />
          )}

          {/* 0000 상태 (본탱크 수집) 경로 표시 */}
          {valve1 === 0 && valve2 === 0 && (
            <path
              d={`M ${tankPositions[5].x} ${tankPositions[5].y}
                  L ${mainTankPosition.x} ${mainTankPosition.y}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeDasharray="10,5"
              strokeOpacity="0.7"
            />
          )}
        </g>
      </svg>

      {/* 범례 */}
      <div className="absolute bottom-4 right-4 bg-white p-2 border rounded-md text-xs">
        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-gray-200 mr-2"></div>
          <span>비어있음 (5% 이하)</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-gray-300 mr-2"></div>
          <span>채워지는 중</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-gray-400 mr-2"></div>
          <span>가득 채워짐</span>
        </div>
        <div className="flex items-center mb-1">
          <div className="w-4 h-4 bg-green-200 mr-2"></div>
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

      {/* 설명 텍스트 */}
      <div className="absolute top-4 left-4 bg-white p-2 border rounded-md text-xs max-w-xs">
        <p className="font-bold mb-2">밸브 상태 설명:</p>
        <p className="mb-1">1000: 추출 순환 - 본탱크를 통과하지 않고 6개 탱크만 순환 (1→2→3→4→5→6→1)</p>
        <p className="mb-1">0100: 전체 순환 - 본탱크를 포함한 전체 순환 (1→2→3→4→5→6→본탱크→1)</p>
        <p>0000: 본탱크 수집 - 본탱크로만 흐름, 본탱크에서 출구가 닫혀 있어 모든 액체가 본탱크에 모임</p>
      </div>
    </div>
  )
} 