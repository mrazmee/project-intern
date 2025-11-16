// src/api/evaluateController.js
const fileService = require("../services/fileService");
const jobService = require("../services/jobService");

async function handleEvaluate(req, res, next) {
  try {
    const { job_title, cv_id, report_id } = req.body;

    if (!job_title || !cv_id || !report_id) {
      return res.status(400).json({
        success: false,
        message: "job_title, cv_id, report_id are required",
      });
    }

    // cek file CV & report benar-benar ada
    await fileService.ensureFileExists(cv_id);
    await fileService.ensureFileExists(report_id);

    // buat job baru
    const job = await jobService.createJob(job_title, cv_id, report_id);

    return res.status(202).json({
      success: true,
      id: job.id,
      status: job.status.toLowerCase(),
    });
  } catch (err) {
    console.error("EVALUATE ERROR:", err);
    return next(err); // lempar ke global error handler
  }
}

module.exports = { handleEvaluate };
