// src/api/evaluateController.js
const fileService = require("../services/fileService");
const jobService = require("../services/jobService");

async function handleEvaluate(req, res) {
  try {
    const { job_title, cv_id, report_id } = req.body;

    if (!job_title || !cv_id || !report_id) {
      return res
        .status(400)
        .json({ message: "job_title, cv_id, report_id are required" });
    }

    await fileService.ensureFileExists(cv_id);
    await fileService.ensureFileExists(report_id);

    const job = await jobService.createJob(job_title, cv_id, report_id);

    res.status(202).json({
      id: job.id,
      status: job.status.toLowerCase(),
    });
  } catch (err) {
    console.error("EVALUATE ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { handleEvaluate };
