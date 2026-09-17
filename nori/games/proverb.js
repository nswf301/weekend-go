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
  { question: '낮말은 새가 듣고\n…', choices: ['밤말은 쥐가 듣는다', '밤말은 개가 듣는다', '밤말은 소가 듣는다'], answer: 0 },
  { question: '원숭이도\n…', choices: ['산에서 산다', '나무에서 떨어진다', '과일을 좋아한다'], answer: 1 },
  { question: '티끌 모아\n…', choices: ['먼지 된다', '부자 된다', '태산'], answer: 2 },
  { question: '백지장도\n…', choices: ['맞들면 낫다', '찢어진다', '가볍다'], answer: 0 },
  { question: '등잔 밑이\n…', choices: ['밝다', '어둡다', '뜨겁다'], answer: 1 },
  { question: '하늘이 무너져도\n…', choices: ['비가 그친다', '땅은 멀쩡하다', '솟아날 구멍이 있다'], answer: 2 },
  { question: '고래 싸움에\n…', choices: ['새우 등 터진다', '바다가 넘친다', '멸치가 웃는다'], answer: 0 },
];

export function mount(host, done) {
  mountChoice(host, done, { lead: '속담의 뒷말을 골라 보세요', questions: QUESTIONS });
}
