import { CONFIG, QUESTIONS } from './quiz-data.js';

const app = document.getElementById('app');
const TICKET_KEY = 'senior_quiz_ticket';

let index = 0;

document.title = CONFIG.title;

// ---------------- 시작 화면 ----------------
function showStart() {
  app.innerHTML = `
    <div class="card">
      <h1 class="title">${esc(CONFIG.title)}</h1>
      <p class="lead">${esc(CONFIG.subtitle)}</p>
      <button class="big-btn primary" id="start">시작하기</button>
    </div>`;
  document.getElementById('start').onclick = () => {
    index = 0;
    showQuestion();
  };
}

// ---------------- 문제 화면 ----------------
function showQuestion() {
  const q = QUESTIONS[index];
  app.innerHTML = `
    <div class="card">
      <p class="step">${index + 1}번 문제 (모두 ${QUESTIONS.length}문제)</p>
      <h2 class="question">${esc(q.question)}</h2>
      <div id="choices">
        ${q.choices.map((c, i) => `<button class="big-btn" data-i="${i}">${esc(c)}</button>`).join('')}
      </div>
      <p class="feedback" id="feedback"></p>
      <div id="next-area"></div>
    </div>`;

  app.querySelectorAll('#choices .big-btn').forEach((btn) => {
    btn.onclick = () => pick(Number(btn.dataset.i));
  });
}

function pick(picked) {
  const q = QUESTIONS[index];
  const correct = picked === q.answer;

  app.querySelectorAll('#choices .big-btn').forEach((btn) => {
    const i = Number(btn.dataset.i);
    btn.disabled = true;
    if (i === q.answer) btn.classList.add('correct');
    else if (i === picked) btn.classList.add('picked');
  });

  document.getElementById('feedback').innerHTML = correct
    ? '<span class="badge ok">정답</span>잘하셨습니다'
    : `<span class="badge no">아쉬워요</span>정답은 "${esc(q.choices[q.answer])}" 입니다`;

  const last = index === QUESTIONS.length - 1;
  const area = document.getElementById('next-area');
  area.innerHTML = `<button class="big-btn primary" id="next">${last ? '상품 암호 보기' : '다음 문제'}</button>`;
  document.getElementById('next').onclick = () => {
    if (last) {
      showPassword();
    } else {
      index += 1;
      showQuestion();
    }
  };
}

// ---------------- 암호 화면 ----------------
function showPassword() {
  app.innerHTML = `
    <div class="card">
      <h1 class="title">다 푸셨습니다</h1>
      <div class="password-box">
        <p class="password-label">상품 암호</p>
        <p class="password-text">${esc(CONFIG.password)}</p>
      </div>
      <p class="ticket" id="ticket">참여 번호를 받는 중입니다</p>
      <p class="notice">${esc(CONFIG.prizeNotice)}</p>
    </div>`;
  fillTicket();
}

// 참여 번호(번호표) 받아오기.
// 이미 받은 번호가 있으면 그대로 다시 보여준다(새로고침해도 번호가 늘지 않게).
async function fillTicket() {
  const el = document.getElementById('ticket');
  const saved = localStorage.getItem(TICKET_KEY);
  if (saved) {
    el.innerHTML = `참여 번호 <strong>${esc(saved)}번</strong>`;
    return;
  }
  try {
    const res = await fetch('/.netlify/functions/ticket', { method: 'POST' });
    if (!res.ok) throw new Error('bad status');
    const data = await res.json();
    const num = String(data.number);
    localStorage.setItem(TICKET_KEY, num);
    el.innerHTML = `참여 번호 <strong>${esc(num)}번</strong>`;
  } catch (e) {
    // 번호를 못 받아도 암호는 그대로 쓸 수 있으므로 번호 줄만 지운다.
    el.remove();
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

showStart();
