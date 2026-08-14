/*
 * 경기 의왕시 — 체험견학 예약  (본보기 B: 목록 구조 + 상세 안 열기, 김포와 비슷하다)
 *
 *   목록  eduList.do?currentMenuNo=473&pageIndex=<쪽>   (한 쪽에 8건, 서버가 그려준다)
 *   상세  eduView.do?resrId=<RESR_..>&currentMenuNo=473
 *
 * 표(table)가 아니라 앨범(ul.album/li) 구조다. 항목 하나가
 * onclick="fnView('RESR_..')"로 시작해서 이 문자열로 잘라 조각을 만든다.
 * 정보 줄은 <li><span class="em">라벨</span>값</li> 꼴로 라벨이 고정돼 있어
 * (접수기간·체험캠프기간·요일·대상·사용료·위치·신청/정원·대기인원) 라벨 이름으로
 * 바로 찾으면 된다 — 김포처럼 라벨을 태그에서 떼어낼 필요가 없다.
 *
 * 목록 한 줄에 대상·장소·요금·행사기간·사진까지 다 있어서 상세를 열지 않는다.
 * 접수상태가 `접수중`인 것만 남긴다. 45건 중 4건이다.
 *
 * 새 시군을 붙이는 방법은 sigun/지침.md 를 보라.
 */

const AREA = "경기 의왕시";
const ORIGIN = "https://www.uiwang.go.kr";
const BASE = ORIGIN + "/reserve/";

// 좌표는 목록이 주지 않는다. 의왕시청 좌표를 공통으로 쓴다.
const CITY_XY = [37.3448, 126.9683];   // 의왕시청

async function getText(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": "weekend-go/1.0" } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return await res.text();
}

module.exports = {
  name: "의왕시",
  area: AREA,

  async collect(util) {
    // 태그를 걷어내고 실체참조를 되돌린 뒤 공백을 한 칸으로 줄인다.
    // 체험캠프기간처럼 값 중간에 <br>이 섞인 줄도 있어서 태그 제거가 필요하다.
    const strip = (s) =>
      util.unent(String(s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

    // "2026-08-19 ~ 2026-08-19" 를 앞·뒤 날짜로 가른다.
    const term = (v) => {
      const [a, b] = String(v || "").split("~");
      return [util.toDate(a || ""), util.toDate(b || "")];
    };

    // <li><span class="em">라벨</span>값</li> 에서 값만 뽑는다.
    const field = (chunk, label) => {
      const re = new RegExp(`<li><span class="em">${label}</span>([\\s\\S]*?)</li>`);
      const m = chunk.match(re);
      return m ? strip(m[1]) : "";
    };

    const out = [];

    // 총 건수는 화면에 "전체 N건"으로 나온다. 한 쪽에 8건씩 나오는데 이 수가
    // 바뀔 수도 있으니 항목이 안 나올 때까지 쪽을 넘긴다(과하게 돌지 않게 20쪽 상한).
    for (let page = 1; page <= 20; page++) {
      const html = await getText(
        `${BASE}EXP/X01/eduList.do?currentMenuNo=473&pageIndex=${page}`,
        `의왕 목록 ${page}쪽`
      );

      const chunks = html.split(/onclick="fnView\(/).slice(1);
      if (!chunks.length) break;

      for (const c of chunks) {
        const resrId = (c.match(/^'(RESR_\d+)'/) || [])[1];
        if (!resrId) continue;

        // 상태 배지: label ing(접수중)/wait(접수예정)/end(접수마감). 클래스보다 글자로 본다.
        const status = strip((c.match(/<span class="label[^"]*">([\s\S]*?)<\/span>/) || [])[1] || "");
        if (status !== "접수중") continue;

        const title = strip((c.match(/<p class="tit">([\s\S]*?)<\/p>/) || [])[1] || "");
        if (!title) continue;

        const src = (c.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "";
        // 이미지 주소에 세션 꼬리표(;jsessionid=..)가 붙어 있는데 없어도 잘 열린다.
        const img = src ? ORIGIN + util.unent(src).replace(/;jsessionid=[^?]*/, "") : "";

        const [rcptStart, rcptEnd] = term(field(c, "접수기간"));
        const [start, end]         = term(field(c, "체험캠프기간"));

        const target = field(c, "대상");
        const age    = util.ageRange(target);
        const [lat, lng] = CITY_XY;

        out.push({
          kind: "reserve",
          group: "체험·견학",
          title,
          area: AREA,
          place: field(c, "위치"),
          target,                                // 원문 그대로
          ageMin: age ? age[0] : null,
          ageMax: age ? age[1] : null,
          status,
          start,
          end,
          rcptStart,
          rcptEnd,
          fee: field(c, "사용료"),
          url: `${BASE}EXP/X01/eduView.do?resrId=${resrId}&currentMenuNo=473`,
          img,
          lat, lng,
        });
      }
    }

    return out;
  },
};
