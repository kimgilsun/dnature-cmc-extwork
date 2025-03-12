# MQTT 탱크 시스템 대시보드

MQTT를 사용하여 탱크 시스템의 상태를 모니터링하고 제어하는 웹 대시보드 애플리케이션입니다.

## 로컬 개발

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

개발 서버는 [http://localhost:3000](http://localhost:3000)에서 실행됩니다.

## Vercel 배포 관련 주의사항

### MQTT WebSocket 연결

이 애플리케이션은 `wss://api.codingpen.com:8884/mqtt`로 WebSocket을 통한 MQTT 연결을 사용합니다. Vercel 환경에서 배포할 때 다음 사항에 주의하세요:

1. **CORS 처리**: `next.config.js`에 CORS 헤더가 설정되어 있습니다.
2. **WebSocket 연결**: 브라우저 환경에서만 WebSocket 연결이 시도됩니다.
3. **디버깅 페이지**: `/debug` 경로에서 MQTT 연결 상태를 확인할 수 있는 디버깅 페이지를 제공합니다.

### 배포 후 문제 해결

배포 후 MQTT 연결 문제가 발생하면:

1. 브라우저 콘솔에서 오류 메시지 확인
2. `/debug` 페이지에서 연결 상태 및 로그 확인
3. WebSocket이 차단되지 않았는지 확인 (일부 프록시나 방화벽에서 WebSocket을 차단할 수 있음)

## MQTT 토픽 구조

애플리케이션에서 사용하는 MQTT 토픽 구조:

- `extwork/valve/input`: 밸브 제어 명령 (1000, 0100, 0000 등)
- `extwork/valve/state`: 밸브 상태 정보
- `extwork/extraction/progress`: 추출 진행 상황 (JSON 형식)
- `extwork/extraction/error`: 오류 메시지
- `extwork/inverter{N}/state`: 인버터(펌프) 상태 (N은 인버터 번호)
- `extwork/inverter{N}/tank{M}_level`: 탱크 수위 (N은 인버터 번호, M은 탱크 번호)
- `extwork/cam{N}/command`: 카메라 제어 명령 (N은 카메라 번호)
- `extwork/cam{N}/state`: 카메라 상태 (N은 카메라 번호)

## 디버깅

문제 발생 시 아래 방법으로 디버깅할 수 있습니다:

1. 브라우저 개발자 도구의 콘솔 로그 확인
2. `/debug` 페이지에서 MQTT 연결 상태 및 오류 확인
3. 로컬에서 `test-mqtt.js` 또는 `test-mqtt-complex.js` 스크립트를 실행하여 MQTT 메시지 발행 테스트

## Vercel 배포 시 환경 변수 설정

필요한 경우 다음 환경 변수를 Vercel 프로젝트 설정에 추가할 수 있습니다:

- `NEXT_PUBLIC_MQTT_BROKER`: MQTT 브로커 URL (기본값: wss://api.codingpen.com:8884/mqtt)
- `NEXT_PUBLIC_MQTT_USERNAME`: MQTT 브로커 사용자 이름
- `NEXT_PUBLIC_MQTT_PASSWORD`: MQTT 브로커 비밀번호
# extwork-dnature
