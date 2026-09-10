// ===========================================================
//  부스에 세워둘 QR 인쇄판.
//  부스 하나가 A4 한 장이다. 브라우저에서 열어 인쇄하면 된다.
//  부스 이름이나 번호를 config.js에서 고치면 여기도 따라 바뀐다.
// ===========================================================
import { CONFIG, BOOTHS } from '../config.js';

const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

// 부스 QR이 가리킬 주소. 이 인쇄 페이지가 놓인 곳을 기준으로 만든다.
const baseUrl = new URL('../', location.href).href;

function loadQrLib() {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = QR_LIB;
    s.onload = resolve;
    s.onerror = () => reject(new Error('QR 만드는 도구를 못 불러왔습니다'));
    document.head.appendChild(s);
  });
}

async function render() {
  const root = document.getElementById('sheets');

  try {
    await loadQrLib();
  } catch (e) {
    root.innerHTML = '<p class="warn">인터넷에 연결한 뒤 다시 열어 주세요.</p>';
    return;
  }

  root.innerHTML = BOOTHS.map((b) => `
    <section class="sheet">
      <p class="sheet-event">${CONFIG.title}</p>
      <h1 class="sheet-name">${b.name}</h1>
      <div class="sheet-qr" id="qr-${b.code}"></div>
      <p class="sheet-guide">휴대전화로 이 그림을 비춰 주세요</p>
      <div class="sheet-pin">
        <p class="sheet-pin-label">카메라가 안 될 때 넣는 번호</p>
        <p class="sheet-pin-value">${b.pin}</p>
      </div>
    </section>`).join('');

  for (const b of BOOTHS) {
    const url = `${baseUrl}?g=${b.code}`;
    // eslint-disable-next-line no-new, no-undef
    new QRCode(document.getElementById(`qr-${b.code}`), {
      text: url,
      width: 620,
      height: 620,
      colorDark: '#2b2320',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  document.getElementById('addr').textContent = `${baseUrl}?g=부스코드`;
}

render();
