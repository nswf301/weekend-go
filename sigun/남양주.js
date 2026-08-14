/*
 * 경기 남양주시 — 체험·견학 예약  (본보기 A: 표 구조 + 상세 열기)
 *
 *   목록  selectUserExprnTourBasicInfoList.do?key=3383&pageUnit=100&pageIndex=<쪽>
 *   상세  selectUserExprnTourBasicInfoView.do?key=3383&searchTourKey=..&searchExprnKey=..
 *
 * API가 아니라 서버가 그려주는 표(HTML)를 읽는다. 로그인은 필요 없고 UTF-8이다.
 * 접수상태가 `접수중`인 것만 남긴다 — 전체 104건 중 대부분이 이미 접수마감이라
 * 지금 신청할 수 없다. 서울 예약이 `접수중·안내중`만 받는 것과 같은 기준이다.
 * 돌릴 때마다 8~9건 사이로 달라지는 게 정상이다.
 *
 * 새 시군을 붙이는 방법은 sigun/지침.md 를 보라.
 */

const AREA = "경기 남양주시";
const BASE = "https://www.nyj.go.kr/reserve/";

// 좌표는 페이지가 주지 않아서 기관별로 박아뒀다 (관광공사 API로 찾은 값).
// 표에 없는 기관은 남양주시청 좌표를 쓴다 — `유아숲체험원`·`남양주 궁집`·
// `REMEMBER 1910`은 관광공사에 등록이 없어 위치를 확인할 수 없었다.
const ORG_XY = {
  "정약용유적지":     [37.5166, 127.2993],
  "물맑음수목원":     [37.7058, 127.2956],
  "남양주시립박물관": [37.5464, 127.2444],
};
const CITY_XY = [37.6360, 127.2165];   // 남양주시청

async function getText(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": "weekend-go/1.0" } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return await res.text();
}

module.exports = {
  name: "남양주시",
  area: AREA,

  async collect(util) {
    // 태그를 걷어내고 실체참조를 되돌린 뒤 공백을 한 칸으로 줄인다.
    // 실체참조 규칙은 util.unent 하나만 쓴다 — 여기서 따로 갖지 않는다.
    const strip = (s) =>
      util.unent(String(s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

    // 상세 페이지는 <th>항목</th><td>값</td> 쌍이라 항목 이름으로 찾는다
    const field = (html, label) => {
      const m = html.match(
        new RegExp(`<th[^>]*>\\s*${label}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`)
      );
      return m ? strip(m[1]) : "";
    };

    const out = [];

    // 총 104건이라 pageUnit=100이면 두 쪽이면 끝난다. 넉넉히 4쪽까지 돌되
    // 항목이 안 나오면 멈춘다.
    for (let page = 1; page <= 4; page++) {
      const html = await getText(
        `${BASE}selectUserExprnTourBasicInfoList.do?key=3383&pageUnit=100&pageIndex=${page}`,
        `남양주 목록 ${page}쪽`
      );
      const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
      let found = 0;

      for (const row of rows) {
        const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
        if (tds.length < 7) continue;          // 머리글 줄(<th>)은 걸러진다
        found++;

        // 칸 순서: 0 번호 | 1 기관 | 2 카테고리 | 3 제목 | 4 접수기간 | 5 접수방법 | 6 접수상태
        const status = strip(tds[6]);
        if (status !== "접수중") continue;     // 접수마감·접수대기는 버린다

        const org   = strip(tds[1]);
        const cat   = strip(tds[2]);
        const title = strip(tds[3]);
        const term  = strip(tds[4]);

        const href = (tds[3].match(/href="([^"]+)"/) || [])[1] || "";
        const url  = href ? BASE + util.unent(href).replace(/^\.\//, "") : "";

        const [t1, t2] = term.split("~");
        const rcptStart = util.toDate(t1 || "");
        // 상시 접수를 9999-01-01로 적어두는 항목이 있다(REMEMBER 1910 전시해설).
        // 그대로 두면 카드에 "접수 마감 9999년 1월 1일"이 뜬다. 마감이 없는 것으로 본다.
        const rcptEndRaw = util.toDate(t2 || "");
        const rcptEnd    = /^9999/.test(rcptEndRaw) ? "" : rcptEndRaw;

        // 상세는 접수중인 것만 연다(10건 안팎이라 부담 없다).
        // 못 받아도 목록 정보만으로 넣는다 — 수집 전체가 죽으면 안 된다.
        let target = "", fee = "", place = "", tel = "", time = "";
        if (url) {
          try {
            const d = await getText(url, `남양주 상세`);
            target = field(d, "모집대상");
            fee    = field(d, "이용요금");
            place  = field(d, "장소");
            tel    = field(d, "문의전화");
            time   = field(d, "소요시간");
          } catch (e) {
            console.warn(`  ! 남양주 상세 실패: ${title} (${e.message})`);
          }
        }

        const age = util.ageRange(target);
        const [lat, lng] = ORG_XY[org] || CITY_XY;

        out.push({
          kind: "reserve",
          group: "체험·견학",
          sub: cat,
          title,
          // 지역 이름은 다른 자료와 같은 꼴이라야 화면의 지역 필터가 맞는다
          area: AREA,
          place: place || org,
          target,                                // 원문 그대로
          ageMin: age ? age[0] : null,
          ageMax: age ? age[1] : null,
          fee,
          status,
          time,
          rcptStart,
          rcptEnd,
          url,
          tel,
          lat, lng,
        });
      }

      if (!found) break;
    }

    return out;
  },
};
