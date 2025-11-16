// src/api/resultController.js
const jobService = require("../services/jobService");

async function handleGetResult(req, res, next) {
  try {
    const jobId = req.params.id;
    const jobWithEval = await jobService.getJobWithEvaluation(jobId);

    if (!jobWithEval) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const { job, evaluation } = jobWithEval;

    // Kalau job sudah selesai & ada evaluation
    if (job.status === "COMPLETED" && evaluation) {
      return res.json({
        success: true,
        id: job.id,
        status: job.status.toLowerCase(),
        result: {
          cv_match_rate: evaluation.cvMatchRate,
          cv_feedback: evaluation.cvFeedback,
          project_score: evaluation.projectScore,
          project_feedback: evaluation.projectFeedback,
          overall_summary: evaluation.overallSummary,
        },
      });
    }

    // QUEUED / PROCESSING / FAILED (belum ada evaluation final)
    return res.json({
      success: true,
      id: job.id,
      status: job.status.toLowerCase(),
    });
  } catch (err) {
    console.error("RESULT ERROR:", err);
    return next(err); // lempar ke global error handler
  }
}

module.exports = { handleGetResult };
