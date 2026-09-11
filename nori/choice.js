// ===========================================================
//  문제풀이 공용 흐름.
//  quiz·proverb·market·odd 가 이 파일 하나를 함께 쓴다.
//  문제 내용은 각 게임 파일 맨 위에 있고, 흐름을 고칠 땐 여기만 고치면 된다.
// ===========================================================
import { PACE, wait, enter } from './pace.js';

// options: { lead, questions, grid }
// questions 하나는 { question, choices, answer, explain } 형태다.
// explain은 선택이고, 정답 공개 뒤 한 줄 더 보여준다.
export function mountChoice(host, done, { lead, questions, grid = false } = {}) {
  let idx = 0;
  let correctCount = 0;

  render();

  function render() {
    if (idx >= questions.length) {
      host.innerHTML = `
        <p class="lead">문제를 다 풀었습니다</p>
        <p class="question">${questions.length}문제 중 ${correctCount}문제를 맞히셨습니다</p>
        <button class="big-btn primary" id="finish">도장 받기</button>`;
      enter(host);
      host.querySelector('#finish').onclick = done;
      return;
    }

    const q = questions[idx];
    host.innerHTML = `
      ${lead ? `<p class="lead">${lead}</p>` : ''}
      <p class="step">${idx + 1}번째 / ${questions.length}문제</p>
      <p class="question">${q.question}</p>
      <div id="choices" class="${grid ? 'choice-grid' : ''}">
        ${q.choices.map((c, i) => `<button class="big-btn" data-i="${i}">${c}</button>`).join('')}
      </div>
      <p class="feedback" id="word"></p>
      <div id="buttons"></div>`;
    enter(host);

    host.querySelectorAll('#choices button').forEach((btn) => {
      btn.onclick = () => pick(Number(btn.dataset.i));
    });
  }

  async function pick(i) {
    const q = questions[idx];
    const choicesWrap = host.querySelector('#choices');
    choicesWrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    choicesWrap.children[i].classList.add('picked');

    const wordEl = host.querySelector('#word');
    wordEl.textContent = '정답은…';

    await wait(PACE.suspense);

    choicesWrap.children[q.answer].classList.add('correct');
    const explainHtml = q.explain ? `<br>${q.explain}` : '';
    if (i === q.answer) {
      correctCount += 1;
      wordEl.innerHTML = `<span class="badge ok">정답입니다</span>${explainHtml}`;
    } else {
      wordEl.innerHTML = `<span class="badge no">아쉬워요</span> 정답은 "${q.choices[q.answer]}" 입니다${explainHtml}`;
    }

    const buttonsEl = host.querySelector('#buttons');
    buttonsEl.innerHTML = '<button class="big-btn primary" id="next">다음 문제</button>';
    enter(buttonsEl);
    buttonsEl.querySelector('#next').onclick = () => { idx += 1; render(); };
  }
}
