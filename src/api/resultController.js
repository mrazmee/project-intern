// src/api/resultController.js
const jobService = require("../services/jobService");

async function handleGetResult(req, res) {
  try {
    const jobId = req.params.id;
    const jobWithEval = await jobService.getJobWithEvaluation(jobId);

    if (!jobWithEval) {
      return res.status(404).json({ message: "Job not found" });
    }

    const { job, evaluation } = jobWithEval;

    if (job.status === "COMPLETED" && evaluation) {
      return res.json({
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

    // QUEUED / PROCESSING / FAILED
    return res.json({
      id: job.id,
      status: job.status.toLowerCase(),
    });
  } catch (err) {
    console.error("RESULT ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { handleGetResult };
