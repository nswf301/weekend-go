// ===========================================================
//  다른 하나 찾기.
//  문제는 여기만 고치면 된다.
// ===========================================================
import { mountChoice } from '../choice.js';

const Q = '종류가 다른 하나는\n무엇일까요?';

const QUESTIONS = [
  {
    question: Q,
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
    question: Q,
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
    question: Q,
    choices: [
      { text: '장구', pic: 'janggu' },
      { text: '북', pic: 'buk' },
      { text: '꽹과리', pic: 'kkwaenggwari' },
      { text: '호미', pic: 'homi' },
    ],
    answer: 3,
    explain: '호미는 악기가 아니라 농기구입니다',
  },
  {
    question: Q,
    choices: [
      { text: '해', pic: 'sun' },
      { text: '달', pic: 'moon' },
      { text: '배추', pic: 'cabbage' },
      { text: '별', pic: 'star' },
    ],
    answer: 2,
    explain: '배추만 하늘에서 볼 수 없습니다',
  },
  {
    question: Q,
    choices: [
      { text: '돼지', pic: 'pig' },
      { text: '사과', pic: 'apple' },
      { text: '감', pic: 'persimmon' },
      { text: '배', pic: 'pear' },
    ],
    answer: 0,
    explain: '돼지만 과일이 아니라 동물입니다',
  },
  {
    question: Q,
    choices: [
      { text: '소', pic: 'cow' },
      { text: '꽃', pic: 'flower' },
      { text: '돼지', pic: 'pig' },
      { text: '염소', pic: 'goat' },
    ],
    answer: 1,
    explain: '꽃만 동물이 아닙니다',
  },
  {
    question: Q,
    choices: [
      { text: '붕어빵', pic: 'bungeoppang' },
      { text: '사과', pic: 'apple' },
      { text: '감', pic: 'persimmon' },
      { text: '돈', pic: 'money' },
    ],
    answer: 3,
    explain: '돈만 먹을 수 없습니다',
  },
  {
    question: '살아 있는 동물이\n아닌 것은?',
    choices: [
      { text: '소', pic: 'cow' },
      { text: '붕어빵', pic: 'bungeoppang' },
      { text: '염소', pic: 'goat' },
      { text: '고등어', pic: 'mackerel' },
    ],
    answer: 1,
    explain: '붕어빵은 이름만 붕어인 빵입니다',
  },
  {
    question: Q,
    choices: [
      { text: '꽹과리', pic: 'kkwaenggwari' },
      { text: '북', pic: 'buk' },
      { text: '소', pic: 'cow' },
      { text: '장구', pic: 'janggu' },
    ],
    answer: 2,
    explain: '소만 악기가 아닙니다',
  },
  {
    question: Q,
    choices: [
      { text: '고등어', pic: 'mackerel' },
      { text: '호미', pic: 'homi' },
      { text: '소', pic: 'cow' },
      { text: '돼지', pic: 'pig' },
    ],
    answer: 1,
    explain: '호미만 살아 있는 것이 아닙니다',
  },
];

export function mount(host, done) {
  mountChoice(host, done, { questions: QUESTIONS, grid: true });
}
