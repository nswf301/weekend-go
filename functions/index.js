/*
 * 키즈카페 남은 자리 중계 함수 (Firebase 프로젝트: weekend-go-1)
 *
 *   GET  /slots?date=2026-08-22            → 133곳 전부
 *   GET  /slots?date=2026-08-22&id=JG250701 → 한 곳만
 *
 * 화면(github.io)이 우리동네키움포털에 직접 물어보면 브라우저가 막기 때문에
 * 이 함수가 대신 물어보고 결과만 돌려준다. 읽기만 하고 아무것도 바꾸지 않는다.
 *
 * 배포:  firebase deploy --only functions --project weekend-go-1
 */

const { onRequest } = require("firebase-functions/v2/https");
const { collect } = require("./kidscafe");

/* 같은 날짜를 여러 사람이 봐도 남의 서버에는 5분에 한 번만 묻는다.
 * 함수가 잠들면 사라지는 기억이라 완벽하진 않지만, 이것만으로도 요청이 확 준다. */
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();   // key: "날짜|지점" → { at, data }

exports.slots = onRequest(
  {
    region: "asia-northeast3",   // 서울
    memory: "256MiB",
    timeoutSeconds: 120,         // 133곳을 열 곳씩 끊어 부르면 시간이 걸린다
    cors: true,                  // 화면에서 부를 수 있게 연다 (읽기 전용·공개 자료)
    maxInstances: 3,             // 실수로 폭주해도 남의 서버에 몰리지 않게
  },
  async (req, res) => {
    const date = String(req.query.date || "");
    const id = req.query.id ? String(req.query.id) : "";

    try {
      const key = `${date}|${id}`;
      const hit = cache.get(key);

      if (hit && Date.now() - hit.at < CACHE_MS) {
        res.set("Cache-Control", "public, max-age=120");
        return res.json({ ...hit.data, cached: true });
      }

      const data = await collect(date, id);
      cache.set(key, { at: Date.now(), data });

      res.set("Cache-Control", "public, max-age=120");
      return res.json(data);
    } catch (e) {
      // 실패해도 화면이 죽지 않게 뜻이 통하는 메시지를 준다
      return res.status(400).json({ error: String(e.message || e) });
    }
  }
);
