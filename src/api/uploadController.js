// src/api/uploadController.js
const fileService = require("../services/fileService");

async function handleUpload(req, res, next) {
  try {
    const cvFile = req.files?.cv?.[0];
    const reportFile = req.files?.project_report?.[0];

    if (!cvFile || !reportFile) {
      return res.status(400).json({
        success: false,
        message: "Both 'cv' and 'project_report' files are required.",
      });
    }

    const cvId = await fileService.saveFile("CV", cvFile);
    const reportId = await fileService.saveFile("PROJECT_REPORT", reportFile);

    return res.status(201).json({
      success: true,
      cv_id: cvId,
      report_id: reportId,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return next(err); // ← biar ditangani middleware global
  }
}

module.exports = { handleUpload };
