import mqtt from "mqtt";

class MqttClient {
  private client: mqtt.MqttClient | null = null;
  private topics: Set<string> = new Set();

  // 콜백 함수들
  public onConnect: () => void = () => {};
  public onDisconnect: () => void = () => {};
  public onMessage: (topic: string, message: string) => void = () => {};
  public onError: (error: Error) => void = () => {};

  constructor() {
    // 생성자에서는 초기화만 수행
    // 브라우저 환경에서만 사용 가능
    if (typeof window === 'undefined') {
      console.warn("MqttClient는 브라우저 환경에서만 사용 가능합니다.");
    } else {
      console.log("MqttClient 초기화됨 - 브라우저 환경:", window.location.href);
    }
  }

  // MQTT 브로커에 연결
  connect() {
    // 브라우저 환경에서만 연결 시도
    if (typeof window === 'undefined') {
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
      this.client.end(true);
    }

    console.log("MQTT 브로커에 연결 시도 중... 현재 URL:", window.location.href);

    try {
      // 현재 브라우저 환경에 따라 다른 연결 옵션 사용
      // Vercel 배포 환경인지 확인 (URL에 vercel.app이 포함되어 있는지)
      const isVercelEnv = window.location.href.includes('vercel.app');
      console.log("Vercel 환경 여부:", isVercelEnv);

      // MQTT 연결 옵션
      const options: mqtt.IClientOptions = {
        clientId: `extwork_${Math.random().toString(16).substring(2, 10)}`,
        username: "dnature",
        password: "XihQ2Q%RaS9u#Z3g",
        protocol: "wss",
        protocolVersion: 4,
        reconnectPeriod: 5000,
        connectTimeout: 30000, // 타임아웃 증가
        keepalive: 60,
        rejectUnauthorized: false,
        // WebSocket 전송 옵션 추가
        transformWsUrl: (url, options, client) => {
          console.log("WebSocket 원본 URL:", url);
          
          // Vercel 환경에서 추가 설정
          if (isVercelEnv) {
            // 명시적으로 URL을 지정
            url = "wss://api.codingpen.com:8884/mqtt";
            console.log("Vercel 환경: WebSocket URL 변환됨:", url);
          }
          
          return url;
        },
      };

      // MQTT 브로커에 연결 (호스트 이름 직접 지정)
      // Vercel 환경인 경우 wss:// 프로토콜 사용
      const brokerUrl = isVercelEnv 
        ? "wss://api.codingpen.com:8884/mqtt" 
        : "wss://api.codingpen.com:8884/mqtt";
      
      console.log(`연결 시도 URL: ${brokerUrl}`);
      
      this.client = mqtt.connect(brokerUrl, options);
      console.log("MQTT 클라이언트 생성 완료, 연결 시도 중...");

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
          // 약간의 지연 후에 상태 요청 메시지 발행 (모든 구독이 완료되도록)
          if (this.client?.connected) {
            this.client.publish("extwork/valve/input", "STATUS");
            console.log("밸브 상태 요청 메시지 발행 완료: extwork/valve/input - STATUS");
          }
        }, 1000);
        
        this.onConnect();
      });

      this.client.on("reconnect", () => {
        console.log("MQTT 브로커에 재연결 중...");
      });

      this.client.on("error", (err) => {
        console.error("MQTT 오류:", err.message, err.stack);
        this.onError(err);
      });

      this.client.on("close", () => {
        console.log("MQTT 연결이 종료되었습니다.");
        this.onDisconnect();
      });

      this.client.on("offline", () => {
        console.log("MQTT 클라이언트가 오프라인 상태입니다.");
      });

      this.client.on("message", (topic, message) => {
        const messageStr = message.toString();
        console.log(`메시지 수신: ${topic} - ${messageStr.substring(0, 100)}${messageStr.length > 100 ? '...' : ''}`);
        this.onMessage(topic, messageStr);
      });
    } catch (err) {
      console.error("MQTT 연결 오류:", err);
      this.onError(err as Error);
    }
  }

  // 토픽 구독
  subscribe(topic: string) {
    if (!this.client?.connected) {
      console.log(`토픽 ${topic}을(를) 구독하기 위해 대기 중. 연결 후 구독합니다.`);
      this.topics.add(topic); // 나중에 연결되면 구독할 토픽 저장
      // 연결되어 있지 않으면 연결 시도
      if (!this.client) {
        this.connect();
      }
      return;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error(`토픽 구독 실패: ${topic}`, err);
      } else {
        console.log(`토픽 구독 성공: ${topic}`);
        this.topics.add(topic);
      }
    });
  }

  // 토픽 구독 해제
  unsubscribe(topic: string) {
    if (!this.client?.connected) {
      console.log("MQTT 브로커에 연결되어 있지 않습니다.");
      this.topics.delete(topic);
      return;
    }

    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`토픽 구독 해제 실패: ${topic}`, err);
      } else {
        console.log(`토픽 구독 해제 성공: ${topic}`);
        this.topics.delete(topic);
      }
    });
  }

  // 메시지 발행
  publish(topic: string, message: string) {
    if (!this.client?.connected) {
      console.log(`토픽 ${topic}에 메시지 발행을 위해 대기 중. 연결 후 발행합니다.`);
      
      // 연결되어 있지 않으면 연결 시도
      if (!this.client) {
        this.connect();
      }
      
      // 연결 후 메시지 발행을 위해 이벤트 핸들러 등록
      const publishAfterConnect = () => {
        console.log(`연결 후 발행: ${topic} - ${message}`);
        this.client?.publish(topic, message);
        this.client?.removeListener("connect", publishAfterConnect);
      };
      
      this.client?.on("connect", publishAfterConnect);
      return;
    }

    this.client.publish(topic, message, (err) => {
      if (err) {
        console.error(`메시지 발행 실패: ${topic}`, err);
      } else {
        console.log(`메시지 발행 성공: ${topic} - ${message}`);
      }
    });
  }

  // 연결 종료
  disconnect() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }

  // 연결 상태 확인
  isConnected(): boolean {
    return !!this.client?.connected;
  }
}

export default MqttClient; 