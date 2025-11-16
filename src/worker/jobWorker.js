// src/worker/jobWorker.js
require("dotenv").config();

const fileService = require("../services/fileService");
const jobService = require("../services/jobService");
const evaluationService = require("../services/evaluationService");
const pdfService = require("../services/pdfService");
const llmService = require("../services/llmService");

async function processOneJob() {
  // cari job QUEUED berikutnya
  const job = await jobService.getNextQueuedJob();
  if (!job) {
    // tidak ada job, worker idle
    return;
  }

  console.log(`Processing job ${job.id} ...`);

  try {
    await jobService.markJobProcessing(job.id);

    // 1. ambil file CV & report dari DB
    const cvFile = await fileService.getFileById(job.cvFileId);
    const reportFile = await fileService.getFileById(job.reportFileId);

    // 2. parse PDF -> ambil teks
    const cvParsed = await pdfService.parsePdf(cvFile.path);
    const reportParsed = await pdfService.parsePdf(reportFile.path);

    const cvText = cvParsed.text || "";
    const reportText = reportParsed.text || "";

    console.log("CV text length:", cvText.length);
    console.log("Report text length:", reportText.length);

    // 3. panggil LLM (Gemini) untuk evaluasi (dengan RAG rubrics)
    const aiResult = await llmService.evaluateCandidate({
      jobTitle: job.title || job.position || job.role || null,
      cvText,       // ⬅️ kirim string langsung, bukan cvText.text
      reportText,   // ⬅️ sama
    });

    console.log(
      `AI result (job ${job.id}):`,
      JSON.stringify(aiResult, null, 2)
    );

    // 4. simpan hasil ke tabel Evaluation
    await evaluationService.createEvaluation(job.id, {
      cvMatchRate: aiResult.cvMatchRate,
      cvFeedback: aiResult.cvFeedback,
      projectScore: aiResult.projectScore,
      projectFeedback: aiResult.projectFeedback,
      overallSummary: aiResult.overallSummary,
    });

    // 5. tandai job completed
    await jobService.markJobCompleted(job.id);

    console.log(
      `Job ${job.id} completed. usedFallback=${aiResult.usedFallback}`
    );
  } catch (err) {
    console.error(`Job ${job.id} failed:`, err);
    await jobService.markJobFailed(job.id);
  }
}

async function startWorker() {
  console.log(
    "GEMINI_KEY_PREFIX:",
    (process.env.GEMINI_API_KEY || "").slice(0, 8)
  );
  console.log("Job worker started. Polling for jobs every 5 seconds...");

  setInterval(() => {
    processOneJob().catch((err) => {
      console.error("Worker error:", err);
    });
  }, 5000);
}

startWorker();
