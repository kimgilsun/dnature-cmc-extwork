"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tank } from "./components/tank"
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
useEffect(() => {
  // 클라이언트가 연결되어 있고, 현재 연결 상태가 false일 때
  if (mqttState.client?.connected && !mqttState.isConnected) {
    // 연결 상태를 true로 업데이트
    setMqttState((prevState) => ({
      ...prevState,
      isConnected: true,
    }));
  }
}, [mqttState.client, mqttState.isConnected]); // ✅  연결상태 모니터링만 , mqttState.isConnected 의존성 배열에 추가


// MQTT 연결 설정 - 최초 마운트시에만 실행
useEffect(() => {
  // 클라이언트가 없을 때만 연결 시도
  if (!mqttState.client) { // ✅ 클라이언트가 없을 때만 연결을 시도하도록 수정
  mqttStore.actions.connect(mqttState, setMqttState); // ✅ mqttStore.state → mqttState로 변경 (리렌더링 반영)
  }
  
  return () => {
    // 컴포넌트가 언마운트될 때 클라이언트 종료
    if (mqttState.client) {
      mqttState.client.end(true); // 클라이언트 연결 종료
    }
  };
}, [mqttState.client]); // ✅ 의존성 배열 추가(, mqttState를 추가하면 disconnected)

// 메시지 처리 로직
const handleMessage = useCallback((topic: string, message: Buffer) => {
  console.log("📩 메시지 수신:", topic, message.toString()); // 추가
  const messageStr = message.toString();
 
  // 모든 메시지를 상태에 추가하여 최신순으로 업데이트
  setMessages((currentMessages) => [
    {
      topic, // 메세지의 토픽
      message: messageStr, //변환된 메시지 문자열
      timestamp: new Date().toLocaleTimeString(), // 현제 시간
    },
    ...currentMessages, // 기존 메시지 목록을 포함
  ]);


  try {
    // 특정 토픽에 대한 처리
    if (topic === "extwork/t/process/progress") {
      const processInfo: ProcessInfo = JSON.parse(messageStr); // 메시지를 JSON으로 파싱
      const isWaiting = processInfo.process_info === "waiting"; // 공정 상태 확인

      // 현재 펌프 ID 업데이트
      setCurrentPumpId(isWaiting ? null : processInfo.pump_id);

      // 공정 상태 업데이트
      setProcessState((currentState) => ({
        ...currentState,
        currentProcess: processInfo.process_info, // 현재 공정 정보 업데이트
        processMode: getProcessMode(processInfo.process_info), // 공정 모드 업데이트
      }));

      // 펌프 ID가 1에서 6 사이일 때 상태 업데이트
      if (processInfo.pump_id && processInfo.pump_id >= 1 && processInfo.pump_id <= 6) {
        const tankIndex = processInfo.pump_id - 1; // 탱크 인덱스 계산

        // 채워진 비율 계산
        const fillPercentage = isWaiting
          ? 0
          : processInfo.elapsed_time && processInfo.remaining_time
            ? (processInfo.elapsed_time / (processInfo.elapsed_time + processInfo.remaining_time)) * 100
            : 0;

        // 탱크 상태 업데이트    
        setTankStates((currentStates) => {
          const newStates = [...currentStates]; // 현재 상태 복사
          newStates[tankIndex] = {
            fillPercentage: Math.min(fillPercentage, 100), // 최대 100%로 제한
            elapsedTime: processInfo.elapsed_time || 0, // 경과 시간
            remainingTime: processInfo.remaining_time, // 남은 시간
            isActive: !isWaiting, // 대기 상태 여부
          };
          return newStates // 새로운 상태 반환
        });
      }
    }
  } catch (error) {
    console.error("Error parsing message:", error); // 메시지 파싱 오류 처리
  }
}, [setMessages, setCurrentPumpId, setProcessState, setTankStates]); // 필요한 상태 업데이트 함수 추가


  // 메시지 핸들러 설정
  useEffect(() => {
    const client = mqttState.client;
    if (!client) return;
    
    // 메시지 핸들러 등록 
    client.on("message", handleMessage);
   
    // 클린업 함수: 컴포넌트 언마운트 시 핸들러 제거
    return () => {
      client.removeListener("message", handleMessage);
    };
  }, [mqttState.client, handleMessage]); // mqttState.client을 의존성 배열에 추가

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
                      <span>{messages[0].topic}</span> {/* 변경 부분 */}
                      <span>{messages[0].timestamp}</span> {/* 변경 부분 */}
                    </div>
                    <div className="mt-0.5 break-all whitespace-pre-wrap leading-tight">
                      {messages[0].message} {/* 변경 부분 */}
                    </div>
                  </div>
                )}
              </div>
              <div className="w-[200px] space-y-2">
                <label className="text-sm font-medium">연결 상태</label>
                <div
                  className={`p-1 rounded-sm w-16 ${ // className={`p-2 rounded-md ${
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

