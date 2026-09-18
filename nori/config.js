// ===========================================================
//  행사 설정. 문구·암호·부스 목록은 여기만 고치면 된다.
// ===========================================================

export const CONFIG = {
  // 첫 화면 제목
  title: '스마트 퀴즈존',

  // 도장 몇 개를 모아야 상품을 받는지
  needStamps: 3,

  // 도장을 다 모으면 나오는 상품 암호
  password: '무궁화',

  // 암호 화면 맨 아래 안내
  prizeNotice: '이 화면을 직원에게 보여주시거나\n암호를 말씀해 주세요',
};

// -----------------------------------------------------------
//  부스 목록
//  - code : 주소에 붙는 이름. QR 주소가 .../nori/?g=yut 이 된다
//  - name : 화면에 보이는 부스 이름
//  - pin  : 부스에 크게 붙여둘 네 자리 숫자.
//           카메라가 안 되는 폰을 위한 대비책이다. 겹치면 안 된다.
//  - pic  : 부스 첫 화면에 크게 나오는 그림. pics/ 폴더 파일 이름(.svg 뺀 것)
// -----------------------------------------------------------
export const BOOTHS = [
  { code: 'proverb', name: '속담 잇기',      pin: '1101', pic: 'booth-proverb' },
  { code: 'market',  name: '장보기 셈',      pin: '1202', pic: 'booth-market' },
  { code: 'number',  name: '숫자 누르기',    pin: '1303', pic: 'booth-number' },
  { code: 'quiz',    name: '추억 퀴즈',      pin: '1404', pic: 'booth-quiz' },
  { code: 'memory',  name: '순서 기억하기',  pin: '1505', pic: 'booth-memory' },
  { code: 'match',   name: '짝 맞추기',      pin: '1606', pic: 'booth-match' },
  { code: 'odd',     name: '다른 하나 찾기', pin: '1707', pic: 'booth-odd' },
  { code: 'find',    name: '그림 찾기',      pin: '1808', pic: 'booth-find' },
];

export function findBooth(code) {
  return BOOTHS.find((b) => b.code === code) || null;
}

export function findBoothByPin(pin) {
  return BOOTHS.find((b) => b.pin === String(pin).trim()) || null;
}
