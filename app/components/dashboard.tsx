"use client"

import dynamic from 'next/dynamic'
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Switch } from "@/components/ui/switch"

// 카메라 구독 및 명령 토픽 형식
const CAM_COMMAND_TOPIC = "extwork/cam%d/command";
const CAM_STATE_TOPIC = "extwork/cam%d/state";

// 카메라 토픽 생성 함수
const getCamCommandTopic = (camNumber: number): string => {
  return CAM_COMMAND_TOPIC.replace("%d", camNumber.toString());
};

const getCamStateTopic = (camNumber: number): string => {
  return CAM_STATE_TOPIC.replace("%d", camNumber.toString());
};

// TankSystem 컴포넌트를 동적으로 임포트
const TankSystem = dynamic(
  () => import('@/app/components/tank-system'),
  { 
    ssr: false,
    loading: () => <div>탱크 시스템 로딩 중...</div>
  }
)

// 서버에 상태 저장
const saveStateToServer = async (state: any) => {
  if (typeof window !== 'undefined' && window.navigator.onLine) {
    try {
      const response = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      });
      
      if (!response.ok) {
        console.error('서버 상태 저장 실패:', response.status);
      }
      
      return response.ok;
    } catch (error) {
      console.error('서버 상태 저장 중 오류:', error);
      return false;
    }
  }
  return false;
};

// 서버에서 상태 불러오기
const loadStateFromServer = async () => {
  if (typeof window !== 'undefined' && window.navigator.onLine) {
    try {
      const response = await fetch('/api/state');
      
      if (response.ok) {
        const data = await response.json();
        return data.data;
      } else {
        console.error('서버 상태 불러오기 실패:', response.status);
      }
    } catch (error) {
      console.error('서버 상태 불러오기 중 오류:', error);
    }
  }
  return null;
};

export default function Dashboard() {
  const [topic, setTopic] = useState(VALVE_INPUT_TOPIC)
  const [message, setMessage] = useState("")
  const [mqttStatus, setMqttStatus] = useState("연결 끊김")
  const [searchTopic, setSearchTopic] = useState("")
  const [mqttClient, setMqttClient] = useState<any>(null)
  const [progressData, setProgressData] = useState<string>("데이터 없음")
  const [progressStatus, setProgressStatus] = useState<"connected" | "disconnected">("disconnected")
  const [lastErrors, setLastErrors] = useState<string[]>([])
  
  // 카메라 상태 관리
  const [camStates, setCamStates] = useState<Array<"ON" | "OFF">>(['OFF', 'OFF', 'OFF', 'OFF', 'OFF']);
  
  // 추출 진행 메시지를 저장할 상태
  const [progressMessages, setProgressMessages] = useState<Array<{timestamp: number, message: string, rawJson?: string | null}>>([])
  
  // 펌프 overallstate 메시지를 저장할 상태 추가
  const [pumpStateMessages, setPumpStateMessages] = useState<Record<number, string>>({});
  
  // 기본 탱크 시스템 데이터로 초기화 (6개 탱크)
  const [tankData, setTankData] = useState<TankSystemData>(getDefaultTankSystemData(6))

  // 첫 렌더링 여부 추적
  const isFirstRender = useRef(true);

  // 로컬 스토리지에서 이전 밸브 상태 로드
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // 탱크 데이터 로드
        const savedTankData = localStorage.getItem('tankData');
        if (savedTankData) {
          setTankData(JSON.parse(savedTankData));
        }

        // 밸브 상태 로드 (별도 저장된 경우)
        const savedValveState = localStorage.getItem('valveState');
        if (savedValveState) {
          const valveState = JSON.parse(savedValveState);
          // valveState를 탱크 데이터에 적용하는 로직 (필요한 경우)
        }
      } catch (error) {
        console.error('로컬 스토리지에서 데이터 로드 중 오류:', error);
      }
    }
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    // 서버에서 초기 상태 로드
    const loadInitialState = async () => {
      const serverState = await loadStateFromServer();
      
      if (serverState) {
        console.log('서버에서 상태 로드 성공');
        // 서버 상태로 탱크 데이터 업데이트
        setTankData(serverState);
      } else {
        console.log('서버 상태 없음, 기본값 사용');
      }
    };
    
    loadInitialState();
  }, []);

  // 상태 변경 시 서버에 저장
  useEffect(() => {
    // 첫 렌더링 시에는 저장하지 않음
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // 상태 변경 시 서버에 저장
    saveStateToServer(tankData);
  }, [tankData]);

  // MQTT 클라이언트 초기화
  useEffect(() => {
    console.log("MQTT 클라이언트 초기화 시작 - 현재 위치:", window.location.href);
    
    // 동적으로 MQTT 클라이언트 모듈 로드
    import('@/lib/mqtt-client').then(module => {
      const createMqttClient = module.default;
      
      // MQTT 클라이언트 생성
      const client = createMqttClient({
        onConnect: () => {
          console.log("MQTT 브로커에 연결 성공!");
          setMqttStatus("연결됨");

          // 모든 토픽 구독 (6개 인버터 기준)
          const topics = getAllSubscriptionTopics(6);
          console.log("구독할 토픽:", topics);
          
          topics.forEach(topic => {
            client.subscribe(topic);
          });
          
          // 진행 상황 토픽 명시적 구독
          client.subscribe(PROCESS_PROGRESS_TOPIC);
          console.log("진행 상황 토픽 구독:", PROCESS_PROGRESS_TOPIC);
          
          // 에러 토픽 구독
          client.subscribe(ERROR_TOPIC);
          console.log("에러 토픽 구독:", ERROR_TOPIC);
          
          // 연결 즉시 밸브 상태 요청 메시지 전송
          client.publish(VALVE_INPUT_TOPIC, "STATUS");
        },
        onDisconnect: () => {
          console.log("MQTT 브로커와 연결이 끊겼습니다.");
          setMqttStatus("연결 끊김");
          setProgressStatus("disconnected");
          
          // 5초 후 자동 재연결 시도
          setTimeout(() => {
            console.log("MQTT 자동 재연결 시도...");
            if (!client.isConnected()) {
              client.connect();
            }
          }, 5000);
        },
        onMessage: (topic: string, message: string) => {
          console.log(`MQTT 메시지 수신: ${topic}`);
          handleMqttMessage(topic, message);
        },
        onError: (error: Error) => {
          console.error("MQTT 오류 발생:", error);
          // 오류 메시지 표시
          setLastErrors(prev => {
            const newErrors = [`MQTT 오류: ${error.message}`, ...prev].slice(0, 5);
            return newErrors;
          });
        }
      });
      
      setMqttClient(client);
      
      // 자동으로 연결 시작
      console.log("MQTT 브로커에 연결 시도...");
      client.connect();
    }).catch(error => {
      console.error("MQTT 모듈 로드 실패:", error);
      setLastErrors(prev => {
        const newErrors = [`MQTT 모듈 로드 실패: ${error.message}`, ...prev].slice(0, 5);
        return newErrors;
      });
    });
    
    // 컴포넌트 언마운트 시 연결 종료
    return () => {
      console.log("Dashboard 컴포넌트 언마운트, MQTT 연결 종료");
      if (mqttClient) {
        mqttClient.disconnect();
      }
    };
  }, []);

  // MQTT 메시지 처리
  const handleMqttMessage = (topic: string, message: string) => {
    console.log(`메시지 수신: ${topic} - ${message}`)

    // 카메라 상태 토픽 처리
    const camStateMatch = topic.match(/extwork\/cam(\d+)\/state/)
    if (camStateMatch) {
      const camNumber = parseInt(camStateMatch[1])
      if (camNumber >= 1 && camNumber <= 5) {
        const camStatus: "ON" | "OFF" = message === "1" ? "ON" : "OFF"
        setCamStates(prev => {
          const newStates = [...prev]
          newStates[camNumber - 1] = camStatus
          return newStates
        })
        return
      }
    }

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

        // 업데이트된 상태
        const updatedState = { ...prev, tanks: updatedTanks }
        
        // 변경된 상태를 서버에 저장
        saveStateToServer(updatedState)
        
        return updatedState
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
      
      // 펌프 상태 메시지 저장
      setPumpStateMessages(prev => ({
        ...prev,
        [inverterId]: message
      }));
      
      return
    }

    // 밸브 상태 토픽 처리
    if (topic === VALVE_STATE_TOPIC || topic === VALVE_INPUT_TOPIC) {
      console.log(`밸브 상태 메시지 수신: ${topic} - ${message}`);
      
      // 1000, 0100, 0000 형식의 메시지를 처리
      if (message.match(/^[0-1]{4}$/)) {
        // 4자리 0과 1로 구성된 문자열인 경우 (valve 명령어)
        const { valveState, valveADesc, valveBDesc } = parseValveStateMessage(message);
        if (valveState) {
          console.log(`밸브 상태 코드 업데이트: ${valveState}, 설명 A: ${valveADesc}, 설명 B: ${valveBDesc}`);
          
          const updatedTankData = {
            ...tankData,
            valveState,
            valveADesc: valveADesc || '',
            valveBDesc: valveBDesc || ''
          };
          
          setTankData(updatedTankData);
          
          // 로컬 스토리지에 저장
          localStorage.setItem('tankData', JSON.stringify(updatedTankData));
          localStorage.setItem('valveState', JSON.stringify({
            valveState,
            valveADesc: valveADesc || '',
            valveBDesc: valveBDesc || ''
          }));
        }
      } else if (message.includes('valveA=') || message.includes('valveB=')) {
        // 상세 밸브 상태 메시지인 경우 (valve 상태 정보)
        // 예: "밸브 상태: valveA=ON(추출순환), valveB=OFF(닫힘), valveC=OFF(-), valveD=OFF(-)"
        const valveStatusMessage = message;
        console.log(`밸브 상태 메시지 업데이트: ${valveStatusMessage}`);
        
        // 밸브 상태 문자열에서 ON/OFF 파싱 및 설명 추출
        const valveAState = message.includes('valveA=ON') ? '1' : '0';
        const valveBState = message.includes('valveB=ON') ? '1' : '0';
        const valveCState = message.includes('valveC=ON') ? '1' : '0';
        const valveDState = message.includes('valveD=ON') ? '1' : '0';
        
        // 설명 추출 (괄호 안의 내용)
        let valveADesc = '';
        let valveBDesc = '';
        
        const valveAMatch = message.match(/valveA=[A-Z]+([\(\[][^\)\]]+[\)\]])/i);
        if (valveAMatch && valveAMatch[1]) {
          valveADesc = valveAMatch[1].replace(/[\(\)\[\]]/g, '');
        }
        
        const valveBMatch = message.match(/valveB=[A-Z]+([\(\[][^\)\]]+[\)\]])/i);
        if (valveBMatch && valveBMatch[1]) {
          valveBDesc = valveBMatch[1].replace(/[\(\)\[\]]/g, '');
        }
        
        // 밸브 상태 문자열 업데이트
        const newValveState = valveAState + valveBState + valveCState + valveDState;
        console.log(`밸브 상태 업데이트 결과: 코드=${newValveState}, valveA 설명=${valveADesc}, valveB 설명=${valveBDesc}`);
        
        // 업데이트할 탱크 데이터 생성
        const updatedTankData = {
          ...tankData,
          valveState: newValveState,
          valveStatusMessage,
          valveADesc,
          valveBDesc
        };
        
        // 상태 업데이트
        setTankData(updatedTankData);
        
        // 로컬 스토리지에 저장
        localStorage.setItem('tankData', JSON.stringify(updatedTankData));
        localStorage.setItem('valveState', JSON.stringify({
          valveState: newValveState,
          valveADesc, 
          valveBDesc,
          valveStatusMessage
        }));
      }
      return;
    }
    
    // 공정 진행 상황 토픽 처리
    if (topic === PROCESS_PROGRESS_TOPIC) {
      // 메시지 내용을 로깅하여 디버깅
      console.log('추출 진행 메시지 수신:', message);
      
      setProgressData(message);
      setProgressStatus("connected");
      
      // JSON 메시지인지 확인하고 파싱
      let parsedMessage = message;
      let jsonData = null;
      let rawJsonStr = null;
      
      try {
        // 메시지가 JSON 형식인 경우 파싱
        if (message.trim().startsWith('{') && message.trim().endsWith('}')) {
          console.log('JSON 형식 메시지 감지, 파싱 시도');
          jsonData = JSON.parse(message);
          console.log('JSON 파싱 성공:', jsonData);
          
          // 원본 JSON을 문자열로 예쁘게 포맷팅하여 저장
          rawJsonStr = JSON.stringify(jsonData, null, 2);
          
          // JSON 데이터를 가독성 있는 텍스트로 변환 (모든 필드 포함)
          parsedMessage = `[JSON] `;
          
          // 기본 필드들 추가 (null 체크 추가)
          if (jsonData.process_info) parsedMessage += `진행: ${jsonData.process_info}, `;
          if (jsonData.elapsed_time !== undefined) parsedMessage += `경과: ${jsonData.elapsed_time}s, `;
          if (jsonData.remaining_time !== undefined) parsedMessage += `남은: ${jsonData.remaining_time}s, `;
          if (jsonData.total_remaining !== undefined) parsedMessage += `전체남은: ${jsonData.total_remaining}s, `;
          if (jsonData.process_time !== undefined) parsedMessage += `총시간: ${jsonData.process_time}s, `;
          if (jsonData.pump_id) parsedMessage += `펌프: ${jsonData.pump_id}, `;
          
          // 추가 필드가 있으면 포함
          if (jsonData.current_stage) parsedMessage += `단계: ${jsonData.current_stage}, `;
          if (jsonData.status) parsedMessage += `상태: ${jsonData.status}, `;
          
          // 추가 정보 필드가 있으면 포함
          if (jsonData.additional_info) parsedMessage += `추가정보: ${jsonData.additional_info}, `;
          
          // 마지막 쉼표와 공백 제거
          parsedMessage = parsedMessage.replace(/,\s*$/, '');
          
          // 추가 디버깅 로그
          console.log('변환된 메시지:', parsedMessage);
          console.log('원본 JSON 문자열 길이:', rawJsonStr?.length);
        } else {
          console.log('일반 텍스트 메시지 감지 (JSON 아님)');
        }
      } catch (e) {
        console.error('JSON 파싱 실패:', e);
        // 파싱 실패 시 원본 메시지 사용
        parsedMessage = `[파싱실패] ${message}`;
      }
      
      // 추출 진행 메시지 추가 - 최신 5개 메시지 표시
      setProgressMessages(prev => {
        // 새 메시지 생성
        const newMessage = { 
          timestamp: Date.now(), 
          message: parsedMessage, 
          rawJson: rawJsonStr 
        };
        
        console.log("추가될 메시지:", newMessage.message.substring(0, 50) + (newMessage.message.length > 50 ? '...' : ''));
        
        // 새 메시지를 맨 앞에 추가하고 최신 5개 유지
        const newMessages = [
          newMessage,
          ...prev
        ].slice(0, 5); 
        
        console.log("업데이트된 메시지 목록 개수:", newMessages.length);
        return newMessages;
      });
      
      console.log("추출 진행 메시지 업데이트 완료");
      return;
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

  // 카메라 상태 변경 함수
  const toggleCamera = (camNumber: number) => {
    if (!mqttClient) return
    
    // 현재 상태 확인 (인덱스는 0부터 시작하므로 camNumber - 1)
    const currentState = camStates[camNumber - 1]
    // 토글할 새 상태
    const newState = currentState === "ON" ? "OFF" : "ON"
    // 메시지 값 (ON -> 1, OFF -> 0)
    const messageValue = newState === "ON" ? "1" : "0"
    
    // 메시지 발행
    mqttClient.publish(getCamCommandTopic(camNumber), messageValue)
    
    // UI에 즉시 반영 (실제 상태는 구독한 state 토픽으로부터 업데이트될 것임)
    setCamStates(prev => {
      const newStates = [...prev]
      newStates[camNumber - 1] = newState
      return newStates
    })
  }

  // 밸브 상태 변경
  const changeValveState = (newState: string) => {
    if (mqttClient) {
      let mqttMessage = ""
      
      // 메시지 형식: "0000" - 순서대로 V1, V2, 방향1, 방향2 상태
      switch (newState) {
        case "valve1":
          mqttMessage = "1000"
          break
        case "valve2":
          mqttMessage = "0100"
          break
        case "valve_all_off":
          mqttMessage = "0000"
          break
        // 추가 밸브 상태들...
      }
      
      if (mqttMessage) {
        console.log(`밸브 상태 변경: ${newState} - 메시지: ${mqttMessage}`);
        mqttClient.publish(VALVE_INPUT_TOPIC, mqttMessage)
        
        // 새로운 상태를 로컬 스토리지에 바로 저장할 수도 있지만,
        // MQTT 응답을 통해 실제 상태가 변경된 후 저장하는 것이 더 안전합니다.
      }
    }
  }

  // 펌프 토글 (ON/OFF) 함수 추가
  const togglePump = (pumpId: number) => {
    if (!mqttClient) return;
    
    // 현재 펌프 상태 확인
    const currentState = tankData.tanks[pumpId - 1]?.pumpStatus || "OFF";
    // 토글할 새 상태
    const newState = currentState === "ON" ? "OFF" : "ON";
    // 메시지 값 (ON -> 1, OFF -> 0)
    const messageValue = newState === "ON" ? "1" : "0";
    
    console.log(`펌프 ${pumpId} 토글: ${currentState} -> ${newState}`);
    
    // 명령 발행
    const topic = getPumpCommandTopic(pumpId);
    mqttClient.publish(topic, messageValue);
    
    // 상태 즉시 업데이트 (UI 반응성 향상)
    setTankData(prev => {
      const updatedTanks = prev.tanks.map(tank => {
        if (tank.id === pumpId) {
          return { ...tank, pumpStatus: newState as "ON" | "OFF" };
        }
        return tank;
      });
      
      const updatedState = { ...prev, tanks: updatedTanks };
      
      // 서버에 상태 저장
      saveStateToServer(updatedState);
      
      return updatedState;
    });
  };
  
  // 펌프 리셋 함수 추가
  const resetPump = (pumpId: number) => {
    if (!mqttClient) return;
    
    console.log(`펌프 ${pumpId} 리셋 명령 발행`);
    
    // 리셋 명령(3) 발행
    const topic = getPumpCommandTopic(pumpId);
    mqttClient.publish(topic, "3");
  };
  
  // 펌프 K 명령 함수 추가
  const sendPumpKCommand = (pumpId: number) => {
    if (!mqttClient) return;
    
    console.log(`펌프 ${pumpId}에 k 명령 발행`);
    
    // k 명령 발행 (소문자로 변경)
    const topic = getPumpCommandTopic(pumpId);
    mqttClient.publish(topic, "k");
  };

  // 추출 명령 발행 함수 추가
  const sendExtractionCommand = (command: string) => {
    if (!mqttClient) return;
    
    console.log(`추출 명령 발행: ${command}`);
    
    // 추출 명령 발행 (extwork/extraction/input 토픽으로)
    const topic = "extwork/extraction/input";
    mqttClient.publish(topic, command);
    
    // 로그 메시지 추가
    setProgressMessages(prev => {
      const newMessage = {
        timestamp: Date.now(),
        message: `추출 명령 발행: ${command}`,
        rawJson: null
      };
      return [newMessage, ...prev].slice(0, 10);
    });
  };

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

  // 토픽 구독 함수
  const subscribeToTopic = () => {
    if (!searchTopic || !mqttClient) return
    
    mqttClient.subscribe(searchTopic)
    setSearchTopic("")
  }

  // 밸브 상태 파싱 함수
  const parseValveStateMessage = (message: string) => {
    console.log(`밸브 상태 메시지 파싱 시작: ${message}`);
    
    // 0100 형식의 메시지 처리 (밸브 상태 코드)
    if (message.match(/^[0-1]{4}$/)) {
      // 4자리 0과 1 코드인 경우
      console.log(`밸브 상태 코드 감지: ${message}`);
      
      // 특수 케이스: 0100 (3웨이 밸브 OFF, 2웨이 밸브 ON)
      if (message === '0100') {
        console.log('특수 케이스 0100 감지: 3웨이 밸브 OFF, 2웨이 밸브 ON');
        return {
          valveState: '0100',
          valveAState: '0', // 3웨이 밸브 OFF
          valveBState: '1', // 2웨이 밸브 ON
          valveADesc: '전체순환_교환',
          valveBDesc: '열림'
        };
      }
      
      // 다른 케이스들 (1000, 0000 등)
      const valveAState = message[0];
      const valveBState = message[1];
      const valveCState = message[2];
      const valveDState = message[3];
      
      console.log(`밸브 상태 파싱 결과: A=${valveAState}, B=${valveBState}, C=${valveCState}, D=${valveDState}`);
      
      return {
        valveState: message,
        valveAState,
        valveBState,
        valveCState,
        valveDState,
        valveADesc: valveAState === '1' ? '추출순환' : '전체순환',
        valveBDesc: valveBState === '1' ? '열림' : '닫힘'
      };
    }
    
    return { valveState: message };
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="tanks">
        <TabsList className="mb-4">
          <TabsTrigger value="tanks">탱크 시스템</TabsTrigger>
          <TabsTrigger value="cameras">카메라</TabsTrigger>
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
                    onClick={() => togglePump(tank.id)}
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
                onPumpToggle={togglePump}
                onPumpReset={resetPump}
                onPumpKCommand={sendPumpKCommand}
                pumpStateMessages={pumpStateMessages}
                mqttClient={mqttClient}
                onExtractionCommand={sendExtractionCommand}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cameras" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>카메라 제어</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {Array.from({ length: 5 }, (_, i) => i + 1).map((camNumber) => (
                  <Card key={`cam-${camNumber}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">카메라 {camNumber}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <span>OFF</span>
                          <Switch 
                            id={`cam-switch-${camNumber}`}
                            checked={camStates[camNumber - 1] === 'ON'}
                            onCheckedChange={() => toggleCamera(camNumber)}
                          />
                          <span>ON</span>
                        </div>
                        <Badge 
                          variant={camStates[camNumber - 1] === 'ON' ? "default" : "secondary"}
                          className="mt-2"
                        >
                          {camStates[camNumber - 1]}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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