// ===========================================================
//  사다리타기.
//  출발점(가나다라) 중 하나를 고르면 사다리를 타고 내려가
//  덕담 하나를 만난다. 경로는 색으로 표시한다.
// ===========================================================

const LABELS = ['가', '나', '다', '라'];
const RESULTS = [
  '늘 웃는 하루 되십시오',
  '가족들과 화목하십시오',
  '바라시는 일 이루십시오',
  '몸 성히 지내십시오',
];

const COLS = 4;
const GAPS = COLS - 1;
const ROWS = 6;

const W = 300;
const TOP_Y = 12;
const BOTTOM_Y = 168;
const COL_W = W / COLS;
const ROW_H = (BOTTOM_Y - TOP_Y) / ROWS;
const PATH_COLOR = '#f36458';

function xOf(col) {
  return COL_W * (col + 0.5);
}

function buildRungs() {
  const rungs = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = new Array(GAPS).fill(false);
    for (let g = 0; g < GAPS; g += 1) {
      if (row[g - 1]) continue; // 같은 줄 옆 칸과 겹치지 않게
      if (Math.random() < 0.5) row[g] = true;
    }
    rungs.push(row);
  }
  return rungs;
}

function tracePath(rungs, startCol) {
  let col = startCol;
  const path = [col];
  for (let r = 0; r < rungs.length; r += 1) {
    const row = rungs[r];
    if (row[col]) col += 1;
    else if (col > 0 && row[col - 1]) col -= 1;
    path.push(col);
  }
  return path;
}

function svgMarkup(rungs, path) {
  let s = `<svg viewBox="0 0 ${W} ${BOTTOM_Y + 12}" class="ladder-svg">`;

  // 세로줄
  for (let c = 0; c < COLS; c += 1) {
    s += `<line x1="${xOf(c)}" y1="${TOP_Y}" x2="${xOf(c)}" y2="${BOTTOM_Y}" class="ladder-line" />`;
  }
  // 가로줄(사다리 칸)
  rungs.forEach((row, r) => {
    const midY = TOP_Y + (r + 0.5) * ROW_H;
    row.forEach((on, g) => {
      if (!on) return;
      s += `<line x1="${xOf(g)}" y1="${midY}" x2="${xOf(g + 1)}" y2="${midY}" class="ladder-line" />`;
    });
  });

  if (path) {
    let d = `M ${xOf(path[0])} ${TOP_Y}`;
    for (let r = 0; r < rungs.length; r += 1) {
      const midY = TOP_Y + (r + 0.5) * ROW_H;
      const nextY = TOP_Y + (r + 1) * ROW_H;
      d += ` L ${xOf(path[r])} ${midY} L ${xOf(path[r + 1])} ${midY} L ${xOf(path[r + 1])} ${nextY}`;
    }
    s += `<path d="${d}" class="ladder-path" style="stroke:${PATH_COLOR}" />`;
  }

  s += '</svg>';
  return s;
}

export function mount(host, done) {
  const rungs = buildRungs();
  const order = [0, 1, 2, 3];
  // 결과 배치를 섞는다
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const results = order.map((i) => RESULTS[i]);

  host.innerHTML = `
    <p class="lead">가, 나, 다, 라 중 하나를 골라 보세요</p>
    <div class="ladder-heads" id="heads">
      ${LABELS.map((l, i) => `<button class="big-btn ladder-btn" data-i="${i}">${l}</button>`).join('')}
    </div>
    <div class="ladder-svg-box" id="svgbox">${svgMarkup(rungs, null)}</div>
    <div class="ladder-feet" id="feet">
      ${[0, 1, 2, 3].map(() => '<span>?</span>').join('')}
    </div>
    <p class="feedback" id="word"></p>
    <div id="buttons"></div>`;

  const heads = host.querySelector('#heads');
  const svgbox = host.querySelector('#svgbox');
  const feet = host.querySelectorAll('#feet span');
  const wordEl = host.querySelector('#word');
  const buttons = host.querySelector('#buttons');

  heads.querySelectorAll('.ladder-btn').forEach((btn) => {
    btn.onclick = () => {
      const startCol = Number(btn.dataset.i);
      heads.querySelectorAll('.ladder-btn').forEach((b) => { b.disabled = true; });
      btn.classList.add('picked');

      const path = tracePath(rungs, startCol);
      const endCol = path[path.length - 1];
      svgbox.innerHTML = svgMarkup(rungs, path);
      feet[endCol].textContent = results[endCol];
      feet[endCol].classList.add('hit');

      wordEl.textContent = results[endCol];
      buttons.innerHTML = '<button class="big-btn primary" id="finish">도장 받기</button>';
      buttons.querySelector('#finish').onclick = done;
    };
  });
}
