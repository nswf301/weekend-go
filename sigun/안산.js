/*
 * 경기 안산시 — 체험·견학 예약  (본보기 B: 목록 구조 + 상세 안 열기)
 *
 *   목록  expList.do?searchClsfCd=all&searchRcptStat=I&pageIndex=<쪽>
 *   상세  expView.do?resrId=RESR_..&currentMenuNo=667
 *
 * 목록이 표가 아니라 <ul class="blog reserv"> 안의 <li>다. 항목 안에 또 <li>가
 * 있어서 <li>로 자르면 안 된다 — 항목마다 있는 fnView('RESR_..') 로 자른다.
 *
 * 접수상태는 주소에 searchRcptStat=I를 넣어 서버가 접수중만 주게 한다.
 * 상세는 열지 않는다 — 목록 한 줄에 기관·접수기간·체험기간·대상·사용료·위치가 다 있다.
 *
 * 새 시군을 붙이는 방법은 sigun/지침.md 를 보라.
 */

const AREA = "경기 안산시";
const SITE = "https://reserve.ansan.go.kr";
const LIST = `${SITE}/exp/X01/expList.do?currentMenuNo=667&searchClsfCd=all` +
             `&searchRcptStat=I&searchDateGb=U&pageIndex=`;

// 목록은 위치를 법정동 이름으로만 준다(주소가 없다). 김포·수원과 같이
// 시청 좌표를 공통으로 쓴다. 거리 거르기는 100km 단위라 이걸로 충분하다.
const CITY_XY = [37.3219, 126.8309];   // 안산시청

// 반려견놀이터는 개를 데리고 가는 곳이라 아이 나들이가 아니다.
// (목록 유형 X04. 주소에 유형을 하나만 넣을 수 있어 여기서 거른다)
const NOT_KIDS = /반려견/;

async function getText(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": "weekend-go/1.0" } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return await res.text();
}

module.exports = {
  name: "안산시",
  area: AREA,

  async collect(util) {
    const strip = (s) =>
      util.unent(String(s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

    // "2026-08-14 12:00 ~ 2026-09-30 17:00" — 시각은 버리고 날짜만 쓴다
    const term = (v) => {
      const [a, b] = String(v || "").split("~");
      return [util.toDate(a || ""), util.toDate(b || "")];
    };

    const out = [];

    // 한 쪽에 10건씩이고 쪽수를 늘리는 값이 없다. 넉넉히 6쪽까지 돈다.
    for (let page = 1; page <= 6; page++) {
      const html = await getText(`${LIST}${page}`, `안산 목록 ${page}쪽`);

      const ul = html.slice(html.indexOf('class="blog reserv"'));
      const chunks = ul.split("fnView('").slice(1);
      if (!chunks.length) break;

      for (const c of chunks) {
        const id = c.slice(0, c.indexOf("'"));
        if (!/^RESR_/.test(id)) continue;

        const title = strip((c.match(/<p class="tit">([\s\S]*?)<\/p>/) || [])[1]);
        if (!title || NOT_KIDS.test(title)) continue;

        // 라벨과 값이 <span class="em emExp">라벨</span>값</li> 꼴로 붙어 있다
        const f = {};
        for (const m of c.matchAll(/<span class="em emExp">([\s\S]*?)<\/span>([\s\S]*?)<\/li>/g)) {
          f[strip(m[1])] = strip(m[2]);
        }

        const [rcptStart, rcptEnd] = term(f["접수기간"]);
        const [start, end]         = term(f["체험/견학기간"]);

        const target = f["대상"] || "";
        const age = util.ageRange(target);
        const [lat, lng] = CITY_XY;

        out.push({
          kind: "reserve",
          group: "체험·견학",
          sub: "",
          title,
          area: AREA,
          place: f["위치"] || "",
          target,
          ageMin: age ? age[0] : null,
          ageMax: age ? age[1] : null,
          fee: f["사용료"] || "",
          status: "접수중",
          start,
          end,
          rcptStart,
          rcptEnd,
          url: `${SITE}/exp/X01/expView.do?resrId=${id}&currentMenuNo=667`,
          tel: "",
          lat, lng,
        });
      }

      if (chunks.length < 10) break;            // 마지막 쪽이다
    }

    return out;
  },
};
