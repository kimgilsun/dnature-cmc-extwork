// 복잡한 MQTT 테스트 스크립트
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
  
  // 테스트 시나리오: 추출 진행 과정 시뮬레이션
  setTimeout(() => {
    // 추출 시작 메시지
    const startMsg = JSON.stringify({
      pump_id: 1,
      process_info: 'S(1/10)',
      elapsed_time: 10,
      remaining_time: 290,
      total_remaining: 2950,
      process_time: 3000,
      current_stage: 'START',
      status: '추출 시작',
      additional_info: '온도: 78°C, 압력: 9bar'
    });
    console.log('추출 시작 메시지 발행');
    client.publish('extwork/extraction/progress', startMsg);
    
    // 1초 후 중간 진행 메시지
    setTimeout(() => {
      const progressMsg = JSON.stringify({
        pump_id: 1,
        process_info: 'S(5/10)',
        elapsed_time: 150,
        remaining_time: 150,
        total_remaining: 1500,
        process_time: 3000,
        current_stage: 'PROGRESS',
        status: '추출 진행 중',
        additional_info: '온도: 85°C, 압력: 11bar'
      });
      console.log('추출 중간 진행 메시지 발행');
      client.publish('extwork/extraction/progress', progressMsg);
      
      // 1초 후 추출 완료 메시지
      setTimeout(() => {
        const completeMsg = JSON.stringify({
          pump_id: 1,
          process_info: 'S(10/10)',
          elapsed_time: 300,
          remaining_time: 0,
          total_remaining: 0,
          process_time: 3000,
          current_stage: 'COMPLETE',
          status: '추출 완료!',
          additional_info: '온도: 80°C, 압력: 8bar, 추출량: 250ml'
        });
        console.log('추출 완료 메시지 발행');
        client.publish('extwork/extraction/progress', completeMsg);
        
        // 완료 후 연결 종료
        setTimeout(() => {
          client.end();
          console.log('MQTT 연결 종료');
        }, 500);
      }, 1000);
    }, 1000);
  }, 1000);
});

// 에러 처리
client.on('error', (err) => {
  console.error('MQTT 오류:', err);
}); 