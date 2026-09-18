// ===========================================================
//  그림 찾기.
//  4×4 칸에 그림 네 종류가 네 장씩 섞여 있다. 안내에 나온 그림 네 장을 모두 누른다. 세 판.
//  시간·벌점·순위 없음. 틀리면 그 칸만 잠깐 빨갛게 됐다가 돌아온다.
// ===========================================================
import { PACE, wait, enter } from '../pace.js';

// 판마다 쓰는 그림 네 종류. 한 판 안에서는 모양·색이 확실히 다른 것끼리 묶었다.
// 판끼리 그림이 겹치지 않으므로 찾을 그림은 판마다 반드시 달라진다.
const SETS = [
  [
    { name: '사과', pic: 'apple' },
    { name: '배추', pic: 'cabbage' },
    { name: '별', pic: 'star' },
    { name: '고등어', pic: 'mackerel' },
  ],
  [
    { name: '꽃', pic: 'flower' },
    { name: '달', pic: 'moon' },
    { name: '소', pic: 'cow' },
    { name: '돈', pic: 'money' },
  ],
  [
    { name: '해', pic: 'sun' },
    { name: '돼지', pic: 'pig' },
    { name: '호미', pic: 'homi' },
    { name: '장구', pic: 'janggu' },
  ],
];

// 이름 끝 글자에 받침이 있으면 '을', 없으면 '를'
function eulReul(word) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code % 28 !== 0 ? '을' : '를';
}

export function mount(host, done) {
  let round = 0;
  renderRound();

  // 판이 바뀌어도 같은 구조로 다시 그린다. 안내 줄은 높이를 고정해 둬서(그림 크기·글자 한 줄)
  // 격자 위치가 판마다 같다. 같은 놀이 안이므로 맨 위로 되돌리지 않는다.
  function renderRound() {
    const set = SETS[round];
    const target = set[Math.floor(Math.random() * set.length)];
    const cells = shuffle(set.flatMap((p) => [p, p, p, p]));

    host.innerHTML = `
      <p class="lead find-lead"><img class="find-target" src="pics/${target.pic}.svg" alt=""><span>${target.name}${eulReul(target.name)} 모두 눌러 주세요</span></p>
      <div class="tap-grid find-grid" id="grid">
        ${cells.map((p) => `<button class="tap-cell find-cell" data-p="${p.pic}"><img src="pics/${p.pic}.svg" alt=""></button>`).join('')}
      </div>`;
    enter(host);

    let found = 0;
    host.querySelectorAll('.tap-cell').forEach((btn) => {
      let timer = null;
      btn.onclick = () => {
        if (btn.dataset.p === target.pic) {
          clearTimeout(timer);
          btn.classList.remove('no');
          btn.classList.add('ok');
          btn.disabled = true;
          found += 1;
          if (found >= 4) {
            // 다 찾았으면 나머지 칸도 잠근다(팝업 전 0.8초 동안 눌러도 변화 없게)
            host.querySelectorAll('.tap-cell').forEach((b) => { b.disabled = true; });
            finishRound();
          }
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
    const last = round >= SETS.length;
    showResult(
      last ? '세 판을 모두 마치셨습니다' : `${round}판째 그림을 모두 찾으셨습니다`,
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
        <div class="popup-feedback"><p class="feedback"><span class="badge ok">성공</span> ${text}</p></div>
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
