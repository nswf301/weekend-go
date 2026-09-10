// ===========================================================
//  오늘의 운세.
//  꽃 하나를 고르면 그 꽃에 맞는 덕담과 운세가 나온다.
// ===========================================================

const FLOWERS = [
  { name: '매화', word: '어려운 고비를 잘 넘기고, 곧 좋은 소식이 찾아옵니다' },
  { name: '난초', word: '주변 사람들과의 정이 더욱 깊어지는 한 해가 됩니다' },
  { name: '국화', word: '그동안 애쓰신 일들이 하나씩 좋은 결실을 맺습니다' },
  { name: '대나무', word: '건강하게 오래오래 곧은 마음으로 지내십니다' },
  { name: '연꽃', word: '마음이 편안해지고 가정에 웃음이 끊이지 않습니다' },
];

export function mount(host, done) {
  host.innerHTML = `
    <p class="lead">마음에 드는 꽃을 골라보세요</p>
    <div id="flowers">
      ${FLOWERS.map((f, i) => `<button class="big-btn" data-i="${i}">${f.name}</button>`).join('')}
    </div>
    <p class="feedback" id="word"></p>
    <div id="buttons"></div>`;

  const flowers = host.querySelector('#flowers');
  const wordEl = host.querySelector('#word');
  const buttons = host.querySelector('#buttons');

  flowers.querySelectorAll('button').forEach((btn) => {
    btn.onclick = () => {
      flowers.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      btn.classList.add('picked');
      const flower = FLOWERS[Number(btn.dataset.i)];
      wordEl.textContent = `${flower.name} — ${flower.word}`;
      buttons.innerHTML = '<button class="big-btn primary" id="finish">도장 받기</button>';
      buttons.querySelector('#finish').onclick = done;
    };
  });
}
