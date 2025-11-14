// src/services/pdfService.js

const fs = require("fs");
const pdfParse = require("pdf-parse"); // pastikan versinya 1.x (misal: 1.1.1)

/**
 * Parse file PDF dan kembalikan teks + info dasar.
 * @param {string} filePath - path lengkap file PDF di filesystem
 * @returns {Promise<{ text: string, numPages: number, info: any, metadata: any }>}
 */
async function parsePdf(filePath) {
  // Baca file PDF ke dalam Buffer
  const dataBuffer = fs.readFileSync(filePath);

  // pdfParse (v1.x) adalah function → langsung dipanggil dengan buffer
  const data = await pdfParse(dataBuffer);

  // `data` biasanya berisi:
  // - data.text      → semua teks di PDF
  // - data.numpages  → jumlah halaman
  // - data.info      → metadata dokumen (Title, Author, dll)
  // - data.metadata  → metadata XMP (kalau ada)

  return {
    text: data.text || "",
    numPages: data.numpages || 0,
    info: data.info || {},
    metadata: data.metadata || null,
  };
}

module.exports = {
  parsePdf,
};
