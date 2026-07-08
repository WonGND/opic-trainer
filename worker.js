/**
 * OPIc 작문 첨삭 Worker (Cloudflare Workers AI · 무료 · 별도 LLM 키 불필요)
 * --------------------------------------------------------------------
 * 배포: dash.cloudflare.com → Workers & Pages → opic-tutor → Edit code
 *  1) 편집기 안의 코드를 전부 지우고(Ctrl+A → Delete) 이 파일 내용을 통째로 붙여넣기
 *  2) Deploy
 *  3) Settings → Bindings → Add → "Workers AI" → Variable name = AI → 저장 → Deploy
 *  4) 주소(https://<이름>.<계정>.workers.dev)를 OPIc 앱 통계탭→설정에 등록
 *  ※ 무료 한도: 하루 10,000 뉴런. UTC 0시 초기화.
 */

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    // 프리플라이트
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // 어떤 오류가 나도 항상 CORS + JSON 으로 응답 (디버깅 쉽게)
    try {
      if (request.method !== "POST") return json({ error: "POST only" }, 405, cors);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: "잘못된 요청(JSON 아님)" }, 400, cors); }

      const prompt_ko = (body.prompt_ko || "").toString().slice(0, 500);
      const answer    = (body.answer || "").toString().slice(0, 1000);
      const model_ref = (body.model || "").toString().slice(0, 500);
      if (!answer.trim()) return json({ error: "빈 답안" }, 400, cors);

      if (!env.AI) return json({ error: "AI 바인딩 없음: Settings→Bindings에서 Workers AI를 변수명 AI로 추가 후 Deploy" }, 500, cors);

      const system = [
        "You are an English writing tutor for Korean learners preparing for the OPIc speaking test.",
        "The learner translated a Korean sentence into English.",
        "Reply with ONLY a single JSON object, no markdown, no extra text, using exactly these keys:",
        '"corrected": a natural, corrected English version of the learner\'s answer (string).',
        '"feedback": a short explanation IN KOREAN of the main mistakes and how to improve, 2-4 sentences (string).',
        '"score": an integer from 0 to 100 for grammatical accuracy and naturalness (number).',
      ].join("\n");
      const user = `Korean prompt: ${prompt_ko}\nLearner's English: ${answer}\nReference answer: ${model_ref}`;

      const r = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 512,
        temperature: 0.3,
      });
      const resp = r && r.response;
      let out;
      if (resp && typeof resp === "object") {
        // 모델이 이미 JSON 객체로 돌려준 경우 그대로 사용
        out = resp;
      } else {
        const raw = (resp == null ? "" : String(resp));   // 문자열 보장
        try { out = JSON.parse(extractJson(raw)); }
        catch { out = { corrected: "", feedback: raw.slice(0, 800), score: null }; }
      }

      return json(
        {
          corrected: out.corrected || "",
          feedback: out.feedback || out.comment || "",
          score: (typeof out.score === "number") ? Math.max(0, Math.min(100, Math.round(out.score))) : null,
        },
        200,
        cors
      );
    } catch (e) {
      return json({ error: "Worker 오류: " + (e && e.message || e) }, 500, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
function extractJson(s) {
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : s;
}
