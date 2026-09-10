// ===========================================================
//  관리 페이지.
//  참여 현황을 한눈에 보고, 번호로 어느 부스를 했는지 확인한다.
//  Firebase 연결은 player.js 것을 그대로 쓴다(새로 만들지 않는다).
// ===========================================================
import { db } from '../player.js';
import { CONFIG, BOOTHS } from '../config.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const app = document.getElementById('app');

async function loadData() {
  const counterSnap = await getDoc(doc(db, 'nori', 'counter'));
  const total = counterSnap.exists() ? (Number(counterSnap.data().count) || 0) : 0;

  const boothCounts = {};
  BOOTHS.forEach((b) => { boothCounts[b.code] = 0; });

  let prizeCount = 0;
  const players = [];

  const playersSnap = await getDocs(collection(db, 'players'));
  playersSnap.forEach((d) => {
    const data = d.data();
    const stamps = (data.stamps && typeof data.stamps === 'object') ? data.stamps : {};
    const doneCodes = Object.keys(stamps).filter((code) => stamps[code]);

    if (doneCodes.length >= CONFIG.needStamps) prizeCount += 1;
    doneCodes.forEach((code) => {
      if (code in boothCounts) boothCounts[code] += 1;
    });

    players.push({ id: d.id, stamps });
  });

  return {
    total, prizeCount, boothCounts, players,
  };
}

function render(data) {
  app.innerHTML = `
    <p class="title small">어울림 한마당 관리</p>
    <div class="admin-top">
      <button class="big-btn ghost" id="refresh">새로고침</button>
      <a class="big-btn ghost" href="../print/" target="_blank" rel="noopener">QR 인쇄판</a>
    </div>

    <div class="card admin-card">
      <p class="count">총 참여 인원 <strong>${data.total}</strong>명</p>
      <p class="count">선물 받을 수 있는 분 <strong>${data.prizeCount}</strong>명</p>
    </div>

    <div class="card admin-card">
      <p class="step">부스별 참여 수</p>
      ${BOOTHS.map((b) => `
        <div class="admin-row">
          <span>${b.name}</span>
          <strong>${data.boothCounts[b.code]}</strong>
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
    </div>`;

  app.querySelector('#refresh').onclick = init;

  const input = app.querySelector('#numInput');
  const resultEl = app.querySelector('#searchResult');

  const doSearch = () => {
    const num = input.value.trim();
    if (!num) return;
    const player = data.players.find((p) => p.id === num);
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

async function init() {
  app.innerHTML = '<p class="lead">불러오는 중입니다</p>';
  const data = await loadData();
  render(data);
}

init();
