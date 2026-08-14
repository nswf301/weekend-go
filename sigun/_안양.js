/*
 * 경기 안양시 — 체험·견학 예약  (본보기 C: 달력 구조, 시설 하나)
 *
 *   달력  reservCalendarGreenMaru.do?key=4531           (안양그린마루, 한 번에 2.4MB)
 *   안내  reservWebDescrptView.do?key=4531&reservNo=..  (프로그램별 안내 — 대상만 뽑는다)
 *   신청  reservWebReqstRegist.do?key=4531&reservNo=..&rsvde=..
 *
 * 안양시 통합예약에는 남양주·김포 같은 "체험견학" 목록 탭이 없다. 문화/체험 메뉴
 * 아래 프로그램마다 달력이 따로 있다(그린마루·생태이야기관·산림체험·유아숲체험 등).
 * "문화/체험" 게시판(bbsNo=745)도 열어봤지만 목록이 아니라 문의 게시판이었다.
 * 더 가벼운 목록 주소는 찾지 못해서 사용자가 준 안양그린마루 달력 하나만 다룬다.
 *
 * 달력이 2.4MB나 되는 건 여러 달 치를 한 번에 그려서다. 그 안의 프로그램은 실제로
 * 9개뿐이고(전시해설류 4개·교육 4개·기관연계해설 1개) 날짜마다 반복될 뿐이다.
 * 마감 버튼(gotoReserveClosed)은 버리고 예약 가능한 버튼(gotoReserve)만 하루짜리
 * 항목으로 만든다. 대상 문구는 프로그램(reservNo)별 안내 페이지에서 한 번씩만
 * 받는다 — 같은 프로그램이 여러 날 열려도 안내 페이지를 중복해서 열지 않는다.
 *
 * 새 시군을 붙이는 방법은 sigun/지침.md 를 보라.
 */

const AREA = "경기 안양시";
const BASE = "https://www.anyang.go.kr/reserve/";
const KEY = 4531;
const CITY_XY = [37.3943, 126.9568];   // 안양시청

async function getText(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": "weekend-go/1.0" } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return await res.text();
}

module.exports = {
  name: "안양시",
  area: AREA,

  async collect(util) {
    // 태그를 걷어내고 실체참조를 되돌린 뒤 공백을 한 칸으로 줄인다.
    // &ensp;는 util.unent가 다루는 공통 실체참조 목록에 없어서 여기서만 따로 지운다.
    const strip = (s) =>
      util
        .unent(String(s || "").replace(/&ensp;|&emsp;/g, " ").replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();

    const html = await getText(`${BASE}reservCalendarGreenMaru.do?key=${KEY}`, "안양그린마루 달력");

    // 마감 버튼은 gotoReserveClosed(...)이고, 예약 가능한 버튼만 gotoReserve(...)다.
    // 인자 순서: (신청주소, 접수시작, 접수종료, 날짜, 접수구분ORDTM|PERIOD)
    const re =
      /onclick="gotoReserve\('([^']*)','([^']*)','([^']*)','(\d{8})','\w+'\);"\s*title="([^"]+)"/g;
    const sessions = [];
    let m;
    while ((m = re.exec(html))) {
      const [, href, rcptStartRaw, rcptEndRaw, ymd, titleRaw] = m;
      sessions.push({
        href: util.unent(href),
        rcptStartRaw,
        rcptEndRaw,
        ymd,
        title: strip(titleRaw),
      });
    }

    // 오늘보다 이른 날짜는 버린다(달력이 이미 마감 처리하지만 한 번 더 확인한다).
    const now = new Date();
    const todayYmd =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");
    const open = sessions.filter((s) => s.ymd >= todayYmd);

    // 프로그램(reservNo)별로 안내 페이지를 한 번씩만 열어 대상 문구를 받는다.
    // 못 받아도 목록 정보만으로 넣는다 — 안내 페이지 하나 때문에 수집 전체가 죽으면 안 된다.
    const reservNos = [
      ...new Set(open.map((s) => (s.href.match(/reservNo=(\d+)/) || [])[1]).filter(Boolean)),
    ];
    const targetByNo = {};
    for (const no of reservNos) {
      try {
        const d = await getText(
          `${BASE}reservWebDescrptView.do?key=${KEY}&reservNo=${no}`,
          `안양 안내 ${no}`
        );
        const plain = strip(d);
        // "대상" 또는 "교육대상" 라벨 뒤부터 다음 ● 항목 전까지를 원문 그대로 뽑는다.
        const t = plain.match(/(?:교육\s*)?대상\s*:\s*([^●]+?)(?=●|$)/);
        targetByNo[no] = t ? t[1].trim() : "";
      } catch (e) {
        console.warn(`  ! 안양 안내 실패: reservNo=${no} (${e.message})`);
        targetByNo[no] = "";
      }
    }

    const out = [];
    for (const s of open) {
      const no = (s.href.match(/reservNo=(\d+)/) || [])[1] || "";
      const url = s.href ? BASE + s.href.replace(/^\.[\\/]/, "") : "";
      const start = util.toDate(s.ymd);
      const target = targetByNo[no] || "";
      const age = util.ageRange(target);
      // 제목 앞의 "(10:00)"·"(오후)" 같은 시간 표기만 뽑는다. "(★)"·"(유아 단체)"
      // 처럼 시간이 아닌 괄호는 놔둔다.
      const timeM = s.title.match(/^\((\d{1,2}:\d{2}|오전|오후)\)/);

      out.push({
        kind: "reserve",
        group: "체험·견학",
        title: s.title,
        // 지역 이름은 다른 자료와 같은 꼴이라야 화면의 지역 필터가 맞는다
        area: AREA,
        place: "안양그린마루",
        target, // 원문 그대로
        ageMin: age ? age[0] : null,
        ageMax: age ? age[1] : null,
        time: timeM ? timeM[1] : "",
        status: "접수중",
        start,
        end: start, // 달력 하루짜리 회차라 시작·끝이 같다
        rcptStart: s.rcptStartRaw ? util.toDate(s.rcptStartRaw) : "",
        rcptEnd: s.rcptEndRaw ? util.toDate(s.rcptEndRaw) : "",
        url,
        img: "",
        lat: CITY_XY[0],
        lng: CITY_XY[1],
      });
    }

    return out;
  },
};
