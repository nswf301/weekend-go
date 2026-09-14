// ===========================================================
//  문제풀이 공용 흐름.
//  quiz·proverb·market·odd 가 이 파일 하나를 함께 쓴다.
//  문제 내용은 각 게임 파일 맨 위에 있고, 흐름을 고칠 땐 여기만 고치면 된다.
// ===========================================================
import { PACE, wait, enter, keepInView, toTop } from './pace.js';

// options: { lead, questions, grid }
// questions 하나는 { question, choices, answer, explain } 형태다.
// explain은 선택이고, 정답 공개 뒤 한 줄 더 보여준다.
// pics도 선택이다. ['apple', 'apple'] 처럼 넣으면 문제 위에 그림을 한 줄로 늘어놓는다.
// choices 하나는 글자('사과') 또는 { text: '사과', pic: 'apple' }. 그림이 있으면 그림+글자 버튼 2열.
export function mountChoice(host, done, { lead, questions, grid = false } = {}) {
  let idx = 0;
  let correctCount = 0;

  render();

  function render() {
    toTop();
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
    const withPics = q.choices.some((c) => typeof c === 'object' && c.pic);
    const picsHtml = q.pics
      ? `<div class="q-pics${q.pics.length === 1 ? ' one' : ''}">${q.pics.map((p) => `<img src="pics/${p}.svg" alt="">`).join('')}</div>`
      : '';
    // 정답 공개 전/뒤에 나올 수 있는 문구 세 가지를 미리 다 그려 한 칸에 겹쳐 둔다.
    // 오답 문구는 무엇을 골랐든 같다(정답이 무엇인지만 알려주므로).
    const explainHtml = q.explain ? `<br>${q.explain}` : '';
    const correctHtml = `<span class="badge ok">정답입니다</span>${explainHtml}`;
    const wrongHtml = `<span class="badge no">아쉬워요</span> 정답은 "${choiceText(q.choices[q.answer])}" 입니다${explainHtml}`;
    host.innerHTML = `
      ${lead ? `<p class="lead">${lead}</p>` : ''}
      <p class="step">${idx + 1}번째 / ${questions.length}문제</p>
      ${picsHtml}
      <p class="question">${q.question}</p>
      <div id="choices" class="${grid || withPics ? 'choice-grid' : ''}">
        ${q.choices.map((c, i) => choiceHtml(c, i)).join('')}
      </div>
      <p class="feedback stack" id="word">
        <span class="fx fx-suspense">정답은…</span>
        <span class="fx fx-correct">${correctHtml}</span>
        <span class="fx fx-wrong">${wrongHtml}</span>
      </p>
      <div id="buttons"><button class="big-btn primary reserve" id="next">다음 문제</button></div>`;
    enter(host);

    host.querySelectorAll('#choices button').forEach((btn) => {
      btn.onclick = () => pick(Number(btn.dataset.i));
    });
    host.querySelector('#next').onclick = () => { idx += 1; render(); };
  }

  async function pick(i) {
    const q = questions[idx];
    const choicesWrap = host.querySelector('#choices');
    choicesWrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    choicesWrap.children[i].classList.add('picked');

    const wordEl = host.querySelector('#word');
    wordEl.querySelector('.fx-suspense').classList.add('show');

    await wait(PACE.suspense);

    choicesWrap.children[q.answer].classList.add('correct');
    wordEl.querySelector('.fx-suspense').classList.remove('show');
    if (i === q.answer) {
      correctCount += 1;
      wordEl.querySelector('.fx-correct').classList.add('show');
    } else {
      wordEl.querySelector('.fx-wrong').classList.add('show');
    }

    const buttonsEl = host.querySelector('#buttons');
    enter(buttonsEl);
    buttonsEl.querySelector('#next').classList.remove('reserve');
    keepInView(buttonsEl);
  }
}

// 보기 하나의 글자. 글자만 있으면 그대로, { text, pic } 이면 text.
function choiceText(c) {
  return typeof c === 'string' ? c : c.text;
}

function choiceHtml(c, i) {
  if (typeof c === 'string' || !c.pic) return `<button class="big-btn" data-i="${i}">${choiceText(c)}</button>`;
  return `<button class="big-btn pic-btn" data-i="${i}"><img src="pics/${c.pic}.svg" alt=""><span>${c.text}</span></button>`;
}
