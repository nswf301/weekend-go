// ===========================================================
//  문제풀이 공용 흐름.
//  quiz·proverb·market·odd 가 이 파일 하나를 함께 쓴다.
//  문제 내용은 각 게임 파일 맨 위에 있고, 흐름을 고칠 땐 여기만 고치면 된다.
// ===========================================================
import { PACE, wait, enter, toTop } from './pace.js';

// 한 판에 풀 문제 수. 문제가 이보다 적으면 있는 만큼만 쓴다.
const PICK_COUNT = 3;

// 새 문제의 보기는 화면 두드림이 이만큼(ms) 멎은 뒤에야 눌린다. 아래 arm() 설명 참고.
const QUIET = 1000;

// options: { lead, questions, grid }
// questions 하나는 { question, choices, answer, explain } 형태다.
// explain은 선택이고, 정답 공개 뒤 한 줄 더 보여준다.
// pics도 선택이다. ['apple', 'apple'] 처럼 넣으면 문제 위에 그림을 한 줄로 늘어놓는다.
// choices 하나는 글자('사과') 또는 { text: '사과', pic: 'apple' }. 그림이 있으면 그림+글자 버튼 2열.
export function mountChoice(host, done, { lead, questions, grid = false } = {}) {
  let idx = 0;
  let correctCount = 0;
  // 시작할 때 한 번만 섞어서 앞 PICK_COUNT개만 쓴다. 보기 순서는 섞지 않는다(answer가 보기 순서를 가리키므로).
  const pool = questions.length <= PICK_COUNT ? questions : shuffle(questions).slice(0, PICK_COUNT);

  // [다음 문제] 버튼과 다음 문제의 첫 번째 보기가 화면의 같은 자리에 온다. 같은 곳을 계속 두드리면
  // 문제를 읽기도 전에 보기가 골라져서, 한 문제만 풀고도 끝 화면까지 넘어갔다(2026-10-13 행사 당일 발견).
  // 그래서 새 문제의 보기는 두드림이 QUIET 만큼 멎은 뒤에야 눌리게 한다. 한 번 풀리면 그 문제 동안은 그대로다.
  let armed = false;
  let armTimer = null;
  const arm = () => {
    armed = false;
    clearTimeout(armTimer);
    armTimer = setTimeout(() => { armed = true; }, QUIET);
  };
  const onTap = () => { if (!armed) arm(); };
  document.addEventListener('pointerdown', onTap, true);

  render();

  function render() {
    toTop();
    if (idx >= pool.length) {
      clearTimeout(armTimer);
      document.removeEventListener('pointerdown', onTap, true);
      host.innerHTML = `
        <p class="lead">문제를 다 풀었습니다</p>
        <p class="question">${pool.length}문제 중 ${correctCount}문제를 맞히셨습니다</p>
        <button class="big-btn primary" id="finish">도장 받기</button>`;
      enter(host);
      host.querySelector('#finish').onclick = done;
      return;
    }

    const q = pool[idx];
    const withPics = q.choices.some((c) => typeof c === 'object' && c.pic);
    const picsHtml = q.pics
      ? `<div class="q-pics${q.pics.length === 1 ? ' one' : ''}">${q.pics.map((p) => `<img src="pics/${p}.svg" alt="">`).join('')}</div>`
      : '';
    host.innerHTML = `
      ${lead ? `<p class="lead">${lead}</p>` : ''}
      <p class="step">${idx + 1}번째 / ${pool.length}문제</p>
      ${picsHtml}
      <p class="question">${q.question}</p>
      <div id="choices" class="${grid || withPics ? 'choice-grid' : ''}">
        ${q.choices.map((c, i) => choiceHtml(c, i)).join('')}
      </div>`;
    enter(host);
    arm();

    host.querySelectorAll('#choices button').forEach((btn) => {
      btn.onclick = () => { if (armed) pick(Number(btn.dataset.i)); };
    });
  }

  // 답을 고르면 고른 보기 표시만 남긴 채 뜸을 들이고, 그 뒤에 결과를 담은
  // 팝업이 한 번에 뜬다(문구만 먼저 보여주는 "정답은…" 단계는 없앴다).
  // 팝업은 화면 가운데, 바탕이 옅게 어두워져 뒤의 보기 표시(picked·correct)가
  // 비쳐 보이고, [다음 문제]를 눌러야만 닫힌다.
  async function pick(i) {
    const q = pool[idx];
    const choicesWrap = host.querySelector('#choices');
    choicesWrap.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    choicesWrap.children[i].classList.add('picked');

    await wait(PACE.suspense);

    choicesWrap.children[q.answer].classList.add('correct');
    const explainHtml = q.explain ? `<br>${q.explain}` : '';
    let wordHtml;
    if (i === q.answer) {
      correctCount += 1;
      wordHtml = `<span class="badge ok">정답</span>${q.explain || ''}`;
    } else {
      wordHtml = `<span class="badge no">아쉬워요</span> 정답은 "${choiceText(q.choices[q.answer])}" 입니다${explainHtml}`;
    }

    const popup = document.createElement('div');
    popup.className = 'popup-overlay';
    popup.innerHTML = `
      <div class="card popup-card" role="dialog" aria-modal="true">
        <div class="popup-feedback"><p class="feedback" id="word">${wordHtml}</p></div>
        <div id="buttons"><button class="big-btn primary" id="next">다음 문제</button></div>
      </div>`;
    // host(#game)의 조상인 .card에는 화면 전환 때 .enter 애니메이션이 걸린다.
    // 예전엔 여기 transform(translateY)이 있어서 끝난 뒤에도 값이 남아
    // position:fixed의 기준이 뷰포트가 아니라 .card로 틀어진 적이 있다.
    // 지금은 opacity만 쓰지만, 안전하게 계속 body에 직접 붙인다.
    document.body.appendChild(popup);
    enter(popup);
    popup.querySelector('#next').onclick = () => {
      popup.remove();
      idx += 1;
      render();
    };
  }
}

// 배열을 섞은 새 배열을 돌려준다(원본은 그대로 둠).
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 보기 하나의 글자. 글자만 있으면 그대로, { text, pic } 이면 text.
function choiceText(c) {
  return typeof c === 'string' ? c : c.text;
}

function choiceHtml(c, i) {
  if (typeof c === 'string' || !c.pic) return `<button class="big-btn" data-i="${i}">${choiceText(c)}</button>`;
  return `<button class="big-btn pic-btn" data-i="${i}"><img src="pics/${c.pic}.svg" alt=""><span>${c.text}</span></button>`;
}
