// ===========================================================
//  가위바위보 세 판.
//  세 판을 겨루고 전적을 보여준다. 져도 도장은 받는다.
// ===========================================================
import { PACE, wait, enter } from '../pace.js';

const HANDS = [
  { key: 'scissors', name: '가위' },
  { key: 'rock', name: '바위' },
  { key: 'paper', name: '보' },
];

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
      <div id="picks">
        ${HANDS.map((h) => `<button class="big-btn" data-k="${h.key}">${h.name}</button>`).join('')}
      </div>
      <p class="feedback" id="word"></p>
      <div id="buttons"></div>`;
    enter(host);

    host.querySelectorAll('#picks button').forEach((btn) => {
      btn.onclick = () => playRound(btn.dataset.k);
    });
  }

  async function playRound(mine) {
    host.querySelectorAll('#picks button').forEach((b) => { b.disabled = true; });
    host.querySelector(`#picks button[data-k="${mine}"]`).classList.add('picked');

    const other = HANDS[Math.floor(Math.random() * HANDS.length)].key;
    const result = judge(mine, other);
    const myName = HANDS.find((h) => h.key === mine).name;
    const otherName = HANDS.find((h) => h.key === other).name;

    const picksEl = host.querySelector('#picks');
    picksEl.insertAdjacentHTML('afterend', '<p class="question" id="beat"></p>');
    const beatEl = host.querySelector('#beat');

    for (const word of ['가위…', '바위…', '보!']) {
      beatEl.textContent = word;
      // eslint-disable-next-line no-await-in-loop
      await wait(PACE.rpsBeat);
    }
    beatEl.remove();

    let text;
    if (result === 1) { win += 1; text = `내 ${myName}, 상대 ${otherName} — 이겼습니다`; }
    else if (result === -1) { lose += 1; text = `내 ${myName}, 상대 ${otherName} — 졌습니다`; }
    else { draw += 1; text = `내 ${myName}, 상대 ${otherName} — 비겼습니다`; }

    round += 1;
    host.querySelector('#word').textContent = text;

    const buttonsEl = host.querySelector('#buttons');
    buttonsEl.innerHTML = `<button class="big-btn primary" id="next">${round >= 3 ? '결과 보기' : '다음 판'}</button>`;
    enter(buttonsEl);
    buttonsEl.querySelector('#next').onclick = render;
  }
}
