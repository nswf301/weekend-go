// ===========================================================
//  참여자 담당.
//  - 참여 번호를 발급한다(번호 = 몇 번째 참여자).
//  - 도장을 Firebase에 저장한다. 폰이 아니라 서버에 있으므로
//    폰이 초기화돼도 번호만 넣으면 도장이 돌아온다.
// ===========================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {
  getFirestore, doc, getDoc, setDoc, runTransaction, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC54ECUQxrDkB_rxSyabHcAjbzTj1RCrt4',
  authDomain: 'weekend-go-1.firebaseapp.com',
  projectId: 'weekend-go-1',
  storageBucket: 'weekend-go-1.firebasestorage.app',
  messagingSenderId: '805120591103',
  appId: '1:805120591103:web:aa398a44d68142eccff8ca',
};

export const db = getFirestore(initializeApp(firebaseConfig));

const NUMBER_KEY = 'nori_player_number';
const ROUND_KEY = 'nori_round';

// 지금 회차. 관리 화면에서 참여 초기화를 누를 때마다 1씩 오른다.
async function currentRound() {
  const snap = await getDoc(doc(db, 'nori', 'counter'));
  return snap.exists() ? Number(snap.data().round) || 0 : 0;
}

// 이 폰이 기억하고 있는 참여 번호.
// 초기화 전 회차의 번호면 잊는다(새 참여자와 번호가 겹치지 않게).
export async function savedNumber() {
  const num = localStorage.getItem(NUMBER_KEY);
  if (!num) return null;
  let round;
  try { round = await currentRound(); } catch (e) { return num; }
  if ((Number(localStorage.getItem(ROUND_KEY)) || 0) !== round) {
    forgetNumber();
    return null;
  }
  return num;
}

function remember(num, round) {
  try {
    localStorage.setItem(NUMBER_KEY, String(num));
    localStorage.setItem(ROUND_KEY, String(round));
  } catch (e) { /* 저장이 막혀도 진행은 된다 */ }
}

export function forgetNumber() {
  try {
    localStorage.removeItem(NUMBER_KEY);
    localStorage.removeItem(ROUND_KEY);
  } catch (e) { /* 무시 */ }
}

// 새 참여 번호를 받는다.
// 여러 명이 같은 순간에 눌러도 번호가 겹치지 않는다.
export async function issueNumber() {
  const ref = doc(db, 'nori', 'counter');
  const { num, round } = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.exists() ? Number(snap.data().count) || 0 : 0) + 1;
    const r = snap.exists() ? Number(snap.data().round) || 0 : 0;
    tx.set(ref, { count: next, round: r });
    return { num: next, round: r };
  });
  remember(num, round);
  return String(num);
}

// 번호로 도장 현황을 읽는다. 없는 번호면 null.
export async function loadStamps(num) {
  const snap = await getDoc(doc(db, 'players', String(num)));
  if (!snap.exists()) return null;
  const stamps = snap.data().stamps;
  return (stamps && typeof stamps === 'object') ? stamps : {};
}

// 번호를 이어받는다(다른 폰에서 이어 하거나 화면이 초기화된 경우).
// 없는 번호면 null을 돌려주고 폰에 기억시키지 않는다.
export async function resumeNumber(num) {
  const stamps = await loadStamps(num);
  if (stamps === null) return null;
  remember(num, await currentRound());
  return stamps;
}

// 도장을 찍는다. 이미 찍힌 부스면 그대로 둔다.
export async function addStamp(num, boothCode, stamps) {
  const next = { ...stamps, [boothCode]: true };
  await setDoc(
    doc(db, 'players', String(num)),
    { stamps: next, updatedAt: serverTimestamp() },
    { merge: true },
  );
  return next;
}
