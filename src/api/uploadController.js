const fileService = require("../services/fileService");

async function handleUpload(req, res) {
  try {
    const cvFile = req.files?.cv?.[0];
    const reportFile = req.files?.project_report?.[0];

    if (!cvFile || !reportFile) {
      return res
        .status(400)
        .json({ message: "cv and project_report are required" });
    }

    const cvId = await fileService.saveFile("CV", cvFile);
    const reportId = await fileService.saveFile("PROJECT_REPORT", reportFile);

    res.status(201).json({ cv_id: cvId, report_id: reportId });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { handleUpload };
