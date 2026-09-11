// ===========================================================
//  추억 퀴즈.
//  문제를 순서대로 풀어본다. 틀려도 정답을 보여주고 다음으로 넘어간다.
//  문제 내용은 quiz-data.js 에서 고친다.
// ===========================================================
import { mountChoice } from '../choice.js';
import { QUESTIONS } from '../quiz-data.js';

export function mount(host, done) {
  mountChoice(host, done, { questions: QUESTIONS });
}
