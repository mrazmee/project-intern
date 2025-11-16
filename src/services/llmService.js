// src/services/llmService.js
const { GoogleGenAI } = require("@google/genai");
const { findRubricsForCvAndProject } = require("./ragService");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!GEMINI_API_KEY) {
  console.warn("[llmService] GEMINI_API_KEY tidak diset, LLM tidak bisa dipakai.");
}

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

// ---------- helper: fallback heuristic kalau LLM gagal ----------
function heuristicFallback({ jobTitle, cvText, reportText }) {
  const cvLen = (cvText || "").length;
  const reportLen = (reportText || "").length;

  const cvMatchRate = cvLen > 0 ? 0.5 : 0.0;
  const projectScore = reportLen > 0 ? 2.5 : 0.0;

  return {
    cvMatchRate,
    cvFeedback:
      cvLen > 0
        ? "Automatic fallback: CV dinilai secara kasar berdasarkan panjang teks. Disarankan melakukan review manual."
        : "No CV text was provided. Please submit a CV for proper evaluation.",
    projectScore,
    projectFeedback:
      reportLen > 0
        ? "Automatic fallback: Project report dinilai secara kasar berdasarkan panjang teks. Disarankan melakukan review manual."
        : "No project report text was provided. Please submit a project report for proper evaluation.",
    overallSummary:
      "LLM evaluation failed or was unavailable. Sistem menggunakan heuristic sederhana berdasarkan panjang dokumen, sehingga keputusan rekrutmen sebaiknya tidak sepenuhnya bergantung pada skor ini.",
    usedFallback: true,
  };
}

// ---------- helper: build prompt ----------
function buildPrompt({ jobTitle, cvText, reportText, cvRubricsText, projectRubricsText }) {
  return `
You are an AI assistant that evaluates internship candidates based on their CV and project report.

Vacancy title: ${jobTitle || "-"}

=== EVALUATION RUBRICS FOR CV ===
${cvRubricsText || "(no specific CV rubrics, use general best practices: clarity of targeted role, structure, relevance, quantified impact, and technical skills)."}

=== EVALUATION RUBRICS FOR PROJECT REPORT ===
${projectRubricsText || "(no specific project rubrics, use general best practices: clarity of problem, methodology, technical depth, deployment details, results, and reflection on limitations)."}

=== CANDIDATE CV (RAW TEXT) ===
${cvText && cvText.trim().length > 0 ? cvText : "(no CV text provided)"}

=== CANDIDATE PROJECT REPORT (RAW TEXT) ===
${reportText && reportText.trim().length > 0 ? reportText : "(no project report text provided)"}

Task:
1. Evaluate how well the CV matches the vacancy (0.0–1.0).
2. Evaluate the project report quality on a 0.0–5.0 scale.
3. Give short, constructive feedback for CV and project.
4. Give a concise overall summary.

Return ONLY valid JSON. No explanation, no markdown, no backticks, no extra keys.
Use exactly this schema:

{
  "cvMatchRate": 0.0,
  "cvFeedback": "string",
  "projectScore": 0.0,
  "projectFeedback": "string",
  "overallSummary": "string"
}
`;
}

// ---------- helper: bersihin output JSON dari LLM ----------
function cleanJsonText(rawText) {
  if (!rawText) return "";

  let text = rawText.trim();

  // buang ```json ... ```
  if (text.startsWith("```")) {
    text = text.replace(/^```json/i, "").replace(/^```/i, "");
    text = text.replace(/```$/, "");
    text = text.trim();
  }

  return text;
}

// ---------- helper: panggil Gemini dengan retry ----------
async function callGeminiWithRetry(prompt, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await genAI.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });

      // SDK @google/genai punya response.text
      const rawText =
        response.text ||
        (response.response && typeof response.response.text === "function"
          ? await response.response.text()
          : "");

      return rawText;
    } catch (err) {
      lastError = err;

      // 503 / 429 -> bisa retry
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

// ---------- fungsi utama dipakai worker ----------
async function evaluateCandidate({ jobTitle, cvText, reportText }) {
  const cv = cvText || "";
  const project = reportText || "";

  // 1) Kalau nggak ada API key -> langsung fallback
  if (!GEMINI_API_KEY) {
    console.warn("[llmService] GEMINI_API_KEY tidak diset, pakai fallback heuristic.");
    return heuristicFallback({ jobTitle, cvText: cv, reportText: project });
  }

  // 2) Ambil rubrics dari RAG (Qdrant + embedding)
  let cvRubricsText = "";
  let projectRubricsText = "";

  try {
    const rag = await findRubricsForCvAndProject({
      cvText: cv,
      reportText: project,
    });

    cvRubricsText = rag.cvRubricsText || "";
    projectRubricsText = rag.projectRubricsText || "";

    console.log(
      `[llmService] RAG rubrics: cvLen=${cvRubricsText.length}, projectLen=${projectRubricsText.length}`
    );
  } catch (err) {
    console.warn("[llmService] Gagal mengambil rubrics dari RAG, lanjut tanpa rubrics spesifik:", err);
  }

  // 3) Build prompt lengkap
  const prompt = buildPrompt({
    jobTitle,
    cvText: cv,
    reportText: project,
    cvRubricsText,
    projectRubricsText,
  });

  // 4) Panggil LLM
  try {
    const rawText = await callGeminiWithRetry(prompt);
    const jsonString = cleanJsonText(rawText);

    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      console.warn("[llmService] Response bukan JSON valid, pakai fallback. Raw:", rawText);
      return heuristicFallback({ jobTitle, cvText: cv, reportText: project });
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
    return heuristicFallback({ jobTitle, cvText: cv, reportText: project });
  }
}

module.exports = {
  evaluateCandidate,
};
