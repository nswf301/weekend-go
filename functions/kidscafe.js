/*
 * 서울형 키즈카페 남은 자리 읽기 (순수 Node — firebase 없이도 돌아간다)
 *
 * 우리동네키움포털 예약 달력이 쓰는 통로를 그대로 부른다. 로그인이 필요 없고
 * 회차별 정원·예약인원이 그대로 온다. 화면에서 직접 부르지 못하는 이유는
 * 그 서버가 다른 사이트의 요청을 막기 때문(CORS)이고, 그래서 이 함수가 대신 묻는다.
 *
 * 확인한 규칙 (2026-08-15)
 *   q_dayNo 는 일=1 … 토=7. 날짜와 요일이 안 맞으면 회차가 0개로 온다.
 *   휴관일은 회차가 1개 오되 시각이 null이다 — 자리 없음으로 본다.
 *   남은 자리 = resvePsncpa(정원) - resveNmpr(예약됨). 괄호로 보이는 돌봄은 따로 온다.
 */

const EP = "https://umppa.seoul.go.kr/icare/user/kidsCafeResve/ND_selectResveTmeList.do";
const LIST_URL = "https://nswf301.github.io/weekend-go/data.json";

const HEADERS = {
  "User-Agent": "weekend-go/1.0",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "X-Requested-With": "XMLHttpRequest",
  "Referer": "https://umppa.seoul.go.kr/icare/user/kidsCafeResve/BD_selectKidsCafeResveCal.do",
};

/* ── 지점 목록 ──────────────────────────────────────────────
 * data.json의 kidscafe를 그대로 쓴다. 여기에 목록을 또 적어두면 두 벌이 되어
 * 지점이 늘거나 빠질 때 한쪽만 고쳐진다. 30분 동안 기억해둔다. */
let listCache = { at: 0, rows: [] };

async function loadPlaces() {
  if (Date.now() - listCache.at < 30 * 60 * 1000 && listCache.rows.length) return listCache.rows;

  const res = await fetch(LIST_URL, { headers: { "User-Agent": "weekend-go/1.0" } });
  if (!res.ok) throw new Error(`목록 받기 실패: HTTP ${res.status}`);
  const data = await res.json();

  const rows = (data.kidscafe || [])
    .map((k) => {
      const id = (String(k.url || "").match(/q_fcltyId=([A-Za-z0-9]+)/) || [])[1];
      return id ? { id, name: k.name, area: k.area, place: k.place, url: k.url } : null;
    })
    .filter(Boolean);   // 우리동네키움포털이 아닌 한 건은 여기서 빠진다

  listCache = { at: Date.now(), rows };
  return rows;
}

/* ── 한 지점의 하루 ── */
async function fetchSlots(id, date, dayNo) {
  const body = new URLSearchParams({ q_fcltyId: id, q_resveDe: date, q_dayNo: String(dayNo) });
  const res = await fetch(EP, { method: "POST", headers: HEADERS, body });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const j = await res.json();
  const rows = (j && j.value && j.value.tmeData) || [];

  return rows
    .filter((t) => t.useBeginTime && t.useEndTime)     // 휴관일은 시각이 null이다
    .map((t) => {
      const hhmm = (v) => `${String(v).slice(0, 2)}:${String(v).slice(2, 4)}`;
      const left = Math.max(0, Number(t.resvePsncpa || 0) - Number(t.resveNmpr || 0));
      const care = Math.max(0, Number(t.dolbomPsncpa || 0) - Number(t.dolbomNmpr || 0));
      return {
        begin: hhmm(t.useBeginTime),
        end: hhmm(t.useEndTime),
        cap: Number(t.resvePsncpa || 0),
        left,                                          // 남은 자리
        care,                                          // 돌봄 자리 (화면의 괄호 숫자)
        kind: t.tmeSeNm || "",                         // 개인 / 공용 등
      };
    });
}

/* ── 여럿을 한꺼번에 ──────────────────────────────────────
 * 남의 서버라 한 번에 다 던지지 않는다. 열 곳씩 끊어 부르고 사이를 조금 쉰다.
 * 한 곳이 실패해도 나머지는 살린다(그 지점만 error로 표시). */
async function fetchMany(places, date, dayNo, { batch = 10, gapMs = 120 } = {}) {
  const out = [];
  for (let i = 0; i < places.length; i += batch) {
    const chunk = places.slice(i, i + batch);
    const done = await Promise.all(chunk.map(async (p) => {
      try {
        const slots = await fetchSlots(p.id, date, dayNo);
        return { ...p, slots, left: slots.reduce((s, t) => s + t.left, 0) };
      } catch (e) {
        return { ...p, slots: [], left: 0, error: String(e.message || e) };
      }
    }));
    out.push(...done);
    if (i + batch < places.length) await new Promise((r) => setTimeout(r, gapMs));
  }
  return out;
}

/* ── 바깥에서 부르는 것 ── */
/* 서버가 어느 나라 시각을 쓰든 같은 요일이 나오게 UTC로 고정해 센다.
 * (예전에 +09:00 + getDay()를 썼는데, Firebase 서버가 UTC라 토요일이 금요일로 밀렸다) */
const dayNoOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay() + 1;   // 일=1 … 토=7

async function collect(date, onlyId) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) throw new Error("날짜는 2026-08-22 꼴이라야 합니다");

  const all = await loadPlaces();
  const places = onlyId ? all.filter((p) => p.id === onlyId) : all;
  if (!places.length) throw new Error("그런 지점이 없습니다");

  const dayNo = dayNoOf(date);
  const rows = await fetchMany(places, date, dayNo);

  // 자리 많은 곳 → 자치구 → 이름 순
  rows.sort((a, b) => b.left - a.left ||
    (a.area || "").localeCompare(b.area || "", "ko") ||
    (a.name || "").localeCompare(b.name || "", "ko"));

  return {
    date,
    dayNo,
    checkedAt: new Date().toISOString(),
    total: rows.length,
    open: rows.filter((r) => r.left > 0).length,
    places: rows,
  };
}

module.exports = { collect, loadPlaces, fetchSlots, dayNoOf };
