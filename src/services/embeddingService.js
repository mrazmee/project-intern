// src/services/embeddingService.js
require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Dimensi embedding yang dipakai di Qdrant
const EMBEDDING_DIM = 768;

// Nama model embedding Gemini
const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

if (!GEMINI_API_KEY) {
  console.warn(
    "[embeddingService] GEMINI_API_KEY tidak diset. Embedding akan gagal."
  );
}

const genAI = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

/**
 * Embed banyak teks sekaligus.
 * @param {string[]} texts
 * @returns {Promise<number[][]>} array of vectors, masing-masing panjang EMBEDDING_DIM
 */
async function embedTexts(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const ai = genAI;

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    taskType: "RETRIEVAL_DOCUMENT",
    // minta 768 dim, tapi Gemini kadang tetap kirim 3072 → akan kita crop
    outputDimensionality: EMBEDDING_DIM,
  });

  // SDK baru: response.embeddings = [{ values: [...] }, ...]
  let vectors = response.embeddings.map((e) => e.values);

  const sample = vectors[0] || [];
  if (sample.length !== EMBEDDING_DIM) {
    if (process.env.DEBUG_EMBED) {
      console.warn(
        `[embeddingService] Unexpected embedding dim, sample length: ${sample.length} expected: ${EMBEDDING_DIM} – cropping locally.`
      );
    }

    // Crop prefix supaya cocok dengan Qdrant (Matryoshka-friendly)
    vectors = vectors.map((v) => v.slice(0, EMBEDDING_DIM));
  }

  return vectors;
}

/**
 * Helper untuk satu teks saja.
 */
async function embedText(text) {
  const [vec] = await embedTexts([text]);
  return vec;
}

module.exports = {
  EMBEDDING_DIM,
  embedTexts,
  embedText,
};
