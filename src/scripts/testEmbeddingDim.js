// src/scripts/testEmbeddingDim.js
require("dotenv").config();
const { embedTexts, EMBEDDING_DIM } = require("../services/embeddingService");

async function main() {
  try {
    const texts = ["tes dimensi embedding"];
    const vectors = await embedTexts(texts);

    if (!vectors.length) {
      console.log("Tidak ada embedding yang di-return.");
      return;
    }

    const vec = vectors[0];
    console.log("Configured EMBEDDING_DIM :", EMBEDDING_DIM);
    console.log("Actual embedding length  :", vec.length);

    if (vec.length === EMBEDDING_DIM) {
      console.log("✅ Dimensi sudah sesuai.");
    } else {
      console.log("⚠️ Dimensi TIDAK sesuai, cek lagi outputDimensionality di embeddingService.js");
    }
  } catch (err) {
    console.error("Error saat test embedding dim:", err);
  }
}

main();
