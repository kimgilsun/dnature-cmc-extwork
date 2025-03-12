"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MqttClient from "@/lib/mqtt-client";

export default function DebugPage() {
  const [status, setStatus] = useState<string>("연결 대기 중...");
  const [messages, setMessages] = useState<Array<{topic: string, message: string, timestamp: number}>>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [mqttClient, setMqttClient] = useState<any>(null);
  const [brokerInfo, setBrokerInfo] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // 로그 함수
  const addLog = (log: string) => {
    console.log(log);
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${log}`, ...prev].slice(0, 20));
  };

  // MQTT 클라이언트 초기화
  useEffect(() => {
    addLog("디버그 페이지 마운트됨");
    
    // 브라우저 환경 정보 수집
    try {
      const browserInfo = `
        URL: ${window.location.href}
        UserAgent: ${navigator.userAgent}
        Platform: ${navigator.platform}
        WebSocket 지원: ${typeof WebSocket !== 'undefined' ? '지원함' : '지원 안함'}
      `;
      addLog(`브라우저 정보: ${browserInfo.replace(/\n/g, ' | ')}`);
      setBrokerInfo(browserInfo);
    } catch (err) {
      addLog(`브라우저 정보 수집 실패: ${err}`);
    }

    // MQTT 클라이언트 생성
    try {
      addLog("MQTT 클라이언트 초기화 시작");
      const client = new MqttClient();

      client.onConnect = () => {
        addLog("MQTT 브로커에 연결됨!");
        setStatus("연결됨");
        setIsConnected(true);

        // 테스트 토픽 구독
        client.subscribe("extwork/valve/state");
        client.subscribe("extwork/extraction/progress");
        addLog("토픽 구독 완료: extwork/valve/state, extwork/extraction/progress");
      };

      client.onDisconnect = () => {
        addLog("MQTT 브로커와 연결 끊김");
        setStatus("연결 끊김");
        setIsConnected(false);
      };

      client.onError = (error) => {
        const errorMessage = `MQTT 오류: ${error.message}`;
        addLog(errorMessage);
        setErrors(prev => [errorMessage, ...prev].slice(0, 10));
      };

      client.onMessage = (topic, message) => {
        addLog(`메시지 수신: ${topic}`);
        setMessages(prev => [
          { topic, message, timestamp: Date.now() },
          ...prev
        ].slice(0, 10));
      };

      setMqttClient(client);
      addLog("MQTT 클라이언트 초기화 완료");
    } catch (err) {
      addLog(`MQTT 클라이언트 초기화 실패: ${err}`);
      setErrors(prev => [`초기화 오류: ${err}`, ...prev]);
    }

    return () => {
      addLog("디버그 페이지 언마운트");
      // mqttClient?.disconnect();
    };
  }, []);

  // 연결 버튼 핸들러
  const handleConnect = () => {
    if (!mqttClient) {
      addLog("MQTT 클라이언트가 초기화되지 않았습니다");
      return;
    }

    addLog("MQTT 브로커 연결 시도");
    mqttClient.connect();
  };

  // 연결 해제 버튼 핸들러
  const handleDisconnect = () => {
    if (!mqttClient) return;
    
    addLog("MQTT 브로커 연결 해제");
    mqttClient.disconnect();
  };

  // 테스트 메시지 발행 핸들러
  const handlePublishTest = () => {
    if (!mqttClient) return;
    
    const testMsg = JSON.stringify({
      pump_id: 1,
      process_info: "TEST(1/1)",
      elapsed_time: 10,
      remaining_time: 0,
      status: "테스트 메시지"
    });
    
    addLog("테스트 메시지 발행");
    mqttClient.publish("extwork/extraction/progress", testMsg);
  };

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="text-3xl font-bold mb-6">MQTT 디버그 페이지</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>연결 상태</span>
              <Badge variant={isConnected ? "default" : "destructive"}>
                {status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-md text-xs font-mono overflow-auto max-h-32">
                <pre>{brokerInfo}</pre>
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={handleConnect} variant="default" disabled={isConnected}>
                  연결
                </Button>
                <Button onClick={handleDisconnect} variant="outline" disabled={!isConnected}>
                  연결 해제
                </Button>
                <Button onClick={handlePublishTest} variant="secondary" disabled={!isConnected}>
                  테스트 메시지 발행
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>오류 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 p-3 rounded-md max-h-60 overflow-auto">
              {errors.length > 0 ? (
                <ul className="space-y-2 text-xs">
                  {errors.map((err, idx) => (
                    <li key={idx} className="text-red-600 p-1 border-b border-red-100">
                      {err}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">오류 없음</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>수신된 메시지</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-md p-3 max-h-80 overflow-auto">
              {messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((msg, idx) => (
                    <div key={idx} className="p-2 bg-white border rounded-md">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>토픽: <span className="font-mono font-bold">{msg.topic}</span></span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs font-mono bg-gray-50 p-2 rounded-md whitespace-pre-wrap overflow-auto max-h-40">
                        {msg.message}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">수신된 메시지 없음</p>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>디버그 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-800 text-gray-100 p-3 rounded-md font-mono text-xs max-h-60 overflow-auto">
              {logs.map((log, idx) => (
                <div key={idx} className="mb-1 border-b border-gray-700 pb-1">
                  {log}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 