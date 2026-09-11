// ===========================================================
//  놀이 속도(시간 값) 모음.
//  어르신 반응 속도에 맞춰 천천히 진행하도록 시간을 여기 한 곳에 모았다.
//  숫자만 바꾸면 앱 전체 속도가 바뀐다. 단위는 1000분의 1초(ms).
// ===========================================================

export const PACE = {
  fadeIn: 1000,         // 화면이 서서히 나타나는 시간
  buttonDelay: 1500,    // 안내 문장이 먼저 뜨고 버튼이 나타나기까지
  suspense: 2000,       // 정답 공개 전 뜸 ("정답은…")
  rpsBeat: 1000,         // 가위… 바위… 보! 한 마디
  cardFlip: 600,         // 짝 맞추기 카드 뒤집히는 효과
  matchFlipBack: 3000,   // 틀린 카드 두 장이 다시 덮이기까지
  memoryLead: 1000,      // 순서 기억하기: 시작 누른 뒤 첫 불까지
  memoryOn: 1500,        // 한 칸에 불이 켜져 있는 시간
  memoryGap: 700,        // 불과 불 사이 쉬는 시간
  stamp: 1500,           // 도장 "쿵" 효과
};

// ms만큼 기다리는 Promise. await wait(1000) 처럼 쓴다.
export function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// root를 서서히 나타나게 하고(다시 불러도 매번 재생된다),
// 그 안의 버튼들은 buttonDelay 뒤에야 눌리도록 늦게 나타나게 한다.
export function enter(root, buttonDelay = PACE.buttonDelay) {
  if (!root) return;

  // 버튼을 먼저 숨긴 뒤에 리플로우를 강제해야 한다. 순서가 바뀌면 리플로우가
  // "아직 안 숨겨진" 상태를 찍어버려서, 숨기는 순간 1→0으로 옅어지는 게 눈에 보인다.
  const buttons = root.querySelectorAll('button');
  buttons.forEach((b) => b.classList.add('wait'));

  root.style.setProperty('--fade', `${PACE.fadeIn}ms`);
  root.classList.remove('enter');
  // eslint-disable-next-line no-void
  void root.offsetWidth; // 강제로 리플로우시켜 애니메이션을 처음부터 다시 재생한다
  root.classList.add('enter');

  setTimeout(() => {
    buttons.forEach((b) => b.classList.remove('wait'));
  }, buttonDelay);
}
