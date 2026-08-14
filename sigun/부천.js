/*
 * 경기 부천시 — 관람·체험 예약  (본보기 A에 가깝다: 목록 + 상세 열기)
 *
 *   목록  reserv.bucheon.go.kr/site/main/see/list?cp=<쪽>&pageSize=16&listType=list&viewMode=image
 *   상세  reserv.bucheon.go.kr/site/main/see/detail?program_seq=..&cp=..&pageSize=..&listType=list&viewMode=image
 *
 * /site/main/see/list 는 "관람/체험" 탭이고, 목록에 실제 프로그램 이름
 * (시민재난체험교실, 8월 자연생태공원 관람 등)이 바로 나온다 — 기관 목록이 아니다.
 * "기관별" 드롭다운(자연생태공원, 어린이건강체험관 ...)은 필터 옵션일 뿐 목록 자체는
 * 이미 프로그램 단위다.
 *
 * 목록의 <li class="li0N">에는 제목·상태·사진·동(洞) 정도만 있고 대상·장소·연락처는
 * 없다. 그래서 상세를 연다(남양주와 같은 이유). 접수상태가 `예약중`인 것만 남긴다.
 * 확인한 날은 21건 전체가 예약중이었다 — 마감이 하나도 없을 수도 있다는 뜻이다.
 *
 * 상세 페이지는 표 구조(체험장소·운영시간·유의사항·담당기관·연락처·주소)가 있고,
 * "유의사항" 칸의 <pre> 원문 안에 "◯◯대상 : ..." 줄이 섞여 있어 거기서 대상을 뽑는다.
 * 일부 프로그램(예: 시민재난체험교실)은 별도 소개 영역(div.txt-tit)에 "체험대상"·
 * "예약기간" 같은 줄이 한 칸씩 나뉘어 있어 그쪽도 같이 본다.
 * 예약기간이 뚜렷한 문장으로 나온 경우에만 rcptStart/rcptEnd를 채운다 — 나머지는
 * 목록에 없어 억지로 만들지 않는다(행사 start/end도 마찬가지).
 *
 * 새 시군을 붙이는 방법은 sigun/지침.md 를 보라.
 */

const AREA = "경기 부천시";
const BASE = "https://reserv.bucheon.go.kr";
const CITY_XY = [37.5035, 126.7660];   // 부천시청

async function getText(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": "weekend-go/1.0" } });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  return await res.text();
}

module.exports = {
  name: "부천시",
  area: AREA,

  async collect(util) {
    // 태그를 걷어내고 실체참조를 되돌린 뒤 공백을 한 칸으로 줄인다.
    const strip = (s) =>
      util.unent(String(s || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

    // 상세 표는 <th scope="row">항목</th><td ...>값</td> 꼴이다. td에 style
    // 속성이 붙기도 해서 [^>]*로 받는다.
    const field = (html, label) => {
      const m = html.match(
        new RegExp(`<th[^>]*>\\s*${label}\\s*</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`)
      );
      return m ? strip(m[1]) : "";
    };

    // "대상"이 들어간 줄을 찾아 라벨을 떼고 값만 돌려준다. 줄 배열을 받는다.
    const ageLabels = ["체험대상", "참여대상", "이용대상", "신청대상", "교육대상", "모집대상", "대상"];
    const findTarget = (lines) => {
      for (const raw of lines) {
        const line = raw.replace(/^[\s■○◯▶*\-·]+/, "").trim();
        for (const lab of ageLabels) {
          if (line.startsWith(lab)) {
            const rest = line.slice(lab.length).replace(/^\s*[:：]\s*/, "").trim();
            if (rest) return rest;
          }
        }
      }
      return "";
    };

    // "예약기간 : 2026. 6. 25. ~ 7. 23." 꼴에서 날짜 두 개를 뽑는다.
    // util.toDate는 "2026-08-14" 처럼 붙은 꼴을 가정해서, 점+공백이 섞인 이 사이트
    // 표기에는 안 맞아 따로 만든다.
    const periodLabels = ["예약기간", "신청기간", "접수기간", "모집기간"];
    const findPeriod = (lines) => {
      for (const raw of lines) {
        const line = raw.replace(/^[\s■○◯▶*\-·]+/, "").trim();
        for (const lab of periodLabels) {
          if (!line.startsWith(lab)) continue;
          const m = line.match(
            /(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})\s*\.?\s*~\s*(?:(\d{4})\s*[.\-\/]\s*)?(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/
          );
          if (m) {
            const pad = (n) => String(n).padStart(2, "0");
            const [, y1, mo1, d1, y2, mo2, d2] = m;
            return [`${y1}-${pad(mo1)}-${pad(d1)}`, `${y2 || y1}-${pad(mo2)}-${pad(d2)}`];
          }
        }
      }
      return ["", ""];
    };

    const out = [];

    // 첫 화면 확인 결과 총 21건, pageSize=16이 최대치라 그대로 두 쪽을 돈다.
    // 넉넉히 6쪽까지 돌되 항목이 안 나오면 멈춘다.
    for (let page = 1; page <= 6; page++) {
      const html = await getText(
        `${BASE}/site/main/see/list?cp=${page}&pageSize=16&listType=list&viewMode=image`,
        `부천 목록 ${page}쪽`
      );

      const blocks = html.match(/<li class="li0\d">[\s\S]*?<\/li>/g) || [];
      if (!blocks.length) break;

      for (const b of blocks) {
        const status = strip((b.match(/<span class="area[^"]*">([\s\S]*?)<\/span>/) || [])[1] || "");
        if (status !== "예약중") continue;      // 접수중인 것만 남긴다

        const title = strip((b.match(/<span class="tit">([\s\S]*?)<\/span>/) || [])[1] || "");
        if (!title) continue;

        const hrefRaw = (b.match(/<a href="([^"]+)"/) || [])[1] || "";
        const href = util.unent(hrefRaw);
        const url = href ? BASE + href : "";

        const dong = strip((b.match(/<em class="dong">([\s\S]*?)<\/em>/) || [])[1] || "");

        // 썸네일 파일명이 비어 있으면(".../uu/") onerror로 대체 이미지가 뜰 뿐이니
        // 없는 것으로 본다.
        const hasThumb = (src) => /\/uu\/[0-9a-f]+$/i.test(src || "");
        const imgSrcRaw = (b.match(/<img src="([^"]*)"/) || [])[1] || "";
        const imgSrc = imgSrcRaw ? util.unent(imgSrcRaw) : "";
        let img = hasThumb(imgSrc) ? (/^https?:/.test(imgSrc) ? imgSrc : BASE + imgSrc) : "";

        // 상세를 연다 — 대상·장소·연락처·예약기간이 목록에는 없다.
        let target = "", place = "", tel = "", rcptStart = "", rcptEnd = "";
        if (url) {
          try {
            const d = await getText(url, `부천 상세`);

            const dept = field(d, "담당기관");
            const spot = field(d, "체험장소");

            const addrRaw = field(d, "주소").replace(/^\d{5}\s*\/\s*/, "");
            const addr = addrRaw.replace(/지도보기\s*$/, "").trim();

            place = dept
              ? (addr ? `${dept} (${addr})` : dept)
              : (addr || spot || dong);

            tel = field(d, "연락처");

            // 유의사항 <pre> 원문 줄과, 소개 영역(div/p.txt-tit) 줄을 모두 모은다.
            const preRaw = (d.match(/<pre>([\s\S]*?)<\/pre>/) || [])[1] || "";
            const preLines = util.unent(preRaw).split("\n");

            const introLines = [];
            const introRe = /<(?:div|p) class="txt-tit"[^>]*>([\s\S]*?)<\/(?:div|p)>/g;
            let im;
            while ((im = introRe.exec(d))) introLines.push(strip(im[1]));

            const lines = [...preLines, ...introLines];

            target = findTarget(lines);
            [rcptStart, rcptEnd] = findPeriod(lines);

            if (!img) {
              const dImgRaw = (d.match(/<div class="lf-img">[\s\S]*?<img src="([^"]*)"/) || [])[1] || "";
              const dImg = dImgRaw ? util.unent(dImgRaw) : "";
              if (hasThumb(dImg)) img = /^https?:/.test(dImg) ? dImg : BASE + dImg;
            }
          } catch (e) {
            console.warn(`  ! 부천 상세 실패: ${title} (${e.message})`);
          }
        }

        const age = util.ageRange(target);
        const [lat, lng] = CITY_XY;

        out.push({
          kind: "reserve",
          group: "체험·견학",
          title,
          // 지역 이름은 다른 자료와 같은 꼴이라야 화면의 지역 필터가 맞는다
          area: AREA,
          place,
          target,                                // 원문 그대로
          ageMin: age ? age[0] : null,
          ageMax: age ? age[1] : null,
          status,
          start: "",                             // 목록·상세 어디에도 뚜렷한 행사기간이 없다
          end: "",
          rcptStart,
          rcptEnd,
          url,
          img,
          tel,
          lat, lng,
        });
      }

      if (blocks.length < 16) break;              // 마지막 쪽이었다
    }

    return out;
  },
};
