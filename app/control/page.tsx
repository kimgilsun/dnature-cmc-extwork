"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import MqttClient from "@/lib/mqtt-client";

// 모드 정의
const MODES = [
  { id: "standard", name: "표준 모드" },
  { id: "sequential", name: "순차 모드" },
  { id: "alternate", name: "교차 모드" },
  { id: "custom", name: "사용자 정의" }
];

export default function MqttControlPage() {
  // MQTT 클라이언트 상태
  const [mqttClient, setMqttClient] = useState<any>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // 펌프 상태 (1~6번)
  const [pumpStatus, setPumpStatus] = useState<Array<boolean>>([false, false, false, false, false, false]);
  
  // 선택된 모드
  const [selectedMode, setSelectedMode] = useState<string>("standard");
  
  // 시간 설정
  const [pumpRunTime, setPumpRunTime] = useState<number>(60); // 펌프 가동 시간 (초)
  const [waitTime, setWaitTime] = useState<number>(30); // 대기 시간 (초)
  
  // 반복 설정
  const [individualRepeat, setIndividualRepeat] = useState<number>(1); // 개별 반복
  const [totalRepeat, setTotalRepeat] = useState<number>(1); // 전체 반복
  
  // 발송할 명령 미리보기
  const [commandPreview, setCommandPreview] = useState<string>("");
  
  // 최근 명령 기록
  const [commandHistory, setCommandHistory] = useState<Array<{command: string, timestamp: number}>>([]);

  // MQTT 클라이언트 초기화
  useEffect(() => {
    console.log("MQTT 제어 페이지 마운트됨");
    
    // MQTT 클라이언트 생성
    const client = new MqttClient({
      onConnect: () => {
        console.log("MQTT 브로커에 연결됨");
        setIsConnected(true);
        toast.success("MQTT 연결 성공", {
          description: "MQTT 브로커에 연결되었습니다."
        });
        
        // 연결 시 서버에서 최신 명령 기록 불러오기
        loadCommandHistoryFromServer();
      },
      onDisconnect: () => {
        console.log("MQTT 브로커에서 연결 해제됨");
        setIsConnected(false);
        toast.error("MQTT 연결 해제", {
          description: "MQTT 브로커와의 연결이 해제되었습니다."
        });
      },
      onMessage: (topic: string, message: Buffer | string) => {
        console.log(`메시지 수신: ${topic} - ${message.toString()}`);
        // 메시지 처리 로직 추가
      },
      onError: (error: Error) => {
        console.error("MQTT 오류:", error);
        toast.error("MQTT 오류", {
          description: `오류가 발생했습니다: ${error.message}`
        });
      }
    });
    
    setMqttClient(client);
    
    // 컴포넌트 언마운트 시 MQTT 연결 해제
    return () => {
      if (client) {
        client.disconnect();
      }
    };
  }, []);

  // 서버에서 명령 기록 불러오기
  const loadCommandHistoryFromServer = async () => {
    try {
      const response = await fetch('/api/state');
      if (response.ok) {
        const data = await response.json();
        if (data.data?.commandHistory) {
          setCommandHistory(data.data.commandHistory);
          console.log('서버에서 명령 기록을 불러왔습니다.');
        }
      }
    } catch (error) {
      console.error('서버에서 명령 기록 불러오기 실패:', error);
    }
  };

  // 서버에 명령 기록 저장
  const saveCommandHistoryToServer = async (history: Array<{command: string, timestamp: number}>) => {
    try {
      const response = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandHistory: history })
      });
      
      if (!response.ok) {
        console.error('서버에 명령 기록 저장 실패:', response.status);
      }
    } catch (error) {
      console.error('서버에 명령 기록 저장 중 오류:', error);
    }
  };

  // 명령 미리보기 생성
  useEffect(() => {
    generateCommandPreview();
  }, [pumpStatus, selectedMode, pumpRunTime, waitTime, individualRepeat, totalRepeat]);

  // 명령 미리보기 생성 함수
  const generateCommandPreview = () => {
    const activePumps = pumpStatus.map((status, index) => status ? index + 1 : null).filter(id => id !== null);
    
    const command = {
      mode: selectedMode,
      pumps: activePumps,
      runTime: pumpRunTime,
      waitTime: waitTime,
      individualRepeat: individualRepeat,
      totalRepeat: totalRepeat,
      timestamp: Date.now()
    };
    
    setCommandPreview(JSON.stringify(command, null, 2));
  };

  // 명령 발송 함수
  const sendCommand = () => {
    if (!mqttClient || !isConnected) {
      toast.error("연결 오류", {
        description: "MQTT 브로커에 연결되어 있지 않습니다."
      });
      return;
    }
    
    const activePumps = pumpStatus.map((status, index) => status ? index + 1 : null).filter(id => id !== null);
    
    if (activePumps.length === 0) {
      toast.error("입력 오류", {
        description: "최소 하나 이상의 펌프를 선택해야 합니다."
      });
      return;
    }
    
    const command = {
      mode: selectedMode,
      pumps: activePumps,
      runTime: pumpRunTime,
      waitTime: waitTime,
      individualRepeat: individualRepeat,
      totalRepeat: totalRepeat,
      timestamp: Date.now()
    };
    
    const topic = "extwork/extraction/input";
    const payload = JSON.stringify(command);
    
    try {
      mqttClient.publish(topic, payload);
      
      // 명령 기록 추가
      const updatedHistory = [
        {command: payload, timestamp: Date.now()},
        ...commandHistory.slice(0, 9) // 최근 10개만 유지
      ];
      
      setCommandHistory(updatedHistory);
      
      // 서버에 명령 기록 저장
      saveCommandHistoryToServer(updatedHistory);
      
      toast.success("명령 발송 성공", {
        description: `명령이 ${topic}으로 발송되었습니다.`
      });
    } catch (error) {
      console.error("명령 발송 오류:", error);
      toast.error("명령 발송 실패", {
        description: `오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  };

  // 펌프 토글 함수
  const togglePump = (index: number) => {
    setPumpStatus(prev => {
      const newStatus = [...prev];
      newStatus[index] = !newStatus[index];
      return newStatus;
    });
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">MQTT 제어 페이지</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 좌측: 펌프 제어 */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>펌프 제어</CardTitle>
              <CardDescription>
                활성화할 펌프를 선택하고 작동 파라미터를 설정하세요
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-6">
                {/* 펌프 ON/OFF 스위치 */}
                <div>
                  <h3 className="text-lg font-medium mb-4">펌프 ON/OFF</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {pumpStatus.map((status, index) => (
                      <div key={`pump-${index+1}`} className="flex items-center space-x-3 border p-3 rounded-md">
                        <Switch
                          id={`pump-${index+1}`}
                          checked={status}
                          onCheckedChange={() => togglePump(index)}
                        />
                        <Label htmlFor={`pump-${index+1}`} className="font-medium">
                          펌프 {index+1}
                          <Badge className={`ml-2 ${status ? 'bg-green-500' : 'bg-gray-300'}`}>
                            {status ? 'ON' : 'OFF'}
                          </Badge>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 모드 선택 */}
                <div>
                  <h3 className="text-lg font-medium mb-4">모드 선택</h3>
                  <Select value={selectedMode} onValueChange={setSelectedMode}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="작동 모드 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map(mode => (
                        <SelectItem key={mode.id} value={mode.id}>
                          {mode.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* 시간 설정 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">펌프 가동 시간 (초)</h3>
                    <div className="space-y-2">
                      <Slider
                        value={[pumpRunTime]}
                        min={1}
                        max={300}
                        step={1}
                        onValueChange={(value: number[]) => setPumpRunTime(value[0])}
                      />
                      <div className="flex justify-between">
                        <span>1초</span>
                        <span className="font-bold">{pumpRunTime}초</span>
                        <span>300초</span>
                      </div>
                      <Input
                        type="number"
                        value={pumpRunTime}
                        onChange={(e) => setPumpRunTime(Number(e.target.value))}
                        min={1}
                        max={300}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">대기 시간 (초)</h3>
                    <div className="space-y-2">
                      <Slider
                        value={[waitTime]}
                        min={0}
                        max={300}
                        step={1}
                        onValueChange={(value: number[]) => setWaitTime(value[0])}
                      />
                      <div className="flex justify-between">
                        <span>0초</span>
                        <span className="font-bold">{waitTime}초</span>
                        <span>300초</span>
                      </div>
                      <Input
                        type="number"
                        value={waitTime}
                        onChange={(e) => setWaitTime(Number(e.target.value))}
                        min={0}
                        max={300}
                      />
                    </div>
                  </div>
                </div>
                
                {/* 반복 설정 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4">개별 반복 횟수</h3>
                    <div className="space-y-2">
                      <Slider
                        value={[individualRepeat]}
                        min={1}
                        max={50}
                        step={1}
                        onValueChange={(value: number[]) => setIndividualRepeat(value[0])}
                      />
                      <div className="flex justify-between">
                        <span>1회</span>
                        <span className="font-bold">{individualRepeat}회</span>
                        <span>50회</span>
                      </div>
                      <Input
                        type="number"
                        value={individualRepeat}
                        onChange={(e) => setIndividualRepeat(Number(e.target.value))}
                        min={1}
                        max={50}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">전체 반복 횟수</h3>
                    <div className="space-y-2">
                      <Slider
                        value={[totalRepeat]}
                        min={1}
                        max={50}
                        step={1}
                        onValueChange={(value: number[]) => setTotalRepeat(value[0])}
                      />
                      <div className="flex justify-between">
                        <span>1회</span>
                        <span className="font-bold">{totalRepeat}회</span>
                        <span>50회</span>
                      </div>
                      <Input
                        type="number"
                        value={totalRepeat}
                        onChange={(e) => setTotalRepeat(Number(e.target.value))}
                        min={1}
                        max={50}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                className="w-full" 
                size="lg" 
                disabled={!isConnected}
                onClick={sendCommand}
              >
                명령 발송
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* 우측: 명령 미리보기 및 토픽 정보 */}
        <div>
          <Tabs defaultValue="preview">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preview">명령 미리보기</TabsTrigger>
              <TabsTrigger value="history">명령 기록</TabsTrigger>
              <TabsTrigger value="topics">토픽 정보</TabsTrigger>
            </TabsList>
            
            <TabsContent value="preview">
              <Card>
                <CardHeader>
                  <CardTitle>JSON 명령 미리보기</CardTitle>
                  <CardDescription>
                    "extwork/extraction/input" 토픽으로 발송될 명령입니다
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-[400px] text-sm">
                    {commandPreview}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>명령 발송 기록</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-[400px] overflow-auto">
                    {commandHistory.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">아직 발송된 명령이 없습니다</p>
                    ) : (
                      commandHistory.map((item, index) => (
                        <div key={index} className="border p-3 rounded-md">
                          <div className="text-xs text-gray-500 mb-1">
                            {new Date(item.timestamp).toLocaleString()}
                          </div>
                          <pre className="text-xs bg-gray-100 p-2 rounded-md overflow-auto">
                            {JSON.stringify(JSON.parse(item.command), null, 2)}
                          </pre>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="topics">
              <Card>
                <CardHeader>
                  <CardTitle>토픽 정보</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border p-3 rounded-md">
                      <h3 className="font-bold">명령 발송 토픽</h3>
                      <code className="bg-gray-100 p-1 rounded text-sm block mt-1">
                        extwork/extraction/input
                      </code>
                      <p className="text-sm mt-2">
                        펌프 제어 명령이 JSON 형식으로 이 토픽에 발송됩니다.
                      </p>
                    </div>
                    
                    <div className="border p-3 rounded-md">
                      <h3 className="font-bold">펌프 상태 토픽</h3>
                      <code className="bg-gray-100 p-1 rounded text-sm block mt-1">
                        extwork/inverter{"{number}"}/state
                      </code>
                      <p className="text-sm mt-2">
                        각 펌프(인버터)의 현재 상태가 이 토픽으로 발행됩니다.
                      </p>
                    </div>
                    
                    <div className="border p-3 rounded-md">
                      <h3 className="font-bold">펌프 명령 토픽</h3>
                      <code className="bg-gray-100 p-1 rounded text-sm block mt-1">
                        extwork/pump{"{number}"}/cmd
                      </code>
                      <p className="text-sm mt-2">
                        개별 펌프에 명령을 직접 전송하는 토픽입니다.
                      </p>
                    </div>
                    
                    <div className="border p-3 rounded-md">
                      <h3 className="font-bold">시스템 상태 토픽</h3>
                      <code className="bg-gray-100 p-1 rounded text-sm block mt-1">
                        tank-system/state
                      </code>
                      <p className="text-sm mt-2">
                        전체 시스템의 상태 정보가 이 토픽으로 발행됩니다.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">MQTT 연결 상태</p>
                    <p className="text-sm text-gray-500">
                      {isConnected ? "브로커에 연결됨" : "연결 안됨"}
                    </p>
                  </div>
                  <Badge
                    className={isConnected ? "bg-green-500" : "bg-red-500"}
                  >
                    {isConnected ? "온라인" : "오프라인"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <Toaster />
    </div>
  );
} 