"use client"

import dynamic from "next/dynamic"
const Tank = dynamic(() => import("./components/tank"), { ssr: false })

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
//import { Tank } from "./components/tank"
import { getProcessMode } from "./utils/processMode"
import { mqttStore } from "./store/mqttStore"

interface ProcessInfo {
  process_info: string
  pump_id: number
  elapsed_time?: number
  remaining_time: number
  total_remaining?: number
  process_time?: number
  total_time?: number
}

interface TankState {
  fillPercentage: number
  elapsedTime: number
  remainingTime: number
  isActive: boolean
}

interface ProcessState {
  currentProcess: string
  processMode: string
  circulationMode: string
  tankConnection: string
}

export default function MQTTDashboard() {
  const [topic, setTopic] = useState("")
  const [message, setMessage] = useState("")
  const [mqttState, setMqttState] = useState(mqttStore.state)
  const [tankStates, setTankStates] = useState<TankState[]>(
    Array(6).fill({
      fillPercentage: 0,
      elapsedTime: 0,
      remainingTime: 0,
      isActive: false,
    }),
  )
  const [processState, setProcessState] = useState<ProcessState>({
    currentProcess: "대기중",
    processMode: "대기중",
    circulationMode: "--",
    tankConnection: "--",
  })
  const [currentPumpId, setCurrentPumpId] = useState<number | null>(null)
  const [messages, setMessages] = useState<{ topic: string; message: string; timestamp: string }[]>([])

  // MQTT 연결 상태 모니터링
  // useEffect(() => {
  //   if (mqttState.client?.connected && !mqttState.isConnected) {
  //     setMqttState((prev) => ({
  //       ...prev,
  //       isConnected: true,
  //     }))
  //   }
  // }, [mqttState.client?.connected, mqttState.isConnected]) // Added mqttState.isConnected to dependencies

  // MQTT 연결 설정 - 최초 마운트시에만 실행
  // useEffect(() => {
  //   mqttStore.actions.connect(mqttStore.state, setMqttState)

  //   return () => {
  //     if (mqttState.client) {
  //       mqttState.client.end(true)
  //     }
  //   }
  // }, [mqttStore, setMqttState]) // Added mqttStore and setMqttState to dependencies

  // // 메시지 처리 로직
  // const handleMessage = useCallback((topic: string, message: Buffer) => {
  //   const messageStr = message.toString()

  //   setMessages((prev) => {
  //     return [
  //       {
  //         topic,
  //         message: messageStr,
  //         timestamp: new Date().toLocaleTimeString(),
  //       },
  //     ]
  //   })

  //   try {
  //     if (topic === "extwork/t/process/progress") {
  //       const processInfo: ProcessInfo = JSON.parse(messageStr)
  //       const isWaiting = processInfo.process_info === "waiting"

  //       setCurrentPumpId(isWaiting ? null : processInfo.pump_id)
  //       setProcessState((prev) => ({
  //         ...prev,
  //         currentProcess: processInfo.process_info,
  //         processMode: getProcessMode(processInfo.process_info),
  //       }))

  //       if (processInfo.pump_id && processInfo.pump_id >= 1 && processInfo.pump_id <= 6) {
  //         const tankIndex = processInfo.pump_id - 1

  //         // fillPercentage 계산 로직 수정
  //         const fillPercentage = isWaiting
  //           ? 0
  //           : processInfo.elapsed_time && processInfo.remaining_time
  //             ? (processInfo.elapsed_time / (processInfo.elapsed_time + processInfo.remaining_time)) * 100
  //             : 0

  //         setTankStates((prev) => {
  //           const newStates = [...prev]
  //           newStates[tankIndex] = {
  //             fillPercentage: Math.min(fillPercentage, 100),
  //             elapsedTime: processInfo.elapsed_time || 0,
  //             remainingTime: processInfo.remaining_time,
  //             isActive: !isWaiting,
  //           }
  //           return newStates
  //         })
  //       }
  //     } else if (topic === "extwork/valve/state") {
  //       const valveAMatch = messageStr.match(/valveA=(\w+)$$([\p{L}_]+)$$/u)
  //       const valveBMatch = messageStr.match(/valveB=(\w+)$$([\p{L}_]+)$$/u)

  //       if (valveAMatch && valveBMatch) {
  //         setProcessState((prev) => ({
  //           ...prev,
  //           circulationMode: valveAMatch[2],
  //           tankConnection: valveBMatch[2],
  //         }))
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Error parsing message:", error)
  //   }
  // }, [])


  // MQTT 연결 상태 모니터링
useEffect(() => {
  if (mqttState.client?.connected && !mqttState.isConnected) {
    setMqttState((prevState) => ({
      ...prevState,
      isConnected: true,
    }))
  }
}, [mqttState.client?.connected, mqttState.isConnected]) // ✅ mqttState.client?.connected를 명시적으로 추가

// MQTT 연결 설정 - 최초 마운트시에만 실행
useEffect(() => {
  mqttStore.actions.connect(mqttState, setMqttState) // ✅ mqttStore.state → mqttState로 변경 (리렌더링 반영)
  
  return () => {
    if (mqttState.client) {
      mqttState.client.end(true)
    }
  }
}, [mqttState.client]) // ✅ mqttState.client를 의존성 배열에 추가, mqttStore 제거

// 메시지 처리 로직
const handleMessage = useCallback((topic: string, message: Buffer) => {
  const messageStr = message.toString()

  setMessages((currentMessages) => [
    {
      topic,
      message: messageStr,
      timestamp: new Date().toLocaleTimeString(),
    },
    ...currentMessages,
  ])

  try {
    if (topic === "extwork/t/process/progress") {
      const processInfo: ProcessInfo = JSON.parse(messageStr)
      const isWaiting = processInfo.process_info === "waiting"

      setCurrentPumpId(isWaiting ? null : processInfo.pump_id)
      setProcessState((currentState) => ({
        ...currentState,
        currentProcess: processInfo.process_info,
        processMode: getProcessMode(processInfo.process_info),
      }))

      if (processInfo.pump_id && processInfo.pump_id >= 1 && processInfo.pump_id <= 6) {
        const tankIndex = processInfo.pump_id - 1

        const fillPercentage = isWaiting
          ? 0
          : processInfo.elapsed_time && processInfo.remaining_time
            ? (processInfo.elapsed_time / (processInfo.elapsed_time + processInfo.remaining_time)) * 100
            : 0

        setTankStates((currentStates) => {
          const newStates = [...currentStates]
          newStates[tankIndex] = {
            fillPercentage: Math.min(fillPercentage, 100),
            elapsedTime: processInfo.elapsed_time || 0,
            remainingTime: processInfo.remaining_time,
            isActive: !isWaiting,
          }
          return newStates
        })
      }
    }
  } catch (error) {
    console.error("Error parsing message:", error)
  }
}, [])


  // 메시지 핸들러 설정
  useEffect(() => {
    const client = mqttState.client
    if (!client) return

    client.on("message", handleMessage)

    return () => {
      client.removeListener("message", handleMessage)
    }
  }, [mqttState.client, handleMessage])

  const handlePublish = async () => {
    if (topic && message && mqttState.client) {
      mqttState.client.publish(topic, message)
      setMessage("")
    }
  }

  const handleSubscribe = async () => {
    if (topic && mqttState.client) {
      mqttState.client.subscribe(topic)
      setTopic("")
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">ExtWork 대시보드</h1>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr,300px] gap-4">
          <Card>
            <CardHeader>
              <CardTitle>메시지 발행</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">토픽</label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="토픽 입력 (예: sensors/temperature)"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">메시지</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="발행할 메시지 입력"
                />
              </div>
              <Button onClick={handlePublish} className="w-full">
                발행
              </Button>
            </CardContent>
          </Card>

          <Card className="w-[300px] ml-auto">
            <CardHeader>
              <CardTitle>MQTT 연결 상태</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="구독할 토픽 입력" />
                <Button onClick={handleSubscribe}>구독</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>공정(progress topic)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between gap-4">
              <div className="flex-1 h-[100px] overflow-y-auto">
                {messages.length > 0 && (
                  <div className="bg-secondary p-1.5 rounded-md text-[11px]">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{messages[messages.length - 1].topic}</span>
                      <span>{messages[messages.length - 1].timestamp}</span>
                    </div>
                    <div className="mt-0.5 break-all whitespace-pre-wrap leading-tight">
                      {messages[messages.length - 1].message}
                    </div>
                  </div>
                )}
              </div>
              <div className="w-[200px] space-y-2">
                <label className="text-sm font-medium">연결 상태</label>
                <div
                  className={`p-2 rounded-md ${
                    mqttState.isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {mqttState.isConnected ? "Connected" : "Disconnected"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>기기 상태</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] flex flex-col">
              <div className="bg-secondary p-3 rounded-md mb-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">현재 공정</span>
                    <span className="text-sm text-muted-foreground">{processState.currentProcess}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">공정 모드</span>
                    <span className="text-sm text-muted-foreground">{processState.processMode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">순환 모드</span>
                    <span className="text-sm text-muted-foreground">{processState.circulationMode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">본탱크 연결</span>
                    <span className="text-sm text-muted-foreground">{processState.tankConnection}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-auto">
                {tankStates.map((state, index) => (
                  <Tank
                    key={index}
                    id={index + 1}
                    fillPercentage={state.fillPercentage}
                    elapsedTime={state.elapsedTime}
                    remainingTime={state.remainingTime}
                    isActive={state.isActive}
                    isCurrentPump={currentPumpId === index + 1}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

