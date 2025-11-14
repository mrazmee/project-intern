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
      // Hari 1: belum ada evaluation, ini nanti diisi Hari 2/3
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

    return res.json({
      id: job.id,
      status: job.status.toLowerCase(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { handleGetResult };
