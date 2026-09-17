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
  { pics: ['pear', 'pear'], question: '2,000원짜리 배를\n2개 사면\n모두 얼마일까요?', choices: ['4,000원', '3,000원', '5,000원'], answer: 0 },
  { pics: ['money'], question: '5,000원을 내고\n3,000원어치를 사면\n거스름돈은?', choices: ['1,000원', '2,000원', '3,000원'], answer: 1 },
  { pics: ['persimmon', 'persimmon', 'persimmon'], question: '500원짜리 감을\n3개 사면\n모두 얼마일까요?', choices: ['1,000원', '2,000원', '1,500원'], answer: 2 },
  { pics: ['cabbage', 'cabbage'], question: '3,000원짜리 배추를\n2포기 사면\n모두 얼마일까요?', choices: ['5,000원', '6,000원', '9,000원'], answer: 1 },
  { pics: ['money'], question: '1,000원짜리 지폐\n5장은\n모두 얼마일까요?', choices: ['5,000원', '500원', '50,000원'], answer: 0 },
  { pics: ['bungeoppang', 'bungeoppang'], question: '붕어빵 2개가\n1,000원이면\n1개는 얼마일까요?', choices: ['200원', '500원', '1,000원'], answer: 1 },
  { pics: ['apple', 'apple', 'pear'], question: '사과 2개 2,000원\n배 1개 2,000원\n모두 얼마일까요?', choices: ['3,000원', '5,000원', '4,000원'], answer: 2 },
];

export function mount(host, done) {
  mountChoice(host, done, { questions: QUESTIONS });
}
