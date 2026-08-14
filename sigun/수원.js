/*
 * 경기 수원시 — 교육·강좌·체험 예약  (본보기 A: 표 구조)
 *
 *   목록  list.do?q_categoryCode=83&q_rowPerPage=100&q_currPage=<쪽>
 *   상세  view.do?seqNo=..&q_categoryCode=83
 *
 * 표(table.yeyak-t) 한 줄이 항목 하나라 남양주와 같은 방식으로 읽는다.
 * 칸 순서: 번호 · 강좌명 · 접수기간/교육기간 · 요일/시간 · 대상 · 인원 · 장소 · 상태
 *
 * 접수상태가 `접수중`인 것만 남긴다. 한 쪽에 100건씩 받으면 접수중은 전부
 * 첫 쪽에 몰려 있다(번호 내림차순). 그래도 뒷쪽까지 훑되 빈 쪽이 나오면 멈춘다.
 *
 * 새 시군을 붙이는 방법은 sigun/지침.md 를 보라.
 */

const AREA = "경기 수원시";
const SITE = "https://www.suwon.go.kr";
const LIST = `${SITE}/web/reserv/edu/list.do?q_categoryCode=83&q_rowPerPage=100&q_currPage=`;

// 목록은 장소를 이름으로만 준다(주소가 없다). 지오코딩은 인증키가 필요해서
// 김포와 같이 시청 좌표를 공통으로 쓴다. 거리 거르기는 100km 단위라 이걸로 충분하다.
const CITY_XY = [37.2636, 127.0286];   // 수원시청

// 자격증·지도사 과정은 어른이 배우러 가는 강좌라 나들이가 아니다.
// (평생학습강좌를 안 넣기로 한 것과 같은 이유)
const ADULT = /지도사|자격증/;

async function getText(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": "weekend-go/1.0" } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return await res.text();
}

module.exports = {
  name: "수원시",
  area: AREA,

  async collect(util) {
    const strip = (s) =>
      util.unent(String(s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

    // "2026-08-08 ~ 2026-08-15" 를 앞·뒤 날짜로 가른다
    const term = (v) => {
      const [a, b] = String(v || "").split("~");
      return [util.toDate(a || ""), util.toDate(b || "")];
    };

    const out = [];

    for (let page = 1; page <= 4; page++) {
      const html = await getText(`${LIST}${page}`, `수원 목록 ${page}쪽`);

      // 머리행(thead)까지 같이 잘리므로 두 번째 조각부터 쓴다
      const body = html.slice(html.indexOf('class="yeyak-t"'));
      const rows = body.split("<tr").slice(2);
      if (!rows.length) break;

      for (const r of rows) {
        const td = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
        if (td.length < 8) continue;

        const status = strip(td[7]);
        if (status !== "접수중") continue;

        const a = r.match(/href="([^"]+)"[^>]*class="title"[^>]*>([\s\S]*?)<\/a>/);
        const title = strip(a && a[2]);
        if (!title || ADULT.test(title)) continue;

        // 링크에 목록 쪽번호까지 딸려 오므로 seqNo만 떼어 다시 만든다
        const no = ((a && a[1]) || "").match(/seqNo=(\d+)/);
        const url = no ? `${SITE}/web/reserv/edu/view.do?seqNo=${no[1]}&q_categoryCode=83` : "";

        // 한 칸에 접수기간과 교육기간이 <br>로 겹쳐 들어 있다
        const [rcpt, edu] = td[2].split(/<br\s*\/?>/).map(strip);
        const [rcptStart, rcptEnd] = term(rcpt);
        const [start, end]         = term(edu);

        // "수 10:00 ~ 11:00" — 요일은 카드에 필요 없고 시각만 쓴다
        const time = (strip(td[3]).match(/\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2}/) || [""])[0];

        const target = strip(td[4]);
        const age = util.ageRange(target);
        const [lat, lng] = CITY_XY;

        out.push({
          kind: "reserve",
          group: "체험·견학",
          sub: "",
          title,
          area: AREA,
          place: strip(td[6]),
          target,
          ageMin: age ? age[0] : null,
          ageMax: age ? age[1] : null,
          status,
          start,
          end,
          rcptStart,
          rcptEnd,
          time,
          url,
          lat, lng,
        });
      }

      if (rows.length < 100) break;
    }

    return out;
  },
};
