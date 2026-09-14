// ===========================================================
//  화면 흐름 담당.
//  부스 QR로 들어오면 -> 번호 확인 -> 게임 -> 도장 -> 다음 부스
//  도장을 다 모으면 상품 암호를 보여준다.
// ===========================================================
import { CONFIG, BOOTHS, findBooth, findBoothByPin } from './config.js';
import { savedNumber, issueNumber, loadStamps, resumeNumber, addStamp } from './player.js';
import { scanOnce, boothCodeFrom } from './scan.js';
import { PACE, enter, toTop } from './pace.js';

const app = document.getElementById('app');
document.title = CONFIG.title;

const state = {
  number: null,
  stamps: {},
  booth: null,
  preview: false,
};

// 옛 부스 코드로 남은 시험 도장이 섞이지 않게, 지금 BOOTHS에 있는 코드만 센다.
const stampCount = () => BOOTHS.filter((b) => state.stamps[b.code]).length;
const isDone = () => stampCount() >= CONFIG.needStamps;

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// 화면을 그리고 서서히 나타나게 한다. buttonDelay를 넘기면 그만큼
// 버튼이 더 늦게 나타난다(도장 "쿵" 뒤에 버튼을 보여줄 때 쓴다).
function show(html, buttonDelay) {
  app.innerHTML = html;
  toTop(); // 새 화면은 맨 위부터 보인다
  enter(app.firstElementChild, buttonDelay);
}

// ---------------- 시작 ----------------
async function boot() {
  const params = new URL(location.href).searchParams;
  state.booth = findBooth(params.get('g'));
  state.preview = params.get('preview') === '1';

  // 관리 페이지에서 온 미리보기 - 번호도 도장도 없이 놀이만 열어 본다
  if (state.preview && state.booth) return startGame(state.booth);

  const saved = savedNumber();
  if (!saved) return state.booth ? showBoothIntro() : showWelcome();

  state.number = saved;
  try {
    const stamps = await loadStamps(saved);
    state.stamps = stamps || {};
  } catch (e) {
    return showError('연결이 잠시 끊겼습니다', '잠시 뒤 다시 열어 주세요');
  }
  routeAfterNumber();
}

function routeAfterNumber() {
  if (isDone()) return showPrize();
  if (state.booth) return showBoothIntro();
  return showProgress();
}

// ---------------- 처음 오신 분 ----------------
function showWelcome() {
  const where = state.booth ? `${esc(state.booth.name)} 부스입니다` : '';
  show(`
    <div class="card">
      <h1 class="title">${esc(CONFIG.title)}</h1>
      ${where ? `<p class="lead">${where}</p>` : ''}
      <p class="lead">놀이 ${CONFIG.needStamps}가지를 하시면\n선물을 드립니다</p>
      <button class="big-btn primary" id="start">시작하기</button>
      <button class="big-btn ghost" id="resume">번호를 이미 받으셨어요</button>
    </div>`);

  document.getElementById('start').onclick = async () => {
    setBusy('start', '번호를 받는 중입니다');
    try {
      state.number = await issueNumber();
      state.stamps = {};
      routeAfterNumber();
    } catch (e) {
      showError('번호를 받지 못했습니다', '직원에게 말씀해 주세요');
    }
  };
  document.getElementById('resume').onclick = showResume;
}

// ---------------- 번호 이어받기 ----------------
function showResume() {
  show(`
    <div class="card">
      <h2 class="title small">받으신 번호를\n넣어 주세요</h2>
      ${keypadHtml()}
      <button class="big-btn ghost" id="back">뒤로</button>
    </div>`);

  bindKeypad(async (value, setMsg) => {
    setMsg('찾는 중입니다');
    try {
      const stamps = await resumeNumber(value);
      if (stamps === null) return setMsg('그런 번호가 없습니다. 직원에게 문의해 주세요');
      state.number = value;
      state.stamps = stamps;
      routeAfterNumber();
    } catch (e) {
      setMsg('연결이 잠시 끊겼습니다. 다시 눌러 주세요');
    }
  });
  document.getElementById('back').onclick = () => (state.booth ? showBoothIntro() : showWelcome());
}

// ---------------- 부스 안내 ----------------
function showBoothIntro() {
  const booth = state.booth;
  if (state.stamps[booth.code]) {
    show(`
      <div class="card">
        <h2 class="title small">${esc(booth.name)}</h2>
        ${booth.pic ? `<img class="booth-pic" src="pics/${esc(booth.pic)}.svg" alt="">` : ''}
        <p class="lead">이 놀이는 이미 하셨습니다</p>
        ${progressHtml()}
        <button class="big-btn primary" id="again">한 번 더 놀기</button>
        ${nextButtonsHtml()}
      </div>`);
    document.getElementById('again').onclick = () => startGame(booth);
    bindNextButtons();
    return;
  }

  show(`
    <div class="card">
      <h2 class="title small">${esc(booth.name)}</h2>
      ${booth.pic ? `<img class="booth-pic" src="pics/${esc(booth.pic)}.svg" alt="">` : ''}
      ${progressHtml()}
      <button class="big-btn primary" id="play">놀이 시작</button>
      ${state.number ? '' : '<button class="big-btn ghost" id="resume">번호를 이미 받으셨어요</button>'}
    </div>`);
  document.getElementById('play').onclick = async () => {
    if (state.number) return startGame(booth);
    setBusy('play', '번호를 받는 중입니다');
    try {
      state.number = await issueNumber();
      state.stamps = {};
      startGame(booth);
    } catch (e) {
      showError('번호를 받지 못했습니다', '직원에게 말씀해 주세요');
    }
  };
  if (!state.number) {
    document.getElementById('resume').onclick = showResume;
  }
}

// ---------------- 게임 ----------------
async function startGame(booth) {
  show(`
    <div class="card">
      <h2 class="title small">${esc(booth.name)}</h2>
      <div id="game"></div>
    </div>`);
  const host = document.getElementById('game');
  host.textContent = '준비 중입니다';

  try {
    const mod = await import(`./games/${booth.code}.js`);
    host.textContent = '';
    mod.mount(host, () => finishGame(booth));
  } catch (e) {
    showError('놀이를 열지 못했습니다', '직원에게 말씀해 주세요');
  }
}

async function finishGame(booth) {
  if (state.preview) return showPreviewEnd(booth);
  if (state.stamps[booth.code]) return showStampResult(booth, false);
  try {
    state.stamps = await addStamp(state.number, booth.code, state.stamps);
    showStampResult(booth, true);
  } catch (e) {
    showError('도장을 저장하지 못했습니다', '직원에게 말씀해 주세요');
  }
}

function showPreviewEnd(booth) {
  show(`
    <div class="card">
      <h2 class="title small">${esc(booth.name)}</h2>
      <p class="lead">미리보기입니다
도장은 찍히지 않았습니다</p>
      <button class="big-btn primary" id="again">한 번 더 보기</button>
    </div>`);
  document.getElementById('again').onclick = () => startGame(booth);
}

function showStampResult(booth, isNew) {
  if (isDone()) {
    // 새로 받은 도장으로 다 찬 경우엔 쿵 화면을 먼저 보여준다.
    if (isNew) return showStampBeforePrize(booth);
    return showPrize();
  }
  const left = CONFIG.needStamps - stampCount();
  show(`
    <div class="card">
      <h2 class="title small">${isNew ? '도장을 받았습니다' : '수고하셨습니다'}</h2>
      ${progressHtml(isNew ? booth.code : null)}
      <p class="lead">${left}가지만 더 하시면\n선물을 드립니다</p>
      ${nextButtonsHtml()}
    </div>`, isNew ? PACE.fadeIn + PACE.stamp : undefined);
  bindNextButtons();
}

function showStampBeforePrize(booth) {
  show(`
    <div class="card">
      <h2 class="title small">도장을 받았습니다</h2>
      ${progressHtml(booth.code)}
      <p class="lead">도장을 모두 모으셨습니다</p>
      <button class="big-btn primary" id="toPrize">상품 암호 보기</button>
    </div>`, PACE.fadeIn + PACE.stamp);
  document.getElementById('toPrize').onclick = showPrize;
}

// ---------------- 현황(부스 없이 들어온 경우) ----------------
function showProgress() {
  const left = CONFIG.needStamps - stampCount();
  show(`
    <div class="card">
      <h2 class="title small">${esc(CONFIG.title)}</h2>
      ${progressHtml()}
      <p class="lead">${left}가지만 더 하시면\n선물을 드립니다</p>
      ${nextButtonsHtml()}
    </div>`);
  bindNextButtons();
}

// ---------------- 상품 암호 ----------------
function showPrize() {
  show(`
    <div class="card">
      <h1 class="title">다 모으셨습니다</h1>
      <div class="password-box">
        <p class="password-label">상품 암호</p>
        <p class="password-text">${esc(CONFIG.password)}</p>
      </div>
      <p class="ticket">참여 번호 <strong>${esc(state.number)}번</strong></p>
      <p class="notice">${esc(CONFIG.prizeNotice)}</p>
    </div>`);
}

// ---------------- 다음 부스로 ----------------
function nextButtonsHtml() {
  return `
    <button class="big-btn primary" id="scan">다음 놀이 찍기</button>
    <button class="big-btn ghost" id="bypin">부스 번호 넣기</button>
    <p class="ticket small">참여 번호 <strong>${esc(state.number)}번</strong></p>`;
}

function bindNextButtons() {
  const scanBtn = document.getElementById('scan');
  if (scanBtn) scanBtn.onclick = openScanner;
  const pinBtn = document.getElementById('bypin');
  if (pinBtn) pinBtn.onclick = showPinEntry;
}

async function openScanner() {
  show(`
    <div class="card">
      <h2 class="title small">부스의 QR을\n비춰 주세요</h2>
      <div class="scanner" id="cam"></div>
      <p class="feedback" id="msg"></p>
      <button class="big-btn ghost" id="cancel">그만두기</button>
    </div>`);
  const cam = document.getElementById('cam');
  document.getElementById('cancel').onclick = () => {
    if (cam.__stopScan) cam.__stopScan();
    routeAfterNumber();
  };

  let text = null;
  try {
    text = await scanOnce(cam);
  } catch (e) {
    return showCameraFailed();
  }
  if (text === null) return;

  const code = boothCodeFrom(text);
  const booth = findBooth(code);
  if (!booth) {
    document.getElementById('msg').textContent = '이 행사의 QR이 아닙니다';
    return openScanner();
  }
  state.booth = booth;
  showBoothIntro();
}

function showCameraFailed() {
  show(`
    <div class="card">
      <h2 class="title small">카메라를 열지 못했습니다</h2>
      <p class="lead">부스에 붙어 있는\n네 자리 번호를 넣어 주세요</p>
      <button class="big-btn primary" id="bypin">부스 번호 넣기</button>
      <button class="big-btn ghost" id="back">뒤로</button>
    </div>`);
  document.getElementById('bypin').onclick = showPinEntry;
  document.getElementById('back').onclick = routeAfterNumber;
}

function showPinEntry() {
  show(`
    <div class="card">
      <h2 class="title small">부스에 붙은\n번호를 넣어 주세요</h2>
      ${keypadHtml()}
      <button class="big-btn ghost" id="back">뒤로</button>
    </div>`);
  bindKeypad((value, setMsg) => {
    const booth = findBoothByPin(value);
    if (!booth) return setMsg('그런 부스 번호가 없습니다');
    state.booth = booth;
    showBoothIntro();
  });
  document.getElementById('back').onclick = routeAfterNumber;
}

// ---------------- 공용 조각 ----------------
// justCode를 넘기면 그 부스의 도장에 "쿵" 효과(.new)를 붙인다.
function progressHtml(justCode) {
  const dots = BOOTHS.map((b) => {
    const on = state.stamps[b.code] ? ' on' : '';
    const isNew = justCode && b.code === justCode;
    const cls = `stamp${on}${isNew ? ' new' : ''}`;
    // 인라인 style은 ::after 가상요소엔 먹지 않으므로 CSS 변수로 넘긴다.
    const style = isNew ? ` style="--delay:${PACE.fadeIn}ms;--dur:${PACE.stamp}ms"` : '';
    return `<span class="${cls}"${style}>${esc(b.name)}</span>`;
  }).join('');
  return `
    <div class="stamps">${dots}</div>`;
}

function keypadHtml() {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지우기', '0', '확인'];
  return `
    <p class="pad-value" id="pad-value"></p>
    <p class="feedback" id="pad-msg"></p>
    <div class="pad">
      ${keys.map((k) => `<button class="pad-key${k.length > 1 ? ' wide' : ''}" data-k="${k}">${k}</button>`).join('')}
    </div>`;
}

function bindKeypad(onSubmit) {
  const valueEl = document.getElementById('pad-value');
  const msgEl = document.getElementById('pad-msg');
  const setMsg = (m) => { msgEl.textContent = m; };
  let value = '';

  const render = () => { valueEl.textContent = value; };
  render();

  app.querySelectorAll('.pad-key').forEach((btn) => {
    btn.onclick = () => {
      const k = btn.dataset.k;
      if (k === '지우기') { value = value.slice(0, -1); setMsg(''); return render(); }
      if (k === '확인') {
        if (!value) return setMsg('번호를 넣어 주세요');
        return onSubmit(value, setMsg);
      }
      if (value.length >= 6) return;
      value += k;
      setMsg('');
      render();
    };
  });
}

function setBusy(id, text) {
  const el = document.getElementById(id);
  if (el) { el.disabled = true; el.textContent = text; }
}

function showError(title, sub) {
  show(`
    <div class="card">
      <h2 class="title small">${esc(title)}</h2>
      <p class="lead">${esc(sub)}</p>
      <button class="big-btn primary" id="retry">다시 해보기</button>
    </div>`);
  document.getElementById('retry').onclick = () => location.reload();
}

boot();
