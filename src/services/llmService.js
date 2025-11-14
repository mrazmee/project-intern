// src/services/llmService.js
const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

// ---------- helper: build prompt ----------
function buildPrompt({ jobTitle, cvText, reportText }) {
  return `
You are an ATS-like evaluator for internship candidates.

Vacancy title: ${jobTitle || "-"}

=== CV TEXT (raw) ===
${cvText}

=== PROJECT REPORT TEXT (raw) ===
${reportText}

Task:
1. Evaluate how well the CV matches the job title (0–1).
2. Evaluate the project report quality on a 1–5 scale.
3. Give short, constructive feedback for CV and project.
4. Give a concise overall summary.

Return ONLY valid JSON with this exact schema.
Do NOT wrap it in Markdown or code fences.

{
  "cvMatchRate": 0.0-1.0 (number),
  "cvFeedback": "string",
  "projectScore": 0.0-5.0 (number),
  "projectFeedback": "string",
  "overallSummary": "string"
}
`;
}

// ---------- heuristic fallback (kalau LLM error) ----------
function heuristicFallback({ jobTitle, cvText, reportText }) {
  const cvLen = cvText ? cvText.length : 0;
  const reportLen = reportText ? reportText.length : 0;

  const cvMatchRate = Math.max(0.2, Math.min(0.9, cvLen / 8000));
  const projectScore = Math.max(1, Math.min(5, reportLen / 1500));

  return {
    cvMatchRate,
    cvFeedback:
      "Automatic fallback evaluation: CV terlihat cukup relevan, namun penilaian ini tidak berasal dari model LLM karena terjadi kegagalan saat memanggil API.",
    projectScore,
    projectFeedback:
      "Automatic fallback evaluation: Project report dinilai berdasarkan panjang dan struktur dasar teks. Disarankan untuk melakukan review manual.",
    overallSummary:
      "Sistem gagal memanggil LLM dan menggunakan heuristic fallback. Untuk keputusan rekrutmen sebaiknya dilakukan penilaian manual tambahan.",
    usedFallback: true,
  };
}

// ---------- helper: panggil Gemini dengan retry ----------
async function callGeminiWithRetry(prompt, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await genAI.models.generateContent({
        model: MODEL_NAME,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });
      return response;
    } catch (err) {
      lastError = err;

      if ((err.status === 503 || err.status === 429) && attempt < maxRetries) {
        const delayMs = 1000 * attempt; // 1s, 2s, 3s
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

// ---------- helper: ambil teks dari response Gemini ----------
function extractTextFromResponse(response) {
  if (typeof response.text === "string") {
    return response.text;
  }

  const parts =
    response.candidates?.[0]?.content?.parts ||
    response.output?.[0]?.content?.parts ||
    [];

  const text = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("\n")
    .trim();

  return text;
}

// ---------- helper: bersihkan markdown & ambil JSON murni ----------
function extractJsonString(rawText) {
  if (!rawText) return "";

  let txt = rawText.trim();

  // kalau dibungkus ```json ... ```
  if (txt.startsWith("```")) {
    // buang baris pertama ```json / ```lang
    txt = txt.replace(/^```[a-zA-Z0-9_-]*\s*/i, "");
    // buang ``` terakhir
    txt = txt.replace(/```$/i, "").trim();
  }

  // jaga-jaga kalau masih ada teks lain di luar { ... }
  const firstBrace = txt.indexOf("{");
  const lastBrace = txt.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    txt = txt.slice(firstBrace, lastBrace + 1);
  }

  return txt.trim();
}

// ---------- fungsi utama ----------
async function evaluateCandidate({ jobTitle, cvText, reportText }) {
  const prompt = buildPrompt({ jobTitle, cvText, reportText });

  if (!GEMINI_API_KEY) {
    console.warn("[llmService] GEMINI_API_KEY tidak diset, pakai fallback.");
    return heuristicFallback({ jobTitle, cvText, reportText });
  }

  try {
    const response = await callGeminiWithRetry(prompt);
    const rawText = extractTextFromResponse(response);

    if (!rawText) {
      console.warn("[llmService] Response kosong, pakai fallback.");
      return heuristicFallback({ jobTitle, cvText, reportText });
    }

    const jsonString = extractJsonString(rawText);

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      console.warn(
        "[llmService] Response bukan JSON valid, pakai fallback. Raw:",
        rawText
      );
      return heuristicFallback({ jobTitle, cvText, reportText });
    }

    return {
      cvMatchRate: Number(parsed.cvMatchRate) || 0,
      cvFeedback: parsed.cvFeedback || "",
      projectScore: Number(parsed.projectScore) || 0,
      projectFeedback: parsed.projectFeedback || "",
      overallSummary: parsed.overallSummary || "",
      usedFallback: false,
    };
  } catch (err) {
    console.error("[llmService] LLM call failed, using fallback:", err);
    return heuristicFallback({ jobTitle, cvText, reportText });
  }
}

module.exports = {
  evaluateCandidate,
};
