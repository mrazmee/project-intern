// src/scripts/testSingleEmbed.js
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

async function main() {
  const key = process.env.GEMINI_API_KEY;

  console.log("GEMINI_KEY_PREFIX:", (key || "").slice(0, 8));

  if (!key) {
    console.error("❌ GEMINI_API_KEY belum diset di .env");
    process.exit(1);
  }

  const genAI = new GoogleGenAI({ apiKey: key });

  try {
    const res = await genAI.models.embedContent({
      model: "models/text-embedding-004",
      contents: ["hello world"],        // 1 teks pendek
      taskType: "RETRIEVAL_DOCUMENT",   // bebas, cuma contoh
      outputDimensionality: 768,        // biar match EMBEDDING_DIM kita
    });

    // Struktur response embedContent di @google/genai:
    // res.embeddings[0].values -> array angka
    const first = res.embeddings?.[0];
    const len = first?.values?.length;

    console.log("✅ Embed sukses, panjang vektor:", len);
  } catch (err) {
    console.error("❌ Embed error RAW:", err);
    console.error("status:", err?.status);
    console.error("message:", err?.message);
    console.error("errorDetails:", err?.errorDetails);
  }
}

main();
