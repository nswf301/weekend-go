// ===========================================================
//  관리 페이지.
//  참여 현황을 한눈에 보고, 번호로 어느 부스를 했는지 확인한다.
//  숫자는 Firebase가 바뀔 때마다 알려 줘서 저절로 바뀐다(onSnapshot).
//  Firebase 연결은 player.js 것을 그대로 쓴다(새로 만들지 않는다).
// ===========================================================
import { db } from '../player.js';
import { CONFIG, BOOTHS } from '../config.js';
import {
  collection, getDocs, doc, getDoc, setDoc, writeBatch, onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const app = document.getElementById('app');

// 서버에서 마지막으로 받은 값. 바뀔 때마다 Firebase가 알려 준다(자동 새로고침).
let total = null;    // 참여 인원. 아직 못 받았으면 null
let players = null;  // [{ id, stamps }]. 아직 못 받았으면 null
let busy = false;    // 참여 초기화 중에는 화면을 건드리지 않는다

function summarize() {
  const boothCounts = {};
  BOOTHS.forEach((b) => { boothCounts[b.code] = 0; });

  let prizeCount = 0;
  players.forEach((p) => {
    // 옛 부스 코드로 남은 시험 도장이 섞이지 않게, 지금 BOOTHS에 있는 코드만 센다.
    const doneCodes = BOOTHS.filter((b) => p.stamps[b.code]).map((b) => b.code);

    if (doneCodes.length >= CONFIG.needStamps) prizeCount += 1;
    doneCodes.forEach((code) => {
      if (code in boothCounts) boothCounts[code] += 1;
    });
  });

  return { prizeCount, boothCounts };
}

function drawShell() {
  app.innerHTML = `
    <p class="title small">스마트 퀴즈존 관리</p>
    <div class="admin-top">
      <button class="big-btn ghost" id="refresh">새로고침</button>
      <a class="big-btn ghost" href="../print/" target="_blank" rel="noopener">QR 인쇄판</a>
    </div>
    <p class="admin-note" id="liveNote"></p>

    <div class="card admin-card">
      <p class="count">총 참여 인원 <strong id="totalNum"></strong>명</p>
      <p class="count">선물 받을 수 있는 분 <strong id="prizeNum"></strong>명</p>
    </div>

    <div class="card admin-card">
      <p class="step">부스별 참여 수</p>
      ${BOOTHS.map((b) => `
        <div class="admin-row">
          <span>${b.name}</span>
          <strong data-booth="${b.code}"></strong>
        </div>`).join('')}
    </div>

    <div class="card admin-card">
      <p class="step">놀이 미리보기</p>
      <p class="admin-note">새 탭에서 열립니다. 도장은 찍히지 않습니다.</p>
      <div class="admin-links">
        ${BOOTHS.map((b) => `
          <a href="../?g=${b.code}&preview=1" target="_blank" rel="noopener">${b.name}</a>`).join('')}
      </div>
    </div>

    <div class="card admin-card">
      <p class="step">번호로 찾기</p>
      <div class="admin-search">
        <input id="numInput" class="admin-input" type="text" inputmode="numeric" placeholder="참여 번호">
        <button class="big-btn primary" id="searchBtn">찾기</button>
      </div>
      <div id="searchResult"></div>
    </div>

    <div class="card admin-card">
      <p class="step">참여 초기화</p>
      <p class="admin-note">시험해 본 기록을 모두 지웁니다. 번호는 1번부터 다시 시작하고, 도장도 전부 사라집니다. 행사 중에는 누르지 마세요.</p>
      <button class="big-btn ghost" id="resetBtn">참여 초기화</button>
    </div>`;

  app.querySelector('#refresh').onclick = () => location.reload();
  app.querySelector('#resetBtn').onclick = resetAll;

  const input = app.querySelector('#numInput');
  const resultEl = app.querySelector('#searchResult');

  const doSearch = () => {
    const num = input.value.trim();
    if (!num) return;
    const player = players.find((p) => p.id === num);
    if (!player) {
      resultEl.innerHTML = `<p class="feedback">${num}번을 찾을 수 없습니다</p>`;
      return;
    }
    const doneNames = BOOTHS.filter((b) => player.stamps[b.code]).map((b) => b.name);
    resultEl.innerHTML = doneNames.length
      ? `<p class="feedback">${num}번 — ${doneNames.join(', ')}</p>`
      : `<p class="feedback">${num}번 — 아직 도장이 없습니다</p>`;
  };

  app.querySelector('#searchBtn').onclick = doSearch;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
}

// 숫자만 바꾼다. 화면을 다시 그리지 않으므로 번호 찾기 칸에 쓰던 글자가 지워지지 않는다.
function update() {
  if (busy || total === null || players === null) return;
  if (!app.querySelector('#totalNum')) drawShell();
  const { prizeCount, boothCounts } = summarize();
  app.querySelector('#totalNum').textContent = total;
  app.querySelector('#prizeNum').textContent = prizeCount;
  BOOTHS.forEach((b) => {
    app.querySelector(`[data-booth="${b.code}"]`).textContent = boothCounts[b.code];
  });
  const time = new Date().toLocaleTimeString('ko-KR', {
    hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  // 좁은 폰에서 시각이 두 줄로 쪼개지지 않게 묶는다.
  app.querySelector('#liveNote').innerHTML = `참여자가 생기면 자동으로 바뀝니다. <span style="white-space: nowrap">마지막 변경 ${time}</span>`;
}

// 참여 기록을 전부 지운다.
// 회차를 먼저 올려서, 옛 번호를 기억하는 폰이 새 참여자와 번호가 겹치지 않게 한다.
async function resetAll() {
  if (!confirm('참여 기록을 모두 지웁니다.\n번호는 1번부터 다시 시작하고 도장도 전부 사라집니다.\n\n정말 지울까요?')) return;
  busy = true;
  app.innerHTML = '<p class="lead">지우는 중입니다</p>';
  try {
    const ref = doc(db, 'nori', 'counter');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await setDoc(ref, { count: 0, round: (Number(snap.data().round) || 0) + 1 });
    }
    const players = await getDocs(collection(db, 'players'));
    for (let i = 0; i < players.docs.length; i += 400) {
      const batch = writeBatch(db);
      players.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    alert('초기화했습니다.');
  } catch (e) {
    alert(`초기화하지 못했습니다.\n${e.message}`);
  }
  busy = false;
  update();
}

// 듣기가 끊겼을 때.
function onError() {
  const note = app.querySelector('#liveNote');
  if (note) {
    note.textContent = '자동으로 바뀌지 않고 있습니다. 새로고침을 눌러 주세요.';
  } else {
    app.innerHTML = '<p class="lead">불러오지 못했습니다. 화면을 새로 열어 주세요.</p>';
  }
}

app.innerHTML = '<p class="lead">불러오는 중입니다</p>';

onSnapshot(doc(db, 'nori', 'counter'), (snap) => {
  total = snap.exists() ? (Number(snap.data().count) || 0) : 0;
  update();
}, onError);

onSnapshot(collection(db, 'players'), (snap) => {
  players = snap.docs.map((d) => {
    const data = d.data();
    const stamps = (data.stamps && typeof data.stamps === 'object') ? data.stamps : {};
    return { id: d.id, stamps };
  });
  update();
}, onError);
