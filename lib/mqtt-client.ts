// 더미 MQTT 클라이언트 인터페이스 정의
interface IMQTTClient {
  connect: () => void;
  disconnect: () => void;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  publish: (topic: string, message: string) => void;
  isConnected: () => boolean;
}

// 안전한 더미 MQTT 클라이언트
class SafeDummyMQTTClient implements IMQTTClient {
  private connected: boolean = false;
  private eventHandlers: Record<string, Array<(...args: any[]) => void>> = {};
  
  constructor(options?: any) {
    console.log("안전한 더미 MQTT 클라이언트가 생성되었습니다.");
    this.eventHandlers = {
      'connect': [],
      'disconnect': [],
      'message': [],
      'error': [],
      'reconnect': [],
      'close': [],
      'offline': []
    };
  }
  
  // 이벤트 핸들러 등록 메서드
  on(event: string, callback: (...args: any[]) => void) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
    return this;
  }
  
  // 연결 메서드
  connect() {
    console.log("더미 MQTT 클라이언트: 연결 시도 (아무 작업 없음)");
    this.connected = true;
    // 연결 이벤트 호출
    setTimeout(() => {
      if (this.eventHandlers['connect']) {
        this.eventHandlers['connect'].forEach(handler => {
          try {
            handler();
          } catch (error) {
            console.error('연결 핸들러 오류:', error);
          }
        });
      }
    }, 100);
    return this;
  }
  
  // 연결 해제 메서드
  disconnect() {
    console.log("더미 MQTT 클라이언트: 연결 해제 (아무 작업 없음)");
    this.connected = false;
    // 연결 해제 이벤트 호출
    setTimeout(() => {
      if (this.eventHandlers['close']) {
        this.eventHandlers['close'].forEach(handler => {
          try {
            handler();
          } catch (error) {
            console.error('연결 해제 핸들러 오류:', error);
          }
        });
      }
    }, 100);
    return this;
  }
  
  // 토픽 구독 메서드
  subscribe(topic: string) {
    console.log(`더미 MQTT 클라이언트: '${topic}' 토픽 구독 (아무 작업 없음)`);
    return this;
  }
  
  // 토픽 구독 해제 메서드
  unsubscribe(topic: string) {
    console.log(`더미 MQTT 클라이언트: '${topic}' 토픽 구독 해제 (아무 작업 없음)`);
    return this;
  }
  
  // 메시지 발행 메서드
  publish(topic: string, message: string) {
    console.log(`더미 MQTT 클라이언트: '${topic}' 토픽에 메시지 발행 (아무 작업 없음)`, message);
    return this;
  }
  
  // 연결 상태 확인 메서드
  isConnected() {
    return this.connected;
  }
  
  // 연결 종료 메서드
  end(force?: boolean) {
    console.log("더미 MQTT 클라이언트: 종료", force ? '(강제)' : '');
    this.connected = false;
    return this;
  }
}

// 실제 MQTT 클라이언트 구현 (클라이언트 사이드에서만 사용)
let RealMQTTClient: any = SafeDummyMQTTClient;

// 클라이언트 사이드에서만 실제 구현을 로드
if (typeof window !== 'undefined') {
  try {
    const mqtt = require('mqtt');
    
    RealMQTTClient = class MqttClient implements IMQTTClient {
      private client: any = null;
      private topics: Set<string> = new Set();
    
      // 콜백 함수들
      public onConnect: () => void = () => {};
      public onDisconnect: () => void = () => {};
      public onMessage: (topic: string, message: string) => void = () => {};
      public onError: (error: Error) => void = () => {};
    
      constructor(options?: {
        onConnect?: () => void;
        onDisconnect?: () => void;
        onMessage?: (topic: string, message: any) => void;
        onError?: (error: Error) => void;
      }) {
        if (options) {
          if (options.onConnect) this.onConnect = options.onConnect;
          if (options.onDisconnect) this.onDisconnect = options.onDisconnect;
          if (options.onMessage) this.onMessage = (topic: string, message: string) => {
            options.onMessage(topic, message);
          };
          if (options.onError) this.onError = options.onError;
        }
        
        console.log("MQTT 클라이언트 초기화됨 - 브라우저 환경:", window.location.href);
      }
    
      // MQTT 브로커에 연결
      connect() {
        try {
          if (this.client?.connected) {
            console.log("이미 연결되어 있습니다.");
            this.onConnect();
            return;
          }
      
          // 기존 연결이 있다면 정리
          if (this.client) {
            try {
              this.client.end(true);
            } catch (e) {
              console.error("기존 연결 종료 중 오류 발생:", e);
            }
          }
      
          console.log("MQTT 브로커에 연결 시도 중... 현재 URL:", window.location.href);
      
          // MQTT 연결 옵션
          const options: any = {
            clientId: `extwork_${Math.random().toString(16).substring(2, 10)}`,
            username: "dnature",
            password: "XihQ2Q%RaS9u#Z3g",
            protocol: "wss",
            protocolVersion: 4,
            reconnectPeriod: 5000,
            connectTimeout: 30000, // 타임아웃 증가
            keepalive: 60,
            rejectUnauthorized: false,
          };
      
          // 브로커 URL 설정 (하드코딩된 값 사용)
          const defaultUrl = "wss://api.codingpen.com:8884/mqtt";
          
          console.log(`연결 시도 URL: ${defaultUrl}`);
          
          // 안전하게 MQTT 클라이언트 생성
          try {
            this.client = mqtt.connect(defaultUrl, options);
            console.log("MQTT 클라이언트 생성 완료, 연결 시도 중...");
          } catch (e) {
            console.error("MQTT 클라이언트 생성 중 오류:", e);
            this.onError(e instanceof Error ? e : new Error(String(e)));
            return;
          }
      
          // 이벤트 핸들러 등록
          this.client.on("connect", () => {
            console.log("MQTT 브로커에 연결되었습니다!");
            
            try {
              // 저장된 토픽 다시 구독
              this.topics.forEach(topic => {
                console.log(`재구독 중: ${topic}`);
                this.client?.subscribe(topic);
              });
              
              // 연결 후 밸브 상태 요청 메시지 발행
              console.log("연결 성공 - 현재 밸브 상태 요청 메시지 준비 중...");
              setTimeout(() => {
                try {
                  // 약간의 지연 후에 상태 요청 메시지 발행 (모든 구독이 완료되도록)
                  if (this.client?.connected) {
                    this.client.publish("extwork/valve/input", "STATUS");
                    console.log("밸브 상태 요청 메시지 발행 완료: extwork/valve/input - STATUS");
                  }
                } catch (e) {
                  console.error("상태 요청 메시지 발행 중 오류:", e);
                }
              }, 1000);
              
              this.onConnect();
            } catch (error) {
              console.error("연결 후 처리 중 오류:", error);
              this.onError(error instanceof Error ? error : new Error(String(error)));
            }
          });
      
          this.client.on("reconnect", () => {
            console.log("MQTT 브로커에 재연결 중...");
          });
      
          this.client.on("error", (err: any) => {
            console.error("MQTT 오류:", err.message, err.stack);
            this.onError(err instanceof Error ? err : new Error(String(err)));
          });
      
          this.client.on("close", () => {
            console.log("MQTT 연결이 종료되었습니다.");
            this.onDisconnect();
          });
      
          this.client.on("offline", () => {
            console.log("MQTT 클라이언트가 오프라인 상태가 되었습니다.");
            this.onDisconnect();
          });
      
          this.client.on("message", (topic: string, payload: Buffer) => {
            try {
              const message = payload.toString();
              this.onMessage(topic, message);
            } catch (error) {
              console.error("메시지 수신 중 오류:", error);
            }
          });
        } catch (error) {
          console.error("MQTT 연결 중 예외 발생:", error);
          this.onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    
      // MQTT 브로커와 연결 종료
      disconnect() {
        try {
          if (this.client) {
            this.client.end();
            console.log("MQTT 연결이 종료되었습니다.");
          }
        } catch (error) {
          console.error("MQTT 연결 종료 중 오류:", error);
        }
      }
    
      // 토픽 구독
      subscribe(topic: string) {
        try {
          if (!this.client?.connected) {
            console.log(`클라이언트가 연결되지 않았습니다. 나중에 구독할 토픽 저장: ${topic}`);
            this.topics.add(topic);
            return;
          }
      
          console.log(`토픽 구독: ${topic}`);
          this.client.subscribe(topic);
          this.topics.add(topic);
        } catch (error) {
          console.error(`토픽 구독 중 오류 (${topic}):`, error);
        }
      }
    
      // 토픽 구독 해제
      unsubscribe(topic: string) {
        try {
          if (this.client?.connected) {
            console.log(`토픽 구독 해제: ${topic}`);
            this.client.unsubscribe(topic);
          }
          
          this.topics.delete(topic);
        } catch (error) {
          console.error(`토픽 구독 해제 중 오류 (${topic}):`, error);
        }
      }
    
      // 메시지 발행
      publish(topic: string, message: string) {
        try {
          if (!this.client?.connected) {
            console.warn(`클라이언트가 연결되지 않았습니다. 메시지를 발행할 수 없습니다: ${topic}`);
            return;
          }
          
          console.log(`메시지 발행: ${topic} - ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
          this.client.publish(topic, message);
        } catch (error) {
          console.error(`메시지 발행 중 오류 (${topic}):`, error);
        }
      }
    
      // 연결 상태 확인
      isConnected() {
        try {
          return !!this.client?.connected;
        } catch (error) {
          console.error("연결 상태 확인 중 오류:", error);
          return false;
        }
      }
    };
  } catch (error) {
    console.error("MQTT 모듈 로드 실패, 더미 클라이언트를 사용합니다:", error);
    // 오류가 발생하면 더미 클라이언트 사용
  }
}

// MQTT 클라이언트 생성 함수 (팩토리 함수)
export default function createMqttClient(options?: any): IMQTTClient {
  try {
    // 강제로 실제 MQTT 클라이언트 사용 (더미 클라이언트 사용하지 않음)
    if (typeof window !== 'undefined' && window) {
      if (RealMQTTClient) {
        console.log('실제 MQTT 클라이언트를 사용합니다.');
        return new RealMQTTClient(options);
      }
    }
  } catch (error) {
    console.error('MQTT 클라이언트 생성 중 오류:', error);
  }
  
  console.log('더미 MQTT 클라이언트를 대신 사용합니다.');
  return new SafeDummyMQTTClient(options);
} 