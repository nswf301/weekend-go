// ===========================================================
//  참여 번호(번호표) 담당.
//  Firebase(weekend-go-1)에 숫자 하나를 두고 한 명씩 1을 올린다.
//  마지막 번호가 곧 참여 인원수다.
// ===========================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {
  getFirestore, doc, runTransaction,
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC54ECUQxrDkB_rxSyabHcAjbzTj1RCrt4',
  authDomain: 'weekend-go-1.firebaseapp.com',
  projectId: 'weekend-go-1',
  storageBucket: 'weekend-go-1.firebasestorage.app',
  messagingSenderId: '805120591103',
  appId: '1:805120591103:web:aa398a44d68142eccff8ca',
};

const db = getFirestore(initializeApp(firebaseConfig));

// 여러 명이 같은 순간에 눌러도 번호가 겹치지 않는다.
// 읽기와 쓰기를 한 묶음으로 처리하고, 부딪히면 Firebase가 알아서 다시 시도한다.
export async function issueTicketNumber() {
  const ref = doc(db, 'quiz', 'counter');
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const next = (snap.exists() ? Number(snap.data().count) || 0 : 0) + 1;
    tx.set(ref, { count: next });
    return next;
  });
}
