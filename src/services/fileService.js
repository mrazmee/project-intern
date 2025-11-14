// src/services/fileService.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function saveFile(type, file) {
  const saved = await prisma.file.create({
    data: {
      type,          // "CV" atau "PROJECT_REPORT"
      path: file.path,
    },
  });
  return saved.id;
}

// dipakai di /evaluate untuk memastikan file ada
async function ensureFileExists(id) {
  const file = await prisma.file.findUnique({
    where: { id: Number(id) },
  });

  if (!file) {
    const err = new Error("File not found");
    err.code = "FILE_NOT_FOUND";
    throw err;
  }

  return file;
}

// nanti dipakai worker untuk ambil path file
async function getFileById(id) {
  return prisma.file.findUnique({
    where: { id: Number(id) },
  });
}

module.exports = {
  saveFile,
  ensureFileExists,
  getFileById,
};
