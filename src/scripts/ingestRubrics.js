// src/scripts/ingestRubrics.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const { embedTexts } = require("../services/embeddingService");
const {
  ensureCollectionExists,
  upsertDocuments,
} = require("../services/qdrantService");

// ------- helper: baca file rubrik dan pecah per blok -------
// Format file (contoh):
// ---
// teks rubrik 1
// ---
// teks rubrik 2
// ...
function loadRubricsFromFile(filePath, type) {
  const raw = fs.readFileSync(filePath, "utf8");

  // pecah pakai delimiter --- di awal baris
  const parts = raw
    .split(/^-{3,}\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return parts.map((text, idx) => ({
    id: randomUUID(),     // id unik untuk Qdrant
    type,                 // "cv_rubric" atau "project_rubric"
    text,
  }));
}

async function main() {
  // 1) pastikan collection & index "type" sudah ada
  await ensureCollectionExists();

  // 2) baca rubrik dari file
  const dataDir = path.join(__dirname, "..", "..", "data");

  const cvFile = path.join(dataDir, "cv_rubrics.txt");
  const projectFile = path.join(dataDir, "project_rubrics.txt");

  const cvRubrics = loadRubricsFromFile(cvFile, "cv_rubric");
  const projectRubrics = loadRubricsFromFile(
    projectFile,
    "project_rubric"
  );

  const allDocs = [...cvRubrics, ...projectRubrics];

  console.log(
    `[ingestRubrics] Total rubrics: CV=${cvRubrics.length}, Project=${projectRubrics.length}, Total=${allDocs.length}`
  );

  if (allDocs.length === 0) {
    console.warn("[ingestRubrics] Tidak ada rubrik untuk diingest.");
    return;
  }

  // 3) embedding + upsert ke Qdrant dalam batch
  const BATCH_SIZE = 50;

  for (let start = 0; start < allDocs.length; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE, allDocs.length);
    const batch = allDocs.slice(start, end);

    console.log(`[ingestRubrics] Embedding batch ${start}..${end - 1}`);

    const texts = batch.map((d) => d.text);
    const vectors = await embedTexts(texts); // -> array of number[]

    const docsForUpsert = batch.map((doc, idx) => ({
      id: doc.id,
      vector: vectors[idx],
      payload: {
        type: doc.type,
        text: doc.text,
      },
    }));

    await upsertDocuments(docsForUpsert);
  }

  console.log("[ingestRubrics] Ingestion selesai.");
}

main().catch((err) => {
  console.error("Ingestion error:", err);
  process.exit(1);
});
