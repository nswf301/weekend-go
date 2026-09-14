// ===========================================================
//  숫자 누르기.
//  3×3 칸에 섞어 놓은 1~9를 1부터 차례로 누른다. 세 판.
//  시간·벌점·순위 없음. 틀리면 그 칸만 잠깐 빨갛게 됐다가 돌아온다.
// ===========================================================
import { PACE, wait, enter } from '../pace.js';

const ROUNDS = 3;

export function mount(host, done) {
  let round = 0;
  renderRound();

  // 판이 바뀌어도 같은 구조로 다시 그린다. 격자 위 안내는 한 줄 .lead 고정이라
  // 격자 위치가 판마다 같다. 같은 놀이 안이므로 맨 위로 되돌리지 않는다(되돌리면 화면이 튄다).
  function renderRound() {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    host.innerHTML = `
      <p class="lead">1부터 차례로 눌러 주세요</p>
      <div class="tap-grid number-grid" id="grid">
        ${nums.map((n) => `<button class="tap-cell number-cell" data-n="${n}">${n}</button>`).join('')}
      </div>`;
    enter(host);

    let next = 1;
    host.querySelectorAll('.tap-cell').forEach((btn) => {
      let timer = null;
      btn.onclick = () => {
        if (Number(btn.dataset.n) === next) {
          clearTimeout(timer);
          btn.classList.remove('no');
          btn.classList.add('ok');
          btn.disabled = true;
          next += 1;
          if (next > 9) finishRound();
          return;
        }
        btn.classList.add('no');
        clearTimeout(timer);
        timer = setTimeout(() => btn.classList.remove('no'), PACE.tapWrong);
      };
    });
  }

  async function finishRound() {
    round += 1;
    await wait(PACE.roundDone);
    const last = round >= ROUNDS;
    showResult(
      last ? '세 판을 모두 마치셨습니다' : `${round}판째를 모두 누르셨습니다`,
      last ? '도장 받기' : '다음 판',
      last ? done : renderRound,
    );
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
