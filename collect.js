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
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
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

        // 서울형 키즈카페는 동네 시설이라 뺀다 (지점마다 줄이 생겨 목록을 덮는다)
        if (/키즈카페/.test(`${both} ${r.PLACENM || ""}`)) continue;

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
  A01010500: "자연생태관광지", A01010600: "자연휴양림", A01010700: "수목원", A01010200: "도립공원",
  A02010100: "고궁",          A02010600: "민속마을",   A02020600: "테마공원", A02020800: "유람선",
  A02030200: "전통체험",      A02040600: "식음료",
  A01010900: "계곡",          A01011200: "해수욕장",   A01011700: "호수",     A01010800: "폭포",
};

// 이 두 분류는 관광공사 쪽 분류가 엉성해서 '강남'·'경리단길'·'족발골목' 같은
// 동네 이름이 잔뜩 섞여 있다. 이름이 체험거리로 읽힐 때만 남긴다.
const TOUR_SPOT_CAT_COND = { A02030100: "농·산·어촌 체험", A02030400: "이색체험" };
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

      out.push({
        kind: "place", group: "관광지", sub,
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

/* ── 직접 확인이 필요한 곳 (자동 수집이 안 되는 예약처) ────── */

const MANUAL = [
  {
    kind: "manual",
    group: "직접 확인",
    title: "남양주시 체험·견학 프로그램 예약",
    // 지역 이름은 다른 자료와 같은 꼴이라야 한다. "남양주시"처럼 적으면
    // 공백이 없어 화면의 지역 필터가 서울로 분류해버린다.
    area: "경기 남양주시",
    note: "물맑음수목원 등. 목록은 로그인 없이 볼 수 있고, 신청할 때만 로그인한다",
    // 예전에는 selectExprnMyTourListU.do(내 예약 조회)를 걸어둬서 로그인해야 보였다.
    // 아래가 프로그램 목록 페이지다.
    url: "https://www.nyj.go.kr/reserve/selectUserExprnTourBasicInfoList.do?key=3383",
    lat: 37.636, lng: 127.216,
  },
];

/* ── 실행 ────────────────────────────────────────────────── */

(async () => {
  console.log(`수집 시작 (기준일 ${TODAY})`);

  const seoul = await collectSeoul().catch((e) => { console.error("서울 실패:", e.message); return []; });
  const std   = await collectStandard().catch((e) => { console.error("표준데이터 실패:", e.message); return []; });
  const tour  = await collectTour().catch((e) => { console.error("TourAPI 실패:", e.message); return []; });
  const std2  = await collectStandard2().catch((e) => { console.error("표준데이터 추가 실패:", e.message); return []; });

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

  const seen = new Set();
  const merged = [];
  let dropped = 0;
  for (const list of [tour, std, std2]) {
    for (const it of list) {
      const k = normName(it.title);
      if (k) {
        if (seen.has(k)) { dropped++; continue; }
        seen.add(k);
      }
      merged.push(it);
    }
  }
  console.log(`  이름 겹쳐 뺀 것 ${dropped}건`);

  // 빈 칸을 빼고 좌표 자릿수를 줄여 파일을 가볍게 만든다
  const items = [...merged, ...seoul, ...MANUAL].map((it) => {
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
  };

  fs.writeFileSync(path.join(__dirname, "data.json"), JSON.stringify(data), "utf8");

  const kb = Math.round(fs.statSync(path.join(__dirname, "data.json")).size / 1024);
  console.log(`\n완료 — ${items.length}건, data.json ${kb}KB`);
  console.log(`  행사·축제 ${items.filter(i => i.kind === "festival").length}`);
  console.log(`  예약 프로그램 ${items.filter(i => i.kind === "reserve").length}`);
  console.log(`  상시 시설 ${items.filter(i => i.kind === "place").length}`);
  console.log(`  (자료원별 중복 제거 전) 서울 ${seoul.length} / 표준데이터 ${std.length} / TourAPI ${tour.length} / 표준데이터 추가 ${std2.length}`);
  console.log(`  경기도 ${items.filter(i => String(i.area || "").startsWith("경기")).length}`);
})();
