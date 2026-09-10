// ===========================================================
//  윷 던지기.
//  버튼 한 번이면 끝난다. 윷이나 모가 나오면 한 번 더 던질 수 있다.
// ===========================================================

const RESULTS = {
  0: { name: '모', word: '최고입니다', again: true },
  1: { name: '도', word: '천천히 가도 좋습니다', again: false },
  2: { name: '개', word: '한 걸음 나아갑니다', again: false },
  3: { name: '걸', word: '기운이 좋습니다', again: false },
  4: { name: '윷', word: '아주 좋습니다', again: true },
};

export function mount(host, done) {
  let throws = 0;

  host.innerHTML = `
    <p class="lead">윷을 던져 보세요</p>
    <div class="yut" id="sticks">${stickHtml([1, 1, 1, 1])}</div>
    <p class="yut-name" id="name"></p>
    <p class="feedback" id="word"></p>
    <div id="buttons">
      <button class="big-btn primary" id="throw">윷 던지기</button>
    </div>`;

  const sticks = host.querySelector('#sticks');
  const nameEl = host.querySelector('#name');
  const wordEl = host.querySelector('#word');
  const buttons = host.querySelector('#buttons');

  const throwOnce = () => {
    throws += 1;
    const faces = [0, 0, 0, 0].map(() => (Math.random() < 0.5 ? 1 : 0));
    const flat = faces.filter((f) => f === 1).length;
    const result = RESULTS[flat];

    sticks.innerHTML = stickHtml(faces);
    nameEl.textContent = result.name;
    wordEl.textContent = result.word;

    const canAgain = result.again && throws < 3;
    buttons.innerHTML = `
      ${canAgain ? '<button class="big-btn primary" id="again">한 번 더 던지기</button>' : ''}
      <button class="big-btn ${canAgain ? 'ghost' : 'primary'}" id="finish">도장 받기</button>`;
    if (canAgain) buttons.querySelector('#again').onclick = throwOnce;
    buttons.querySelector('#finish').onclick = done;
  };

  host.querySelector('#throw').onclick = throwOnce;
}

// 윷가락 넷. 1이면 평평한 면이 위(젖혀진 것), 0이면 엎어진 것.
function stickHtml(faces) {
  return faces.map((f) => `<span class="stick${f ? ' up' : ''}"></span>`).join('');
}
