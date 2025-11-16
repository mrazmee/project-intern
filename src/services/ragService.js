// src/services/ragService.js
const { embedTexts } = require("./embeddingService");
const { searchRubrics } = require("./qdrantService");

/**
 * Ambil rubrik yang paling relevan dari Qdrant untuk CV & Project report.
 * Kalau Qdrant nggak balikin apa-apa, kita kasih rubrik default supaya LLM
 * tetap punya pegangan.
 *
 * @param {Object} params
 * @param {string} params.cvText
 * @param {string} params.reportText
 * @returns {Promise<{ cvRubricsText: string, projectRubricsText: string }>}
 */
async function findRubricsForCvAndProject({ cvText, reportText }) {
  const cv = cvText || "";
  const project = reportText || "";

  const textsToEmbed = [];
  const types = [];

  if (cv.trim().length > 0) {
    textsToEmbed.push(cv);
    types.push("cv_rubric");
  }

  if (project.trim().length > 0) {
    textsToEmbed.push(project);
    types.push("project_rubric");
  }

  // Kalau dua-duanya kosong, nggak usah ke embedding & Qdrant
  if (textsToEmbed.length === 0) {
    return { cvRubricsText: "", projectRubricsText: "" };
  }

  // Embed CV dan/atau project sekaligus
  const vectors = await embedTexts(textsToEmbed);

  let cvRubricsText = "";
  let projectRubricsText = "";

  let idx = 0;

  // --- RAG untuk CV ---
  if (cv.trim().length > 0) {
    const cvVector = vectors[idx++];
    const cvResults = await searchRubrics({
      queryVector: cvVector,
      limit: 3,
      type: "cv_rubric",
    });

    cvRubricsText = (cvResults || [])
      .map((hit) => hit.payload?.text)
      .filter(Boolean)
      .join("\n\n---\n\n");
  }

  // --- RAG untuk Project ---
  if (project.trim().length > 0) {
    const projectVector = vectors[idx++];
    const projectResults = await searchRubrics({
      queryVector: projectVector,
      limit: 3,
      type: "project_rubric",
    });

    projectRubricsText = (projectResults || [])
      .map((hit) => hit.payload?.text)
      .filter(Boolean)
      .join("\n\n---\n\n");
  }

  // Fallback kalau hasil search kosong
  if (!cvRubricsText) {
    cvRubricsText =
      "Evaluate the CV based on: clarity of targeted role, structure, relevance to the vacancy, quantified impact, and technical skills.";
  }

  if (!projectRubricsText) {
    projectRubricsText =
      "Evaluate the project report based on: clarity of problem statement, methodology, technical depth, deployment details, results, and reflection on limitations.";
  }

  console.log(
    `[ragService] RAG rubrics: cvLen=${cvRubricsText.length}, projectLen=${projectRubricsText.length}`
  );

  return { cvRubricsText, projectRubricsText };
}

module.exports = {
  findRubricsForCvAndProject,
};
