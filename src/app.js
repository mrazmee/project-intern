// src/app.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadController = require("./api/uploadController");
const evaluateController = require("./api/evaluateController");
const resultController = require("./api/resultController");

const app = express();

app.use(express.json());

// === Multer setup ===
const uploadDir = path.join(process.cwd(), "uploads");
console.log("Upload directory (process.cwd):", uploadDir);

// pastikan folder uploads ADA, kalau belum -> buat
if (!fs.existsSync(uploadDir)) {
  console.log("Uploads directory not found, creating...");
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);

    // buang karakter aneh di nama file (emoji, dll)
    const original = file.originalname.normalize("NFKD").replace(/[^\w.\-]/g, "_");

    cb(null, unique + "-" + original);
  },
});


const upload = multer({ storage });

// === Routes ===
app.post(
  "/upload",
  upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "project_report", maxCount: 1 },
  ]),
  uploadController.handleUpload
);

app.post("/evaluate", evaluateController.handleEvaluate);
app.get("/result/:id", resultController.handleGetResult);

module.exports = app;
