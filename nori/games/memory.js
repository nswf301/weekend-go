// ===========================================================
//  순서 기억하기.
//  불이 켜지는 순서를 보고 그대로 눌러 맞히는 놀이. 실패해도 도장을 받는다.
// ===========================================================
import { PACE, wait, enter } from '../pace.js';

const CELLS = [
  { name: '해', pic: 'sun' },
  { name: '달', pic: 'moon' },
  { name: '별', pic: 'star' },
  { name: '꽃', pic: 'flower' },
  { name: '소', pic: 'cow' },
  { name: '배', pic: 'pear' },
];

// 칸 하나의 속(그림 + 글자)
const cellInner = (c) => `<img class="cell-pic" src="pics/${c.pic}.svg" alt=""><span class="cell-name">${c.name}</span>`;

// [보여 주세요] 버튼 자리. 불 켜지는 중·누르는 중에도 안 보이게 남겨 페이지 길이를 유지한다.
// 버튼이 사라져 페이지가 짧아지면 내려 두었던 화면이 아래로 튄다(사용자 지적).
const startSlot = (visible) => `
  <div id="buttons">
    <button class="big-btn primary${visible ? '' : ' slot-off'}" id="start">보여 주세요</button>
  </div>`;

export function mount(host, done) {
  renderIntro();

  function renderIntro() {
    host.innerHTML = `
      <p class="lead">불이 켜지는 순서를 잘 보세요</p>
      <div class="memory-grid">
        ${CELLS.map((c) => `<button class="memory-cell" disabled>${cellInner(c)}</button>`).join('')}
      </div>
      ${startSlot(true)}`;
    enter(host);
    host.querySelector('#start').onclick = runRound;
  }

  // 같은 화면 안에서 단계만 바뀌므로 맨 위로 되돌리지 않는다(되돌리면 화면이 튄다).
  // 격자 위 안내는 세 단계 모두 같은 .lead 로 둔다. 글자 모양이 다르면 높이가 달라 격자가 튄다.
  async function runRound() {
    const order = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 4);

    host.innerHTML = `
      <p class="lead">잘 보세요</p>
      <div class="memory-grid" id="grid">
        ${CELLS.map((c) => `<button class="memory-cell" disabled>${cellInner(c)}</button>`).join('')}
      </div>
      ${startSlot(false)}`;

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
      ${startSlot(false)}`;

    const picks = [];
    const cells = host.querySelectorAll('.memory-cell');
    cells.forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        picks.push(i);
        btn.disabled = true;
        btn.classList.add('picked');
        btn.insertAdjacentHTML('beforeend', `<span class="memory-order">${picks.length}</span>`);
        if (picks.length === 4) {
          cells.forEach((b) => { b.disabled = true; });
          checkResult(order, picks);
        }
      };
    });
  }

  // 결과는 퀴즈(choice.js)와 같은 팝업으로 보여준다(사용자 요청).
  // 뜸을 들인 뒤 결과를 담은 팝업이 한 번에 뜬다("맞았을까요…" 단계는 없앴다).
  // 버튼 칸은 처음부터 두 개 자리를 잡아 둬서, 맞았을 때(버튼 1개)와 틀렸을 때(2개) 팝업 크기가 같다.
  async function checkResult(order, picks) {
    await wait(PACE.suspense);

    const correct = order.every((v, i) => v === picks[i]);
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    popup.innerHTML = `
      <div class="card popup-card memory-popup" role="dialog" aria-modal="true">
        <div class="popup-feedback"><p class="feedback" id="word"></p></div>
        <div id="buttons">
          <button class="big-btn primary slot-off" id="slot1"></button>
          <button class="big-btn ghost slot-off" id="slot2"></button>
        </div>
      </div>`;
    const wordEl = popup.querySelector('#word');
    const slot1 = popup.querySelector('#slot1');
    const slot2 = popup.querySelector('#slot2');
    const close = (next) => () => { popup.remove(); next(); };

    if (correct) {
      // [도장 받기]는 틀렸을 때와 같은 아래 칸에 둔다(위 칸은 빈 자리로 남긴다)
      wordEl.innerHTML = '<span class="badge ok">정답입니다</span> 순서를 모두 기억하셨습니다';
      slot2.textContent = '도장 받기';
      slot2.onclick = close(done);
      slot2.classList.replace('ghost', 'primary');
      slot2.classList.remove('slot-off');
    } else {
      const orderNames = order.map((i) => CELLS[i].name).join(' → ');
      wordEl.innerHTML = `<span class="badge no">아쉬워요</span> 켜진 순서는 "${orderNames}" 이었습니다`;
      slot1.textContent = '한 번 더 해보기';
      slot1.onclick = close(runRound);
      slot2.textContent = '도장 받기';
      slot2.onclick = close(done);
      slot1.classList.remove('slot-off');
      slot2.classList.remove('slot-off');
    }
    document.body.appendChild(popup);
    enter(popup);
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
