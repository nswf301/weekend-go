// ===========================================================
//  속담 잇기.
//  문제는 여기만 고치면 된다.
// ===========================================================
import { mountChoice } from '../choice.js';

const QUESTIONS = [
  {
    question: '가는 말이 고와야\n…',
    choices: ['오는 말이 곱다', '길이 편하다', '발이 가볍다'],
    answer: 0,
  },
  {
    question: '세 살 버릇\n…',
    choices: ['열 살까지 간다', '금방 고친다', '여든까지 간다'],
    answer: 2,
  },
  {
    question: '소 잃고\n…',
    choices: ['송아지 산다', '외양간 고친다', '밭을 간다'],
    answer: 1,
  },
];

export function mount(host, done) {
  mountChoice(host, done, { lead: '속담의 뒷말을 골라 보세요', questions: QUESTIONS });
}
