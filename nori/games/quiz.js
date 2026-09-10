// ===========================================================
//  추억 퀴즈.
//  문제를 순서대로 풀어본다. 틀려도 정답을 보여주고 다음으로 넘어간다.
// ===========================================================
import { QUESTIONS } from '../quiz-data.js';

export function mount(host, done) {
  let idx = 0;
  let correctCount = 0;

  render();

  function render() {
    if (idx >= QUESTIONS.length) {
      host.innerHTML = `
        <p class="lead">문제를 다 풀었습니다</p>
        <p class="question">${QUESTIONS.length}문제 중 ${correctCount}문제를 맞히셨습니다</p>
        <button class="big-btn primary" id="finish">도장 받기</button>`;
      host.querySelector('#finish').onclick = done;
      return;
    }

    const q = QUESTIONS[idx];
    host.innerHTML = `
      <p class="step">${idx + 1}번째 / ${QUESTIONS.length}문제</p>
      <p class="question">${q.question}</p>
      <div id="choices">
        ${q.choices.map((c, i) => `<button class="big-btn" data-i="${i}">${c}</button>`).join('')}
      </div>
      <p class="feedback" id="word"></p>
      <div id="buttons"></div>`;

    host.querySelectorAll('#choices button').forEach((btn) => {
      btn.onclick = () => pick(Number(btn.dataset.i));
    });
  }

  function pick(i) {
    const q = QUESTIONS[idx];
    const buttonsWrap = host.querySelector('#choices');
    buttonsWrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    buttonsWrap.children[q.answer].classList.add('correct');

    const wordEl = host.querySelector('#word');
    if (i === q.answer) {
      correctCount += 1;
      wordEl.innerHTML = '<span class="badge ok">정답입니다</span>';
    } else {
      buttonsWrap.children[i].classList.add('picked');
      wordEl.innerHTML = `<span class="badge no">아쉬워요</span> 정답은 "${q.choices[q.answer]}" 입니다`;
    }

    host.querySelector('#buttons').innerHTML = '<button class="big-btn primary" id="next">다음 문제</button>';
    host.querySelector('#next').onclick = () => { idx += 1; render(); };
  }
}
