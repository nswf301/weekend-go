/*
 * 주말 어디 가지 — 자료 수집기
 *
 *   node collect.js          수집해서 data.json 저장
 *   node collect.js --peek   각 API가 주는 칸 이름만 확인 (연결 시험용)
 *
 * 키는 keys.json 에서 읽는다. (깃허브에 올라가지 않음)
 */

const fs = require("fs");
const path = require("path");

/* ── 설정 ────────────────────────────────────────────────── */

// 서울에서 대략 2시간 반경만 남긴다 (전국을 다 담으면 파일이 너무 커진다)
const BOX = { latMin: 36.2, latMax: 38.4, lngMin: 125.7, lngMax: 128.8 };

// 오늘 이전에 끝난 행사는 버린다
const TODAY = new Date().toISOString().slice(0, 10);

const KEYS = JSON.parse(fs.readFileSync(path.join(__dirname, "keys.json"), "utf8"));
const PEEK = process.argv.includes("--peek");

/* ── 공통 도구 ───────────────────────────────────────────── */

async function getJson(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": "weekend-go/1.0" } });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${label}: JSON 아님 (${res.status})\n${text.slice(0, 300)}`);
  }
}

// 여러 후보 칸 이름 중 값이 있는 첫 번째를 쓴다 (기관마다 칸 이름이 조금씩 다름)
function pick(row, ...names) {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

// &middot; &#39; 같은 HTML 기호를 글자로 되돌린다
const unent = (s) => String(s || "")
  .replace(/&middot;/g, "·").replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'")
  .replace(/&nbsp;/g, " ");

const toDate = (s) => {
  const m = String(s).match(/(\d{4})[-.\/]?(\d{2})[-.\/]?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

function inBox(lat, lng) {
  return (
    lat !== null && lng !== null &&
    lat >= BOX.latMin && lat <= BOX.latMax &&
    lng >= BOX.lngMin && lng <= BOX.lngMax
  );
}

/* ── 대상 문구에서 나이 읽기 ──────────────────────────────
 * "유아(만5세이상), 초등학생"  →  5~12세
 * "가족(초등학교 4~6학년 어린이를 동반한 가족)"  →  10~12세
 * 쉼표로 나눠 조각마다 읽고 합친다. 낱말로 기본 범위를 잡은 뒤
 * 괄호 안 나이·학년으로 좁힌다.
 */
const AGE_WORDS = [
  [/유아|영유아|미취학/, 3, 6], [/초등/, 7, 12], [/중학/, 13, 15], [/고등/, 16, 18],
  [/청소년/, 13, 18], [/어린이/, 6, 12], [/청년/, 19, 34],
  [/성인|주부|여성|직장인/, 19, 99], [/어르신|노인|시니어/, 65, 99],
  [/가족|제한없음|누구나|전연령|무관|장애인|국가유공자/, 0, 99],
];

function splitTarget(t) {                 // 괄호를 지키며 쉼표로 나눈다
  const out = []; let depth = 0, cur = "";
  for (const c of t) {
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth <= 0) { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.filter((s) => s.trim());
}

function segAge(seg) {
  const s = seg.replace(/\s/g, "");
  let base = null;
  for (const [re, a, b] of AGE_WORDS)
    if (re.test(s)) base = base ? [Math.min(base[0], a), Math.max(base[1], b)] : [a, b];

  let nar = null, m;
  if ((m = s.match(/초등?(?:학교|학생)?([1-6])~([1-6])학년/))) nar = [+m[1] + 6, +m[2] + 6];
  else if ((m = s.match(/([1-6])학년이상/)))                   nar = [+m[1] + 6, 12];
  else if ((m = s.match(/([1-6])학년이하/)))                   nar = [7, +m[1] + 6];
  else if ((m = s.match(/만?(\d{1,2})~(\d{1,2})세/)))          nar = [+m[1], +m[2]];
  else if ((m = s.match(/만?(\d{1,2})세이상/)))                nar = [+m[1], 99];
  else if ((m = s.match(/만?(\d{1,2})세(?:이하|미만)/)))        nar = [0, +m[1]];

  if (!base && !nar) return null;
  if (!base) return nar;
  if (!nar) return base;
  const lo = Math.max(base[0], nar[0]), hi = Math.min(base[1], nar[1]);
  return lo <= hi ? [lo, hi] : nar;       // 앞뒤가 안 맞으면 괄호 쪽을 믿는다
}

function ageRange(t) {
  if (!t) return null;
  let lo = null, hi = null;
  for (const s of splitTarget(t)) {
    const a = segAge(s);
    if (!a) continue;
    lo = lo === null ? a[0] : Math.min(lo, a[0]);
    hi = hi === null ? a[1] : Math.max(hi, a[1]);
  }
  return lo === null ? null : [lo, hi];
}

/* ── 1. 서울시 공공서비스예약 (서울 열린데이터광장) ────────── */

// 체육시설(테니스장·풋살장 대관)과 공간시설(강당·촬영장 대관)은
// 나들이와 무관해서 받지 않는다.
const SEOUL_SERVICES = [
  ["ListPublicReservationCulture",   "문화체험"],
  ["ListPublicReservationEducation", "교육강좌"],
];

/* 서울형 키즈카페 — 찾기 목록이 아니라 전용 탭으로 간다.
 * 25개 자치구에 132곳이라 찾기 목록에 넣으면 다른 곳을 덮는다.
 * 예약 링크(SVCURL)는 우리동네키움포털 달력이고, 거기 들어가면 회차별로
 * 남은 자리가 보인다. 그 숫자를 여기서 미리 받아오지는 않는다 — 하루 한 번
 * 수집한 값은 금방 낡아서 "어제 11자리 남음"이 헛걸음을 만든다. */
const KIDSCAFE = [];

async function collectSeoul() {
  const key = KEYS.seoulOpenData;
  if (!key) return [];
  const out = [];

  for (const [svc, kindName] of SEOUL_SERVICES) {
    let start = 1;
    for (;;) {
      const end = start + 999;
      const url = `http://openapi.seoul.go.kr:8088/${key}/json/${svc}/${start}/${end}/`;
      const j = await getJson(url, svc);
      const body = j[svc];

      if (!body || !body.row) {
        if (body && body.RESULT && body.RESULT.CODE !== "INFO-000") {
          console.warn(`  ! ${svc}: ${body.RESULT.MESSAGE}`);
        }
        break;
      }

      if (PEEK && start === 1) {
        console.log(`\n[서울/${kindName}] 칸 이름:`, Object.keys(body.row[0]).join(", "));
      }

      for (const r of body.row) {
        // 접수가 이미 끝난 것은 버린다
        const rcptEnd = toDate(r.RCPTENDDT);
        if (rcptEnd && rcptEnd < TODAY) continue;

        // 마감·중지된 것도 버린다 ("안내중"은 곧 열리는 것이라 남긴다)
        if (!["접수중", "안내중"].includes(r.SVCSTATNM)) continue;

        // 서울형 키즈카페는 찾기 목록에 넣지 않는다 — 132곳이 지점마다 줄을 만들어
        // 다른 곳을 덮는다. 대신 여기서 따로 모아 전용 탭(kidscafe)으로 보낸다.
        if (/키즈카페/.test(`${r.SVCNM} ${r.MINCLASSNM || ""}`)) {
          KIDSCAFE.push({
            name: unent(r.SVCNM).replace(/^서울형 ?키즈카페 ?/, ""),
            area: r.AREANM,
            place: r.PLACENM,
            tel: r.TELNO,
            target: r.USETGTINFO,
            fee: r.PAYATNM,
            url: r.SVCURL,          // 우리동네키움포털 예약 달력 (회차별 남은 자리가 보인다)
            img: r.IMGURL,
            lat: num(r.Y), lng: num(r.X),
          });
          continue;
        }

        // 단체 전용은 버린다. 다만 "개인/단체", "단체는 전화문의"처럼
        // 개인도 되는 것은 남긴다. ("용산가족공원"처럼 이름에 든 '가족'은
        // 세지 않으려고 '가족'은 대상 칸에서만 본다)
        const tgt = r.USETGTINFO || "";
        const both = `${r.SVCNM} ${tgt}`;
        if (/단체|학급/.test(both) &&
            !/개인|누구나|단체는|단체문의|단체 문의/.test(both) &&
            !/가족/.test(tgt)) continue;

        // 성인 전용은 버린다. "성인, 청소년"이나 "성인(보호자), 어린이"처럼
        // 아이가 낄 수 있는 것은 남긴다.
        if (/성인/.test(tgt) && !/어린이|유아|초등|청소년|가족|제한없음/.test(tgt)) continue;

        // 외국인 전용도 버린다
        if (/외국인/.test(tgt) && !/누구나/.test(tgt)) continue;

        // 여럿이 팀을 꾸려야 신청되는 것은 버린다.
        // "2인 1팀"(부모+아이)이나 "최대 3인"(상한)은 가족이 갈 수 있으니 남긴다.
        const many = both.replace(/\s/g, "");
        if (/[3-9]\d*인1?팀/.test(many) ||   // 3인 이상 한 팀
            /\d*학급|기관단위|1기관/.test(many) ||
            /(?:[4-9]|\d{2,})[인명]이상/.test(many)) continue;

        // 난임·임신·태교 프로그램은 나들이가 아니다
        if (/난임|임산부|임신부|예비임신|태교|산모/.test(both)) continue;

        const lat = num(r.Y), lng = num(r.X);
        if (!inBox(lat, lng)) continue;

        const age = ageRange(tgt);

        out.push({
          kind: "reserve",
          group: kindName,
          sub: r.MINCLASSNM || "",                 // 소분류 (역사·자연·공예)
          title: unent(r.SVCNM),
          area: r.AREANM,
          place: r.PLACENM,
          target: tgt,                             // 원문 그대로
          ageMin: age ? age[0] : null,
          ageMax: age ? age[1] : null,
          fee: r.PAYATNM === "무료" ? "무료" : "유료",
          status: r.SVCSTATNM,
          start: toDate(r.SVCOPNBGNDT),
          end: toDate(r.SVCOPNENDDT),
          time: [r.V_MIN, r.V_MAX].filter(Boolean).join(" ~ "),
          rcptStart: toDate(r.RCPTBGNDT),
          rcptEnd,
          url: r.SVCURL,
          img: r.IMGURL || "",
          tel: r.TELNO || "",
          lat, lng,
        });
      }

      if (body.row.length < 1000) break;
      start = end + 1;
    }
    console.log(`  서울/${kindName} 누적 ${out.length}건`);
    if (PEEK) break;
  }
  return out;
}

/* ── 2. 전국 표준데이터 (공공데이터포털) ───────────────────── */

const STANDARD = [
  { ep: "tn_pubr_public_cltur_fstvl_api",        kind: "festival", group: "축제",          label: "전국문화축제" },
  { ep: "tn_pubr_public_pblprfr_event_info_api", kind: "festival", group: "공연행사",      label: "전국공연행사" },
  { ep: "tn_pubr_public_museum_artgr_info_api",  kind: "place",    group: "박물관·미술관", label: "전국박물관미술관" },
];

// 주소에서 지역 이름을 뽑되, 서울 예약 데이터의 "도봉구"와 짝이 맞게 줄인다.
// "서울특별시 도봉구" → "도봉구",  "경기도 고양시" → "경기 고양시"
const SIDO = {
  "서울특별시":"", "경기도":"경기", "인천광역시":"인천",
  "강원특별자치도":"강원", "강원도":"강원",
  "충청남도":"충남", "충청북도":"충북", "세종특별자치시":"세종",
  "대전광역시":"대전", "전북특별자치도":"전북",
  "경상북도":"경북", "경상남도":"경남", "대구광역시":"대구",
  "부산광역시":"부산", "울산광역시":"울산", "광주광역시":"광주",
  "전라남도":"전남", "제주특별자치도":"제주", "세종특별시":"세종",
};
// 긴 이름부터 검사해야 "강원특별자치도"가 "강원도"보다 먼저 걸린다
const SIDO_NAMES = Object.keys(SIDO).sort((a, b) => b.length - a.length);
// 주소 문자열만 받는 속살. TourAPI처럼 칸 이름이 다른 자료도 같은 규칙을 쓰게 하려고 뺐다.
function areaOfAddr(addr){
  if(!addr) return "";
  let [sido, sigungu] = String(addr).trim().split(/\s+/);
  // "강원특별자치도양구군 양구읍"처럼 시도와 시군구가 붙어 있는 주소를 갈라낸다
  const stuck = SIDO_NAMES.find(k => sido.length > k.length && sido.startsWith(k));
  if(stuck){ sigungu = sido.slice(stuck.length); sido = stuck; }
  if(!sigungu) return sido;
  const short = SIDO[sido];
  if(short === "") return sigungu;                 // 서울은 구 이름만
  if(short) return `${short} ${sigungu}`;
  return `${sido} ${sigungu}`;
}
function areaOf(r){
  const addr = pick(r, "rdnmadr", "lnmadr");
  if(!addr) return pick(r, "insttNm");
  return areaOfAddr(addr);
}

async function collectStandard() {
  // Encoding 키(%가 섞인 것)는 그대로, Decoding 키는 인코딩해서 쓴다
  const raw = KEYS.dataGoKr;
  if (!raw) return [];
  const key = raw.includes("%") ? raw : encodeURIComponent(raw);
  const out = [];

  for (const src of STANDARD) {
    let page = 1, kept = 0;
    for (;;) {
      const url =
        `https://api.data.go.kr/openapi/${src.ep}` +
        `?serviceKey=${key}&pageNo=${page}&numOfRows=500&type=json`;
      const j = await getJson(url, src.label);

      // 키 미등록 등은 body 없이 오류 헤더만 온다
      if (!j?.body?.items) {
        const msg =
          j?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg ||
          j?.header?.resultMsg || JSON.stringify(j).slice(0, 120);
        console.warn(`  ! ${src.label} 건너뜀 — ${msg}`);
        break;
      }

      const items = j.body.items.item || j.body.items;
      if (!items.length) break;

      if (PEEK && page === 1) {
        console.log(`\n[${src.label}] 칸 이름:`, Object.keys(items[0]).join(", "));
      }

      for (const r of items) {
        // 사립·대학 박물관은 받지 않는다 (작은 개인 박물관, 일반 관람이 애매한 곳)
        if (src.group === "박물관·미술관" &&
            /사립|대학/.test(pick(r, "fcltyType"))) continue;

        const lat = num(pick(r, "latitude"));
        const lng = num(pick(r, "longitude"));
        if (!inBox(lat, lng)) continue;

        const start = toDate(pick(r, "fstvlStartDate", "eventStartDate"));
        const end   = toDate(pick(r, "fstvlEndDate", "eventEndDate"));

        // 이미 끝난 행사는 버린다 (박물관처럼 날짜가 없는 것은 남긴다)
        if (end && end < TODAY) continue;

        const tgt2 = pick(r, "entncAge");                    // 공연행사의 관람 연령
        const age2 = ageRange(tgt2);

        // 박물관은 여는 시간이, 공연은 시작·종료 시각이 온다
        const hours = pick(r, "weekdayOperOpenHhmm")
          ? `${pick(r, "weekdayOperOpenHhmm")} ~ ${pick(r, "weekdayOperColseHhmm")}`
          : [pick(r, "eventStartTime"), pick(r, "eventEndTime")].filter(Boolean).join(" ~ ");

        out.push({
          kind: src.kind,
          group: src.group,
          sub: pick(r, "fcltyType"),                         // 박물관: 국립·사립 등
          title: pick(r, "fstvlNm", "eventNm", "fcltyNm"),
          area: areaOf(r),
          place: pick(r, "opar", "rdnmadr"),
          target: tgt2,
          ageMin: age2 ? age2[0] : null,
          ageMax: age2 ? age2[1] : null,
          park: /^Y|가능|있음/.test(pick(r, "prkplceYn")) ? "주차 가능" : "",
          // 박물관은 어린이 요금이 따로 있다
          fee: pick(r, "chrgeInfo", "admfee") ||
               (pick(r, "childChrge") ? `어린이 ${pick(r, "childChrge")}` : pick(r, "adultChrge")) || "",
          note: pick(r, "rstdeInfo"),                        // 박물관 휴무일
          status: "",
          start, end,
          time: hours,
          rcptStart: "", rcptEnd: "",
          url: pick(r, "homepageUrl", "relateInfo"),
          tel: pick(r, "phoneNumber"),
          lat, lng,
        });
        kept++;
      }

      const total = j.body.totalCount || 0;
      if (PEEK || page * 500 >= total) {
        console.log(`  ${src.label} 전체 ${total}건 → 반경 내 ${kept}건`);
        break;
      }
      page++;
    }
  }
  return out;
}

/* ── 3. 한국관광공사 TourAPI ───────────────────────────────
 * 표준데이터에 없는 관광지·박물관·축제를 사진과 함께 받는다.
 * 다만 분류가 넓어서 그대로 받으면 술집·모텔·동네 골목까지 들어온다.
 * 그래서 아이와 갈 만한 분류(cat3)만 흰 목록으로 골라 남긴다.
 */

const TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2/";

// 서울·경기·인천과 반경에 걸치는 도 단위만 받는다 (부산·제주는 어차피 반경 밖)
const TOUR_AREAS = [
  ["1", "서울"], ["31", "경기"], ["2", "인천"], ["32", "강원"],
  ["33", "충북"], ["34", "충남"], ["8", "세종"], ["3", "대전"],
];

// 관광지(contentTypeId=12) 중 무조건 남기는 분류.
// 코드→이름 표를 여기 박아둔다 (categoryCode2 API를 수집할 때마다 부를 이유가 없다).
const TOUR_SPOT_CAT = {
  A01010700: "수목원",   A02010600: "민속마을", A02020600: "테마공원",
  A02030200: "전통체험", A02040600: "식음료",
};

// 이 두 분류는 관광공사 쪽 분류가 엉성해서 '강남'·'경리단길'·'족발골목' 같은
// 동네 이름이 잔뜩 섞여 있다. 이름이 체험거리로 읽힐 때만 남긴다.
const TOUR_SPOT_CAT_COND = { A02030400: "이색체험" };
const TOUR_EXP_WORD = /체험|박물|미술|과학|농장|목장|공방|캠프|학습|교육|어린이|키즈|동물|테마|랜드|워터|아쿠아|수족관|식물|온실|전시|공장|양조|와이너리|치즈|딸기|허브|수목/;

// 문화시설(contentTypeId=14) 중 남기는 것은 넷뿐이다.
// 공연장·도서관·문화원·문화전수시설·컨벤션센터·대형서점·영화관·학교·외국문화원은
// 사용자 지시로 전부 뺀다.
const TOUR_CULTURE_CAT = {
  A02060100: "박물관", A02060200: "기념관", A02060300: "전시관", A02060500: "미술관/화랑",
};

/* ⚠️ 대한민국구석구석 주소를 contentid로 만들려다 실패했다. 다시 시도하지 말 것.
 *   https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=<contentid>
 * 구석구석의 cotid는 TourAPI의 contentid와 **다른 번호 체계**라, 숫자를 그대로 넣으면
 * "요청하신 페이지를 찾을 수 없거나 비정상적인 접근입니다" 화면이 뜬다.
 * 그 오류 화면도 HTTP 200으로 응답하기 때문에 상태 코드만 봐서는 성공처럼 보인다.
 * 진짜 홈페이지가 필요하면 detailCommon2를 건별로 불러야 한다(항목당 1회 호출).
 */

async function collectTour() {
  // 표준데이터와 같은 키를 쓴다. Encoding 키(%가 섞인 것)는 그대로 둔다.
  const raw = KEYS.dataGoKr;
  if (!raw) return [];
  const key = raw.includes("%") ? raw : encodeURIComponent(raw);
  const out = [];

  // 한 조작(operation)을 끝까지 넘겨가며 읽어 행마다 콜백을 부른다
  async function pages(op, extra, label, onRow) {
    let page = 1;
    for (;;) {
      const url =
        `${TOUR_BASE}${op}?serviceKey=${key}&numOfRows=1000&pageNo=${page}` +
        `&MobileOS=ETC&MobileApp=weekendgo&_type=json${extra}`;
      const j = await getJson(url, label);
      const body = j?.response?.body;

      if (!body) {
        const msg =
          j?.response?.header?.resultMsg ||
          j?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg ||
          JSON.stringify(j).slice(0, 120);
        console.warn(`  ! ${label} 건너뜀 — ${msg}`);
        return;
      }

      const items = body.items && body.items.item;
      if (!Array.isArray(items) || !items.length) return;

      if (PEEK && page === 1) {
        console.log(`\n[${label}] 칸 이름:`, Object.keys(items[0]).join(", "));
      }

      for (const r of items) onRow(r);

      const total = body.totalCount || 0;
      if (PEEK || page * 1000 >= total) return;
      page++;
    }
  }

  for (const [code, areaName] of TOUR_AREAS) {
    const before = out.length;

    /* 3-A. 관광지 */
    await pages("areaBasedList2", `&areaCode=${code}&contentTypeId=12`, `TourAPI 관광지/${areaName}`, (r) => {
      const cat = String(r.cat3 || "");
      let sub = TOUR_SPOT_CAT[cat];
      const title = unent(r.title);
      if (!sub && TOUR_SPOT_CAT_COND[cat]) {
        // 체험성 낱말이 있고, '마을'·'거리'로 끝나지 않을 때만 (서래마을·공방거리를 뺀다)
        if (TOUR_EXP_WORD.test(title) && !/(마을|거리)$/.test(title.trim())) {
          sub = TOUR_SPOT_CAT_COND[cat];
        }
      }
      if (!sub) return;

      const lat = num(r.mapy), lng = num(r.mapx);   // mapy가 위도, mapx가 경도
      if (!inBox(lat, lng)) return;

      // 자연휴양림이면 숲나들e 소개 페이지를 붙인다 (예약 정보를 이름으로 다시
      // 찾지 않아도 되게). 아래 FOREST 목록에 이름이 있을 때만 붙고,
      // 산림욕장·도시자연공원처럼 숲나들e에 없는 곳은 빈 칸으로 둔다.
      let url = "";
      if (cat === "A01010600" || /휴양림/.test(title)) url = forestUrl(title);

      out.push({
        kind: "place", group: "관광지", sub,
        title,
        area: areaOfAddr(r.addr1),
        place: r.addr1 || "",
        target: "", ageMin: null, ageMax: null,
        fee: "", status: "", start: "", end: "", time: "",
        url, img: r.firstimage || "", tel: r.tel || "",
        note: "", park: "",
        lat, lng,
      });
    });

    /* 3-B. 문화시설 */
    await pages("areaBasedList2", `&areaCode=${code}&contentTypeId=14`, `TourAPI 문화시설/${areaName}`, (r) => {
      const sub = TOUR_CULTURE_CAT[String(r.cat3 || "")];
      if (!sub) return;

      const title = unent(r.title);
      // 미술관/화랑 분류에는 상업 화랑이 섞여 있다. 아이와 갈 곳이 아니라서
      // 이름에 '갤러리'가 든 것은 뺀다 (간송미술관은 남고 갤러리 라메르는 빠진다).
      if (sub === "미술관/화랑" && /갤러리/.test(title)) return;

      const lat = num(r.mapy), lng = num(r.mapx);
      if (!inBox(lat, lng)) return;

      out.push({
        kind: "place", group: "박물관·미술관", sub,
        title,
        area: areaOfAddr(r.addr1),
        place: r.addr1 || "",
        target: "", ageMin: null, ageMax: null,
        fee: "", status: "", start: "", end: "", time: "",
        url: "", img: r.firstimage || "", tel: r.tel || "",
        note: "", park: "",
        lat, lng,
      });
    });

    /* 3-C. 축제·행사
     * areaBasedList2는 행사 날짜를 주지 않는다. 날짜가 이 앱의 전부라서
     * 반드시 searchFestival2를 쓴다 (eventStartDate가 필수 항목).
     */
    const from = TODAY.replace(/-/g, "");
    await pages("searchFestival2", `&areaCode=${code}&eventStartDate=${from}`, `TourAPI 축제/${areaName}`, (r) => {
      const lat = num(r.mapy), lng = num(r.mapx);
      if (!inBox(lat, lng)) return;

      const start = toDate(r.eventstartdate);
      const end   = toDate(r.eventenddate);
      if (end && end < TODAY) return;               // 이미 끝난 행사는 버린다

      out.push({
        kind: "festival", group: "축제", sub: "",
        title: unent(r.title),
        area: areaOfAddr(r.addr1),
        place: r.addr1 || "",
        target: "", ageMin: null, ageMax: null,
        fee: "", status: "", start, end, time: "",
        url: "", img: r.firstimage || "", tel: r.tel || "",
        note: "", park: "",
        lat, lng,
      });
    });

    console.log(`  TourAPI/${areaName} 반경 내 ${out.length - before}건 (누적 ${out.length})`);
    if (PEEK) break;
  }
  return out;
}

/* ── 4. 표준데이터 추가 (전국관광지정보) ───────────────────── */

// 소개글이 몇백 자짜리라 그대로 넣으면 data.json이 몇 배로 불어난다. 앞머리만 남긴다.
const cut = (s, n) => {
  const t = String(s || "").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

// 농어촌체험휴양마을(552건)은 뺐다 — 실제로 운영이 제대로 되는 곳이 드물다는
// 사용자 판단. 다시 넣지 말 것.
const STANDARD2 = [
  {
    ep: "tn_pubr_public_trrsrt_api",
    label: "전국관광지정보",
    map: (r) => ({
      kind: "place", group: "관광지",
      title: pick(r, "trrsrtNm"),
      sub: pick(r, "trrsrtSe"),                      // 관광지 구분
      area: areaOfAddr(pick(r, "rdnmadr", "lnmadr")),
      place: pick(r, "rdnmadr"),
      note: cut(pick(r, "trrsrtIntrcn"), 120),
      // 이 자료는 주차 가능 여부 대신 주차면수가 온다
      park: num(pick(r, "prkplceCo")) > 0 ? "주차 가능" : "",
      tel: pick(r, "phoneNumber"),
    }),
  },
];

async function collectStandard2() {
  const raw = KEYS.dataGoKr;
  if (!raw) return [];
  const key = raw.includes("%") ? raw : encodeURIComponent(raw);
  const out = [];

  for (const src of STANDARD2) {
    let page = 1, kept = 0;
    for (;;) {
      const url =
        `https://api.data.go.kr/openapi/${src.ep}` +
        `?serviceKey=${key}&pageNo=${page}&numOfRows=500&type=json`;
      const j = await getJson(url, src.label);

      if (!j?.body?.items) {
        const msg =
          j?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg ||
          j?.header?.resultMsg || JSON.stringify(j).slice(0, 120);
        console.warn(`  ! ${src.label} 건너뜀 — ${msg}`);
        break;
      }

      const items = j.body.items.item || j.body.items;
      if (!items.length) break;

      if (PEEK && page === 1) {
        console.log(`\n[${src.label}] 칸 이름:`, Object.keys(items[0]).join(", "));
      }

      for (const r of items) {
        // 구분이 그냥 '관광지'인 것은 뺀다 — 사진도 홈페이지도 없고 제목이
        // 행정 명칭('수동관광지')이라 무엇인지 알 수 없다는 사용자 판단.
        if (pick(r, "trrsrtSe") === "관광지") continue;

        const lat = num(pick(r, "latitude"));
        const lng = num(pick(r, "longitude"));
        if (!inBox(lat, lng)) continue;

        out.push({
          target: "", ageMin: null, ageMax: null,
          fee: "", status: "", start: "", end: "", time: "",
          url: "", img: "", tel: "", note: "", park: "",
          ...src.map(r),
          lat, lng,
        });
        kept++;
      }

      const total = j.body.totalCount || 0;
      if (PEEK || page * 500 >= total) {
        console.log(`  ${src.label} 전체 ${total}건 → 반경 내 ${kept}건`);
        break;
      }
      page++;
    }
  }
  return out;
}

/* ── 숲나들e(자연휴양림 통합예약) 소개 페이지 붙이기 ─────────
 * 휴양림 카드에 `지도 →` 밖에 없어서 예약 정보를 보려면 숲나들e에 들어가
 * 이름으로 다시 찾아야 했다. 아래 표로 이름을 맞춰 `url`을 채운다.
 *   https://www.foresttrip.go.kr/indvz/main.do?hmpgId=<ID>
 *
 * 목록을 받은 곳 — 숲나들e 휴양림 검색 API (2026-08-13 받음, 96곳)
 *   POST https://www.foresttrip.go.kr/indvz/selectInsttListForSearch.do
 *   권역 코드 1~4 (수도권·강원·충북·대전충남) 네 번 불러 합쳤다.
 * 갱신이 필요하면 그 주소를 다시 부르면 된다. 다만 CSRF 토큰과 세션이 필요해서
 * 브라우저에서 받아 여기 붙여넣는 방식이다 — **수집기에서 매번 부르지 말 것.**
 * 휴양림 목록 자체는 자주 바뀌지 않는다.
 *
 * 한 줄은 [권역, 시군, 이름, ID]. 권역·시군은 화면의 휴양림 탭에서 쓰려고 넣었다
 * (data.json의 `forests` 키로 그대로 나간다). 이름 맞추기는 예전처럼 이름만 본다.
 */
const FOREST = [
  ["수도권", "가평군", "강씨봉자연휴양림", "ID02030019"],
  ["수도권", "가평군", "유명산자연휴양림", "0101"],
  ["수도권", "가평군", "청평자연휴양림", "ID04030007"],
  ["수도권", "가평군", "칼봉산자연휴양림", "ID02030099"],
  ["수도권", "강화군", "강화자연휴양림", "ID04030105"],
  ["수도권", "강화군", "석모도자연휴양림", "ID02030071"],
  ["수도권", "남양주시", "축령산자연휴양림", "ID02030050"],
  ["수도권", "노원구", "수락산동막골자연휴양림", "ID02030129"],
  ["수도권", "동두천시", "동두천자연휴양림", "ID02030023"],
  ["수도권", "안성시", "서운산자연휴양림", "ID02030092"],
  ["수도권", "양주시", "신암저수지숲속야영장", "ID02030123"],
  ["수도권", "양주시", "아세안자연휴양림", "0104"],
  ["수도권", "양평군", "산음자연휴양림", "0103"],
  ["수도권", "양평군", "양평 백운봉 자연휴양림", "ID02030087"],
  ["수도권", "양평군", "양평설매재자연휴양림", "ID04030004"],
  ["수도권", "양평군", "양평쉬자파크", "ID02030079"],
  ["수도권", "양평군", "중미산자연휴양림", "0108"],
  ["수도권", "연천군", "고대산자연휴양림", "ID02030001"],
  ["수도권", "옹진군", "덕적도자연휴양림", "ID02030127"],
  ["수도권", "용인시", "용인자연휴양림", "ID02030031"],
  ["수도권", "의왕시", "의왕바라산자연휴양림", "ID02030065"],
  ["수도권", "인천시", "무의도자연휴양림", "0303"],
  ["수도권", "포천시", "운악산자연휴양림", "0224"],
  ["수도권", "포천시", "천보산자연휴양림", "CBMNT"],
  ["수도권", "화성시", "무봉산 자연휴양림", "ID02030118"],
  ["강원", "강릉시", "대관령자연휴양림", "0111"],
  ["강원", "강릉시", "임해자연휴양림", "ID02030100"],
  ["강원", "고성군", "진부령자연휴양림", "0306"],
  ["강원", "삼척시", "검봉산자연휴양림", "0244"],
  ["강원", "삼척시", "삼척활기자연휴양림", "ID02030104"],
  ["강원", "양구군", "광치자연휴양림", "ID02030095"],
  ["강원", "양양군", "미천골자연휴양림", "0112"],
  ["강원", "양양군", "송이밸리자연휴양림", "ID02030049"],
  ["강원", "영월군", "망경대산자연휴양림", "ID02030067"],
  ["강원", "원주시", "백운산자연휴양림", "0223"],
  ["강원", "원주시", "치악산자연휴양림", "ID02030024"],
  ["강원", "원주시", "피노키오자연휴양림", "ID04030001"],
  ["강원", "인제군", "갯골자연휴양림", "ID02030120"],
  ["강원", "인제군", "방태산자연휴양림", "0109"],
  ["강원", "인제군", "용대자연휴양림", "0102"],
  ["강원", "인제군", "하추자연휴양림", "ID02030018"],
  ["강원", "정선군", "가리왕산자연휴양림", "0113"],
  ["강원", "철원군", "복주산자연휴양림", "0110"],
  ["강원", "철원군", "철원두루웰숲속문화촌", "ID02030005"],
  ["강원", "춘천시", "강원숲체험장", "ID02030096"],
  ["강원", "춘천시", "용화산자연휴양림", "0222"],
  ["강원", "춘천시", "집다리골자연휴양림", "ID02030043"],
  ["강원", "춘천시", "춘천숲자연휴양림", "ID02030125"],
  ["강원", "태백시", "태백고원자연휴양림", "ID02030022"],
  ["강원", "평창군", "두타산자연휴양림", "0243"],
  ["강원", "평창군", "평창자연휴양림", "ID02030003"],
  ["강원", "홍천군", "가리산자연휴양림", "ID02030002"],
  ["강원", "홍천군", "삼봉자연휴양림", "0107"],
  ["강원", "화천군", "화천숲속야영장", "0116"],
  ["강원", "횡성군", "청태산자연휴양림", "0106"],
  ["강원", "횡성군", "횡성자연휴양림", "ID04030002"],
  ["충북", "괴산군", "성불산자연휴양림", "ID02030070"],
  ["충북", "괴산군", "조령산자연휴양림", "ID02030008"],
  ["충북", "단양군", "소백산자연휴양림", "ID02030009"],
  ["충북", "단양군", "소선암자연휴양림", "ID02030041"],
  ["충북", "단양군", "황정산자연휴양림", "0242"],
  ["충북", "보은군", "속리산말티재자연휴양림", "0115"],
  ["충북", "보은군", "속리산숲체험휴양마을", "ID02030035"],
  ["충북", "보은군", "충북알프스자연휴양림", "ID02030032"],
  ["충북", "영동군", "민주지산자연휴양림", "ID02030107"],
  ["충북", "옥천군", "장령산자연휴양림", "ID02030036"],
  ["충북", "음성군", "백야자연휴양림", "ID02030016"],
  ["충북", "음성군", "수레의산자연휴양림", "ID02030017"],
  ["충북", "제천시", "박달재자연휴양림", "ID02030062"],
  ["충북", "제천시", "옥전자연휴양림", "ID02030110"],
  ["충북", "증평군", "좌구산휴양랜드", "ID02030089"],
  ["충북", "진천군", "생거진천자연휴양림", "ID02030033"],
  ["충북", "청주시", "미원별빛자연휴양림", "ID02030132"],
  ["충북", "청주시", "상당산성자연휴양림", "0300"],
  ["충북", "청주시", "옥화자연휴양림", "ID02030054"],
  ["충북", "충주시", "계명산자연휴양림", "ID02030042"],
  ["충북", "충주시", "문성자연휴양림", "ID02030055"],
  ["충북", "충주시", "봉황자연휴양림", "ID02030051"],
  ["대전·충남", "공주시", "공주산림휴양마을", "ID02030011"],
  ["대전·충남", "금산군", "금산산림문화타운", "ID02030063"],
  ["대전·충남", "금산군", "금산자연휴양림", "0305"],
  ["대전·충남", "논산시", "양촌자연휴양림", "ID02030034"],
  ["대전·충남", "대전시", "만인산자연휴양림", "ID02030111"],
  ["대전·충남", "대전시", "장태산자연휴양림", "ID02030106"],
  ["대전·충남", "보령시", "성주산자연휴양림", "ID02030078"],
  ["대전·충남", "보령시", "오서산자연휴양림", "0191"],
  ["대전·충남", "보령시", "원산도자연휴양림", "ID02030130"],
  ["대전·충남", "부여군", "만수산자연휴양림", "ID02030007"],
  ["대전·충남", "서산시", "용현자연휴양림", "0220"],
  ["대전·충남", "서천군", "희리산자연휴양림", "0187"],
  ["대전·충남", "아산시", "영인산자연휴양림", "ID02030012"],
  ["대전·충남", "예산군", "봉수산자연휴양림", "ID02030028"],
  ["대전·충남", "천안시", "태학산자연휴양림", "ID02030040"],
  ["대전·충남", "청양군", "칠갑산자연휴양림", "ID02030044"],
  ["대전·충남", "태안군", "안면도자연휴양림", "ID02030086"],
  ["대전·충남", "홍성군", "용봉산자연휴양림", "ID02030080"],
];

// 이름 맞추기 — 우리 자료의 제목과 숲나들e 이름을 같은 꼴로 만든다.
//   괄호와 그 안의 글자 제거 → 공백·가운뎃점·-·_·,·. 제거
//   → 맨 앞의 국립·도립·시립·군립·공립 제거 → `자연휴양림`을 `휴양림`으로 통일
// (예: `(가평군)강씨봉자연휴양림` 과 `국립 강씨봉 자연휴양림` 이 같은 열쇠가 된다)
const forestNorm = (s) => String(s || "")
  .replace(/\([^)]*\)/g, "")
  .replace(/[\s·\-_,.]/g, "")
  .replace(/^(국립|도립|시립|군립|공립)/, "")
  .replace(/자연휴양림/g, "휴양림");

/* 휴양림 경리 정보 — 시도·편의시설·사진.
 * 2026-08-20에 숮나들e 예약검색(`fcfsRsrvtRcrfrDtlDetls.do`)을 9개 권역 훑어 받았다.
 * 잘 안 바뀌는 값이라 박아둔다. 다시 받으려면 그 페이지에서 한 번 조회한 뒤
 * 주소의 `netfunnel_key`가 살아있는 동안(약 13번·십수 분) 권역을 돌려야 한다.
 *
 * 시도는 화면의 지역 체크와 맞추려고 넣었다 — FOREST의 `city`는 시군뿐이라
 * 강화군이 인천인지 경기인지 구분이 안 된다. 긴 주소 앞 2글자에서 뽑았다.
 * [이름, 시도, 편의시설[], 사진URL] */
const FOREST_INFO = new Map(
  [
  ["강씨봉자연휴양림", "경기", ["바베큐","야외 물놀이장","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/c139c94a-05d2-4474-9b29-4722d98d81f0.jpg"],
  ["유명산자연휴양림", "경기", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/7bdb6b8a-d458-4796-9e7f-3ce5ca38c8af.jpg"],
  ["청평자연휴양림", "경기", ["회의실/강당","야외 물놀이장","장애인 편의시설","바베큐"], "https://image.foresttrip.go.kr/ino/instt/9868744e-ddf1-4dd4-9685-17a8b5955c59.JPG"],
  ["칼봉산자연휴양림", "경기", ["회의실/강당","바베큐","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/c3c6e863-7366-47e8-9850-501d4407e2fb.jpg"],
  ["강화자연휴양림", "인천", ["바베큐","레포츠시설","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/9c1de511-bfa8-49da-8cc7-67992b46b791.png"],
  ["석모도자연휴양림", "인천", ["바베큐","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/746bffb4-30fd-4486-a5f4-434ca079778a.jpg"],
  ["축령산자연휴양림", "경기", ["장애인 편의시설","야외 물놀이장"], "https://image.foresttrip.go.kr/ino/instt/2ae519f2-df11-46b8-acde-487ee09c930e.jpg"],
  ["수락산동막골자연휴양림", "서울", [], "https://image.foresttrip.go.kr/ino/instt/00ca26a7-8620-45ba-99a8-70978b1d71d6.png"],
  ["동두천자연휴양림", "경기", ["바베큐","장애인 편의시설","야외 물놀이장"], "https://image.foresttrip.go.kr/ino/instt/9acf7700-3fe1-4265-b085-b6f340bebf26.jpg"],
  ["서운산자연휴양림", "경기", ["바베큐","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/b58c1dfe-03dc-4495-81d7-2c771ffaf30d.jpg"],
  ["신암저수지숲속야영장", "경기", [], "https://image.foresttrip.go.kr/ino/instt/34bb89e9-bca7-4c50-9f15-f55e9eb6e691.jpg"],
  ["아세안자연휴양림", "경기", [], "https://image.foresttrip.go.kr/ino/instt/4113f4ed-5c6a-484d-b33b-9e1d8f2d890a.jpg"],
  ["산음자연휴양림", "경기", ["반려견 동반(일부)","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/e17a2f53-b4d3-459b-a5e1-b3c7cf9aebc7.jpg"],
  ["양평 백운봉 자연휴양림", "경기", ["장애인 편의시설","바베큐"], "https://image.foresttrip.go.kr/ino/instt/3c7ad01d-ac5d-4c0e-b04a-8025db4bbd61.jpg"],
  ["양평설매재자연휴양림", "경기", ["레포츠시설","야외 물놀이장","바베큐","장애인 편의시설","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/6df0d341-268f-4c55-ae15-6e1479931562.jpg"],
  ["양평쉬자파크", "경기", ["회의실/강당","장애인 편의시설","바베큐"], "https://image.foresttrip.go.kr/ino/instt/050a1a41-afb2-4d56-b404-4ccb6990f5fe.jpg"],
  ["중미산자연휴양림", "경기", [], "https://image.foresttrip.go.kr/ino/instt/dd026b54-2b2e-4ea7-a885-a836eb02581b.jpg"],
  ["고대산자연휴양림", "경기", [], "https://image.foresttrip.go.kr/ino/instt/e1554248-53a8-4d01-a9f1-b77d1b2fb465.jpg"],
  ["덕적도자연휴양림", "인천", ["회의실/강당","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/db2c4476-ca8c-4d6b-a023-dca1326f2d67.jpg"],
  ["용인자연휴양림", "경기", ["장애인 편의시설","레포츠시설","바베큐","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/37fb9a82-6369-40c4-99e9-f748fe5aa566.JPG"],
  ["의왕바라산자연휴양림", "경기", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/d1bbd569-a8c6-4bf6-9d6b-2904280ef680.jpg"],
  ["무의도자연휴양림", "인천", ["장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/51454f52-9e79-4e3e-89bc-f5105a1aa8f3.jpg"],
  ["운악산자연휴양림", "경기", [], "https://image.foresttrip.go.kr/ino/instt/ccaac323-6c9e-4267-8c88-9d14d995cfd2.jpg"],
  ["천보산자연휴양림", "경기", ["바베큐"], "https://image.foresttrip.go.kr/ino/instt/ae8f794a-359c-4dc4-a2fa-f1378e4467bb.jpg"],
  ["무봉산 자연휴양림", "경기", ["바베큐","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/36bfa7a0-6c6e-4cbc-846f-abc85053215e.jpg"],
  ["대관령자연휴양림", "강원", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/29b81336-fd4b-4ad9-a8e8-23ac92f20788.jpg"],
  ["임해자연휴양림", "강원", ["장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/e66cb2ba-aed3-4e6d-b8bd-87ccaac9a6b8.jpg"],
  ["진부령자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/b4b92480-f370-4d10-a08a-45493be1a151.JPG"],
  ["검봉산자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/75a938d8-5c9f-4800-837a-80b2aa7a6bf7.jpg"],
  ["삼척활기자연휴양림", "강원", ["회의실/강당","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/6e1b4e7d-44a0-46dc-84d1-59fc77513f2f.jpg"],
  ["광치자연휴양림", "강원", ["바베큐","레포츠시설","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/71d17a9f-f9e5-4336-87a1-18180c024e56.jpg"],
  ["미천골자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/ebed3009-4e8d-4c7c-9870-e1d9359c588f.jpg"],
  ["송이밸리자연휴양림", "강원", ["레포츠시설","바베큐"], "https://image.foresttrip.go.kr/ino/instt/c15281cf-4295-4f4c-a6b4-4ebdc88751b0.jpg"],
  ["망경대산자연휴양림", "강원", ["회의실/강당","바베큐"], "https://image.foresttrip.go.kr/ino/instt/0b6b100a-ef19-4881-a13e-5aed039c5016.JPG"],
  ["백운산자연휴양림", "강원", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/f2514a78-cdea-485d-863c-038b780033a1.jpg"],
  ["치악산자연휴양림", "강원", ["야외 물놀이장","바베큐"], "https://image.foresttrip.go.kr/ino/instt/3f339aa8-66bc-49e8-984b-3438761c2466.jpg"],
  ["피노키오자연휴양림", "강원", ["회의실/강당","장애인 편의시설","야외 물놀이장","레포츠시설","바베큐"], "https://image.foresttrip.go.kr/ino/instt/ca7330e1-6040-421a-b384-37fdd6a5b3b4.jpg"],
  ["갯골자연휴양림", "강원", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/4aa53020-8ef9-43e0-a9b8-1e0fcf6be991.JPG"],
  ["방태산자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/733ff67c-da98-43f7-9136-551125175634.jpg"],
  ["용대자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/476ad8bf-3093-4aa2-ae04-0ffa06066b7a.jpg"],
  ["하추자연휴양림", "강원", ["바베큐","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/65bd9dc0-625c-44a8-98b5-45221d6fef10.jpg"],
  ["가리왕산자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/8ef66722-24d6-4548-a2bf-8aa58b0b5bed.jpg"],
  ["복주산자연휴양림", "강원", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/a5f8952a-f99f-44cc-a466-473ca1a1a463.jpg"],
  ["철원두루웰숲속문화촌", "강원", ["바베큐"], "https://image.foresttrip.go.kr/ino/instt/99c57b06-afb6-47d3-a452-9d1943143cc2.jpg"],
  ["강원숲체험장", "강원", ["장애인 편의시설","회의실/강당","바베큐"], "https://image.foresttrip.go.kr/ino/instt/6538f969-5c3e-4ecc-bf48-a28d1d757196.jpg"],
  ["용화산자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/9c8cf340-996c-4582-9a4b-0148ba400c6b.jpg"],
  ["집다리골자연휴양림", "강원", ["바베큐"], "https://image.foresttrip.go.kr/ino/instt/9169d0e6-8042-49c6-b913-3a8bc5fcd329.jpg"],
  ["춘천숲자연휴양림", "강원", ["회의실/강당","야외 물놀이장","장애인 편의시설","바베큐"], "https://image.foresttrip.go.kr/ino/instt/f03b17db-5328-4ae0-bed5-41a8c287cbc8.jpg"],
  ["태백고원자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/6f9f234f-deb1-4e01-86ee-20e49a0b1c91.jpg"],
  ["두타산자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/c8a0b132-c90f-4983-b780-392633a3b23c.jpg"],
  ["평창자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/ccdf113c-fc43-4fa5-8e97-3e99af1c723f.PNG"],
  ["가리산자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/b770807e-c0cb-459d-a5af-b61bcb031316.jpg"],
  ["삼봉자연휴양림", "강원", [], "https://image.foresttrip.go.kr/ino/instt/ea90be12-5ea9-439f-818a-e249076bae5f.jpg"],
  ["화천숲속야영장", "강원", ["반려견 동반(일부)"], "https://image.foresttrip.go.kr/ino/instt/1b1a5f95-9302-44fe-8272-3fc508f0f947.jpg"],
  ["청태산자연휴양림", "강원", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/ef8bdd81-060c-4542-9baf-ed3b8454bc55.jpg"],
  ["횡성자연휴양림", "강원", ["야외 물놀이장","레포츠시설","바베큐"], "https://image.foresttrip.go.kr/ino/instt/7fbe7aed-3368-4535-94bc-8ec06c4b21d9.jpg"],
  ["성불산자연휴양림", "충북", ["회의실/강당","야외 물놀이장","바베큐"], "https://image.foresttrip.go.kr/ino/instt/b4ae0088-e09d-4efb-b918-fd866c410b49.jpg"],
  ["조령산자연휴양림", "충북", ["야외 물놀이장"], "https://image.foresttrip.go.kr/ino/instt/fd58e023-7eba-4571-a9d6-20e38caa5bfc.jpg"],
  ["소백산자연휴양림", "충북", ["바베큐"], "https://image.foresttrip.go.kr/ino/instt/fae40d83-414f-41db-873b-2a37a055cf80.jpg"],
  ["소선암자연휴양림", "충북", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/4dc86a82-4da7-4302-a068-bf63ec03f683.jpg"],
  ["황정산자연휴양림", "충북", [], "https://image.foresttrip.go.kr/ino/instt/014161bb-9862-47d5-b50f-6c929ef16adc.jpg"],
  ["속리산말티재자연휴양림", "충북", [], "https://image.foresttrip.go.kr/ino/instt/100fa838-3b59-4fef-98a2-6d0f48811ec3.jpg"],
  ["속리산숲체험휴양마을", "충북", ["야외 물놀이장","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/534e8561-619b-41a6-9161-9199c66c5996.jpg"],
  ["충북알프스자연휴양림", "충북", ["바베큐","야외 물놀이장","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/4fd6022f-14c1-4a8a-9fea-ad52bee1258e.jpg"],
  ["민주지산자연휴양림", "충북", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/79b4ff07-78e1-43cb-ba18-6f0f3aea9483.jpg"],
  ["장령산자연휴양림", "충북", ["장애인 편의시설","회의실/강당","야외 물놀이장"], "https://image.foresttrip.go.kr/ino/instt/a6ec4928-4358-4ca4-a8b5-83a38ec565dc.jpg"],
  ["백야자연휴양림", "충북", ["장애인 편의시설","야외 물놀이장","바베큐"], "https://image.foresttrip.go.kr/ino/instt/f3e09df5-4e68-4bfb-b442-69b13ecd8bd4.jpg"],
  ["수레의산자연휴양림", "충북", ["바베큐","장애인 편의시설","야외 물놀이장"], "https://image.foresttrip.go.kr/ino/instt/6732215e-2eb5-4123-8e11-00a128b64a71.jpg"],
  ["박달재자연휴양림", "충북", ["바베큐"], "https://image.foresttrip.go.kr/ino/instt/6e0c7fd0-c6d9-4096-ad9b-4a9ef2af18a0.jpg"],
  ["옥전자연휴양림", "충북", [], "https://image.foresttrip.go.kr/ino/instt/edd72ad5-b3ff-48c3-9f89-b06472571c67.jpg"],
  ["좌구산휴양랜드", "충북", ["바베큐","회의실/강당","레포츠시설"], "https://image.foresttrip.go.kr/ino/instt/dba3489c-907c-4ca2-a884-9ab23e21fe87.JPG"],
  ["생거진천자연휴양림", "충북", ["회의실/강당","바베큐","야외 물놀이장","장애인 편의시설","레포츠시설"], "https://image.foresttrip.go.kr/ino/instt/e8bfcf0f-5062-4de0-bbf2-9a505792530e.jpg"],
  ["미원별빛자연휴양림", "충북", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/3fd85548-7e8c-4903-9850-73609d57fe6a.jpg"],
  ["상당산성자연휴양림", "충북", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/3a389fdb-3c68-487f-a985-ea0699543e9c.jpg"],
  ["옥화자연휴양림", "충북", ["야외 물놀이장","장애인 편의시설","바베큐","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/3695d72f-8796-46fe-b180-848a903d6721.jpg"],
  ["계명산자연휴양림", "충북", [], "https://image.foresttrip.go.kr/ino/instt/85eb049a-848e-4e14-ad54-d8a847ccd88a.jpg"],
  ["문성자연휴양림", "충북", ["레포츠시설","장애인 편의시설","야외 물놀이장","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/b74b791e-185a-4386-8f80-c7ee45c732b9.jpg"],
  ["봉황자연휴양림", "충북", ["바베큐"], "https://image.foresttrip.go.kr/ino/instt/bff99235-bc26-43d4-9207-9a57fbf8942e.jpg"],
  ["공주산림휴양마을", "충남", ["야외 물놀이장","레포츠시설"], "https://image.foresttrip.go.kr/ino/instt/55ac4152-c45a-441d-b4f3-e15f20d79478.jpg"],
  ["금산산림문화타운", "충남", ["회의실/강당","장애인 편의시설","야외 물놀이장"], "https://image.foresttrip.go.kr/ino/instt/92662888-f859-4da3-93d7-9eb5f92e8f94.jpg"],
  ["금산자연휴양림", "충남", [], "https://image.foresttrip.go.kr/ino/instt/3863b9ed-d5af-4cb5-8893-0c67f544bfd9.jpg"],
  ["양촌자연휴양림", "충남", ["야외 물놀이장","회의실/강당","바베큐","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/92c67ff2-1db6-4373-b36f-7f114618c1c8.jpg"],
  ["만인산자연휴양림", "대전", ["장애인 편의시설","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/5ebe3bec-4dea-4f06-8800-653305b9fac1.jpg"],
  ["장태산자연휴양림", "대전", ["레포츠시설","장애인 편의시설","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/f6f6b051-9dd4-4c8a-abaa-be71d4bdeaaf.jpg"],
  ["성주산자연휴양림", "충남", ["회의실/강당","야외 물놀이장","바베큐","장애인 편의시설"], "https://image.foresttrip.go.kr/ino/instt/369dc56f-f1bf-44b6-8566-17921b56d3d6.jpg"],
  ["오서산자연휴양림", "충남", [], "https://image.foresttrip.go.kr/ino/instt/b2106242-b444-4317-809c-2609396c06a5.jpg"],
  ["원산도자연휴양림", "충남", ["장애인 편의시설","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/fd078021-9b98-4c83-84fb-8b81a65302e1.png"],
  ["만수산자연휴양림", "충남", ["야외 물놀이장"], "https://image.foresttrip.go.kr/ino/instt/001b00dd-8383-4638-8194-08c7e19379dd.jpg"],
  ["용현자연휴양림", "충남", [], "https://image.foresttrip.go.kr/ino/instt/88451034-8728-4377-b8bd-547d427e9815.jpg"],
  ["희리산자연휴양림", "충남", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/c82c632d-a8bd-49f6-a87f-3bc6e286b794.jpg"],
  ["영인산자연휴양림", "충남", ["야외 물놀이장","레포츠시설","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/3a3eef1b-3c71-4390-9d90-d59d8c9dda50.jpg"],
  ["봉수산자연휴양림", "충남", ["회의실/강당","바베큐"], "https://image.foresttrip.go.kr/ino/instt/188657de-fb5e-48f6-98fe-0bff4587e2f3.jpg"],
  ["태학산자연휴양림", "충남", [], "https://image.foresttrip.go.kr/ino/instt/78e55486-ad5d-4315-8146-95925756fda3.jpg"],
  ["칠갑산자연휴양림", "충남", ["바베큐","레포츠시설","장애인 편의시설","회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/bf28cefb-3ba4-4da4-acb3-1e71a9ed21b9.jpg"],
  ["안면도자연휴양림", "충남", ["회의실/강당"], "https://image.foresttrip.go.kr/ino/instt/faf0488a-8afc-4b6f-a5af-8bf2efb7ad30.jpg"],
  ["용봉산자연휴양림", "충남", [], "https://image.foresttrip.go.kr/ino/instt/dd47b01f-23f1-4e60-a958-9f8affc236e6.jpg"],
  ].map(([name, sido, fac, img]) => [forestNorm(name), { sido, fac, img }])
);

const FOREST_MAP = new Map();
for (const [, , name, id] of FOREST) {
  const k = forestNorm(name);
  if (k && !FOREST_MAP.has(k)) FOREST_MAP.set(k, id);
}

// 목록에 없으면 빈 문자열을 준다. 산림욕장·도시자연공원처럼 숲나들e에 아예 없는
// 곳은 억지로 검색 링크를 만들지 않고 그냥 둔다.
function forestUrl(title) {
  const id = FOREST_MAP.get(forestNorm(title));
  return id ? `https://www.foresttrip.go.kr/indvz/main.do?hmpgId=${id}` : "";
}

/* ── 5. 경기도 시군 예약 — sigun 폴더 ────────────────────────
 * 시군 하나에 파일 하나다 (sigun/남양주.js · sigun/김포.js).
 * 여러 사람이 동시에 시군을 늘려도 서로 덮어쓰지 않게 파일을 나눠뒀다.
 *
 * 각 파일은 { name, area, collect(util) } 를 내보내고 항목 배열을 돌려준다.
 * 공통 도구는 여기서 인자로 넘겨준다 — 시군 파일이 따로 복사해 가지면
 * 날짜·실체참조·나이 읽기 규칙이 두 벌이 되어 나중에 어긋난다.
 *
 * 새 시군을 붙이는 방법은 sigun/지침.md 에 다 적어뒀다.
 */

const SIGUN_UTIL = { toDate, unent, ageRange };

async function collectSigun() {
  const dir = path.join(__dirname, "sigun");
  if (!fs.existsSync(dir)) return [];

  // 앞에 _가 붙은 파일은 건너뛴다 (나중에 공용 파일을 둘 자리)
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith(".js") && !f.startsWith("_"))
    .sort();

  const out = [];
  for (const f of files) {
    // 한 시군이 실패해도 나머지는 살아야 한다 — 시군마다 따로 감싼다
    try {
      const mod = require(path.join(dir, f));
      const rows = await mod.collect(SIGUN_UTIL);
      const list = (Array.isArray(rows) ? rows : []).filter(soloOK);
      console.log(`  ${mod.name || f} 접수중 ${list.length}건`);
      out.push(...list);
    } catch (e) {
      console.error(`  ! 시군 실패: ${f} (${e.message})`);
    }
  }
  return out;
}

/* 단체 전용은 버린다. 서울 예약에 쓰는 것과 같은 기준이라 여기 한 곳에 두고
 * 모든 시군에 일괄로 건다 — 시군 파일마다 같은 규칙을 베끼면 나중에 어긋난다.
 * "개인/단체"나 "단체는 전화문의"처럼 개인도 되는 것, 대상 칸에 "가족"이 있는 것은 남긴다. */
function soloOK(it) {
  const tgt = it.target || "";
  const both = `${it.title || ""} ${tgt}`;
  if (!/단체|학급/.test(both)) return true;
  if (/개인|누구나|단체는|단체문의|단체 문의/.test(both)) return true;
  return /가족/.test(tgt);
}

/* ── 직접 확인이 필요한 곳 (자동 수집이 안 되는 예약처) ────── */

// 지금은 비어 있다. 하나뿐이던 남양주시 체험·견학 링크는 sigun/남양주.js가
// 실제 프로그램을 받아오게 되면서 뺐다. 화면은 항목이 없는 섹션을 건너뛰므로
// "직접 확인" 칸은 그냥 안 보인다. 앞으로 자동 수집이 안 되는 예약처를
// 발견하면 여기에 넣는다.
const MANUAL = [];

/* ── 실행 ────────────────────────────────────────────────── */

(async () => {
  console.log(`수집 시작 (기준일 ${TODAY})`);

  const seoul = await collectSeoul().catch((e) => { console.error("서울 실패:", e.message); return []; });
  const std   = await collectStandard().catch((e) => { console.error("표준데이터 실패:", e.message); return []; });
  const tour  = await collectTour().catch((e) => { console.error("TourAPI 실패:", e.message); return []; });
  // 전국관광지정보(4번)는 껐다 — 사진도 홈페이지도 없고 제목이 행정 명칭이라
  // 무엇인지 알 수 없다는 사용자 판단. 되살리려면 아래 한 줄을 되돌리면 된다.
  // const std2 = await collectStandard2().catch((e) => { console.error("표준데이터 추가 실패:", e.message); return []; });
  const std2  = [];
  const sigun = await collectSigun().catch((e) => { console.error("경기 시군 실패:", e.message); return []; });

  if (PEEK) { console.log("\n칸 이름 확인만 하고 끝냅니다."); return; }

  // 같은 곳이 여러 자료원에 들어 있다. 이름을 정규화해 하나만 남긴다.
  // 앞에 오는 목록이 이긴다 — TourAPI는 사진이 있어 카드가 잘 보이고,
  // 표준데이터가 그다음, 전국관광지정보가 마지막이다.
  // 서울 예약(reserve)은 같은 장소에서 여는 여러 프로그램이라 이름이 겹쳐도
  // 지우면 안 되므로 아예 대상에서 뺀다.
  const normName = (s) => String(s || "")
    .replace(/\([^)]*\)/g, "")            // 괄호와 그 안의 글자
    .replace(/[\s·\-_,.]/g, "")
    .toLowerCase();

  // 대학 부속 시설은 이름으로 뺀다. 시설 종류 칸으로는 못 거른다 —
  // 국립대(서울과학기술대학교미술관)는 종류가 '대학'이 아니라 '국립'으로 온다.
  const isUniv = (it) => /대학교/.test(it.title || "");

  // 그림을 파는 상업 화랑은 나들이가 아니다. 이름에 '화랑'이 든 곳과, 분류가
  // 미술관으로 와 있지만 실제로는 화랑인 다섯 곳을 뺀다(사용자가 골랐다).
  // 미술관은 남긴다 — 국립현대미술관·간송미술관·어린이미술관이 같은 분류에 있다.
  const GALLERY = [
    "금보성아트센터", "아트파크", "어반아트", "유 아트 스페이스", "조은숙아트앤라이프스타일",
  ];
  // 전시관 분류에 섞여 있는 작가 작업실·기획전시장(위 화랑과 성격이 같다)과
  // 상업 공간. 사용자가 목록을 보고 골랐다.
  const STUDIO_SHOP = [
    "서울시립 난지미술창작스튜디오", "플랫폼엘", "수애뇨339", "TINC",
    "틈문화창작지대", "아트플러그 연수", "CXC아트뮤지엄",
    "빛의 시어터", "더서울라이티움", "에스팩토리", "마크트할레",
    "현대 모터스튜디오 고양", "전통주갤러리", "창희보석예술관",
  ];

  const isGallery = (it) => {
    const t = String(it.title || "").trim();
    return /화랑/.test(t) || GALLERY.includes(t) || STUDIO_SHOP.includes(t);
  };

  const seen = new Set();
  const merged = [];
  let dropped = 0, univ = 0, gallery = 0;
  for (const list of [tour, std, std2]) {
    for (const it of list) {
      if (isUniv(it)) { univ++; continue; }
      if (isGallery(it)) { gallery++; continue; }
      const k = normName(it.title);
      if (k) {
        if (seen.has(k)) { dropped++; continue; }
        seen.add(k);
      }
      merged.push(it);
    }
  }
  console.log(`  이름 겹쳐 뺀 것 ${dropped}건 / 대학 시설 ${univ}건 / 화랑·작업실·상업공간 ${gallery}건`);

  // 빈 칸을 빼고 좌표 자릿수를 줄여 파일을 가볍게 만든다
  const items = [...merged, ...seoul, ...sigun, ...MANUAL].map((it) => {
    const o = {};
    for (const [k, v] of Object.entries(it)) {
      if (v === "" || v === null || v === undefined) continue;
      o[k] = (k === "lat" || k === "lng") ? Math.round(v * 1e4) / 1e4 : v;
    }
    return o;
  });

  const data = {
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
    // 휴양림 탭에서 그대로 그리는 목록 (거르지도 정렬하지도 않는다)
    forests: FOREST.map(([region, city, name, id]) => {
      const x = FOREST_INFO.get(forestNorm(name)) || {};
      /* 자체 홈페이지(○○.foresttrip.go.kr)는 넣지 않는다 — meta refresh로
       * indvz 예약 페이지로 보내는 꺽데기라 따로 보여줄 이유가 없다. */
      return { region, city, sido: x.sido || "", name, id, fac: x.fac || [], img: x.img || "" };
    }),
    // 키즈카페 탭 — 자치구 가나다순으로 정렬해서 넘긴다
    kidscafe: KIDSCAFE
      .map((k) => {
        const o = {};
        for (const [a, v] of Object.entries(k)) {
          if (v === "" || v === null || v === undefined) continue;
          o[a] = (a === "lat" || a === "lng") ? Math.round(v * 1e4) / 1e4 : v;
        }
        return o;
      })
      .sort((a, b) => (a.area || "").localeCompare(b.area || "", "ko") ||
                      (a.name || "").localeCompare(b.name || "", "ko")),
  };

  fs.writeFileSync(path.join(__dirname, "data.json"), JSON.stringify(data), "utf8");

  const kb = Math.round(fs.statSync(path.join(__dirname, "data.json")).size / 1024);
  console.log(`\n완료 — ${items.length}건, data.json ${kb}KB`);
  console.log(`  행사·축제 ${items.filter(i => i.kind === "festival").length}`);
  console.log(`  예약 프로그램 ${items.filter(i => i.kind === "reserve").length}`);
  console.log(`  상시 시설 ${items.filter(i => i.kind === "place").length}`);
  console.log(`  키즈카페 탭 ${data.kidscafe.length}곳`);
  console.log(`  (자료원별 중복 제거 전) 서울 ${seoul.length} / 표준데이터 ${std.length} / TourAPI ${tour.length} / 표준데이터 추가 ${std2.length} / 경기 시군 ${sigun.length}`);
  console.log(`  경기도 ${items.filter(i => String(i.area || "").startsWith("경기")).length}`);
})();
