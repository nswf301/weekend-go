/*
 * 경기 고양시 — 체험ㆍ견학 예약  (본보기 B: 목록 구조 + 상세 안 열기, 김포에 가깝다)
 *
 *   목록  BD_selectResveManageList.do?q_resveTopClCode=CL_02&q_resveSttusCode=1002&q_currPage=<쪽>
 *   상세  BD_selectResveManage.do?resveSn=<번호>
 *
 * 서버가 그려주는 HTML이다(80KB, curl로 확인됨). q_resveTopClCode=CL_02가 "체험ㆍ견학"
 * 대분류이고, 안에 전시관견학ㆍ안전체험ㆍ목공체험ㆍ유아숲체험ㆍ생태ㆍ역사체험 같은
 * 소분류가 섞여 있다. 소분류를 따로 고르지 않고 대분류 전체를 받는다.
 *
 * q_resveSttusCode=1002를 붙이면 서버가 접수중인 것만 걸러 돌려준다(총 849건 중 7건).
 * 그래도 상태 글자는 한 번 더 확인한다 — 클래스·쿼리는 언제든 뜻이 바뀔 수 있다.
 *
 * 목록 한 줄(<li>)에 제목ㆍ장소ㆍ대상ㆍ신청기간ㆍ체험(행사)기간이 다 있어 상세를
 * 열 필요가 없다. 사진은 상세에만 있고 목록에는 없어서 비워둔다.
 *
 * 새 시군을 붙이는 방법은 sigun/지침.md 를 보라.
 */

const AREA = "경기 고양시";
const BASE = "https://www.goyang.go.kr/resve/manage/";
const CITY_XY = [37.6584, 126.8320];   // 고양시청

async function getText(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": "weekend-go/1.0" } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return await res.text();
}

module.exports = {
  name: "고양시",
  area: AREA,

  async collect(util) {
    const strip = (s) =>
      util.unent(String(s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

    // "2026-08-03 ~ 2026-08-21" 을 앞·뒤 날짜로 가른다. 신청기간이 비어 있는
    // 항목도 있다(상시 관람 등, " ~ " 만 있음) — toDate가 알아서 빈 문자열을 준다.
    const term = (v) => {
      const [a, b] = String(v || "").split("~");
      return [util.toDate(a || ""), util.toDate(b || "")];
    };

    const out = [];
    let totalPages = 1;

    // pageUnit을 올리는 파라미터를 찾지 못해 기본값 10건/쪽 그대로 돈다.
    // q_resveSttusCode=1002(접수중) 필터를 걸어 받으니 쪽수가 많지 않다.
    // 그래도 "총 N건" 표기를 읽어 쪽수를 계산하고, 끝까지 돈다.
    for (let page = 1; page <= totalPages; page++) {
      const html = await getText(
        `${BASE}BD_selectResveManageList.do?q_resveTopClCode=CL_02` +
        `&q_resveSttusCode=1002&q_currPage=${page}`,
        `고양 목록 ${page}쪽`
      );

      if (page === 1) {
        const total = parseInt(strip((html.match(/총\s*<strong>([\d,]+)<\/strong>\s*건/) || [])[1] || "0").replace(/,/g, ""), 10) || 0;
        totalPages = Math.max(1, Math.ceil(total / 10));
      }

      // 항목 하나가 <li><a href="#" onclick="opResveView(번호, '');">...</a></li> 꼴이다.
      const re = /<li>\s*<a href="#" onclick="opResveView\((\d+)[^>]*>([\s\S]*?)<\/a>\s*<\/li>/g;
      let m;
      let count = 0;
      while ((m = re.exec(html))) {
        count++;
        const [, id, body] = m;

        // 상태 배지 글자로 판별한다(state_clr01=접수중, state_clr02=접수마감, state_clr04=종료).
        // 클래스 이름 대신 글자를 본다 — 클래스는 바뀔 수 있다.
        const status = strip((body.match(/<b class="state_clr\d+">([\s\S]*?)<\/b>/) || [])[1] || "");
        if (status !== "접수중") continue;

        // 제목ㆍ장소는 list_type02 한 칸 안에 <strong><span>제목</span></strong> 뒤에
        // <span>장소</span>가 이어 나온다.
        const titlePlace = body.match(/<strong class="subject_tit"><span[^>]*>([\s\S]*?)<\/span><\/strong>\s*<span>([\s\S]*?)<\/span>/);
        const title = strip(titlePlace ? titlePlace[1] : "");
        const place = strip(titlePlace ? titlePlace[2] : "");
        if (!title) continue;

        const target = strip((body.match(/<p class="list_type03">([\s\S]*?)<\/p>/) || [])[1] || "");

        // 신청기간ㆍ체험(행사)기간이 한 칸(list_type04) 안에 라벨로 나뉘어 있다.
        const type04 = (body.match(/<p class="list_type04">([\s\S]*?)<\/p>/) || [])[1] || "";
        const rcptRaw = (type04.match(/신청\s*:\s*<\/b>([\s\S]*?)<br/) || [])[1] || "";
        const eventRaw = (type04.match(/체험\s*:\s*<\/b>([\s\S]*)/) || [])[1] || "";
        const [rcptStart, rcptEnd] = term(rcptRaw);
        const [start, end] = term(eventRaw);

        const fee = strip((body.match(/<p class="list_type06">([\s\S]*?)<\/p>/) || [])[1] || "");

        const age = util.ageRange(target);
        const [lat, lng] = CITY_XY;

        out.push({
          kind: "reserve",
          group: "체험·견학",
          sub: "",
          title,
          area: AREA,
          place,
          target,
          ageMin: age ? age[0] : null,
          ageMax: age ? age[1] : null,
          status,
          start,
          end,
          rcptStart,
          rcptEnd,
          url: `${BASE}BD_selectResveManage.do?resveSn=${id}`,
          img: "",
          fee,
          tel: "",
          lat, lng,
        });
      }

      if (count === 0) break;   // 항목이 안 나오면 멈춘다
    }

    return out;
  },
};
