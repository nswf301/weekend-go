// ===========================================================
//  가위바위보 세 판.
//  세 판을 겨루고 전적을 보여준다. 져도 도장은 받는다.
// ===========================================================
import { PACE, wait, enter, keepInView, toTop } from '../pace.js';

const HANDS = [
  { key: 'scissors', name: '가위', pic: 'hand-scissors' },
  { key: 'rock', name: '바위', pic: 'hand-rock' },
  { key: 'paper', name: '보', pic: 'hand-paper' },
];

// 손 하나의 그림 + 글자
const handInner = (h) => `<img class="cell-pic" src="pics/${h.pic}.svg" alt=""><span class="cell-name">${h.name}</span>`;

// a가 b를 이기면 1, 지면 -1, 비기면 0
function judge(a, b) {
  if (a === b) return 0;
  if ((a === 'scissors' && b === 'paper')
    || (a === 'rock' && b === 'scissors')
    || (a === 'paper' && b === 'rock')) return 1;
  return -1;
}

export function mount(host, done) {
  let round = 0;
  let win = 0;
  let lose = 0;
  let draw = 0;

  render();

  function render() {
    toTop();
    if (round >= 3) {
      host.innerHTML = `
        <p class="lead">세 판이 모두 끝났습니다</p>
        <p class="question">${win}승 ${draw > 0 ? `${draw}무 ` : ''}${lose}패</p>
        <p class="feedback">이기고 지는 것은 재미로 보시면 됩니다</p>
        <button class="big-btn primary" id="finish">도장 받기</button>`;
      enter(host);
      host.querySelector('#finish').onclick = done;
      return;
    }

    host.innerHTML = `
      <p class="step">${round + 1}판째 / 3판</p>
      <p class="lead">가위, 바위, 보 중 하나를 내세요</p>
      <div id="picks" class="rps-picks">
        ${HANDS.map((h) => `<button class="big-btn" data-k="${h.key}">${handInner(h)}</button>`).join('')}
      </div>
      <p class="feedback" id="word"></p>
      <div id="buttons"></div>`;
    enter(host);

    host.querySelectorAll('#picks button').forEach((btn) => {
      btn.onclick = () => playRound(btn.dataset.k);
    });
  }

  async function playRound(mine) {
    const other = HANDS[Math.floor(Math.random() * HANDS.length)].key;
    const result = judge(mine, other);
    const myName = HANDS.find((h) => h.key === mine).name;
    const otherName = HANDS.find((h) => h.key === other).name;

    // 고르기 줄(안내 문장·세 칸)을 걷고 그 자리에 나 / 상대 두 칸을 띄운다.
    // 카운트다운은 상대 칸의 그림 자리에서 하고, "보!" 다음에 상대 손이 나타난다.
    host.querySelector('.lead').remove();
    host.querySelector('#picks').outerHTML = `
      <div class="rps-vs" id="vs">
        <div class="rps-side"><p class="rps-who">나</p>${handInner(HANDS.find((h) => h.key === mine))}</div>
        <div class="rps-side" id="other"><p class="rps-who">상대</p><div class="rps-beat" id="beat"></div><span class="cell-name">&nbsp;</span></div>
      </div>`;
    enter(host.querySelector('#vs'));
    const beatEl = host.querySelector('#beat');

    for (const word of ['가위…', '바위…', '보!']) {
      beatEl.textContent = word;
      // eslint-disable-next-line no-await-in-loop
      await wait(PACE.rpsBeat);
    }
    host.querySelector('#other').innerHTML = `<p class="rps-who">상대</p>${handInner(HANDS.find((h) => h.key === other))}`;

    let text;
    if (result === 1) { win += 1; text = `내 ${myName}, 상대 ${otherName} — 이겼습니다`; }
    else if (result === -1) { lose += 1; text = `내 ${myName}, 상대 ${otherName} — 졌습니다`; }
    else { draw += 1; text = `내 ${myName}, 상대 ${otherName} — 비겼습니다`; }

    round += 1;
    host.querySelector('#word').textContent = text;

    const buttonsEl = host.querySelector('#buttons');
    buttonsEl.innerHTML = `<button class="big-btn primary" id="next">${round >= 3 ? '결과 보기' : '다음 판'}</button>`;
    enter(buttonsEl);
    keepInView(buttonsEl);
    buttonsEl.querySelector('#next').onclick = render;
  }
}
