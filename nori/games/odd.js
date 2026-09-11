// ===========================================================
//  다른 하나 찾기.
//  문제는 여기만 고치면 된다.
// ===========================================================
import { mountChoice } from '../choice.js';

const QUESTIONS = [
  {
    question: '종류가 다른 하나는\n무엇일까요?',
    choices: [
      { text: '사과', pic: 'apple' },
      { text: '배', pic: 'pear' },
      { text: '배추', pic: 'cabbage' },
      { text: '감', pic: 'persimmon' },
    ],
    answer: 2,
    explain: '배추만 채소입니다',
  },
  {
    question: '종류가 다른 하나는\n무엇일까요?',
    choices: [
      { text: '소', pic: 'cow' },
      { text: '고등어', pic: 'mackerel' },
      { text: '돼지', pic: 'pig' },
      { text: '염소', pic: 'goat' },
    ],
    answer: 1,
    explain: '고등어만 물고기입니다',
  },
  {
    question: '종류가 다른 하나는\n무엇일까요?',
    choices: [
      { text: '장구', pic: 'janggu' },
      { text: '북', pic: 'buk' },
      { text: '꽹과리', pic: 'kkwaenggwari' },
      { text: '호미', pic: 'homi' },
    ],
    answer: 3,
    explain: '호미는 악기가 아니라 농기구입니다',
  },
];

export function mount(host, done) {
  mountChoice(host, done, { questions: QUESTIONS, grid: true });
}
