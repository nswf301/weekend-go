// ===========================================================
//  숫자 누르기.
//  3×3 칸에 섞어 놓은 1~9를 1부터 차례로 누른다. 두 판.
//  2판째만 10초 시간 제한(줄어드는 막대로 보여준다). 시간은 격자가 눌릴 수
//  있게 되는 순간(enter의 buttonDelay 뒤)부터 센다. 시간이 다 되면 다시
//  하기 없이 도장만 받는다. 틀리면 그 칸만 잠깐 빨갛게 됐다가 돌아온다.
// ===========================================================
import { PACE, wait, enter } from '../pace.js';

const ROUNDS = 2;

export function mount(host, done) {
  let round = 0;
  renderRound();

  // 판이 바뀌어도 같은 구조로 다시 그린다. 격자 위 시간 막대 자리는 1판에도
  // (안 보이게) 잡아 둬서 격자 위치가 판마다 같다. 같은 놀이 안이므로 맨
  // 위로 되돌리지 않는다(되돌리면 화면이 튄다).
  function renderRound() {
    const isTimed = round === ROUNDS - 1; // 마지막 판(2판째)만 시간 제한
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    host.innerHTML = `
      <p class="lead">1부터 차례로 눌러 주세요</p>
      <div class="number-bar-wrap${isTimed ? '' : ' slot-off'}"><div class="number-bar" id="bar"></div></div>
      <div class="tap-grid number-grid" id="grid">
        ${nums.map((n) => `<button class="tap-cell number-cell" data-n="${n}">${n}</button>`).join('')}
      </div>`;
    enter(host);

    let next = 1;
    let over = false; // 시간 초과되면 true — 늦게 들어오는 클릭을 막는다
    let timer = null;

    if (isTimed) {
      const bar = host.querySelector('#bar');
      // 시간은 격자가 실제로 눌릴 수 있게 되는 순간(buttonDelay 뒤)부터 센다
      setTimeout(() => {
        if (!bar.isConnected) return; // 그사이 화면을 떠났으면 그만둔다
        bar.style.transition = `width ${PACE.numberLimit}ms linear`;
        void bar.offsetWidth; // 강제 리플로우 후 줄여야 transition이 재생된다
        bar.style.width = '0%';
        timer = setTimeout(onTimeout, PACE.numberLimit);
      }, PACE.buttonDelay);
    }

    host.querySelectorAll('.tap-cell').forEach((btn) => {
      let wrongTimer = null;
      btn.onclick = () => {
        if (over) return;
        if (Number(btn.dataset.n) === next) {
          clearTimeout(wrongTimer);
          btn.classList.remove('no');
          btn.classList.add('ok');
          btn.disabled = true;
          next += 1;
          if (next > 9) {
            clearTimeout(timer);
            finishRound();
          }
          return;
        }
        btn.classList.add('no');
        clearTimeout(wrongTimer);
        wrongTimer = setTimeout(() => btn.classList.remove('no'), PACE.tapWrong);
      };
    });

    function onTimeout() {
      if (over) return; // 마지막 칸을 누른 것과 겹쳐도 한 번만 처리
      over = true;
      host.querySelectorAll('.tap-cell').forEach((b) => { b.disabled = true; });
      showTimeout();
    }
  }

  async function finishRound() {
    round += 1;
    await wait(PACE.roundDone);
    const last = round >= ROUNDS;
    const nextIsTimed = !last && round === ROUNDS - 1;
    const text = last
      ? '두 판을 모두 마치셨습니다'
      : `${round}판째를 모두 누르셨습니다${nextIsTimed ? '. 다음 판은 시간 안에 눌러 주세요' : ''}`;
    showResult(
      text,
      last ? '도장 받기' : '다음 판',
      last ? done : renderRound,
    );
  }

  // 시간이 다 됐을 때: 격려 한마디 + [도장 받기]만. 다시 하기는 없다.
  function showTimeout() {
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    popup.innerHTML = `
      <div class="card popup-card" role="dialog" aria-modal="true">
        <div class="popup-feedback"><p class="feedback"><span class="badge no">아쉬워요</span> 시간이 다 됐어요. 그래도 잘 오셨어요</p></div>
        <div id="buttons">
          <button class="big-btn primary" id="next">도장 받기</button>
        </div>
      </div>`;
    document.body.appendChild(popup);
    enter(popup);
    popup.querySelector('#next').onclick = () => { popup.remove(); done(); };
  }

  // 결과는 순서 기억하기와 같은 팝업. 저절로 닫히지 않는다.
  function showResult(text, label, next) {
    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    popup.innerHTML = `
      <div class="card popup-card" role="dialog" aria-modal="true">
        <div class="popup-feedback"><p class="feedback"><span class="badge ok">잘하셨습니다</span> ${text}</p></div>
        <div id="buttons">
          <button class="big-btn primary" id="next">${label}</button>
        </div>
      </div>`;
    document.body.appendChild(popup);
    enter(popup);
    popup.querySelector('#next').onclick = () => { popup.remove(); next(); };
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
