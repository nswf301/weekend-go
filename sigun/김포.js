/*
 * 경기 김포시 — 견학·체험 예약  (본보기 B: 목록 구조 + 상세 안 열기)
 *
 *   목록  webEtcResveList.do?key=113&etcProgramSection=EXPERIENCE&pageUnit=100&pageIndex=<쪽>
 *   상세  webEtcResveView.do?key=113&etcProgramSection=EXPERIENCE&searchEtcResveNo=..
 *
 * 로그인이 필요 없고 UTF-8인 것은 남양주와 같지만 화면 구조가 달라 읽는 방법이 다르다.
 * 표(table)가 아니라 목록(ul/li)이고, 항목 하나가 <li class="participation_item">로 시작한다.
 *
 * 접수상태가 `접수중`인 것만 남긴다 (남양주·서울 예약과 같은 기준). 88건 중 17건이다.
 * 상세는 열지 않는다 — 목록 한 줄에 대상·장소·신청·행사·문의가 다 들어 있다.
 *
 * 새 시군을 붙이는 방법은 sigun/지침.md 를 보라.
 */

const AREA = "경기 김포시";
const BASE = "https://www.gimpo.go.kr/reserve/";

// 좌표는 목록이 전혀 주지 않는다. `장소` 값에 주소가 섞여 있는 항목도 있지만
// 지오코딩은 인증키가 필요해서 하지 않았다. 그래서 김포시청 좌표를 공통으로 쓴다.
// 나중에 남양주(ORG_XY)처럼 기관별 표로 정교화할 수 있다.
const CITY_XY = [37.6152, 126.7157];   // 김포시청

// 정보 줄에서 떼어낼 라벨. 라벨이 더 있을 수 있으니 아는 것만 처리하고
// 모르는 줄은 버린다.
const LABELS = ["대상", "장소", "신청", "행사", "문의"];

async function getText(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": "weekend-go/1.0" } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return await res.text();
}

module.exports = {
  name: "김포시",
  area: AREA,

  async collect(util) {
    // 태그를 걷어내고 실체참조를 되돌린 뒤 공백을 한 칸으로 줄인다.
    const strip = (s) =>
      util.unent(String(s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

    // "2026-06-17 ~ 2026-08-25" 를 앞·뒤 날짜로 가른다.
    // 상시 접수를 9999-01-01로 적어두는 곳이 있다(남양주에서 겪었다).
    // 그대로 두면 카드에 "9999년 1월 1일"이 뜨므로 마감이 없는 것으로 본다.
    const term = (v) => {
      const [a, b] = String(v || "").split("~");
      const s = util.toDate(a || "");
      const e = util.toDate(b || "");
      return [/^9999/.test(s) ? "" : s, /^9999/.test(e) ? "" : e];
    };

    const out = [];

    // pageUnit=10이 기본이라 첫 쪽만 받으면 10건뿐이다. 100으로 올리면 88건이
    // 한 쪽에 다 온다. 넉넉히 4쪽까지 돌되 항목이 안 나오면 멈춘다.
    for (let page = 1; page <= 4; page++) {
      const html = await getText(
        `${BASE}webEtcResveList.do?key=113&rep=1&etcProgramSection=EXPERIENCE` +
        `&searchEtcGroup=0&pageUnit=100&searchCnd=all&searchKrwd=&pageIndex=${page}`,
        `김포 목록 ${page}쪽`
      );

      // 항목 하나가 <li class="participation_item">로 시작한다. 표가 아니라서
      // <tr>로 자를 수 없다 — 이 낱말로 잘라 조각을 만든다.
      const chunks = html.split('<li class="participation_item"').slice(1);
      if (!chunks.length) break;

      for (const c of chunks) {
        // 상태 배지: participation_label(대기중) / type2(접수중) / type3(마감·완료).
        // 클래스 이름 대신 글자를 본다 — 클래스는 바뀔 수 있다.
        const status = strip((c.match(/<span class="participation_label[^"]*">([\s\S]*?)<\/span>/) || [])[1] || "");
        if (status !== "접수중") continue;

        const title = strip((c.match(/<strong>([\s\S]*?)<\/strong>/) || [])[1] || "");
        if (!title) continue;

        const href = (c.match(/href="([^"]+)"/) || [])[1] || "";
        const url  = href ? BASE + util.unent(href).replace(/^\.\//, "") : "";

        // 사진은 participation_image 칸 안에만 있다. src가 /로 시작하는 상대 주소다.
        const imgBox = (c.match(/<div class="participation_image">([\s\S]*?)<\/div>/) || [])[1] || "";
        const src    = (imgBox.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "";
        const img    = src ? "https://www.gimpo.go.kr" + util.unent(src) : "";

        // 정보 줄은 라벨과 값이 태그로만 나뉘어 있고 사이에 공백이 없다.
        // 태그를 걷어낸 뒤 라벨을 머리글자로 떼어낸다.
        const f = {};
        for (const li of c.match(/<li class="participation_information_item">[\s\S]*?<\/li>/g) || []) {
          const t   = strip(li);
          const lab = LABELS.find((l) => t.startsWith(l));
          if (lab) f[lab] = t.slice(lab.length).trim();
        }

        const [rcptStart, rcptEnd] = term(f["신청"]);
        const [start, end]         = term(f["행사"]);   // 김포는 행사 날짜가 목록에 있다

        const target = f["대상"] || "";
        const age    = util.ageRange(target);
        const [lat, lng] = CITY_XY;

        out.push({
          kind: "reserve",
          group: "체험·견학",
          sub: "",                               // 김포 목록에는 카테고리가 없다
          title,
          // 지역 이름은 다른 자료와 같은 꼴이라야 화면의 지역 필터가 맞는다
          area: AREA,
          place: f["장소"] || "",
          target,                                // 원문 그대로
          ageMin: age ? age[0] : null,
          ageMax: age ? age[1] : null,
          status,
          start,
          end,
          rcptStart,
          rcptEnd,
          url,
          img,
          tel: f["문의"] || "",
          lat, lng,
        });
      }

      if (chunks.length < 100) break;            // 한 쪽으로 끝났다
    }

    return out;
  },
};
