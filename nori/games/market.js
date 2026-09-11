// ===========================================================
//  장보기 셈.
//  문제는 여기만 고치면 된다.
// ===========================================================
import { mountChoice } from '../choice.js';

const QUESTIONS = [
  {
    question: '1,000원짜리 사과를\n3개 사면\n모두 얼마일까요?',
    choices: ['2,000원', '3,000원', '4,000원'],
    answer: 1,
  },
  {
    question: '10,000원을 내고\n6,000원어치를 샀습니다\n거스름돈은 얼마일까요?',
    choices: ['4,000원', '3,000원', '5,000원'],
    answer: 0,
  },
  {
    question: '500원짜리 붕어빵을\n4개 사면\n모두 얼마일까요?',
    choices: ['1,500원', '2,500원', '2,000원'],
    answer: 2,
  },
];

export function mount(host, done) {
  mountChoice(host, done, { lead: '장보기 셈을 해 보세요', questions: QUESTIONS });
}
