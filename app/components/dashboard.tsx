"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TankSystem from "@/app/components/tank-system"
import MqttClient from "@/lib/mqtt-client"
import {
  getPumpCommandTopic,
  getPumpStateTopic,
  getTankLevelTopic,
  getPumpOverallStateTopic,
  getAllSubscriptionTopics,
  parseTankLevelMessage,
  parseValveStateMessage,
  parsePumpStateMessage,
  getDefaultTankSystemData,
  VALVE_INPUT_TOPIC,
  VALVE_STATE_TOPIC,
  PROCESS_PROGRESS_TOPIC,
  ERROR_TOPIC,
  Tank,
  TankSystemData
} from "@/lib/mqtt-topics"

export default function Dashboard() {
  const [topic, setTopic] = useState(VALVE_INPUT_TOPIC)
  const [message, setMessage] = useState("")
  const [mqttStatus, setMqttStatus] = useState("연결 끊김")
  const [searchTopic, setSearchTopic] = useState("")
  const [mqttClient, setMqttClient] = useState<any>(null)
  const [progressData, setProgressData] = useState<string>("데이터 없음")
  const [progressStatus, setProgressStatus] = useState<"connected" | "disconnected">("disconnected")
  const [lastErrors, setLastErrors] = useState<string[]>([])
  
  // 추출 진행 메시지를 저장할 상태
  const [progressMessages, setProgressMessages] = useState<Array<{timestamp: number, message: string}>>([])
  
  // 기본 탱크 시스템 데이터로 초기화 (6개 탱크)
  const [tankData, setTankData] = useState<TankSystemData>(getDefaultTankSystemData(6))

  // MQTT 클라이언트 초기화
  useEffect(() => {
    const client = new MqttClient()

    client.onConnect = () => {
      setMqttStatus("연결됨")

      // 모든 토픽 구독 (6개 인버터 기준)
      const topics = getAllSubscriptionTopics(6)
      topics.forEach(topic => {
        client.subscribe(topic)
      })
      
      console.log("구독한 토픽 목록:", topics)
    }

    client.onDisconnect = () => {
      setMqttStatus("연결 끊김")
      setProgressStatus("disconnected")
    }

    client.onMessage = (topic: string, message: string) => {
      handleMqttMessage(topic, message)
    }

    setMqttClient(client)
    
    // 자동으로 연결 시작
    client.connect()

    // 언마운트 시 정리
    return () => {
      client.disconnect()
    }
  }, [])

  // MQTT 메시지 처리
  const handleMqttMessage = (topic: string, message: string) => {
    console.log(`메시지 수신: ${topic} - ${message}`)

    // 펌프 상태 토픽 처리
    const pumpStateMatch = topic.match(/extwork\/inverter(\d+)\/state/)
    if (pumpStateMatch) {
      const inverterId = Number.parseInt(pumpStateMatch[1])
      const pumpStatus = parsePumpStateMessage(message)

      // 인버터에 해당하는 탱크 업데이트 (1:1 매핑)
      setTankData((prev) => {
        const updatedTanks = prev.tanks.map((tank) => {
          if (tank.id === inverterId) {  // id와 inverterId가 동일하게 매핑됨
            return { ...tank, pumpStatus }
          }
          return tank
        })

        return { ...prev, tanks: updatedTanks }
      })
      return
    }

    // 탱크 수위 토픽 처리 - extwork/inverter%d/tank%d_level 형식
    const tankLevelMatch = topic.match(/extwork\/inverter(\d+)\/tank(\d+)_level/)
    if (tankLevelMatch) {
      const inverterId = Number.parseInt(tankLevelMatch[1])
      const tankId = Number.parseInt(tankLevelMatch[2])
      
      // 인버터 ID를 기준으로 탱크 찾기 (1:1 매핑)
      // 배열 인덱스는 0부터 시작하므로 ID-1로 접근
      const tankIndex = inverterId - 1
      
      // 메시지 파싱
      const { level, status } = parseTankLevelMessage(message)
      
      // 해당 탱크 업데이트
      setTankData(prev => {
        const updatedTanks = [...prev.tanks]
        if (updatedTanks[tankIndex]) {
          updatedTanks[tankIndex] = {
            ...updatedTanks[tankIndex],
            status,
            level
          }
        }
        return { ...prev, tanks: updatedTanks }
      })
      
      return
    }

    // 펌프 전체 상태 토픽 처리
    const overallStateMatch = topic.match(/extwork\/inverter(\d+)\/overallstate/)
    if (overallStateMatch) {
      const inverterId = Number.parseInt(overallStateMatch[1])
      console.log(`인버터 ${inverterId}의 전체 상태 업데이트:`, message)
      
      // 메인 탱크 상태 정보가 포함되어 있을 경우
      if (message.includes("main") || message.includes("본탱크")) {
        let status: "empty" | "filling" | "full" = "empty"
        let level = 0
        
        if (message.includes("full") || message.includes("가득")) {
          status = "full"
          level = 100
        } else if (message.includes("filling") || message.includes("채워")) {
          status = "filling"
          level = 50
        }
        
        setTankData(prev => ({
          ...prev,
          mainTank: {
            status,
            level
          }
        }))
      }
      
      return
    }

    // 밸브 상태 토픽 처리
    if (topic === VALVE_STATE_TOPIC || topic === VALVE_INPUT_TOPIC) {
      // 1000, 0100, 0000 형식의 메시지를 처리
      const { valveState } = parseValveStateMessage(message)
      if (valveState) {
        setTankData((prev) => ({ ...prev, valveState }))
      }
      return
    }
    
    // 공정 진행 상황 토픽 처리
    if (topic === PROCESS_PROGRESS_TOPIC) {
      setProgressData(message)
      setProgressStatus("connected")
      
      // 추출 진행 메시지 추가
      setProgressMessages(prev => {
        const newMessages = [
          { timestamp: Date.now(), message },
          ...prev
        ].slice(0, 2) // 최신 2개만 유지
        return newMessages
      })
      
      return
    }
    
    // 오류 토픽 처리
    if (topic === ERROR_TOPIC) {
      setLastErrors(prev => {
        const newErrors = [message, ...prev].slice(0, 5) // 최근 5개 오류만 유지
        return newErrors
      })
      return
    }
  }

  // 밸브 상태 변경
  const changeValveState = (newState: string) => {
    // MQTT 메시지 발행
    if (mqttClient) {
      let mqttMessage = ""
      switch (newState) {
        case "1000":
          mqttMessage = "1000"
          break
        case "0100":
          mqttMessage = "0100"
          break
        case "0000":
          mqttMessage = "0000"
          break
      }

      if (mqttMessage) {
        mqttClient.publish(VALVE_INPUT_TOPIC, mqttMessage)
      }
    }
  }

  // MQTT 브로커에 연결
  const connectMqtt = () => {
    if (mqttClient) {
      mqttClient.connect()
    }
  }

  // 메시지 발행
  const publishMessage = () => {
    if (!topic || !message || !mqttClient) return

    mqttClient.publish(topic, message)
    setMessage("")
  }

  // 펌프 상태 변경 함수
  const togglePump = (inverterId: number, newState: "ON" | "OFF") => {
    if (mqttClient) {
      const state = newState === "ON" ? "1" : "0"
      mqttClient.publish(getPumpCommandTopic(inverterId), state)
    }
  }

  // 토픽 구독 함수
  const subscribeToTopic = () => {
    if (!searchTopic || !mqttClient) return
    
    mqttClient.subscribe(searchTopic)
    setSearchTopic("")
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="tanks">
        <TabsList className="mb-4">
          <TabsTrigger value="tanks">탱크 시스템</TabsTrigger>
          <TabsTrigger value="mqtt">MQTT 제어</TabsTrigger>
        </TabsList>

        <TabsContent value="tanks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>상태: {mqttStatus}</span>
                <Badge variant={mqttStatus === "연결됨" ? "default" : "destructive"}>{mqttStatus}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2 justify-end">
                {tankData.tanks.map((tank) => (
                  <Button 
                    key={tank.id} 
                    variant={tank.pumpStatus === "ON" ? "default" : "outline"}
                    onClick={() => togglePump(tank.id, tank.pumpStatus === "ON" ? "OFF" : "ON")}
                    size="sm" 
                    className="text-xs"
                  >
                    펌프 {tank.id}: {tank.pumpStatus}
                  </Button>
                ))}
              </div>
              <TankSystem 
                tankData={tankData} 
                onValveChange={changeValveState}
                progressMessages={progressMessages}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mqtt" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>메시지 발행</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="topic" className="block text-sm font-medium mb-1">
                      토픽
                    </label>
                    <Input
                      id="topic"
                      placeholder="토픽 입력 (예: extwork/valve/input)"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium mb-1">
                      메시지
                    </label>
                    <Textarea
                      id="message"
                      placeholder="발행할 메시지 입력 (예: 1000, 0100, 0000)"
                      className="min-h-[100px]"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  <Button className="w-full" onClick={publishMessage} disabled={!topic || !message}>
                    발행
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>MQTT 연결 상태</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Input
                    placeholder="구독할 토픽 입력"
                    value={searchTopic}
                    onChange={(e) => setSearchTopic(e.target.value)}
                    className="flex-1 mr-2"
                  />
                  <Button onClick={subscribeToTopic}>구독</Button>
                </div>

                <div className="flex items-center justify-between">
                  <span>연결 상태</span>
                  <Badge variant={mqttStatus === "연결됨" ? "default" : "destructive"}>{mqttStatus}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>공정 상태 (extwork/extraction/progress)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-2">
                <Badge variant={progressStatus === "connected" ? "default" : "destructive"}>
                  {progressStatus === "connected" ? "연결됨" : "연결 끊김"}
                </Badge>
              </div>
              <div className="h-32 border rounded-md flex items-center justify-center text-muted-foreground p-4 overflow-auto">
                {progressData !== "데이터 없음" ? (
                  <pre className="whitespace-pre-wrap w-full">{progressData}</pre>
                ) : (
                  <span>데이터 없음</span>
                )}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>최근 오류 (extwork/extraction/error)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md p-4 max-h-64 overflow-auto">
                {lastErrors.length > 0 ? (
                  <ul className="space-y-2">
                    {lastErrors.map((error, index) => (
                      <li key={index} className="p-2 bg-red-50 border border-red-200 rounded">
                        {error}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center justify-center text-muted-foreground h-32">
                    오류 메시지 없음
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 