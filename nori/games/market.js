// ===========================================================
//  장보기 셈.
//  문제는 여기만 고치면 된다.
// ===========================================================
import { mountChoice } from '../choice.js';

const QUESTIONS = [
  {
    pics: ['apple', 'apple', 'apple'],
    question: '1,000원짜리 사과를\n3개 사면\n모두 얼마일까요?',
    choices: ['2,000원', '3,000원', '4,000원'],
    answer: 1,
  },
  {
    pics: ['money'],
    question: '10,000원을 내고\n6,000원어치를 사면\n거스름돈은?',
    choices: ['4,000원', '3,000원', '5,000원'],
    answer: 0,
  },
  {
    pics: ['bungeoppang', 'bungeoppang', 'bungeoppang', 'bungeoppang'],
    question: '500원짜리 붕어빵을\n4개 사면\n모두 얼마일까요?',
    choices: ['1,500원', '2,500원', '2,000원'],
    answer: 2,
  },
];

export function mount(host, done) {
  mountChoice(host, done, { questions: QUESTIONS });
}
