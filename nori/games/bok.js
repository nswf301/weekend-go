// ===========================================================
//  복주머니 뽑기.
//  주머니 5개 중 하나를 누르면 열리면서 덕담이 나온다.
// ===========================================================

const WORDS = [
  '올해 건강하십시오',
  '하시는 일마다 뜻대로 되십시오',
  '자손들이 화목하고 평안하십시오',
  '웃을 일이 가득하십시오',
  '늘 지금처럼 젊게 지내십시오',
];

export function mount(host, done) {
  host.innerHTML = `
    <p class="lead">복주머니 하나를 골라보세요</p>
    <div class="bok-row" id="row">
      ${[0, 1, 2, 3, 4].map((i) => `<button class="bok-pouch" data-i="${i}">복</button>`).join('')}
    </div>
    <p class="feedback" id="word"></p>
    <div id="buttons"></div>`;

  const row = host.querySelector('#row');
  const wordEl = host.querySelector('#word');
  const buttons = host.querySelector('#buttons');

  row.querySelectorAll('.bok-pouch').forEach((btn) => {
    btn.onclick = () => {
      row.querySelectorAll('.bok-pouch').forEach((b) => { b.disabled = true; });
      btn.classList.add('open');
      btn.textContent = '福';
      const word = WORDS[Math.floor(Math.random() * WORDS.length)];
      wordEl.textContent = word;
      buttons.innerHTML = '<button class="big-btn primary" id="finish">도장 받기</button>';
      buttons.querySelector('#finish').onclick = done;
    };
  });
}
