// ===========================================================
//  순서 기억하기.
//  불이 켜지는 순서를 보고 그대로 눌러 맞히는 놀이. 실패해도 도장을 받는다.
// ===========================================================
import { PACE, wait, enter, keepInView, toTop } from '../pace.js';

const CELLS = [
  { name: '해', pic: 'sun' },
  { name: '달', pic: 'moon' },
  { name: '별', pic: 'star' },
  { name: '꽃', pic: 'flower' },
];

// 칸 하나의 속(그림 + 글자)
const cellInner = (c) => `<img class="cell-pic" src="pics/${c.pic}.svg" alt=""><span class="cell-name">${c.name}</span>`;

export function mount(host, done) {
  renderIntro();

  function renderIntro() {
    host.innerHTML = `
      <p class="lead">불이 켜지는 순서를 잘 보세요</p>
      <div class="memory-grid">
        ${CELLS.map((c) => `<button class="memory-cell" disabled>${cellInner(c)}</button>`).join('')}
      </div>
      <div id="buttons">
        <button class="big-btn primary" id="start">보여 주세요</button>
      </div>`;
    enter(host);
    host.querySelector('#start').onclick = runRound;
  }

  async function runRound() {
    toTop();
    const order = shuffle([0, 1, 2, 3]).slice(0, 3);

    host.innerHTML = `
      <p class="step">잘 보세요</p>
      <div class="memory-grid" id="grid">
        ${CELLS.map((c) => `<button class="memory-cell" disabled>${cellInner(c)}</button>`).join('')}
      </div>`;

    const cells = host.querySelectorAll('.memory-cell');
    await wait(PACE.memoryLead);
    for (const i of order) {
      cells[i].classList.add('lit');
      // eslint-disable-next-line no-await-in-loop
      await wait(PACE.memoryOn);
      cells[i].classList.remove('lit');
      // eslint-disable-next-line no-await-in-loop
      await wait(PACE.memoryGap);
    }

    askGuess(order);
  }

  function askGuess(order) {
    host.innerHTML = `
      <p class="lead">켜진 순서대로 눌러 보세요</p>
      <div class="memory-grid" id="grid">
        ${CELLS.map((c, i) => `<button class="memory-cell" data-i="${i}">${cellInner(c)}</button>`).join('')}
      </div>
      <p class="feedback" id="word"></p>`;

    const picks = [];
    const cells = host.querySelectorAll('.memory-cell');
    cells.forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        picks.push(i);
        btn.disabled = true;
        btn.classList.add('picked');
        btn.insertAdjacentHTML('beforeend', `<span class="memory-order">${picks.length}</span>`);
        if (picks.length === 3) {
          cells.forEach((b) => { b.disabled = true; });
          checkResult(order, picks);
        }
      };
    });
  }

  async function checkResult(order, picks) {
    const wordEl = host.querySelector('#word');
    wordEl.textContent = '맞았을까요…';

    await wait(PACE.suspense);

    const correct = order.every((v, i) => v === picks[i]);
    if (correct) {
      wordEl.innerHTML = '<span class="badge ok">정답입니다</span> 순서를 모두 기억하셨습니다';
    } else {
      const orderNames = order.map((i) => CELLS[i].name).join(' → ');
      wordEl.innerHTML = `<span class="badge no">아쉬워요</span> 켜진 순서는 "${orderNames}" 이었습니다`;
    }

    const buttonsHtml = correct
      ? '<div id="buttons"><button class="big-btn primary" id="finish">도장 받기</button></div>'
      : `<div id="buttons">
          <button class="big-btn primary" id="retry">한 번 더 해보기</button>
          <button class="big-btn ghost" id="finish">도장 받기</button>
        </div>`;
    host.insertAdjacentHTML('beforeend', buttonsHtml);

    const buttonsEl = host.querySelector('#buttons');
    enter(buttonsEl);
    keepInView(buttonsEl);
    buttonsEl.querySelector('#finish').onclick = done;
    const retryBtn = buttonsEl.querySelector('#retry');
    if (retryBtn) retryBtn.onclick = runRound;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
