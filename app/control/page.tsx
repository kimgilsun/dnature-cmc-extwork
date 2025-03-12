"use client";

import { useState, useEffect } from "react";
import MqttClient from "@/lib/mqtt-client";

// 간단한 알림 함수 정의
const showAlert = (message: string) => {
  console.log(message);
  // 프로덕션에서는 window.alert 사용
  if (typeof window !== 'undefined') {
    window.alert(message);
  }
};

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
        showAlert("MQTT 연결 성공: MQTT 브로커에 연결되었습니다.");
        
        // 연결 시 서버에서 최신 명령 기록 불러오기
        loadCommandHistoryFromServer();
      },
      onDisconnect: () => {
        console.log("MQTT 브로커에서 연결 해제됨");
        setIsConnected(false);
        showAlert("MQTT 연결 해제: MQTT 브로커와의 연결이 해제되었습니다.");
      },
      onMessage: (topic: string, message: Buffer | string) => {
        console.log(`메시지 수신: ${topic} - ${message.toString()}`);
        // 메시지 처리 로직 추가
      },
      onError: (error: Error) => {
        console.error("MQTT 오류:", error);
        showAlert(`MQTT 오류: ${error.message}`);
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
      showAlert("연결 오류: MQTT 브로커에 연결되어 있지 않습니다.");
      return;
    }
    
    const activePumps = pumpStatus.map((status, index) => status ? index + 1 : null).filter(id => id !== null);
    
    if (activePumps.length === 0) {
      showAlert("입력 오류: 최소 하나 이상의 펌프를 선택해야 합니다.");
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
      
      showAlert(`명령 발송 성공: 명령이 ${topic}으로 발송되었습니다.`);
    } catch (error) {
      console.error("명령 발송 오류:", error);
      showAlert(`명령 발송 실패: 오류가 발생했습니다. ${error instanceof Error ? error.message : String(error)}`);
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
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">MQTT 제어 페이지</h1>
      
      <div className="bg-white p-4 mb-4 rounded shadow">
        <h2 className="text-xl mb-2">펌프 제어</h2>
        <p className="mb-4">활성화할 펌프를 선택하고 작동 파라미터를 설정하세요</p>
        
        {/* 펌프 ON/OFF 체크박스 */}
        <div className="mb-4">
          <h3 className="font-bold mb-2">펌프 ON/OFF</h3>
          <div className="grid grid-cols-3 gap-2">
            {pumpStatus.map((status, index) => (
              <div key={`pump-${index+1}`} className="flex items-center border p-2 rounded">
                <input
                  type="checkbox"
                  id={`pump-${index+1}`}
                  checked={status}
                  onChange={() => togglePump(index)}
                  className="mr-2"
                />
                <label htmlFor={`pump-${index+1}`}>
                  펌프 {index+1}: {status ? 'ON' : 'OFF'}
                </label>
              </div>
            ))}
          </div>
        </div>
        
        {/* 모드 선택 */}
        <div className="mb-4">
          <h3 className="font-bold mb-2">모드 선택</h3>
          <select 
            value={selectedMode} 
            onChange={e => setSelectedMode(e.target.value)}
            className="w-full p-2 border rounded"
          >
            {MODES.map(mode => (
              <option key={mode.id} value={mode.id}>
                {mode.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* 시간 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="font-bold mb-2">펌프 가동 시간 (초)</h3>
            <input
              type="range"
              min={1}
              max={300}
              value={pumpRunTime}
              onChange={e => setPumpRunTime(Number(e.target.value))}
              className="w-full mb-2"
            />
            <div className="flex justify-between text-sm">
              <span>1초</span>
              <span className="font-bold">{pumpRunTime}초</span>
              <span>300초</span>
            </div>
            <input
              type="number"
              value={pumpRunTime}
              onChange={e => setPumpRunTime(Number(e.target.value))}
              min={1}
              max={300}
              className="w-full p-2 border rounded mt-2"
            />
          </div>
          
          <div>
            <h3 className="font-bold mb-2">대기 시간 (초)</h3>
            <input
              type="range"
              min={0}
              max={300}
              value={waitTime}
              onChange={e => setWaitTime(Number(e.target.value))}
              className="w-full mb-2"
            />
            <div className="flex justify-between text-sm">
              <span>0초</span>
              <span className="font-bold">{waitTime}초</span>
              <span>300초</span>
            </div>
            <input
              type="number"
              value={waitTime}
              onChange={e => setWaitTime(Number(e.target.value))}
              min={0}
              max={300}
              className="w-full p-2 border rounded mt-2"
            />
          </div>
        </div>
        
        {/* 반복 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="font-bold mb-2">개별 반복 횟수</h3>
            <input
              type="range"
              min={1}
              max={50}
              value={individualRepeat}
              onChange={e => setIndividualRepeat(Number(e.target.value))}
              className="w-full mb-2"
            />
            <div className="flex justify-between text-sm">
              <span>1회</span>
              <span className="font-bold">{individualRepeat}회</span>
              <span>50회</span>
            </div>
            <input
              type="number"
              value={individualRepeat}
              onChange={e => setIndividualRepeat(Number(e.target.value))}
              min={1}
              max={50}
              className="w-full p-2 border rounded mt-2"
            />
          </div>
          
          <div>
            <h3 className="font-bold mb-2">전체 반복 횟수</h3>
            <input
              type="range"
              min={1}
              max={50}
              value={totalRepeat}
              onChange={e => setTotalRepeat(Number(e.target.value))}
              className="w-full mb-2"
            />
            <div className="flex justify-between text-sm">
              <span>1회</span>
              <span className="font-bold">{totalRepeat}회</span>
              <span>50회</span>
            </div>
            <input
              type="number"
              value={totalRepeat}
              onChange={e => setTotalRepeat(Number(e.target.value))}
              min={1}
              max={50}
              className="w-full p-2 border rounded mt-2"
            />
          </div>
        </div>
        
        <button 
          className={`w-full p-2 rounded text-white font-bold ${isConnected ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'}`}
          disabled={!isConnected}
          onClick={sendCommand}
        >
          명령 발송
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 명령 미리보기 */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl mb-2">JSON 명령 미리보기</h2>
          <p className="text-sm text-gray-600 mb-2">&quot;extwork/extraction/input&quot; 토픽으로 발송될 명령입니다</p>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[300px] text-sm">
            {commandPreview}
          </pre>
        </div>
        
        {/* 명령 기록 */}
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl mb-2">명령 발송 기록</h2>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {commandHistory.length === 0 ? (
              <p className="text-gray-500 text-center p-4">아직 발송된 명령이 없습니다</p>
            ) : (
              commandHistory.map((item, index) => (
                <div key={index} className="border p-2 rounded text-sm">
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                  <pre className="bg-gray-100 p-2 rounded overflow-auto text-xs">
                    {JSON.stringify(JSON.parse(item.command), null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* 연결 상태 표시 */}
      <div className="mt-4 bg-white p-4 rounded shadow">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-bold">MQTT 연결 상태</p>
            <p className="text-sm text-gray-600">
              {isConnected ? "브로커에 연결됨" : "연결 안됨"}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-white ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}>
            {isConnected ? "온라인" : "오프라인"}
          </div>
        </div>
      </div>
    </div>
  );
} 