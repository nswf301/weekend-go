// ===========================================================
//  다른 하나 찾기.
//  문제는 여기만 고치면 된다.
// ===========================================================
import { mountChoice } from '../choice.js';

const QUESTIONS = [
  {
    question: '종류가 다른 하나는\n무엇일까요?',
    choices: ['사과', '배', '배추', '감'],
    answer: 2,
    explain: '배추만 채소입니다',
  },
  {
    question: '종류가 다른 하나는\n무엇일까요?',
    choices: ['소', '고등어', '돼지', '염소'],
    answer: 1,
    explain: '고등어만 물고기입니다',
  },
  {
    question: '종류가 다른 하나는\n무엇일까요?',
    choices: ['장구', '북', '꽹과리', '호미'],
    answer: 3,
    explain: '호미는 악기가 아니라 농기구입니다',
  },
];

export function mount(host, done) {
  mountChoice(host, done, { questions: QUESTIONS, grid: true });
}
