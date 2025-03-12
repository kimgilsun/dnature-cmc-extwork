// "use server"

// import mqtt from "mqtt"; // mqtt 전체를 import

// let client: mqtt.MqttClient | null = null; // MqttClient 타입으로 수정


// export async function connectMQTT() {
//   if (!client) {
//     client = mqtt.connect("wss://api.codingpen.com:8884", {
//       username: "dnature",
//       password: "XihQ2Q%RaS9u#Z3g",
//       protocol: "wss",
//       rejectUnauthorized: false, // 자체 서명된 인증서를 사용하는 경우
//     })

//     client.on("connect", () => {
//       console.log("Connected to MQTT broker")
//     })

//     client.on("error", (err) => {
//       console.error("MQTT error:", err)
//     })
//   }
//   return true
// }

// export async function publishMessage(topic: string, message: string) {
//   if (!client) {
//     await connectMQTT()
//   }

//   client?.publish(topic, message)
//   return true
// }

// export async function subscribeTopic(topic: string) {
//   if (!client) {
//     await connectMQTT()
//   }

//   client?.subscribe(topic)
//   return true
// }

// actions/mqtt.ts

// MQTT 클라이언트 타입 정의
interface IMQTTClient {
  connect: () => void;
  disconnect: () => void;
  subscribe: (topic: string, callback?: (topic: string, message: string) => void) => void;
  unsubscribe: (topic: string) => void;
  publish: (topic: string, message: string) => void;
  isConnected: () => boolean;
  on: (event: string, callback: any) => void;
}

// 클라이언트 및 MQTT 객체를 위한 전역 변수
let client: any = null;
let mqtt: any = null;

// 클라이언트 사이드에서만 MQTT 로드
const getMqtt = () => {
  if (typeof window === 'undefined') {
    console.warn('getMqtt가 서버 사이드에서 호출되었습니다. MQTT는 클라이언트 사이드에서만 사용 가능합니다.');
    return null;
  }
  
  if (!mqtt) {
    try {
      mqtt = require('mqtt');
    } catch (error) {
      console.error('MQTT 로드 실패:', error);
      return null;
    }
  }
  
  return mqtt;
};

// MQTT 클라이언트 인스턴스 가져오기
const getClient = () => {
  if (typeof window === 'undefined') {
    console.warn('getClient가 서버 사이드에서 호출되었습니다. MQTT는 클라이언트 사이드에서만 사용 가능합니다.');
    return null;
  }
  
  if (!client) {
    const mqttModule = getMqtt();
    if (!mqttModule) return null;
    
    try {
      client = mqttModule.connect("wss://api.codingpen.com:8884", {
        username: "dnature",
        password: "XihQ2Q%RaS9u#Z3g",
        protocol: "wss",
        protocolVersion: 4,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
        keepalive: 60,
        rejectUnauthorized: false,
        clientId: `extwork_${Math.random().toString(16).substring(2, 10)}`,
      });
      
      // 기본 이벤트 핸들러 설정
      client.on("connect", () => {
        console.log("MQTT 브로커에 연결되었습니다.");
      });
      
      client.on("error", (err: any) => {
        console.error("MQTT 오류:", err);
      });
      
      client.on("close", () => {
        console.log("MQTT 연결이 닫혔습니다.");
      });
    } catch (error) {
      console.error('MQTT 클라이언트 생성 실패:', error);
      return null;
    }
  }
  
  return client;
};

// MQTT 연결 함수
export async function connectMQTT() {
  if (typeof window === 'undefined') {
    console.warn('connectMQTT가 서버 사이드에서 호출되었습니다.');
    return false;
  }
  
  const client = getClient();
  if (!client) return false;
  
  // 이미 연결되어 있으면 바로 반환
  if (client.connected) return true;
  
  // 연결 시도
  client.reconnect();
  return true;
}

// 메시지 발행 함수
export async function publishMessage(topic: string, message: string) {
  if (typeof window === 'undefined') {
    console.warn('publishMessage가 서버 사이드에서 호출되었습니다.');
    return false;
  }
  
  const client = getClient();
  if (!client) return false;
  
  try {
    client.publish(topic, message);
    return true;
  } catch (error) {
    console.error('메시지 발행 실패:', error);
    return false;
  }
}

// 토픽 구독 함수
export async function subscribeTopic(
  topic: string,
  messageHandler: (payload: string) => void
) {
  if (typeof window === 'undefined') {
    console.warn('subscribeTopic이 서버 사이드에서 호출되었습니다.');
    return false;
  }
  
  const client = getClient();
  if (!client) return false;
  
  try {
    client.subscribe(topic);
    
    // 메시지 핸들러 등록
    client.on('message', (receivedTopic: string, message: Buffer) => {
      if (receivedTopic === topic) {
        messageHandler(message.toString());
      }
    });
    
    return true;
  } catch (error) {
    console.error('토픽 구독 실패:', error);
    return false;
  }
}

// 연결 종료 함수
export function disconnectMQTT() {
  if (typeof window === 'undefined') return false;
  
  if (client) {
    client.end();
    client = null;
  }
  return true;
}