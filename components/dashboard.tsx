"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import TankSystem from "@/components/tank-system"

// Tank 인터페이스 정의 (원래 TankSystem 컴포넌트에서 사용하던 것과 동일한 구조)
interface Tank {
  id: number
  level: number
  status: "empty" | "filling" | "full"
  pumpStatus: "ON" | "OFF"
  inverter: number
}

export default function Dashboard() {
  const [topic, setTopic] = useState("extwork/valve/input")
  const [message, setMessage] = useState("")
  const [mqttStatus, setMqttStatus] = useState("연결 끊김")
  const [searchTopic, setSearchTopic] = useState("")
  const [mqttClient, setMqttClient] = useState<any>(null)
  const [tankData, setTankData] = useState({
    mainTank: { level: 0, status: "empty" as "empty" | "filling" | "full" },
    tanks: [
      { id: 1, level: 0, status: "empty" as "empty" | "filling" | "full", pumpStatus: "OFF" as "ON" | "OFF", inverter: 1 },
      { id: 2, level: 0, status: "empty" as "empty" | "filling" | "full", pumpStatus: "OFF" as "ON" | "OFF", inverter: 1 },
      { id: 3, level: 0, status: "empty" as "empty" | "filling" | "full", pumpStatus: "OFF" as "ON" | "OFF", inverter: 2 },
      { id: 4, level: 0, status: "empty" as "empty" | "filling" | "full", pumpStatus: "OFF" as "ON" | "OFF", inverter: 2 },
      { id: 5, level: 0, status: "empty" as "empty" | "filling" | "full", pumpStatus: "OFF" as "ON" | "OFF", inverter: 3 },
      { id: 6, level: 0, status: "empty" as "empty" | "filling" | "full", pumpStatus: "OFF" as "ON" | "OFF", inverter: 3 },
    ] as Tank[],
    valveState: "1000", // 기본값: 추출 순환 (1000)
  })

  // MQTT 클라이언트 초기화
  useEffect(() => {
    // 동적으로 MQTT 클라이언트 모듈 로드
    import('@/lib/mqtt-client').then(module => {
      const createMqttClient = module.default;
      
      // MQTT 클라이언트 생성
      const client = createMqttClient({
        onConnect: () => {
          setMqttStatus("연결됨")

          // 모든 관련 토픽 구독
          for (let i = 1; i <= 3; i++) {
            client.subscribe(`extwork/inverter${i}/state`)
            for (let j = 1; j <= 2; j++) {
              client.subscribe(`extwork/inverter${i}/tank${j}_level`)
            }
            client.subscribe(`extwork/inverter${i}/overallstate`)
          }
          client.subscribe("extwork/valve/input")
        },
        onDisconnect: () => {
          setMqttStatus("연결 끊김")
        },
        onMessage: (topic: string, message: string) => {
          handleMqttMessage(topic, message)
        },
        onError: (error: Error) => {
          console.error("MQTT 오류:", error)
        }
      });

      // 자동으로 연결 시작
      client.connect()
      
      setMqttClient(client)
    }).catch(error => {
      console.error("MQTT 모듈 로드 실패:", error)
    });

    // 언마운트 시 정리
    return () => {
      if (mqttClient) {
        mqttClient.disconnect()
      }
    }
  }, [])

  // MQTT 메시지 처리
  const handleMqttMessage = (topic: string, message: string) => {
    console.log(`메시지 수신: ${topic} - ${message}`)

    // 토픽을 파싱하여 인버터 및 탱크 ID 추출
    const pumpStateMatch = topic.match(/extwork\/inverter(\d+)\/state/)
    const tankLevelMatch = topic.match(/extwork\/inverter(\d+)\/tank(\d+)_level/)
    const overallStateMatch = topic.match(/extwork\/inverter(\d+)\/overallstate/)
    const valveInputMatch = topic.match(/extwork\/valve\/input/)

    if (pumpStateMatch) {
      const inverterId = Number.parseInt(pumpStateMatch[1])
      const pumpStatus = message === "1" ? "ON" as const : "OFF" as const

      // 이 인버터에 연결된 모든 탱크의 펌프 상태 업데이트
      setTankData((prev) => {
        const updatedTanks = prev.tanks.map((tank) => {
          if (tank.inverter === inverterId) {
            return { ...tank, pumpStatus }
          }
          return tank
        })

        return { ...prev, tanks: updatedTanks }
      })
    } else if (tankLevelMatch) {
      const inverterId = Number.parseInt(tankLevelMatch[1])
      const tankId = Number.parseInt(tankLevelMatch[2])

      // 배열에서 탱크 인덱스 계산 (0 기반)
      const tankIndex = (inverterId - 1) * 2 + (tankId - 1)

      // 메시지에 따라 탱크 상태 결정
      let status: "empty" | "filling" | "full" = "filling"
      if (message.includes("가득 채워짐")) {
        status = "full"
      } else if (message.includes("5% 이하") || message.includes("비어있음")) {
        status = "empty"
      }

      // 특정 탱크 업데이트
      setTankData((prev) => {
        const updatedTanks = [...prev.tanks]
        if (updatedTanks[tankIndex]) {
          updatedTanks[tankIndex] = {
            ...updatedTanks[tankIndex],
            status,
            level: status === "empty" ? 5 : status === "full" ? 100 : 50,
          }
        }

        return { ...prev, tanks: updatedTanks }
      })
    } else if (overallStateMatch) {
      // 필요한 경우 전체 상태 업데이트 처리
      const inverterId = Number.parseInt(overallStateMatch[1])
      console.log(`인버터 ${inverterId}의 전체 상태 업데이트:`, message)

      // 메인 탱크 상태 업데이트 (예시)
      if (message.includes("메인 탱크")) {
        let status: "empty" | "filling" | "full" = "empty"
        if (message.includes("가득 참")) {
          status = "full"
        } else if (message.includes("채워지는 중")) {
          status = "filling"
        }

        setTankData((prev) => ({
          ...prev,
          mainTank: {
            ...prev.mainTank,
            status,
          },
        }))
      }
    } else if (valveInputMatch) {
      // 밸브 상태 업데이트
      // 1000, 0100, 0000 형식의 메시지를 처리
      if (message === "1000" || message === "0100" || message === "0000") {
        setTankData((prev) => ({ ...prev, valveState: message }))
      }
    }
  }

  // 밸브 상태 변경
  const changeValveState = (newState: string) => {
    // MQTT 메시지 발행 (실제 환경에서)
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
        mqttClient.publish("extwork/valve/input", mqttMessage)
      }
    }

    // 상태 직접 업데이트 (시뮬레이션 환경에서)
    setTankData((prev) => ({
      ...prev,
      valveState: newState,
    }))
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

  // 데모 목적으로 탱크 업데이트 시뮬레이션
  const simulateTankUpdates = () => {
    // 먼저 MQTT 연결
    if (mqttStatus !== "연결됨") {
      connectMqtt()
    }

    setTimeout(() => {
      // 메인 탱크 채우기
      handleMqttMessage("extwork/inverter1/overallstate", "메인 탱크 채워지는 중")

      // 밸브 상태 설정 (1000 - 추출 순환)
      setTimeout(() => {
        handleMqttMessage("extwork/valve/input", "1000")
      }, 1000)

      // 1번 펌프 켜기 (6->1 경로 활성화)
      setTimeout(() => {
        handleMqttMessage("extwork/inverter1/state", "1")
        // 탱크 1 채우기 시작
        handleMqttMessage("extwork/inverter1/tank1_level", "50%")
      }, 3000)

      // 2번 펌프 켜기 (1->2 경로 활성화)
      setTimeout(() => {
        handleMqttMessage("extwork/inverter1/state", "1")
        handleMqttMessage("extwork/inverter1/tank2_level", "50%")
      }, 5000)

      // 3번 펌프 켜기 (2->3 경로 활성화)
      setTimeout(() => {
        handleMqttMessage("extwork/inverter2/state", "1")
        handleMqttMessage("extwork/inverter2/tank1_level", "50%")
      }, 7000)

      // 4번 펌프 켜기 (3->4 경로 활성화)
      setTimeout(() => {
        handleMqttMessage("extwork/inverter2/state", "1")
        handleMqttMessage("extwork/inverter2/tank2_level", "50%")
      }, 9000)

      // 5번 펌프 켜기 (4->5 경로 활성화)
      setTimeout(() => {
        handleMqttMessage("extwork/inverter3/state", "1")
        handleMqttMessage("extwork/inverter3/tank1_level", "50%")
      }, 11000)

      // 6번 펌프 켜기 (5->6 경로 활성화)
      setTimeout(() => {
        handleMqttMessage("extwork/inverter3/state", "1")
        handleMqttMessage("extwork/inverter3/tank2_level", "50%")
      }, 13000)

      // 밸브 상태 변경 (0100 - 전체 순환)
      setTimeout(() => {
        handleMqttMessage("extwork/valve/input", "0100")
      }, 15000)

      // 밸브 상태 변경 (0000 - 본탱크 수집)
      setTimeout(() => {
        handleMqttMessage("extwork/valve/input", "0000")
      }, 20000)

      // 메인 탱크 가득 참
      setTimeout(() => {
        handleMqttMessage("extwork/inverter1/overallstate", "메인 탱크 가득 참")
      }, 25000)
    }, 500)
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
                <span>탱크 시스템 모니터링</span>
                <Badge variant={mqttStatus === "연결됨" ? "default" : "destructive"}>{mqttStatus}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex justify-end">
                <Button onClick={simulateTankUpdates}>시뮬레이션 시작</Button>
              </div>
              <TankSystem tankData={tankData} onValveChange={changeValveState} />
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
                  <Button onClick={connectMqtt}>구독</Button>
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
              <CardTitle>공정(progress topic)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-2">
                <Badge variant="destructive">연결 끊김</Badge>
              </div>
              <div className="h-32 border rounded-md flex items-center justify-center text-muted-foreground">
                데이터 없음
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 