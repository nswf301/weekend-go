// ===========================================================
//  짝 맞추기.
//  카드 6장(3쌍)을 뒤집어 같은 낱말끼리 짝을 찾는다.
//  시간 제한도 실패도 없다. 언제든 포기하고 도장을 받을 수 있다.
//
//  판은 처음 한 번만 그린다. 이후엔 카드 하나하나의 class·글자만
//  바꿔서 뒤집기 효과가 그 카드에서만 재생되게 한다.
// ===========================================================
import { PACE, enter } from '../pace.js';

const WORDS = ['달', '꽃', '별'];

export function mount(host, done) {
  const deck = shuffle([...WORDS, ...WORDS].map((word, i) => ({ word, id: i })));
  const state = deck.map((c) => ({ ...c, faceUp: false, matched: false }));
  let flipped = [];
  let locked = false;
  let matchedCount = 0;

  renderBoard();

  function renderBoard() {
    host.innerHTML = `
      <p class="lead">같은 낱말 카드 두 장을 찾아보세요</p>
      <div class="match-grid" id="grid">
        ${state.map((c, i) => cardHtml(c, i)).join('')}
      </div>
      <p class="feedback" id="word">${matchedCount}쌍 / 3쌍 찾았습니다</p>
      <div id="buttons">
        <button class="big-btn ghost" id="giveup">포기하고 도장 받기</button>
      </div>`;
    enter(host);

    host.querySelectorAll('.match-card').forEach((btn) => {
      btn.onclick = () => pick(Number(btn.dataset.i));
    });
    host.querySelector('#giveup').onclick = done;
  }

  function cardHtml(c, i) {
    const shown = c.faceUp || c.matched;
    const cls = `match-card${shown ? ' open' : ''}${c.matched ? ' matched' : ''}`;
    const style = `transition:transform ${PACE.cardFlip}ms ease, opacity .8s ease, background .12s, border-color .12s`;
    return `<button class="${cls}" data-i="${i}" style="${style}">${shown ? c.word : ''}</button>`;
  }

  // 카드 한 장을 뒤집는(또는 덮는) 효과. 절반 지점에서 글자를 바꿔 끼운다.
  function flipCard(i) {
    const btn = host.querySelector(`.match-card[data-i="${i}"]`);
    const c = state[i];
    const shown = c.faceUp || c.matched;
    btn.classList.add('flip');
    setTimeout(() => {
      btn.textContent = shown ? c.word : '';
      btn.classList.toggle('open', shown);
    }, PACE.cardFlip / 2);
    setTimeout(() => {
      btn.classList.remove('flip');
    }, PACE.cardFlip);
  }

  function markMatched(i) {
    const btn = host.querySelector(`.match-card[data-i="${i}"]`);
    btn.classList.add('matched');
  }

  function updateWord() {
    host.querySelector('#word').textContent = `${matchedCount}쌍 / 3쌍 찾았습니다`;
  }

  function showFinish() {
    const buttonsEl = host.querySelector('#buttons');
    buttonsEl.innerHTML = '<button class="big-btn primary" id="finish">도장 받기</button>';
    enter(buttonsEl);
    buttonsEl.querySelector('#finish').onclick = done;
  }

  function pick(i) {
    if (locked || state[i].matched || state[i].faceUp) return;
    state[i].faceUp = true;
    flipped.push(i);
    flipCard(i);

    if (flipped.length === 2) {
      locked = true;
      const [a, b] = flipped;

      if (state[a].word === state[b].word) {
        setTimeout(() => {
          state[a].matched = true;
          state[b].matched = true;
          markMatched(a);
          markMatched(b);
          matchedCount += 1;
          flipped = [];
          locked = false;
          updateWord();
          if (matchedCount >= 3) showFinish();
        }, PACE.cardFlip);
      } else {
        setTimeout(() => {
          state[a].faceUp = false;
          state[b].faceUp = false;
          flipCard(a);
          flipCard(b);
          flipped = [];
          locked = false;
        }, PACE.matchFlipBack);
      }
    }
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
