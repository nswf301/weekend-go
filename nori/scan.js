// ===========================================================
//  앱 안에서 QR을 찍는 부분.
//  카톡 스캐너로 다시 찍으면 다른 브라우저로 열려 도장이 끊기므로,
//  두 번째 부스부터는 이 화면으로 찍게 한다.
//
//  안드로이드 크롬은 브라우저에 인식 기능이 있고,
//  아이폰은 없어서 인식 라이브러리(jsQR)를 대신 싣는다.
// ===========================================================

const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

let jsQRLoading = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (!jsQRLoading) {
    jsQRLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = JSQR_URL;
      s.onload = () => resolve(window.jsQR);
      s.onerror = () => reject(new Error('QR 인식 도구를 못 불러왔습니다'));
      document.head.appendChild(s);
    });
  }
  return jsQRLoading;
}

// 카메라를 열어 QR 한 개를 읽는다.
// 읽으면 그 내용을, 사용자가 닫으면 null을 돌려준다.
// 카메라를 못 열면 예외를 던진다(부스 번호 입력으로 안내하기 위해).
export async function scanOnce(host) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });

  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.srcObject = stream;
  host.innerHTML = '';
  host.appendChild(video);
  await video.play();

  const detector = ('BarcodeDetector' in window)
    ? new window.BarcodeDetector({ formats: ['qr_code'] })
    : null;
  const jsQR = detector ? null : await loadJsQR();

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  return new Promise((resolve) => {
    let stopped = false;

    const stop = (value) => {
      if (stopped) return;
      stopped = true;
      stream.getTracks().forEach((t) => t.stop());
      host.innerHTML = '';
      resolve(value);
    };

    host.__stopScan = () => stop(null);

    const tick = async () => {
      if (stopped) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        try {
          if (detector) {
            const found = await detector.detect(video);
            if (found.length) return stop(found[0].rawValue);
          } else {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height);
            if (found && found.data) return stop(found.data);
          }
        } catch (e) {
          // 한 프레임 실패는 넘어간다
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// 찍은 QR 내용에서 부스 코드를 뽑는다.
// 우리 주소가 아니거나 코드가 없으면 null.
export function boothCodeFrom(text) {
  try {
    const url = new URL(text, location.href);
    return url.searchParams.get('g');
  } catch (e) {
    return null;
  }
}
