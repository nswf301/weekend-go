// ===========================================================
//  짝 맞추기.
//  카드 6장(3쌍)을 뒤집어 같은 낱말끼리 짝을 찾는다.
//  시간 제한도 실패도 없다. 언제든 포기하고 도장을 받을 수 있다.
// ===========================================================

const WORDS = ['달', '꽃', '별'];

export function mount(host, done) {
  const deck = shuffle([...WORDS, ...WORDS].map((word, i) => ({ word, id: i })));
  const state = deck.map((c) => ({ ...c, faceUp: false, matched: false }));
  let flipped = [];
  let locked = false;
  let matchedCount = 0;

  render();

  function render() {
    host.innerHTML = `
      <p class="lead">같은 낱말 카드 두 장을 찾아보세요</p>
      <div class="match-grid" id="grid">
        ${state.map((c, i) => cardHtml(c, i)).join('')}
      </div>
      <p class="feedback" id="word">${matchedCount}쌍 / 3쌍 찾았습니다</p>
      <div id="buttons">
        ${matchedCount >= 3
          ? '<button class="big-btn primary" id="finish">도장 받기</button>'
          : '<button class="big-btn ghost" id="giveup">포기하고 도장 받기</button>'}
      </div>`;

    const grid = host.querySelector('#grid');
    grid.querySelectorAll('.match-card').forEach((btn) => {
      btn.onclick = () => pick(Number(btn.dataset.i));
    });

    const finish = host.querySelector('#finish');
    if (finish) finish.onclick = done;
    const giveup = host.querySelector('#giveup');
    if (giveup) giveup.onclick = done;
  }

  function cardHtml(c, i) {
    const shown = c.faceUp || c.matched;
    const cls = `match-card${shown ? ' open' : ''}${c.matched ? ' matched' : ''}`;
    return `<button class="${cls}" data-i="${i}" ${locked && !shown ? 'disabled' : ''}>${shown ? c.word : ''}</button>`;
  }

  function pick(i) {
    if (locked || state[i].matched || state[i].faceUp) return;
    state[i].faceUp = true;
    flipped.push(i);
    render();

    if (flipped.length === 2) {
      const [a, b] = flipped;
      if (state[a].word === state[b].word) {
        state[a].matched = true;
        state[b].matched = true;
        matchedCount += 1;
        flipped = [];
        render();
      } else {
        locked = true;
        render();
        setTimeout(() => {
          state[a].faceUp = false;
          state[b].faceUp = false;
          flipped = [];
          locked = false;
          render();
        }, 1000);
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
