// MQTT 연결 및 메시지 발행 테스트 스크립트
const mqtt = require('mqtt');

// MQTT 브로커 연결 설정
const client = mqtt.connect('wss://api.codingpen.com:8884', {
  username: 'dnature',
  password: 'XihQ2Q%RaS9u#Z3g',
  rejectUnauthorized: false
});

// 연결 성공 시 이벤트 핸들러
client.on('connect', () => {
  console.log('MQTT 브로커에 연결됨');
  
  // 밸브 상태 메시지 발행
  const valveStateMsg = 'valveA=OFF(전체순환_교환), valveB=ON(열림), valveC=OFF(-), valveD=OFF(-)';
  console.log('밸브 상태 메시지 발행:', valveStateMsg);
  client.publish('extwork/valve/state', valveStateMsg);
  
  // 1초 후 JSON 추출 진행 메시지 발행
  setTimeout(() => {
    const jsonMsg = JSON.stringify({
      pump_id: 1,
      process_info: 'S(10/10)',
      elapsed_time: 120,
      remaining_time: 0,
      total_remaining: 0,
      process_time: 3000,
      current_stage: 'COMPLETE',
      status: '추출 완료!',
      additional_info: '테스트 메시지'
    });
    console.log('JSON 추출 진행 메시지 발행');
    client.publish('extwork/extraction/progress', jsonMsg);
    
    // 완료 후 연결 종료
    setTimeout(() => {
      client.end();
      console.log('MQTT 연결 종료');
    }, 500);
  }, 1000);
});

// 에러 처리
client.on('error', (err) => {
  console.error('MQTT 오류:', err);
}); 