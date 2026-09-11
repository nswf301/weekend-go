# 어울림 한마당 (nori)

어르신 행사에서 **부스 일곱 곳 중 세 곳을 돌면 상품 암호**가 나오는 도장 모으기 앱.
어르신이 개인 휴대전화로 QR을 찍어 참여한다. 행사 규모 300명 기준.

주말 앱(`../index.html`)과는 아무 상관 없다. 저장소만 같이 쓴다.

## 주소

| 용도 | 주소 |
|---|---|
| 참여자 | https://nswf301.github.io/weekend-go/nori/ |
| 관리 화면 | https://nswf301.github.io/weekend-go/nori/admin/ |
| QR 인쇄판 | https://nswf301.github.io/weekend-go/nori/print/ |

부스마다 주소 뒤에 `?g=부스코드`가 붙는다. 관리 화면은 참여자 화면 어디에도 링크가 없다.
주소를 아는 사람만 들어온다.

## 파일

```
index.html      틀 (main.js만 불러온다)
config.js       행사 이름·암호·부스 목록  ← 내용을 바꿀 땐 여기만
main.js         화면 흐름 (번호 확인 → 놀이 → 도장 → 다음 부스)
pace.js         놀이 속도(시간 값) 모음  ← 전체 속도를 바꿀 땐 여기만
choice.js       문제풀이 공용 흐름 (속담·장보기·추억 퀴즈·다른 하나 찾기가 같이 쓴다)
player.js       참여 번호 발급, 도장 저장·복구 (Firebase)
scan.js         앱 안에서 QR 찍기
style.css       디자인 전부
quiz-data.js    추억 퀴즈 문항
games/          놀이 하나에 파일 하나 (proverb, market, rps, quiz, memory, match, odd)
pics/           그림 (색종이 오려붙이기 SVG, 한 파일에 그림 하나)
admin/          관리 화면
print/          부스 QR 인쇄판 (A4 한 장 = 부스 하나)
```

놀이를 고칠 땐 `games/` 안의 그 파일 하나만 열면 된다. 놀이를 더 붙이려면
`games/새코드.js`를 만들고 `config.js`의 `BOOTHS`에 한 줄 넣으면 끝이다.

**그림** — `pics/이름.svg`. 코드에서는 `.svg`를 뺀 이름으로 부른다(`apple`, `hand-rock`,
부스 대표 그림은 `booth-부스코드`). 부스 첫 화면 그림은 `config.js` `BOOTHS`의 `pic`으로 정하고,
문제 위 그림·그림 보기는 `choice.js` 맨 위 주석대로 문제에 `pics`·`{ text, pic }`를 넣는다.

**게임 파일 규칙** — `export function mount(host, done)` 하나만 내보낸다.
`host`에 화면을 그리고, 끝나면 "도장 받기" 버튼(`id="finish"`)의 onclick으로 `done`을 부른다.
**실패가 없어야 한다.** 틀리거나 져도 반드시 도장을 받는다.

## 배포

주말 앱과 같다. 이 저장소를 GitHub Pages가 그대로 띄운다.

```
git add -A
git commit -m "무엇을 고쳤는지"
git push
```

보안 규칙만 따로 올린다(루트의 `../firestore.rules`):

```
firebase deploy --only firestore:rules --project weekend-go-1 --account anthem82@gmail.com
```

## Firebase — 계정을 조심할 것

**`weekend-go-1`은 anthem82@gmail.com(개인) 소유다.** 업무 계정(nswf301)으로 로그인하면
프로젝트 목록에 아예 안 보인다. CLI를 쓸 땐 `--account anthem82@gmail.com`을 반드시 붙인다.
Firestore는 이 앱을 만들며 처음 켰다(서울, asia-northeast3).

저장하는 것은 딱 두 가지다.

```
nori/counter        { count: 15 }              ← 참여 번호. 마지막 번호가 곧 참여 인원수
players/<번호>      { stamps: {yut:true, ...} } ← 그 사람이 어느 부스를 돌았는지
```

이름·연락처 같은 개인정보는 받지 않는다. 번호만 쓴다.

보안 규칙은 이 두 곳만 열려 있다. 번호는 **정확히 1씩만** 늘릴 수 있고, 도장은 **줄어들 수 없고**
지울 수도 없다. 관리 화면이 전체를 훑어야 해서 `players` 읽기는 열어 뒀다.

## 설계에서 가장 중요한 것 — 번호가 열쇠다

도장을 폰(localStorage)에만 저장하면 **카카오톡으로 QR을 찍어 열었다가 나중에 크롬으로 들어오는 순간
도장이 통째로 사라진다.** 어르신 본인은 분명 세 곳을 돌았는데 화면엔 0개인 상황이 생기고,
이걸 현장에서 설명하기가 아주 곤란하다.

그래서 도장은 폰이 아니라 **Firebase에 번호로** 저장한다. 화면이 초기화돼도
첫 화면의 "번호를 이미 받으셨어요"에 번호를 넣으면 도장이 그대로 돌아온다.
(2026-09-10 실제로 새 브라우저에서 확인함)

**그래서 행사 당일 이것 하나는 반드시 지켜야 한다 — 첫 부스 직원이 어르신 참여 번호를
종이에 적어드릴 것.** 팔찌든 스티커든 명찰이든 번호가 몸에 붙어 있으면 이 설계는 거의 안 깨진다.
어르신이 세 자리 숫자를 외우고 다니실 거라 기대하면 안 된다. **여기가 유일한 약한 고리다.**

## 부스 이동 — 앱 안에서 QR을 찍는다

두 번째 부스부터는 앱 안의 "다음 놀이 찍기"로 카메라를 연다. 바깥 스캐너(카톡 등)를 다시 쓰면
다른 브라우저로 열려 위의 문제가 그대로 생기기 때문이다. https라서 카메라 권한은 한 번만 물어본다.

아이폰은 브라우저에 QR 인식 기능이 없어 `cdnjs`의 jsQR을 대신 싣는다(`scan.js`).

**카메라가 안 되는 경우를 위해 부스마다 네 자리 번호가 있다.** 부스에 크게 붙여두고,
"부스 번호 넣기"로 들어온다. 카톡 인앱 브라우저에서 카메라가 막히는 경우, 조준이 어려우신 분,
권한을 거부하신 경우가 전부 이 길로 구제된다. 번호는 `config.js`의 `pin`이다.

## 행사 전후에 할 일

**행사 직전 — 지난 기록을 지워 1번부터 시작하게 한다.**

```
firebase firestore:delete players --recursive --force --project weekend-go-1 --account anthem82@gmail.com
firebase firestore:delete nori/counter --force --project weekend-go-1 --account anthem82@gmail.com
```

**행사 중 — 관리 화면**에서 참여 인원, 선물 대상(도장 3개 이상), 부스별 참여 수를 본다.
"도장이 안 보인다"는 분은 번호로 찾으면 어느 부스를 돌았는지 나온다.

**행사 뒤 — 참여 인원수는 `nori/counter`의 `count`다.** 지우기 전에 적어둔다.

## 확인한 것 / 확인 못 한 것 (2026-09-10)

배포된 실제 주소에서 확인했다.

- 부스 세 곳을 돌아 암호가 나오는 것 (운세 → 윷 → 복주머니, 부스 번호로 이동)
- 새 브라우저에서 번호만 넣어 도장 3개가 복구되는 것
- 놀이 일곱 개가 다 열리고 도장까지 도달하는 것
- 관리 화면이 실제 값을 읽는 것
- QR 인쇄판이 부스마다 A4 한 장씩 나오는 것

**앱 안 카메라로 QR 찍기는 확인하지 못했다.** 확인 도구(헤드리스 크롬)에 카메라가 없다.
**실제 폰으로 한 번 해봐야 한다.** 부스 번호로 들어가는 대비책은 통과했다.

## 안 되는 것 (확인 완료, 다시 찾지 말 것)

- **GitHub Pages에는 서버가 없다.** 번호를 세거나 도장을 저장하려면 Firebase가 반드시 필요하다.
- **`@netlify/blobs` 8.2.0에는 조건부 쓰기(`onlyIfMatch`)가 없다.** 처음에 Netlify로 가려다
  이걸로 막혔다. 여러 명이 동시에 누르면 같은 번호가 두 사람에게 나간다.
  Firestore 트랜잭션으로 바꾼 이유다.
- **`cdn.jsdelivr.net/npm/qrcode@1.5.x/build/qrcode.min.js` 는 404다.** 인쇄판은
  `cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`를 쓴다. API가 달라서
  `new QRCode(div, {...})` 형태다(`toCanvas`가 아니다).
- **암호는 브라우저에서 들여다볼 수 있다.** 재미용이면 괜찮지만 값비싼 상품에는 못 쓴다.

## 다음 할 일

- 실제 폰으로 앱 안 카메라 확인
- 행사 이름·상품 암호·퀴즈 문항을 실제 내용으로 교체 (`config.js`, `quiz-data.js`)
- 부스 네 자리 번호가 현장 표기와 맞는지 확인 (지금 1101/1202/1303/1404/1505/1606/1707)
