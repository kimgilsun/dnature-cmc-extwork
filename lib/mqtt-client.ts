let mqtt: any;

// 클라이언트 사이드에서만 mqtt 모듈 로드
if (typeof window !== 'undefined') {
  try {
    mqtt = require('mqtt');
  } catch (e) {
    console.error("MQTT 모듈 로드 실패:", e);
  }
}

class MqttClient {
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
    // 브라우저 환경인지 확인
    if (typeof window === 'undefined') {
      console.warn("MqttClient는 브라우저 환경에서만 사용 가능합니다.");
      return;
    }

    // mqtt 모듈 로드 확인
    if (!mqtt) {
      console.error("MQTT 모듈이 로드되지 않았습니다.");
      return;
    }
    
    // 옵션이 제공된 경우 콜백 함수 설정
    if (options) {
      if (options.onConnect) this.onConnect = options.onConnect;
      if (options.onDisconnect) this.onDisconnect = options.onDisconnect;
      if (options.onMessage) this.onMessage = (topic: string, message: string) => {
        options.onMessage(topic, message);
      };
      if (options.onError) this.onError = options.onError;
    }
    
    console.log("MqttClient 초기화됨 - 브라우저 환경:", window.location.href);
  }

  // MQTT 브로커에 연결
  connect() {
    // 브라우저 환경에서만 연결 시도
    if (typeof window === 'undefined' || !mqtt) {
      console.warn("브라우저 환경에서만 MQTT 연결이 가능합니다.");
      return;
    }

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

    try {
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
        console.log("MQTT 클라이언트가 오프라인 상태입니다.");
      });

      this.client.on("message", (topic: string, message: any) => {
        try {
          const messageStr = message.toString();
          console.log(`메시지 수신: ${topic} - ${messageStr.substring(0, 100)}${messageStr.length > 100 ? '...' : ''}`);
          this.onMessage(topic, messageStr);
        } catch (e) {
          console.error("메시지 처리 중 오류:", e);
        }
      });
    } catch (err) {
      console.error("MQTT 연결 오류:", err);
      this.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // 토픽 구독
  subscribe(topic: string) {
    if (typeof window === 'undefined' || !mqtt) {
      console.warn("브라우저 환경에서만 MQTT 구독이 가능합니다.");
      return;
    }
    
    if (!this.client?.connected) {
      console.log(`토픽 ${topic}을(를) 구독하기 위해 대기 중. 연결 후 구독합니다.`);
      this.topics.add(topic); // 나중에 연결되면 구독할 토픽 저장
      // 연결되어 있지 않으면 연결 시도
      if (!this.client) {
        this.connect();
      }
      return;
    }

    try {
      this.client.subscribe(topic, (err: any) => {
        if (err) {
          console.error(`토픽 구독 실패: ${topic}`, err);
        } else {
          console.log(`토픽 구독 성공: ${topic}`);
          this.topics.add(topic);
        }
      });
    } catch (e) {
      console.error(`토픽 구독 중 예외 발생: ${topic}`, e);
    }
  }

  // 토픽 구독 해제
  unsubscribe(topic: string) {
    if (typeof window === 'undefined' || !mqtt) {
      console.warn("브라우저 환경에서만 MQTT 구독 해제가 가능합니다.");
      return;
    }
    
    if (!this.client?.connected) {
      console.log("MQTT 브로커에 연결되어 있지 않습니다.");
      this.topics.delete(topic);
      return;
    }

    try {
      this.client.unsubscribe(topic, (err: any) => {
        if (err) {
          console.error(`토픽 구독 해제 실패: ${topic}`, err);
        } else {
          console.log(`토픽 구독 해제 성공: ${topic}`);
          this.topics.delete(topic);
        }
      });
    } catch (e) {
      console.error(`토픽 구독 해제 중 예외 발생: ${topic}`, e);
      this.topics.delete(topic);
    }
  }

  // 메시지 발행
  publish(topic: string, message: string) {
    if (typeof window === 'undefined' || !mqtt) {
      console.warn("브라우저 환경에서만 MQTT 메시지 발행이 가능합니다.");
      return;
    }
    
    if (!this.client?.connected) {
      console.log(`토픽 ${topic}에 메시지 발행을 위해 대기 중. 연결 후 발행합니다.`);
      
      // 연결되어 있지 않으면 연결 시도
      if (!this.client) {
        this.connect();
      }
      
      // 연결 후 메시지 발행을 위해 이벤트 핸들러 등록
      const publishAfterConnect = () => {
        try {
          console.log(`연결 후 발행: ${topic} - ${message}`);
          this.client?.publish(topic, message);
        } catch (e) {
          console.error(`연결 후 메시지 발행 중 오류: ${topic}`, e);
        }
        this.client?.removeListener("connect", publishAfterConnect);
      };
      
      try {
        this.client?.on("connect", publishAfterConnect);
      } catch (e) {
        console.error("이벤트 리스너 등록 중 오류:", e);
      }
      return;
    }

    try {
      this.client.publish(topic, message, (err: any) => {
        if (err) {
          console.error(`메시지 발행 실패: ${topic}`, err);
        } else {
          console.log(`메시지 발행 성공: ${topic} - ${message}`);
        }
      });
    } catch (e) {
      console.error(`메시지 발행 중 예외 발생: ${topic}`, e);
    }
  }

  // 연결 종료
  disconnect() {
    if (typeof window === 'undefined' || !mqtt) {
      console.warn("브라우저 환경에서만 MQTT 연결 종료가 가능합니다.");
      return;
    }
    
    if (this.client) {
      try {
        this.client.end(true);
        this.client = null;
      } catch (e) {
        console.error("연결 종료 중 오류:", e);
        this.client = null;
      }
    }
  }

  // 연결 상태 확인
  isConnected(): boolean {
    if (typeof window === 'undefined' || !mqtt) {
      return false;
    }
    
    try {
      return !!this.client?.connected;
    } catch (e) {
      console.error("연결 상태 확인 중 오류:", e);
      return false;
    }
  }
}

// 서버 사이드 렌더링 시 빈 객체 반환을 위한 기본 export
const createMqttClient = (options?: any) => {
  // 서버 사이드 렌더링인 경우 더미 클라이언트 반환
  if (typeof window === 'undefined') {
    return {
      connect: () => {},
      disconnect: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
      publish: () => {},
      isConnected: () => false
    };
  }
  
  // 클라이언트 사이드에서는 실제 클라이언트 반환
  return new MqttClient(options);
};

export default MqttClient; 