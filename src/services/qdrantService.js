// src/services/qdrantService.js
const { QdrantClient } = require("@qdrant/js-client-rest");
const { EMBEDDING_DIM } = require("./embeddingService");

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || "rubrics";

// Guard log kalau env belum di-set
if (!QDRANT_URL) {
  console.warn("[qdrantService] QDRANT_URL is not set. Check your .env");
}
if (!QDRANT_API_KEY) {
  console.warn("[qdrantService] QDRANT_API_KEY is not set. Check your .env");
}

const qdrantClient = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

/**
 * Pastikan collection 'rubrics' ada.
 * Kalau belum ada -> create dengan vector dimensi EMBEDDING_DIM.
 * Sekalian pastikan index payload 'type' & 'slug' ada.
 */
async function ensureCollectionExists() {
  let exists = false;

  try {
    await qdrantClient.getCollection(COLLECTION_NAME);
    exists = true;
    console.log(
      `[qdrantService] Collection '${COLLECTION_NAME}' already exists.`
    );
  } catch (err) {
    if (err?.status === 404) {
      console.log(
        `[qdrantService] Creating collection '${COLLECTION_NAME}' ...`
      );
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: EMBEDDING_DIM,
          distance: "Cosine",
        },
      });
      exists = true;
      console.log("[qdrantService] Collection created.");
    } else {
      console.error(
        "[qdrantService] Failed to get/create collection:",
        err
      );
      throw err;
    }
  }

  if (!exists) return;

  // Pastikan payload index "type" ada
  try {
    await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
      field_name: "type",
      field_schema: "keyword",
    });
    console.log(
      "[qdrantService] Payload index for 'type' created (or ensured)."
    );
  } catch (err) {
    if (err?.status === 409) {
      console.log(
        "[qdrantService] Payload index for 'type' already exists."
      );
    } else {
      console.warn(
        "[qdrantService] Failed to create payload index for 'type':",
        err
      );
    }
  }

  // Optional: index untuk 'slug' juga
  try {
    await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
      field_name: "slug",
      field_schema: "keyword",
    });
    console.log(
      "[qdrantService] Payload index for 'slug' created (or ensured)."
    );
  } catch (err) {
    if (err?.status === 409) {
      console.log(
        "[qdrantService] Payload index for 'slug' already exists."
      );
    } else {
      console.warn(
        "[qdrantService] Failed to create payload index for 'slug':",
        err
      );
    }
  }
}

/**
 * Upsert dokumen ke Qdrant.
 * docs: array of { id?, vector, payload }
 * - id: optional, kalau nggak ada pakai index+1
 * - vector: number[EMBEDDING_DIM]
 * - payload: minimal { type, slug, text }
 */
async function upsertDocuments(docs) {
  if (!Array.isArray(docs) || docs.length === 0) {
    console.warn("[qdrantService] upsertDocuments called with empty docs.");
    return;
  }

  const points = docs.map((doc, index) => ({
    id: doc.id || index + 1,
    vector: doc.vector,
    payload: {
      ...doc.payload,
    },
  }));

  await qdrantClient.upsert(COLLECTION_NAME, {
    wait: true,
    points,
  });

  console.log(
    `[qdrantService] Upserted ${points.length} points into '${COLLECTION_NAME}'.`
  );
}

/**
 * Search rubrics berdasarkan embedding query.
 * - queryVector: array number
 * - limit: default 3
 * - type: optional filter, misalnya "cv_rubric" atau "project_rubric"
 */
async function searchRubrics({ queryVector, limit = 3, type }) {
  const searchRequest = {
    vector: queryVector,
    limit,
    with_payload: true,
  };

  if (type) {
    searchRequest.filter = {
      must: [
        {
          key: "type",
          match: { value: type },
        },
      ],
    };
  }

  const results = await qdrantClient.search(COLLECTION_NAME, searchRequest);
  return results;
}

module.exports = {
  ensureCollectionExists,
  upsertDocuments,
  searchRubrics,
  COLLECTION_NAME,
};
